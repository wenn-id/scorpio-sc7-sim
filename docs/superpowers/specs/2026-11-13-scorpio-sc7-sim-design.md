# Scorpio SC-7 3D CAD Robotics Field Simulator — Design Specification

**Date:** 2026-11-13  
**Project Directory:** `C:\Users\acer\.gemini\antigravity\scratch\scorpio-sc7-sim`  
**Output Video:** `output/scorpio-sc7-sim-1080p60.mp4` (`1920×1080`, `60 fps`, `15.0s` / `900` frames, seamless 360° orbit loop)

---

## 1. Overview & Aesthetic Goals

Build a live, interactive WebGL 3D CAD robotics field simulator featuring the articulated robotic scorpion **Scorpio SC-7** standing in the center of an infinite warm light-beige studio cyclorama floor, paired with a deterministic headless Chromium + FFmpeg capture pipeline to produce a frame-accurate 1080p60 screen recording.

### Visual Direction
- **Studio Environment:** Seamless warm light-beige studio floor (`#e6ddd0` transitioning smoothly into `#ddd1bf` radial gradient and matched horizon fog) with a procedural softbox `PMREMGenerator` environment dome, diffused studio key/fill/rim lights, soft PCF shadow map, and soft radial contact-shadow decals under each foot pad and the main chassis belly.
- **Scorpio SC-7 Craftsmanship:**
  - **Matte Off-White Ceramic Armor Plates:** Chamfered beveled shell plates (`MeshPhysicalMaterial`, subtle surface grain micro-texture, high diffuse clarity, restrained specular clearcoat).
  - **Exposed Dark Titanium Joints:** Brushed dark gunmetal titanium frame, multi-axis servo gimbals, and bolted structural brackets.
  - **Hydraulic Pistons:** Two-piece telescopic actuators (dark anodized cylinder + high-gloss chrome rod) anchored dynamically to joint sockets on the legs, tail segments, and pincers.
  - **Safety-Orange Accent Stripes:** Subtle industrial safety-orange (`#ea5b1b`) trim stripes, recessed joint markings, and crisp `SC-7` stencil decals.
- **Full-Bleed CAD Edge HUD:** Semi-transparent dark-grey (`rgba(28, 30, 34, 0.78)` with `backdrop-filter: blur(8px)`) telemetry panels hugging the edges of the `1920×1080` viewport while leaving the central studio view unobstructed.

---

## 2. Architecture & Module Boundaries

```text
scorpio-sc7-sim/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                      # App entry: live rAF loop vs ?record=1 deterministic hooks
│   ├── sim/
│   │   ├── types.ts                 # Pose, joint angles, TelemetrySnapshot, SimMode types
│   │   ├── ik.ts                    # Analytical 2-link leg IK + piston alignment math
│   │   └── simulation.ts            # Pure deterministic 15s harmonic diagnostic solver
│   ├── scene/
│   │   ├── materials.ts             # Procedural canvas textures + shared PBR materials
│   │   ├── studioEnvironment.ts     # Infinite studio floor, softbox PMREM, lights, contact shadows
│   │   ├── scorpioModel.ts          # Hierarchical Scorpio SC-7 assembly + pose updater
│   │   └── viewport.ts              # WebGLRenderer, PerspectiveCamera, OrbitControls, wireframe toggle
│   └── hud/
│       ├── hud.css                  # Edge-anchored translucent dark-grey technical HUD layout
│       └── TelemetryHud.ts          # Oscillating canvas graphs, SVG radial gauges, servo bars, status LEDs
├── tests/
│   └── simulation.test.ts           # Vitest suite for periodic continuity, IK bounds, piston guards
└── scripts/
    └── record.mjs                   # Vite preview + Playwright Chrome 1920x1080 + FFmpeg H.264 pipeline
```

### Key Responsibilities
- `src/sim/simulation.ts`: Pure function `evaluateSimulation(timeSec, mode)` with no DOM or Three.js side effects. Uses integer harmonics over `CYCLE_SECONDS = 15` (`ω = 2π / 15`) so `evaluateSimulation(0)` and `evaluateSimulation(15)` produce identical poses, camera angles, waveform phases, and servo readouts.
- `src/sim/ik.ts`: Computes hip yaw, femur pitch, and tibia pitch for each of the 8 legs so foot pads stay planted at `y = 0` while the chassis shifts weight subtly; includes length clamping and fallback guards against near-zero vectors.
- `src/scene/scorpioModel.ts`: Constructs modular groups (main thorax/head carapace with sensor optics, 8 legs `L1..L4` & `R1..R4`, dual 4-DOF pincers with opposing articulated jaws, 6-segment dorsal tail + calibration stinger) and exposes `applyPose(pose)` + `setWireframeOverlay(enabled)`. Updates every hydraulic piston cylinder/rod orientation via `lookAt`/quaternion socket alignment each frame.
- `src/hud/TelemetryHud.ts`: Renders live telemetry from `TelemetrySnapshot`:
  - **Top-Left Panel:** Unit badge (`SCORPIO SC-7 // FIELD SIMULATOR`), glowing green `ONLINE` indicator with realistic micro-flicker, glowing orange `OPERATION: STANDBY` badge, and live system clock/cycle counter.
  - **Top-Right Panel:** Orbit telemetry (azimuth°, elevation°, radial distance, FPS/frame index) + compact live-mode interactive controls (`Pause Orbit`, `Mode: Idle / Pincer / Calibrate`, `CAD Wireframe`, `Reset View`) hidden automatically when `?record=1`.
  - **Left Edge Panel:** Real-time oscillating multi-trace `<canvas>` line charts (`HYDRAULIC LINE PSI`, `TAIL GYRO DRIFT`, `SERVO BUS LOAD`) + 2 SVG radial gauges (`MAIN TORQUE`, `SYSTEM PRESSURE`).
  - **Right Edge Panel:** Live percentage bars (`0–100%`) for leg clusters (`L1–L4`, `R1–R4`), tail actuators (`T1–T6`), and pincer grippers (`CLAW-L`, `CLAW-R`), flickering subtly in lockstep with actuator velocity.

---

## 3. Data Flow & Modes

1. **Live Interactive Mode (default `http://localhost:.../`):**
   - `requestAnimationFrame` advances `simTime` smoothly.
   - `OrbitControls` allows dragging/zooming at any time; interacting automatically pauses auto-orbit until the user clicks `Resume Orbit`.
   - Mode buttons let the user inspect **Idle Diagnostic**, **Pincer Calibration**, or **Tail Sweep**, or toggle a subtle **CAD Wireframe** edge overlay on the ceramic plates.
2. **Deterministic Capture Mode (`?record=1`):**
   - Hides interactive control buttons (keeping the pure edge telemetry HUD).
   - Disables `OrbitControls` damping interference and locks viewport to `1920×1080`.
   - Exposes `window.__simReady` (resolved once procedural textures, PMREM lighting, and initial frame finish) and `window.__renderFrame(frameIndex, totalFrames)` where `t = (frameIndex / totalFrames) * 15`.

---

## 4. Recording Pipeline (`scripts/record.mjs`)

1. Runs `vite build` so `dist/` always reflects current source files.
2. Starts `npx vite preview --host 127.0.0.1 --port <port>` and waits for HTTP readiness.
3. Launches local Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) via `playwright-core` with `viewport: { width: 1920, height: 1080 }`, `deviceScaleFactor: 1`, and GPU/ANGLE WebGL enabled.
4. Opens `http://127.0.0.1:<port>/?record=1` and waits for `window.__simReady === true`.
5. Spawns `ffmpeg`:
   ```text
   ffmpeg -y -f image2pipe -vcodec png -framerate 60 -i - \
     -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow -movflags +faststart \
     output/scorpio-sc7-sim-1080p60.mp4
   ```
6. Loops `frame = 0..899`, invokes `window.__renderFrame(frame, 900)`, waits one browser paint tick, captures lossless PNG buffer, and writes to `ffmpeg.stdin` respecting Node stream `drain` backpressure.
7. Closes `ffmpeg`, checks exit code `0`, validates metadata via `ffprobe` (`1920×1080`, `60 fps`, `900` frames), and cleans up child processes in `try/finally`.

---

## 5. Error Handling & Testing

- **WebGL Context Failure:** If `WebGLRenderer` fails to initialize, display an explicit technical diagnostic overlay instead of a blank screen and fail fast in capture mode.
- **Math & IK Safety:** Analytical IK clamps target reach strictly within `[minReach, maxReach]` (`1e-4` epsilon guards) so pistons and joints never produce `NaN` transforms.
- **Automated Tests (`tests/simulation.test.ts`):**
  - Loop continuity: verify `evaluateSimulation(0)` equals `evaluateSimulation(15)` across camera, chassis, tail, pincer, foot positions, and telemetry fields.
  - Bounds & finiteness: sample 300 points across `[0, 15)` and assert all IK angles, piston lengths, and servo percentages (`0..100`) are finite and within mechanical limits.
- **End-to-End Verification:**
  - Run `npm test` and `npm run build`.
  - Run `npm run record` to produce `output/scorpio-sc7-sim-1080p60.mp4`, confirm `ffprobe` stream dimensions/fps/duration, and inspect extracted keyframe PNGs (`0s`, `3.75s`, `7.5s`, `11.25s`) visually.
