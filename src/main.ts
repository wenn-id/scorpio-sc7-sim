import './hud/hud.css';
import { TelemetryHud } from './hud/TelemetryHud.ts';
import { createScorpioMaterials } from './scene/materials.ts';
import { createScorpioRig } from './scene/scorpioModel.ts';
import { createStudioEnvironment } from './scene/studioEnvironment.ts';
import { createViewport } from './scene/viewport.ts';
import { evaluateSimulation } from './sim/simulation.ts';
import { CYCLE_SECONDS, type SimMode } from './sim/types.ts';

declare global {
  interface Window {
    __simReady?: boolean;
    __renderFrame?: (frameIndex: number, totalFrames: number) => void;
  }
}

function bootstrap(): void {
  const params = new URLSearchParams(window.location.search);
  const isRecordMode = params.get('record') === '1';

  const viewportRoot = document.getElementById('viewport-root')!;
  const hudRoot = document.getElementById('hud-root')!;

  let orbitPaused = false;
  let wireframeOn = false;
  let activeMode: SimMode = 'idle';
  let simTime = 0;

  let viewport: ReturnType<typeof createViewport>;
  try {
    viewport = createViewport(viewportRoot, {
      fixedWidth: isRecordMode ? 1920 : undefined,
      fixedHeight: isRecordMode ? 1080 : undefined,
      interactive: !isRecordMode,
      onUserOrbit: () => {
        orbitPaused = true;
      }
    });
  } catch (err) {
    hudRoot.innerHTML = `<div class="error-banner"><strong>WEBGL CONTEXT ERROR</strong><br/><br/>${
      err instanceof Error ? err.message : String(err)
    }</div>`;
    return;
  }

  const materials = createScorpioMaterials();
  const studio = createStudioEnvironment(viewport.scene, viewport.renderer);
  const rig = createScorpioRig(materials, studio.contactShadowTex);
  viewport.scene.add(rig.root);

  const hud = new TelemetryHud(hudRoot, isRecordMode, {
    onToggleOrbit: () => {
      orbitPaused = !orbitPaused;
    },
    onChangeMode: (mode) => {
      activeMode = mode;
    },
    onToggleWireframe: () => {
      wireframeOn = !wireframeOn;
      rig.setWireframeOverlay(wireframeOn);
    },
    onResetCamera: () => {
      orbitPaused = false;
      viewport.resetUserCamera();
    }
  });

  function renderAtTime(t: number, forceOrbitCam: boolean): void {
    const state = evaluateSimulation(t, activeMode);
    rig.applyState(state);
    if (forceOrbitCam || !orbitPaused) {
      viewport.setOrbitCamera(state.cameraAzimuth, state.cameraElevation, state.cameraDistance);
    }
    viewport.renderFrame();
    hud.update(state, orbitPaused, wireframeOn);
  }

  // Initial synchronous frame compiles shaders and prepares textures before signaling ready
  renderAtTime(0, true);

  if (isRecordMode) {
    window.__renderFrame = (frameIndex: number, totalFrames: number) => {
      const t = (frameIndex / totalFrames) * CYCLE_SECONDS;
      renderAtTime(t, true);
    };
    window.__simReady = true;
    return;
  }

  let lastMs = performance.now();
  const tick = (nowMs: number) => {
    const dt = Math.min((nowMs - lastMs) / 1000, 0.1);
    lastMs = nowMs;
    simTime = (simTime + dt) % CYCLE_SECONDS;
    renderAtTime(simTime, false);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

bootstrap();
