import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const OUTPUT_MP4 = path.join(OUTPUT_DIR, 'scorpio-sc7-sim-1080p60.mp4');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TOTAL_FRAMES = 900;
const FPS = 60;
const PORT = 4173;

function runSyncOrThrow(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT_DIR, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // retry until preview server is listening
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for Vite preview server at ${url}`);
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome not found at ${CHROME_PATH}`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('[record] Building production bundle...');
  const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  runSyncOrThrow(process.execPath, [viteBin, 'build']);

  console.log('[record] Starting vite preview server...');
  const previewProc = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT_DIR, stdio: 'pipe' }
  );

  let browser;
  let ffmpegProc;

  try {
    const baseUrl = `http://127.0.0.1:${PORT}/?record=1`;
    await waitForServer(baseUrl);

    console.log('[record] Launching headless Chrome (1920x1080)...');
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--window-size=1920,1080'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => {
      throw new Error(`Browser page error: ${err.message}`);
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__simReady === true, { timeout: 20000 });

    const glInfo = await page.evaluate(() => {
      const c = document.querySelector('#viewport-root canvas');
      const gl = c ? c.getContext('webgl2') || c.getContext('webgl') : null;
      if (!gl) return 'unknown';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    console.log(`[record] WebGL renderer: ${glInfo}`);

    console.log('[record] Spawning FFmpeg H.264 encoder...');
    ffmpegProc = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel', 'warning',
        '-f', 'image2pipe',
        '-vcodec', 'png',
        '-framerate', String(FPS),
        '-i', '-',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '16',
        '-preset', 'slow',
        '-movflags', '+faststart',
        OUTPUT_MP4
      ],
      { cwd: ROOT_DIR, stdio: ['pipe', 'inherit', 'inherit'] }
    );

    const ffmpegDone = once(ffmpegProc, 'close');

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      await page.evaluate(
        ({ f, total }) => {
          window.__renderFrame(f, total);
          return new Promise((resolve) => requestAnimationFrame(() => resolve()));
        },
        { f: frame, total: TOTAL_FRAMES }
      );

      const png = await page.screenshot({ type: 'png' });
      const ok = ffmpegProc.stdin.write(png);
      if (!ok) {
        await once(ffmpegProc.stdin, 'drain');
      }

      if ((frame + 1) % 150 === 0 || frame === TOTAL_FRAMES - 1) {
        console.log(`[record] Captured frame ${frame + 1}/${TOTAL_FRAMES}`);
      }
    }

    ffmpegProc.stdin.end();
    const [exitCode] = await ffmpegDone;
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    console.log(`[record] Export complete: ${OUTPUT_MP4}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (previewProc && !previewProc.killed) previewProc.kill();
    if (ffmpegProc && ffmpegProc.exitCode === null) ffmpegProc.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
