# Scorpio SC-7 3D CAD Robotics Field Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive 3D WebGL CAD field simulator for the robotic scorpion **Scorpio SC-7** on an infinite warm light-beige studio floor with an overlaid semi-transparent dark-grey edge telemetry HUD, and export a seamless 15-second `1920×1080 @ 60fps` MP4 screen recording (`900` frames).

**Architecture:** A pure TypeScript kinematic simulation engine (`src/sim/`) drives both a hierarchical Three.js PBR studio rig (`src/scene/`) and an edge-anchored HTML/Canvas/SVG telemetry HUD (`src/hud/`) from a periodic `15.0s` harmonic clock. Live browsing runs via `requestAnimationFrame` with interactive `OrbitControls` and mode toggles, while `?record=1` exposes deterministic frame stepping to a Playwright/Chrome + FFmpeg capture script (`scripts/record.mjs`).

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, Playwright Core (local Google Chrome), FFmpeg (`libx264`).

**Spec:** [2026-11-13-scorpio-sc7-sim-design.md](file:///C:/Users/acer/.gemini/antigravity/scratch/scorpio-sc7-sim/docs/superpowers/specs/2026-11-13-scorpio-sc7-sim-design.md)

## Global Constraints

- Project directory: `C:\Users\acer\.gemini\antigravity\scratch\scorpio-sc7-sim`.
- Studio aesthetic: infinite warm light-beige studio floor (`#e6ddd0` / `#ddd1bf`), soft diffused lighting, realistic studio contact shadows, zero visible floor horizon seam.
- Scorpio SC-7 materials: matte off-white ceramic armor plates, exposed dark titanium joints, telescopic hydraulic pistons, subtle safety-orange accent stripes.
- Animations in default diagnostic stance: smoothly orbiting camera (`360°` over `15.0s`), subtle tail sway and calibration, slight pincer opening/closing, subtle hydraulic leg weight adjustment with grounded foot pads (`y = 0`).
- HUD aesthetic: crisp semi-transparent dark-grey industrial sci-fi HUD anchored on screen edges only (`ONLINE` glowing green indicator, `OPERATION: STANDBY` glowing orange indicator with subtle live flicker, oscillating line graphs, radial gauges, servo percentage bars).
- Recorded video specification: `1920×1080`, `60 fps`, `15.0s` (`900` frames), seamless loop, H.264 `yuv420p`, saved to `output/scorpio-sc7-sim-1080p60.mp4`.

---

### Task 1: Project Scaffolding & Deterministic Kinematics / IK Core

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `src/sim/types.ts`
- Create: `src/sim/ik.ts`
- Create: `src/sim/simulation.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Produces:
  - `export const CYCLE_SECONDS = 15;`
  - `export type SimMode = 'idle' | 'pincer' | 'calibrate';`
  - `export interface Vec3 { x: number; y: number; z: number; }`
  - `export interface LegMount { id: string; label: string; side: -1 | 1; hipLocal: Vec3; footRestWorld: Vec3; }`
  - `export interface LegPose { id: string; hipWorld: Vec3; footWorld: Vec3; coxaYaw: number; femurPitch: number; tibiaPitch: number; kneeWorld: Vec3; loadPct: number; }`
  - `export interface PincerPose { side: -1 | 1; shoulderYaw: number; shoulderPitch: number; elbowPitch: number; wristRoll: number; jawOpenAngle: number; loadPct: number; }`
  - `export interface TailSegmentPose { index: number; pitch: number; yaw: number; roll: number; loadPct: number; }`
  - `export interface SimulationState { timeSec: number; normalizedPhase: number; mode: SimMode; chassisOffset: Vec3; chassisRotation: Vec3; cameraAzimuth: number; cameraElevation: number; cameraDistance: number; legs: LegPose[]; pincers: [PincerPose, PincerPose]; tailSegments: TailSegmentPose[]; stingerPitch: number; stingerYaw: number; telemetry: TelemetrySnapshot; }`
  - `export interface TelemetrySnapshot { timeSec: number; cycleProgressPct: number; hydraulicPsi: number; mainTorquePct: number; busVoltage: number; gyroDriftDeg: number; opticTempC: number; onlineFlicker: number; standbyFlicker: number; graphSamples: { hydraulic: number[]; gyro: number[]; busLoad: number[]; }; servos: Array<{ id: string; label: string; pct: number; group: 'leg' | 'tail' | 'claw'; }>; }`
  - `export const LEG_MOUNTS: LegMount[];`
  - `export const FEMUR_LENGTH = 0.72;`
  - `export const TIBIA_LENGTH = 0.84;`
  - `export const ANKLE_HEIGHT = 0.08;`
  - `export function solveLegIK(hipWorld: Vec3, ankleTargetWorld: Vec3, femurLen?: number, tibiaLen?: number): { coxaYaw: number; femurPitch: number; tibiaPitch: number; kneeWorld: Vec3; clampedDist: number; };`
  - `export function forwardKinematicsAnkle(hipWorld: Vec3, coxaYaw: number, femurPitch: number, tibiaPitch: number, femurLen?: number, tibiaLen?: number): Vec3;`
  - `export function evaluateSimulation(timeSec: number, mode?: SimMode): SimulationState;`

- [ ] **Step 1: Initialize project configuration files and install dependencies**

Create `.gitignore`:
```gitignore
node_modules/
dist/
output/
*.log
```

Create `package.json`:
```json
{
  "name": "scorpio-sc7-sim",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "record": "node scripts/record.mjs"
  },
  "dependencies": {
    "three": "^0.174.0"
  },
  "devDependencies": {
    "@types/three": "^0.174.0",
    "playwright-core": "^1.51.1",
    "typescript": "^5.8.2",
    "vite": "^6.2.2",
    "vitest": "^3.0.9"
  }
}
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

Create `vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  build: {
    target: 'es2022',
    sourcemap: false
  }
});
```

Run `npm install` inside `C:\Users\acer\.gemini\antigravity\scratch\scorpio-sc7-sim` and verify dependencies install cleanly.

- [ ] **Step 2: Write `src/sim/types.ts` and failing tests in `tests/simulation.test.ts`**

Create `src/sim/types.ts`:
```ts
export const CYCLE_SECONDS = 15;
export const FEMUR_LENGTH = 0.72;
export const TIBIA_LENGTH = 0.84;
export const ANKLE_HEIGHT = 0.08;

export type SimMode = 'idle' | 'pincer' | 'calibrate';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LegMount {
  id: string;
  label: string;
  side: -1 | 1;
  hipLocal: Vec3;
  footRestWorld: Vec3;
}

export interface LegPose {
  id: string;
  hipWorld: Vec3;
  footWorld: Vec3;
  coxaYaw: number;
  femurPitch: number;
  tibiaPitch: number;
  kneeWorld: Vec3;
  loadPct: number;
}

export interface PincerPose {
  side: -1 | 1;
  shoulderYaw: number;
  shoulderPitch: number;
  elbowPitch: number;
  wristRoll: number;
  jawOpenAngle: number;
  loadPct: number;
}

export interface TailSegmentPose {
  index: number;
  pitch: number;
  yaw: number;
  roll: number;
  loadPct: number;
}

export interface TelemetrySnapshot {
  timeSec: number;
  cycleProgressPct: number;
  hydraulicPsi: number;
  mainTorquePct: number;
  busVoltage: number;
  gyroDriftDeg: number;
  opticTempC: number;
  onlineFlicker: number;
  standbyFlicker: number;
  graphSamples: {
    hydraulic: number[];
    gyro: number[];
    busLoad: number[];
  };
  servos: Array<{
    id: string;
    label: string;
    pct: number;
    group: 'leg' | 'tail' | 'claw';
  }>;
}

export interface SimulationState {
  timeSec: number;
  normalizedPhase: number;
  mode: SimMode;
  chassisOffset: Vec3;
  chassisRotation: Vec3;
  cameraAzimuth: number;
  cameraElevation: number;
  cameraDistance: number;
  legs: LegPose[];
  pincers: [PincerPose, PincerPose];
  tailSegments: TailSegmentPose[];
  stingerPitch: number;
  stingerYaw: number;
  telemetry: TelemetrySnapshot;
}
```

Create `tests/simulation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  ANKLE_HEIGHT,
  CYCLE_SECONDS,
  FEMUR_LENGTH,
  TIBIA_LENGTH
} from '../src/sim/types.ts';
import { forwardKinematicsAnkle, solveLegIK } from '../src/sim/ik.ts';
import { evaluateSimulation } from '../src/sim/simulation.ts';

describe('Scorpio SC-7 IK Solver', () => {
  it('reaches ankle target accurately with knee elevated above hip and ankle', () => {
    const hip = { x: 0.46, y: 0.47, z: 0.2 };
    const ankle = { x: 1.38, y: ANKLE_HEIGHT, z: 0.34 };

    const ik = solveLegIK(hip, ankle, FEMUR_LENGTH, TIBIA_LENGTH);
    const fkAnkle = forwardKinematicsAnkle(
      hip,
      ik.coxaYaw,
      ik.femurPitch,
      ik.tibiaPitch,
      FEMUR_LENGTH,
      TIBIA_LENGTH
    );

    expect(fkAnkle.x).toBeCloseTo(ankle.x, 4);
    expect(fkAnkle.y).toBeCloseTo(ankle.y, 4);
    expect(fkAnkle.z).toBeCloseTo(ankle.z, 4);
    expect(ik.kneeWorld.y).toBeGreaterThan(hip.y);
    expect(ik.kneeWorld.y).toBeGreaterThan(ankle.y);
  });

  it('clamps unreachable targets cleanly without producing NaN', () => {
    const hip = { x: 0, y: 0.5, z: 0 };
    const farAnkle = { x: 5, y: 0.08, z: 0 };
    const ik = solveLegIK(hip, farAnkle, FEMUR_LENGTH, TIBIA_LENGTH);

    expect(Number.isFinite(ik.coxaYaw)).toBe(true);
    expect(Number.isFinite(ik.femurPitch)).toBe(true);
    expect(Number.isFinite(ik.tibiaPitch)).toBe(true);
    expect(ik.clampedDist).toBeLessThanOrEqual(FEMUR_LENGTH + TIBIA_LENGTH);
  });
});

describe('Scorpio SC-7 Periodic Simulation Loop', () => {
  it('loops seamlessly between t=0 and t=CYCLE_SECONDS', () => {
    const start = evaluateSimulation(0, 'idle');
    const end = evaluateSimulation(CYCLE_SECONDS, 'idle');

    expect(end.chassisOffset.x).toBeCloseTo(start.chassisOffset.x, 6);
    expect(end.chassisOffset.y).toBeCloseTo(start.chassisOffset.y, 6);
    expect(end.chassisOffset.z).toBeCloseTo(start.chassisOffset.z, 6);
    expect(end.cameraAzimuth - start.cameraAzimuth).toBeCloseTo(Math.PI * 2, 6);
    expect(end.telemetry.hydraulicPsi).toBeCloseTo(start.telemetry.hydraulicPsi, 5);
    expect(end.pincers[0].jawOpenAngle).toBeCloseTo(start.pincers[0].jawOpenAngle, 6);
    expect(end.tailSegments[3].yaw).toBeCloseTo(start.tailSegments[3].yaw, 6);
  });

  it('keeps all 8 feet grounded and servo loads bounded across 300 cycle samples', () => {
    for (let i = 0; i < 300; i++) {
      const t = (i / 300) * CYCLE_SECONDS;
      const state = evaluateSimulation(t, 'idle');

      expect(state.legs).toHaveLength(8);
      for (const leg of state.legs) {
        expect(leg.footWorld.y).toBeCloseTo(0, 6);
        expect(Number.isFinite(leg.femurPitch)).toBe(true);
        expect(Number.isFinite(leg.tibiaPitch)).toBe(true);
        expect(leg.loadPct).toBeGreaterThanOrEqual(0);
        expect(leg.loadPct).toBeLessThanOrEqual(100);
      }

      for (const servo of state.telemetry.servos) {
        expect(servo.pct).toBeGreaterThanOrEqual(0);
        expect(servo.pct).toBeLessThanOrEqual(100);
      }
    }
  });
});
```

- [ ] **Step 3: Run test to verify failure before implementation**

Run: `npx vitest run`  
Expected: FAIL because `src/sim/ik.ts` and `src/sim/simulation.ts` do not exist yet.

- [ ] **Step 4: Implement `src/sim/ik.ts` and `src/sim/simulation.ts`**

Create `src/sim/ik.ts`:
```ts
import { FEMUR_LENGTH, TIBIA_LENGTH, type Vec3 } from './types.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface LegIKResult {
  coxaYaw: number;
  femurPitch: number;
  tibiaPitch: number;
  kneeWorld: Vec3;
  clampedDist: number;
}

/**
 * Analytical 2-link leg IK with upward arachnid knee configuration.
 * Local leg frame convention (matching Three.js right-handed rotation.y then rotation.x):
 *   +Z rotated by coxaYaw around +Y points horizontally toward the foot in XZ.
 *   In that vertical leg plane, positive elevation above horizon maps to rotation.x = -elev.
 */
export function solveLegIK(
  hipWorld: Vec3,
  ankleTargetWorld: Vec3,
  femurLen: number = FEMUR_LENGTH,
  tibiaLen: number = TIBIA_LENGTH
): LegIKResult {
  const dx = ankleTargetWorld.x - hipWorld.x;
  const dz = ankleTargetWorld.z - hipWorld.z;
  const dy = ankleTargetWorld.y - hipWorld.y;

  const horiz = Math.hypot(dx, dz);
  const coxaYaw = horiz > 1e-6 ? Math.atan2(dx, dz) : 0;

  const minReach = Math.abs(femurLen - tibiaLen) + 0.04;
  const maxReach = femurLen + tibiaLen - 0.04;
  const rawDist = Math.hypot(horiz, dy);
  const d = clamp(rawDist, minReach, maxReach);

  const scale = rawDist > 1e-6 ? d / rawDist : 1;
  const effHoriz = horiz * scale;
  const effDy = dy * scale;

  const baseAngle = Math.atan2(effDy, effHoriz);
  const cosAlpha = clamp(
    (femurLen * femurLen + d * d - tibiaLen * tibiaLen) / (2 * femurLen * d),
    -1,
    1
  );
  const alpha = Math.acos(cosAlpha);

  // Knee-up solution: femur rises above the hip->ankle chord
  const femurElev = baseAngle + alpha;
  const kneeR = femurLen * Math.cos(femurElev);
  const kneeY = femurLen * Math.sin(femurElev);

  const tibiaWorldElev = Math.atan2(effDy - kneeY, effHoriz - kneeR);
  const tibiaRelElev = tibiaWorldElev - femurElev;

  const dirX = Math.sin(coxaYaw);
  const dirZ = Math.cos(coxaYaw);

  const kneeWorld: Vec3 = {
    x: hipWorld.x + dirX * kneeR,
    y: hipWorld.y + kneeY,
    z: hipWorld.z + dirZ * kneeR
  };

  return {
    coxaYaw,
    femurPitch: -femurElev,
    tibiaPitch: -tibiaRelElev,
    kneeWorld,
    clampedDist: d
  };
}

export function forwardKinematicsAnkle(
  hipWorld: Vec3,
  coxaYaw: number,
  femurPitch: number,
  tibiaPitch: number,
  femurLen: number = FEMUR_LENGTH,
  tibiaLen: number = TIBIA_LENGTH
): Vec3 {
  const femurElev = -femurPitch;
  const tibiaWorldElev = -(femurPitch + tibiaPitch);
  const totalR = femurLen * Math.cos(femurElev) + tibiaLen * Math.cos(tibiaWorldElev);
  const totalY = femurLen * Math.sin(femurElev) + tibiaLen * Math.sin(tibiaWorldElev);

  return {
    x: hipWorld.x + Math.sin(coxaYaw) * totalR,
    y: hipWorld.y + totalY,
    z: hipWorld.z + Math.cos(coxaYaw) * totalR
  };
}
```

Create `src/sim/simulation.ts`:
```ts
import { solveLegIK } from './ik.ts';
import {
  ANKLE_HEIGHT,
  CYCLE_SECONDS,
  type LegMount,
  type LegPose,
  type PincerPose,
  type SimMode,
  type SimulationState,
  type TailSegmentPose,
  type TelemetrySnapshot,
  type Vec3
} from './types.ts';

export const CHASSIS_BASE_Y = 0.52;

export const LEG_MOUNTS: LegMount[] = [
  { id: 'L1', label: 'LEG L1', side: -1, hipLocal: { x: -0.42, y: -0.05, z: 0.56 }, footRestWorld: { x: -1.18, y: 0, z: 0.92 } },
  { id: 'L2', label: 'LEG L2', side: -1, hipLocal: { x: -0.46, y: -0.05, z: 0.20 }, footRestWorld: { x: -1.38, y: 0, z: 0.34 } },
  { id: 'L3', label: 'LEG L3', side: -1, hipLocal: { x: -0.46, y: -0.05, z: -0.18 }, footRestWorld: { x: -1.36, y: 0, z: -0.34 } },
  { id: 'L4', label: 'LEG L4', side: -1, hipLocal: { x: -0.42, y: -0.05, z: -0.54 }, footRestWorld: { x: -1.14, y: 0, z: -0.96 } },
  { id: 'R1', label: 'LEG R1', side: 1, hipLocal: { x: 0.42, y: -0.05, z: 0.56 }, footRestWorld: { x: 1.18, y: 0, z: 0.92 } },
  { id: 'R2', label: 'LEG R2', side: 1, hipLocal: { x: 0.46, y: -0.05, z: 0.20 }, footRestWorld: { x: 1.38, y: 0, z: 0.34 } },
  { id: 'R3', label: 'LEG R3', side: 1, hipLocal: { x: 0.46, y: -0.05, z: -0.18 }, footRestWorld: { x: 1.36, y: 0, z: -0.34 } },
  { id: 'R4', label: 'LEG R4', side: 1, hipLocal: { x: 0.42, y: -0.05, z: -0.54 }, footRestWorld: { x: 1.14, y: 0, z: -0.96 } }
];

function wrapTime(timeSec: number): number {
  const m = timeSec % CYCLE_SECONDS;
  return m < 0 ? m + CYCLE_SECONDS : m;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function transformLocal(p: Vec3, offset: Vec3, rot: Vec3): Vec3 {
  // Small-angle Euler XYZ approximation matches Three.js hierarchy cleanly for subtle diagnostic stance
  const cy = Math.cos(rot.y);
  const sy = Math.sin(rot.y);
  const cx = Math.cos(rot.x);
  const sx = Math.sin(rot.x);
  const cz = Math.cos(rot.z);
  const sz = Math.sin(rot.z);

  const x1 = p.x * cz - p.y * sz;
  const y1 = p.x * sz + p.y * cz;
  const z1 = p.z;

  const y2 = y1 * cx - z1 * sx;
  const z2 = y1 * sx + z1 * cx;

  const x3 = x1 * cy + z2 * sy;
  const z3 = -x1 * sy + z2 * cy;

  return {
    x: x3 + offset.x,
    y: y2 + CHASSIS_BASE_Y + offset.y,
    z: z3 + offset.z
  };
}

function buildGraphTraces(phase: number, mode: SimMode): { hydraulic: number[]; gyro: number[]; busLoad: number[] } {
  const N = 64;
  const hydraulic: number[] = [];
  const gyro: number[] = [];
  const busLoad: number[] = [];
  const modeAmp = mode === 'pincer' ? 1.25 : mode === 'calibrate' ? 1.35 : 1.0;

  for (let i = 0; i < N; i++) {
    const p = phase - ((N - 1 - i) / N) * 0.24;
    const w = p * Math.PI * 2;
    const h = 0.5 + 0.24 * Math.sin(w * 2) + 0.12 * Math.sin(w * 5 + 0.6) + 0.05 * Math.cos(w * 9);
    const g = 0.5 + 0.26 * Math.sin(w * 3 + 0.8) * modeAmp + 0.1 * Math.cos(w * 7);
    const b = 0.46 + 0.2 * Math.sin(w * 4 - 0.3) + 0.11 * Math.sin(w * 11 + 1.1);
    hydraulic.push(clamp(h, 0.08, 0.94));
    gyro.push(clamp(g, 0.08, 0.94));
    busLoad.push(clamp(b, 0.08, 0.94));
  }
  return { hydraulic, gyro, busLoad };
}

export function evaluateSimulation(timeSec: number, mode: SimMode = 'idle'): SimulationState {
  const t = wrapTime(timeSec);
  const phase = t / CYCLE_SECONDS;
  const w = phase * Math.PI * 2;

  const swayAmp = mode === 'calibrate' ? 1.35 : 1.0;
  const chassisOffset: Vec3 = {
    x: 0.036 * swayAmp * Math.sin(w * 2) + 0.012 * Math.sin(w * 4 + 0.5),
    y: 0.022 * Math.sin(w * 3 - 0.4) + 0.008 * Math.cos(w * 6),
    z: 0.028 * swayAmp * Math.cos(w * 2 + 0.3)
  };

  const chassisRotation: Vec3 = {
    x: 0.024 * Math.sin(w * 3 + 0.6),
    y: 0.018 * Math.sin(w * 2 - 0.2),
    z: -0.028 * swayAmp * Math.sin(w * 2)
  };

  const legs: LegPose[] = LEG_MOUNTS.map((mount, idx) => {
    const hipWorld = transformLocal(mount.hipLocal, chassisOffset, chassisRotation);
    const ankleTarget: Vec3 = {
      x: mount.footRestWorld.x,
      y: ANKLE_HEIGHT,
      z: mount.footRestWorld.z
    };
    const ik = solveLegIK(hipWorld, ankleTarget);
    const lateralShift = chassisOffset.x * mount.side;
    const baseLoad = 48 + idx % 2 * 6 + lateralShift * 280;
    const dynamicPulse = 7 * Math.sin(w * 4 + idx * 0.78);
    return {
      id: mount.id,
      hipWorld,
      footWorld: { ...mount.footRestWorld },
      coxaYaw: ik.coxaYaw,
      femurPitch: ik.femurPitch,
      tibiaPitch: ik.tibiaPitch,
      kneeWorld: ik.kneeWorld,
      loadPct: clamp(baseLoad + dynamicPulse, 18, 92)
    };
  });

  const pincerBoost = mode === 'pincer' ? 1.85 : 1.0;
  const pincers: [PincerPose, PincerPose] = ([-1, 1] as const).map((side, idx) => {
    const phaseShift = idx === 0 ? 0 : 0.85;
    const jawOsc = 0.5 + 0.5 * Math.sin(w * 3 + phaseShift);
    const jawOpenAngle = 0.14 + 0.22 * pincerBoost * jawOsc;
    return {
      side,
      shoulderYaw: side * (0.28 + 0.055 * pincerBoost * Math.sin(w * 2 + phaseShift)),
      shoulderPitch: -0.14 + 0.045 * Math.sin(w * 3 + idx * 1.1),
      elbowPitch: 0.42 + 0.07 * pincerBoost * Math.cos(w * 2 + idx * 0.5),
      wristRoll: side * (0.18 + 0.09 * Math.sin(w * 3 + phaseShift)),
      jawOpenAngle,
      loadPct: clamp(36 + 24 * jawOsc * (mode === 'pincer' ? 1.25 : 1.0), 15, 95)
    };
  }) as [PincerPose, PincerPose];

  const tailBoost = mode === 'calibrate' ? 1.65 : 1.0;
  const tailBaseCurve = [-0.42, -0.44, -0.40, -0.34, -0.26, 0.42];
  const tailSegments: TailSegmentPose[] = tailBaseCurve.map((basePitch, i) => {
    const segRatio = (i + 1) / 6;
    const pitch = basePitch + (0.045 * tailBoost) * Math.sin(w * 3 - i * 0.45);
    const yaw = (0.065 * tailBoost) * segRatio * Math.sin(w * 2 - i * 0.35);
    const roll = (0.025 * tailBoost) * Math.cos(w * 2 - i * 0.4);
    const loadPct = clamp(42 + i * 4.5 + 14 * Math.abs(Math.sin(w * 3 - i * 0.45)) * tailBoost, 20, 96);
    return { index: i, pitch, yaw, roll, loadPct };
  });

  const stingerPitch = 0.52 + 0.14 * tailBoost * Math.sin(w * 4 + 0.4);
  const stingerYaw = 0.12 * tailBoost * Math.sin(w * 5 - 0.3);

  const cameraAzimuth = w + 0.65;
  const cameraElevation = 0.36 + 0.045 * Math.sin(w * 2);
  const cameraDistance = 4.35 + 0.12 * Math.cos(w * 2);

  const telemetry: TelemetrySnapshot = {
    timeSec: t,
    cycleProgressPct: phase * 100,
    hydraulicPsi: 2840 + 135 * Math.sin(w * 3) + 42 * Math.cos(w * 7),
    mainTorquePct: clamp(61 + 14 * Math.sin(w * 2 + 0.4) + 6 * Math.sin(w * 6), 20, 96),
    busVoltage: 47.8 + 0.45 * Math.sin(w * 5),
    gyroDriftDeg: 0.12 * Math.sin(w * 3 + 0.8) * tailBoost,
    opticTempC: 36.4 + 0.8 * Math.sin(w * 2),
    onlineFlicker: 0.92 + 0.08 * Math.sin(w * 19 + 0.3),
    standbyFlicker: 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(w * 11)),
    graphSamples: buildGraphTraces(phase, mode),
    servos: [
      ...legs.slice(0, 4).map((l, idx) => ({ id: l.id, label: `LEG-L${idx + 1}`, pct: l.loadPct, group: 'leg' as const })),
      ...legs.slice(4, 8).map((l, idx) => ({ id: l.id, label: `LEG-R${idx + 1}`, pct: l.loadPct, group: 'leg' as const })),
      ...tailSegments.map((s) => ({ id: `T${s.index + 1}`, label: `TAIL-T${s.index + 1}`, pct: s.loadPct, group: 'tail' as const })),
      { id: 'CLAW-L', label: 'CLAW-L', pct: pincers[0].loadPct, group: 'claw' as const },
      { id: 'CLAW-R', label: 'CLAW-R', pct: pincers[1].loadPct, group: 'claw' as const }
    ]
  };

  return {
    timeSec: t,
    normalizedPhase: phase,
    mode,
    chassisOffset,
    chassisRotation,
    cameraAzimuth,
    cameraElevation,
    cameraDistance,
    legs,
    pincers,
    tailSegments,
    stingerPitch,
    stingerYaw,
    telemetry
  };
}
```

- [ ] **Step 5: Run Vitest to confirm all kinematics tests pass, then commit**

Run: `npx vitest run`  
Expected: PASS (4/4 tests passing).

```bash
git add package.json tsconfig.json vite.config.ts .gitignore src/sim/ tests/simulation.test.ts
git commit -m "feat: scaffold project and deterministic Scorpio SC-7 IK simulation"
```

---

### Task 2: Studio Environment & Procedural PBR Material Library

**Files:**
- Create: `src/scene/materials.ts`
- Create: `src/scene/studioEnvironment.ts`

**Interfaces:**
- Consumes: `THREE` (`three`)
- Produces:
  - `export interface ScorpioMaterials { ceramicArmor: THREE.MeshPhysicalMaterial; ceramicDarkTrim: THREE.MeshPhysicalMaterial; titaniumDark: THREE.MeshStandardMaterial; titaniumLight: THREE.MeshStandardMaterial; pistonChrome: THREE.MeshStandardMaterial; safetyOrange: THREE.MeshPhysicalMaterial; rubberJoint: THREE.MeshStandardMaterial; decalPlate: THREE.MeshPhysicalMaterial; opticGlass: THREE.MeshPhysicalMaterial; opticGlowGreen: THREE.MeshBasicMaterial; opticGlowOrange: THREE.MeshBasicMaterial; cableMat: THREE.MeshStandardMaterial; wireframeMat: THREE.LineBasicMaterial; dispose(): void; }`
  - `export function createScorpioMaterials(): ScorpioMaterials;`
  - `export interface StudioEnvironment { contactShadowTex: THREE.CanvasTexture; updateShadowCamera(): void; dispose(): void; }`
  - `export function createStudioEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): StudioEnvironment;`

- [ ] **Step 1: Create `src/scene/materials.ts` with procedural grain, stencil decals, and physical materials**

Create `src/scene/materials.ts`:
```ts
import * as THREE from 'three';

export interface ScorpioMaterials {
  ceramicArmor: THREE.MeshPhysicalMaterial;
  ceramicDarkTrim: THREE.MeshPhysicalMaterial;
  titaniumDark: THREE.MeshStandardMaterial;
  titaniumLight: THREE.MeshStandardMaterial;
  pistonChrome: THREE.MeshStandardMaterial;
  safetyOrange: THREE.MeshPhysicalMaterial;
  rubberJoint: THREE.MeshStandardMaterial;
  decalPlate: THREE.MeshPhysicalMaterial;
  opticGlass: THREE.MeshPhysicalMaterial;
  opticGlowGreen: THREE.MeshBasicMaterial;
  opticGlowOrange: THREE.MeshBasicMaterial;
  cableMat: THREE.MeshStandardMaterial;
  wireframeMat: THREE.LineBasicMaterial;
  dispose(): void;
}

function createMicroGrainTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = 120 + ((seed >>> 24) & 31);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createSc7DecalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle panel seam line
  ctx.strokeStyle = 'rgba(42, 46, 54, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 228);

  // Safety orange technical stripe
  ctx.fillStyle = '#ea5b1b';
  ctx.fillRect(28, 34, 140, 14);
  ctx.fillRect(178, 34, 28, 14);

  // Crisp industrial stencil typography
  ctx.fillStyle = '#262930';
  ctx.font = '700 44px "Consolas", "Segoe UI", monospace';
  ctx.fillText('SCORPIO SC-7', 28, 128);

  ctx.fillStyle = '#575d68';
  ctx.font = '600 22px "Consolas", monospace';
  ctx.fillText('UNIT // 07-ALPHA  HYD-48V', 30, 174);

  ctx.fillStyle = '#ea5b1b';
  ctx.fillRect(28, 198, 456, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createScorpioMaterials(): ScorpioMaterials {
  const grain = createMicroGrainTexture(256);
  const decalTex = createSc7DecalTexture();

  const ceramicArmor = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f1ede5'),
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.28,
    clearcoatRoughness: 0.48,
    bumpMap: grain,
    bumpScale: 0.0025
  });

  const ceramicDarkTrim = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c7c3ba'),
    roughness: 0.52,
    metalness: 0.08,
    clearcoat: 0.15,
    clearcoatRoughness: 0.55
  });

  const titaniumDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#272b32'),
    roughness: 0.38,
    metalness: 0.86,
    bumpMap: grain,
    bumpScale: 0.003
  });

  const titaniumLight = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a505c'),
    roughness: 0.34,
    metalness: 0.88
  });

  const pistonChrome = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfe4ec'),
    roughness: 0.12,
    metalness: 0.98
  });

  const safetyOrange = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ea5b1b'),
    roughness: 0.32,
    metalness: 0.12,
    clearcoat: 0.4,
    clearcoatRoughness: 0.28
  });

  const rubberJoint = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#191b1f'),
    roughness: 0.86,
    metalness: 0.04
  });

  const decalPlate = new THREE.MeshPhysicalMaterial({
    map: decalTex,
    roughness: 0.44,
    metalness: 0.04,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45
  });

  const opticGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0c1218'),
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const opticGlowGreen = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#39e58c')
  });

  const opticGlowOrange = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff7a29')
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e2127'),
    roughness: 0.72,
    metalness: 0.15
  });

  const wireframeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#ea5b1b'),
    transparent: true,
    opacity: 0.38
  });

  const allTextures = [grain, decalTex];
  const allMaterials: THREE.Material[] = [
    ceramicArmor,
    ceramicDarkTrim,
    titaniumDark,
    titaniumLight,
    pistonChrome,
    safetyOrange,
    rubberJoint,
    decalPlate,
    opticGlass,
    opticGlowGreen,
    opticGlowOrange,
    cableMat,
    wireframeMat
  ];

  return {
    ceramicArmor,
    ceramicDarkTrim,
    titaniumDark,
    titaniumLight,
    pistonChrome,
    safetyOrange,
    rubberJoint,
    decalPlate,
    opticGlass,
    opticGlowGreen,
    opticGlowOrange,
    cableMat,
    wireframeMat,
    dispose() {
      allTextures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    }
  };
}
```

- [ ] **Step 2: Create `src/scene/studioEnvironment.ts` with softbox PMREM dome, infinite warm light-beige cyclorama floor, and contact shadow decals**

Create `src/scene/studioEnvironment.ts`:
```ts
import * as THREE from 'three';

export interface StudioEnvironment {
  contactShadowTex: THREE.CanvasTexture;
  updateShadowCamera(): void;
  dispose(): void;
}

function createStudioPMREM(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#e6dccd');

  // Overhead warm-white main softbox
  const topBox = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.34, 2.24), side: THREE.DoubleSide })
  );
  topBox.position.set(0, 7.5, 0);
  topBox.rotation.x = Math.PI / 2;
  envScene.add(topBox);

  // Left cool-neutral fill softbox
  const leftBox = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.48, 1.54), side: THREE.DoubleSide })
  );
  leftBox.position.set(-8, 3.2, 2);
  leftBox.lookAt(0, 0.5, 0);
  envScene.add(leftBox);

  // Right warm rim strip
  const rightBox = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.85, 1.72, 1.52), side: THREE.DoubleSide })
  );
  rightBox.position.set(8, 2.8, -3);
  rightBox.lookAt(0, 0.5, 0);
  envScene.add(rightBox);

  // Warm beige floor bounce
  const bounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfc3b0'), side: THREE.DoubleSide })
  );
  bounce.position.set(0, -3, 0);
  bounce.rotation.x = -Math.PI / 2;
  envScene.add(bounce);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(42, 34, 25, 0.52)');
  grad.addColorStop(0.38, 'rgba(48, 38, 28, 0.26)');
  grad.addColorStop(0.75, 'rgba(54, 44, 34, 0.06)');
  grad.addColorStop(1, 'rgba(54, 44, 34, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createStudioFloorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, '#eee7db');
  grad.addColorStop(0.45, '#e8dfd1');
  grad.addColorStop(1, '#e1d6c5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Extremely faint studio calibration rings right around the robot stage
  ctx.strokeStyle = 'rgba(130, 114, 92, 0.12)';
  ctx.lineWidth = 1.5;
  for (const r of [110, 175, 240]) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle hairline crosshairs
  ctx.strokeStyle = 'rgba(130, 114, 92, 0.09)';
  ctx.beginPath();
  ctx.moveTo(size / 2 - 260, size / 2);
  ctx.lineTo(size / 2 + 260, size / 2);
  ctx.moveTo(size / 2, size / 2 - 260);
  ctx.lineTo(size / 2, size / 2 + 260);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createStudioEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): StudioEnvironment {
  const bgColor = new THREE.Color('#e1d6c5');
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2('#e1d6c5', 0.052);

  const envTex = createStudioPMREM(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 0.92;

  const floorTex = createStudioFloorTexture();
  const contactShadowTex = createContactShadowTexture();

  // Seamless cyclorama floor
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.92,
    metalness: 0.0
  });
  const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(36, 96), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Subtle shadow-catcher plane to soften directional shadow contrast
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.19, color: new THREE.Color('#3b3024') })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.0015;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // Soft diffused studio 3-point lighting
  const hemi = new THREE.HemisphereLight('#fffaf2', '#cfc1ad', 0.72);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight('#fff7eb', 1.85);
  keyLight.position.set(3.8, 6.4, 3.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 16;
  const d = 2.6;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.radius = 4.5;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#eef3fb', 0.68);
  fillLight.position.set(-4.5, 3.5, 2.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#fff0dc', 0.85);
  rimLight.position.set(-1.8, 4.2, -4.8);
  scene.add(rimLight);

  return {
    contactShadowTex,
    updateShadowCamera() {
      keyLight.shadow.camera.updateProjectionMatrix();
    },
    dispose() {
      envTex.dispose();
      floorTex.dispose();
      contactShadowTex.dispose();
      floorMat.dispose();
      floorMesh.geometry.dispose();
      shadowCatcher.geometry.dispose();
      (shadowCatcher.material as THREE.Material).dispose();
    }
  };
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`  
Expected: PASS (0 errors).

```bash
git add src/scene/materials.ts src/scene/studioEnvironment.ts
git commit -m "feat: add studio cyclorama environment and procedural PBR materials"
```

---

### Task 3: Hyper-Detailed Articulated Scorpio SC-7 Rig

**Files:**
- Create: `src/scene/scorpioModel.ts`

**Interfaces:**
- Consumes:
  - `LEG_MOUNTS`, `CHASSIS_BASE_Y`, `SimulationState` from `../sim/types.ts` & `../sim/simulation.ts`
  - `ScorpioMaterials` from `./materials.ts`
- Produces:
  - `export interface ScorpioRig { root: THREE.Group; applyState(state: SimulationState): void; setWireframeOverlay(enabled: boolean): void; dispose(): void; }`
  - `export function createScorpioRig(materials: ScorpioMaterials, contactShadowTex: THREE.CanvasTexture): ScorpioRig;`

- [ ] **Step 1: Implement `src/scene/scorpioModel.ts` with chamfered ceramic armor plates, exposed dark titanium frame, telescopic pistons, pincers, 6-segment tail + stinger, and studio contact shadows**

Create `src/scene/scorpioModel.ts`:
```ts
import * as THREE from 'three';
import { CHASSIS_BASE_Y, LEG_MOUNTS } from '../sim/simulation.ts';
import type { SimulationState } from '../sim/types.ts';
import type { ScorpioMaterials } from './materials.ts';

export interface ScorpioRig {
  root: THREE.Group;
  applyState(state: SimulationState): void;
  setWireframeOverlay(enabled: boolean): void;
  dispose(): void;
}

interface HydraulicPiston {
  anchorA: THREE.Object3D;
  anchorB: THREE.Object3D;
  cylinderGroup: THREE.Group;
  rodGroup: THREE.Group;
}

interface LegJoints {
  coxaGroup: THREE.Group;
  femurGroup: THREE.Group;
  tibiaGroup: THREE.Group;
  footPadGroup: THREE.Group;
  footShadow: THREE.Mesh;
}

interface PincerJoints {
  shoulderYaw: THREE.Group;
  shoulderPitch: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  upperJaw: THREE.Group;
}

function createBeveledPlate(
  width: number,
  depth: number,
  thickness: number,
  taperFront = 0.82,
  bevel = 0.018
): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const fw = hw * taperFront;
  const hd = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw * 0.85, -hd);
  shape.lineTo(hw * 0.85, -hd);
  shape.lineTo(hw, -hd * 0.35);
  shape.lineTo(fw, hd * 0.72);
  shape.lineTo(fw * 0.65, hd);
  shape.lineTo(-fw * 0.65, hd);
  shape.lineTo(-fw, hd * 0.72);
  shape.lineTo(-hw, -hd * 0.35);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createPiston(
  parent: THREE.Object3D,
  anchorA: THREE.Object3D,
  anchorB: THREE.Object3D,
  cylLen: number,
  rodLen: number,
  radius: number,
  materials: ScorpioMaterials,
  pistons: HydraulicPiston[]
): void {
  const cylinderGroup = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, cylLen, 14),
    materials.titaniumDark
  );
  cyl.rotation.x = Math.PI / 2;
  cyl.position.z = cylLen * 0.5;
  cylinderGroup.add(cyl);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.28, radius * 1.28, 0.025, 14),
    materials.safetyOrange
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = cylLen;
  cylinderGroup.add(collar);

  const rodGroup = new THREE.Group();
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, rodLen, 12),
    materials.pistonChrome
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.z = rodLen * 0.5;
  rodGroup.add(rod);

  parent.add(cylinderGroup, rodGroup);
  pistons.push({ anchorA, anchorB, cylinderGroup, rodGroup });
}

export function createScorpioRig(
  materials: ScorpioMaterials,
  contactShadowTex: THREE.CanvasTexture
): ScorpioRig {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  chassis.position.y = CHASSIS_BASE_Y;
  root.add(chassis);

  const pistons: HydraulicPiston[] = [];
  const wireframeOverlays: THREE.LineSegments[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  // Soft studio belly contact shadow directly on y = 0
  const bellyShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.5),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );
  bellyShadow.rotation.x = -Math.PI / 2;
  bellyShadow.position.y = 0.002;
  root.add(bellyShadow);

  // Dark titanium central core chassis
  const coreFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 1.36), materials.titaniumDark);
  coreFrame.position.set(0, 0.02, 0.02);
  chassis.add(coreFrame);

  // Exposed hydraulic manifold & side titanium servo housings
  const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.62), materials.titaniumLight);
  manifold.position.set(0, 0.12, -0.05);
  chassis.add(manifold);

  // Layered chamfered matte off-white ceramic carapace plates
  const plateConfigs = [
    { w: 0.88, d: 0.56, t: 0.055, y: 0.165, z: 0.42, rx: 0.09, decal: true },
    { w: 0.98, d: 0.52, t: 0.055, y: 0.195, z: 0.02, rx: 0.03, decal: false },
    { w: 0.86, d: 0.50, t: 0.055, y: 0.175, z: -0.38, rx: -0.08, decal: false }
  ];

  for (const cfg of plateConfigs) {
    const geo = createBeveledPlate(cfg.w, cfg.d, cfg.t, 0.8, 0.018);
    const mesh = new THREE.Mesh(geo, cfg.decal ? materials.decalPlate : materials.ceramicArmor);
    mesh.position.set(0, cfg.y, cfg.z);
    mesh.rotation.x = cfg.rx;
    chassis.add(mesh);

    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 22), materials.wireframeMat);
    wire.visible = false;
    mesh.add(wire);
    wireframeOverlays.push(wire);
  }

  // Safety-orange flank accent stripes along carapace edges
  for (const side of [-1, 1] as const) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.88), materials.safetyOrange);
    stripe.position.set(side * 0.44, 0.13, 0.05);
    chassis.add(stripe);

    const sideGuard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 1.15), materials.ceramicDarkTrim);
    sideGuard.position.set(side * 0.42, 0.05, 0.02);
    chassis.add(sideGuard);
  }

  // Front sensor head cluster & optic lenses
  const headPod = new THREE.Group();
  headPod.position.set(0, 0.06, 0.72);
  chassis.add(headPod);

  const headShell = new THREE.Mesh(createBeveledPlate(0.46, 0.3, 0.09, 0.65, 0.015), materials.ceramicArmor);
  headShell.position.set(0, 0.06, 0.02);
  headPod.add(headShell);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.065, 0.12), materials.opticGlass);
  visor.position.set(0, 0.02, 0.11);
  headPod.add(visor);

  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 14), materials.opticGlowGreen);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(side * 0.09, 0.02, 0.16);
    headPod.add(eye);
  }
  const statusBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.02), materials.opticGlowOrange);
  statusBeacon.position.set(0, 0.035, 0.165);
  headPod.add(statusBeacon);

  // 8 Articulated Hydraulic Legs (mounted in root space at solved hipWorld for zero chassis-tilt drift)
  const legJoints: LegJoints[] = LEG_MOUNTS.map((mount) => {
    const coxaGroup = new THREE.Group();
    coxaGroup.position.set(mount.hipLocal.x, CHASSIS_BASE_Y + mount.hipLocal.y, mount.hipLocal.z);
    root.add(coxaGroup);

    const coxaHub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 16), materials.titaniumDark);
    coxaGroup.add(coxaHub);

    const coxaBracket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.14), materials.titaniumLight);
    coxaBracket.position.set(0, 0, 0.04);
    coxaGroup.add(coxaBracket);

    const femurGroup = new THREE.Group();
    coxaGroup.add(femurGroup);

    // Femur inner dark titanium truss (length = 0.72 along +Z)
    const femurTruss = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.72), materials.titaniumDark);
    femurTruss.position.set(0, 0, 0.36);
    femurGroup.add(femurTruss);

    // Femur sculpted ceramic top armor
    const femurArmorGeo = createBeveledPlate(0.12, 0.58, 0.045, 0.78, 0.01);
    const femurArmor = new THREE.Mesh(femurArmorGeo, materials.ceramicArmor);
    femurArmor.position.set(0, 0.05, 0.35);
    femurGroup.add(femurArmor);

    const femurWire = new THREE.LineSegments(new THREE.EdgesGeometry(femurArmorGeo, 25), materials.wireframeMat);
    femurWire.visible = false;
    femurArmor.add(femurWire);
    wireframeOverlays.push(femurWire);

    // Orange collar accent on femur
    const femurStripe = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.02, 0.06), materials.safetyOrange);
    femurStripe.position.set(0, 0.055, 0.16);
    femurGroup.add(femurStripe);

    // Knee servo drum
    const kneeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.12, 16), materials.titaniumLight);
    kneeDrum.rotation.z = Math.PI / 2;
    kneeDrum.position.set(0, 0, 0.72);
    femurGroup.add(kneeDrum);

    // Tibia group at knee (0, 0, 0.72)
    const tibiaGroup = new THREE.Group();
    tibiaGroup.position.set(0, 0, 0.72);
    femurGroup.add(tibiaGroup);

    const tibiaCore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.84), materials.titaniumDark);
    tibiaCore.position.set(0, 0, 0.42);
    tibiaGroup.add(tibiaCore);

    const ankleBall = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), materials.titaniumLight);
    ankleBall.position.set(0, 0, 0.84);
    tibiaGroup.add(ankleBall);

    const tibiaShield = new THREE.Mesh(
      createBeveledPlate(0.095, 0.54, 0.035, 0.62, 0.008),
      materials.ceramicArmor
    );
    tibiaShield.position.set(0, 0.04, 0.34);
    tibiaGroup.add(tibiaShield);

    // Hydraulic piston spanning Coxa -> Femur
    const coxaAnch = new THREE.Object3D();
    coxaAnch.position.set(0, -0.075, 0.04);
    coxaGroup.add(coxaAnch);

    const femurAnch = new THREE.Object3D();
    femurAnch.position.set(0, -0.055, 0.42);
    femurGroup.add(femurAnch);
    createPiston(root, coxaAnch, femurAnch, 0.25, 0.26, 0.018, materials, pistons);

    // Hydraulic piston spanning Femur -> Tibia
    const femurUpperAnch = new THREE.Object3D();
    femurUpperAnch.position.set(0, 0.09, 0.48);
    femurGroup.add(femurUpperAnch);

    const tibiaUpperAnch = new THREE.Object3D();
    tibiaUpperAnch.position.set(0, 0.07, 0.34);
    tibiaGroup.add(tibiaUpperAnch);
    createPiston(root, femurUpperAnch, tibiaUpperAnch, 0.24, 0.24, 0.016, materials, pistons);

    // Grounded shock-absorbing foot pad at y = 0
    const footPadGroup = new THREE.Group();
    footPadGroup.position.copy(new THREE.Vector3(mount.footRestWorld.x, 0, mount.footRestWorld.z));
    root.add(footPadGroup);

    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.092, 0.042, 16), materials.rubberJoint);
    sole.position.y = 0.021;
    footPadGroup.add(sole);

    const ankleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.058, 0.045, 14), materials.titaniumLight);
    ankleCap.position.y = 0.062;
    footPadGroup.add(ankleCap);

    const footRing = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.01, 16), materials.safetyOrange);
    footRing.position.y = 0.042;
    footPadGroup.add(footRing);

    const footShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      })
    );
    footShadow.rotation.x = -Math.PI / 2;
    footShadow.position.set(mount.footRestWorld.x, 0.0025, mount.footRestWorld.z);
    root.add(footShadow);

    return { coxaGroup, femurGroup, tibiaGroup, footPadGroup, footShadow };
  });

  // Dual Mechanical Pincers (Pedipalps)
  const pincerJoints = ([-1, 1] as const).map((side) => {
    const shoulderYaw = new THREE.Group();
    shoulderYaw.position.set(side * 0.36, 0.0, 0.68);
    chassis.add(shoulderYaw);

    const shoulderPitch = new THREE.Group();
    shoulderYaw.add(shoulderPitch);

    const shoulderDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.11, 14), materials.titaniumDark);
    shoulderDrum.rotation.z = Math.PI / 2;
    shoulderPitch.add(shoulderDrum);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.44), materials.titaniumDark);
    upperArm.position.set(0, 0, 0.22);
    shoulderPitch.add(upperArm);

    const upperShield = new THREE.Mesh(createBeveledPlate(0.14, 0.36, 0.045, 0.82, 0.01), materials.ceramicArmor);
    upperShield.position.set(0, 0.052, 0.22);
    shoulderPitch.add(upperShield);

    const elbow = new THREE.Group();
    elbow.position.set(0, 0, 0.44);
    shoulderPitch.add(elbow);

    const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 14), materials.titaniumLight);
    elbowJoint.rotation.z = Math.PI / 2;
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.1, 0.46), materials.titaniumDark);
    forearm.position.set(0, 0, 0.23);
    elbow.add(forearm);

    const forearmArmorGeo = createBeveledPlate(0.16, 0.38, 0.05, 0.78, 0.01);
    const forearmArmor = new THREE.Mesh(forearmArmorGeo, materials.ceramicArmor);
    forearmArmor.position.set(0, 0.056, 0.23);
    elbow.add(forearmArmor);

    const wrist = new THREE.Group();
    wrist.position.set(0, 0, 0.46);
    elbow.add(wrist);

    // Pincer palm housing
    const palm = new THREE.Mesh(createBeveledPlate(0.22, 0.22, 0.09, 0.75, 0.012), materials.ceramicDarkTrim);
    palm.position.set(0, 0, 0.1);
    wrist.add(palm);

    const palmAccent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.04), materials.safetyOrange);
    palmAccent.position.set(0, 0.052, 0.12);
    wrist.add(palmAccent);

    // Fixed lower jaw
    const lowerJaw = new THREE.Mesh(createBeveledPlate(0.09, 0.34, 0.036, 0.32, 0.008), materials.titaniumDark);
    lowerJaw.position.set(0, -0.036, 0.29);
    wrist.add(lowerJaw);

    // Articulated upper jaw
    const upperJaw = new THREE.Group();
    upperJaw.position.set(0, 0.025, 0.16);
    wrist.add(upperJaw);

    const upperJawBlade = new THREE.Mesh(createBeveledPlate(0.1, 0.34, 0.04, 0.3, 0.008), materials.ceramicArmor);
    upperJawBlade.position.set(0, 0.018, 0.15);
    upperJaw.add(upperJawBlade);

    const clawTipStripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.06), materials.safetyOrange);
    clawTipStripe.position.set(0, 0.035, 0.22);
    upperJaw.add(clawTipStripe);

    // Miniature hydraulic actuator driving upper jaw
    const palmAnch = new THREE.Object3D();
    palmAnch.position.set(0, 0.068, 0.04);
    wrist.add(palmAnch);

    const jawAnch = new THREE.Object3D();
    jawAnch.position.set(0, 0.05, 0.08);
    upperJaw.add(jawAnch);
    createPiston(root, palmAnch, jawAnch, 0.08, 0.08, 0.011, materials, pistons);

    return { shoulderYaw, shoulderPitch, elbow, wrist, upperJaw } as PincerJoints;
  }) as [PincerJoints, PincerJoints];

  // 6-Segment Articulated Tail + Calibration Stinger
  const tailBase = new THREE.Group();
  tailBase.position.set(0, 0.14, -0.62);
  chassis.add(tailBase);

  const tailSegments: THREE.Group[] = [];
  let parentTail: THREE.Object3D = tailBase;
  const segLengths = [0.34, 0.33, 0.31, 0.29, 0.27, 0.25];
  const segWidths = [0.28, 0.25, 0.22, 0.19, 0.16, 0.13];

  for (let i = 0; i < 6; i++) {
    const segGroup = new THREE.Group();
    if (i > 0) {
      segGroup.position.set(0, 0, -segLengths[i - 1]);
    }
    parentTail.add(segGroup);

    const jointBall = new THREE.Mesh(new THREE.SphereGeometry(segWidths[i] * 0.34, 16, 12), materials.titaniumDark);
    segGroup.add(jointBall);

    const len = segLengths[i];
    const w = segWidths[i];
    const link = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, w * 0.54, len), materials.titaniumDark);
    link.position.set(0, 0, -len * 0.5);
    segGroup.add(link);

    const armorGeo = createBeveledPlate(w, len * 0.84, w * 0.28, 0.8, 0.012);
    const armor = new THREE.Mesh(armorGeo, materials.ceramicArmor);
    armor.position.set(0, w * 0.3, -len * 0.5);
    segGroup.add(armor);

    const armorWire = new THREE.LineSegments(new THREE.EdgesGeometry(armorGeo, 24), materials.wireframeMat);
    armorWire.visible = false;
    armor.add(armorWire);
    wireframeOverlays.push(armorWire);

    if (i === 2 || i === 4) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.025, 0.045), materials.safetyOrange);
      band.position.set(0, w * 0.31, -len * 0.5);
      segGroup.add(band);
    }

    // Exposed dorsal hydraulic piston between consecutive tail segments
    if (i > 0) {
      const prevAnch = new THREE.Object3D();
      prevAnch.position.set(0, w * 0.44, -segLengths[i - 1] * 0.45);
      parentTail.add(prevAnch);

      const curAnch = new THREE.Object3D();
      curAnch.position.set(0, w * 0.42, -len * 0.42);
      segGroup.add(curAnch);
      createPiston(root, prevAnch, curAnch, 0.14, 0.14, 0.013, materials, pistons);
    }

    tailSegments.push(segGroup);
    parentTail = segGroup;
  }

  // Calibration Stinger Assembly
  const stingerGroup = new THREE.Group();
  stingerGroup.position.set(0, 0, -segLengths[5]);
  parentTail.add(stingerGroup);

  const bulb = new THREE.Mesh(createBeveledPlate(0.17, 0.28, 0.11, 0.55, 0.018), materials.ceramicArmor);
  bulb.position.set(0, 0.02, -0.12);
  stingerGroup.add(bulb);

  const bulbAccent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.024, 0.05), materials.safetyOrange);
  bulbAccent.position.set(0, 0.04, -0.10);
  stingerGroup.add(bulbAccent);

  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.24, 14), materials.pistonChrome);
  needle.rotation.x = -Math.PI / 2;
  needle.position.set(0, 0.0, -0.35);
  stingerGroup.add(needle);

  const emitterTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), materials.opticGlowOrange);
  emitterTip.position.set(0, 0, -0.47);
  stingerGroup.add(emitterTip);

  enableShadows(root);
  bellyShadow.castShadow = false;
  legJoints.forEach((l) => {
    l.footShadow.castShadow = false;
  });

  function updatePistons(): void {
    for (const p of pistons) {
      p.anchorA.getWorldPosition(tmpA);
      p.anchorB.getWorldPosition(tmpB);
      if (tmpA.distanceToSquared(tmpB) < 1e-8) continue;

      p.cylinderGroup.position.copy(tmpA);
      p.cylinderGroup.lookAt(tmpB);

      p.rodGroup.position.copy(tmpB);
      p.rodGroup.lookAt(tmpA);
    }
  }

  return {
    root,
    applyState(state: SimulationState) {
      chassis.position.set(
        state.chassisOffset.x,
        CHASSIS_BASE_Y + state.chassisOffset.y,
        state.chassisOffset.z
      );
      chassis.rotation.set(
        state.chassisRotation.x,
        state.chassisRotation.y,
        state.chassisRotation.z
      );

      for (let i = 0; i < legJoints.length; i++) {
        const j = legJoints[i];
        const lp = state.legs[i];
        j.coxaGroup.position.set(lp.hipWorld.x, lp.hipWorld.y, lp.hipWorld.z);
        j.coxaGroup.rotation.y = lp.coxaYaw;
        j.femurGroup.rotation.x = lp.femurPitch;
        j.tibiaGroup.rotation.x = lp.tibiaPitch;
      }

      for (let i = 0; i < 2; i++) {
        const pj = pincerJoints[i];
        const pp = state.pincers[i];
        pj.shoulderYaw.rotation.y = pp.shoulderYaw;
        pj.shoulderPitch.rotation.x = pp.shoulderPitch;
        pj.elbow.rotation.x = pp.elbowPitch;
        pj.wrist.rotation.z = pp.wristRoll;
        pj.upperJaw.rotation.x = -pp.jawOpenAngle;
      }

      for (let i = 0; i < tailSegments.length; i++) {
        const ts = state.tailSegments[i];
        tailSegments[i].rotation.set(ts.pitch, ts.yaw, ts.roll);
      }
      stingerGroup.rotation.set(state.stingerPitch, state.stingerYaw, 0);

      root.updateMatrixWorld(true);
      updatePistons();
    },
    setWireframeOverlay(enabled: boolean) {
      for (const w of wireframeOverlays) {
        w.visible = enabled;
      }
    },
    dispose() {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    }
  };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`  
Expected: PASS (0 errors).

```bash
git add src/scene/scorpioModel.ts
git commit -m "feat: build articulated Scorpio SC-7 PBR model and hydraulic piston rig"
```

---

### Task 4: Viewport Controller, Edge Telemetry HUD & Live Application Entry

**Files:**
- Create: `index.html`
- Create: `src/scene/viewport.ts`
- Create: `src/hud/hud.css`
- Create: `src/hud/TelemetryHud.ts`
- Create: `src/main.ts`

**Interfaces:**
- Consumes:
  - `CYCLE_SECONDS`, `SimMode`, `SimulationState` from `../sim/types.ts`
  - `evaluateSimulation` from `../sim/simulation.ts`
  - `createScorpioMaterials`, `createStudioEnvironment`, `createScorpioRig` from `../scene/*`
- Produces:
  - `export interface ViewportController { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; setOrbitCamera(azimuth: number, elevation: number, distance: number): void; renderFrame(): void; resetUserCamera(): void; setInteractiveControlsEnabled(enabled: boolean): void; dispose(): void; }`
  - `export function createViewport(container: HTMLElement, options: { fixedWidth?: number; fixedHeight?: number; interactive: boolean; onUserOrbit?: () => void; }): ViewportController;`
  - `export interface HudCallbacks { onToggleOrbit(): void; onChangeMode(mode: SimMode): void; onToggleWireframe(): void; onResetCamera(): void; }`
  - `export class TelemetryHud { constructor(container: HTMLElement, isRecordMode: boolean, callbacks: HudCallbacks); update(state: SimulationState, orbitPaused: boolean, wireframeOn: boolean): void; dispose(): void; }`
  - Global deterministic capture API on `window`:
    - `window.__simReady: boolean`
    - `window.__renderFrame(frameIndex: number, totalFrames: number): void`

- [ ] **Step 1: Create `index.html` and `src/scene/viewport.ts`**

Create `index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scorpio SC-7 // 3D CAD Robotics Field Simulator</title>
  </head>
  <body>
    <div id="app">
      <div id="viewport-root"></div>
      <div id="hud-root"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/scene/viewport.ts`:
```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ViewportController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  setOrbitCamera(azimuth: number, elevation: number, distance: number): void;
  renderFrame(): void;
  resetUserCamera(): void;
  setInteractiveControlsEnabled(enabled: boolean): void;
  dispose(): void;
}

const TARGET = new THREE.Vector3(0, 0.72, 0.04);

export function createViewport(
  container: HTMLElement,
  options: {
    fixedWidth?: number;
    fixedHeight?: number;
    interactive: boolean;
    onUserOrbit?: () => void;
  }
): ViewportController {
  const width = options.fixedWidth ?? (container.clientWidth || window.innerWidth);
  const height = options.fixedHeight ?? (container.clientHeight || window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !options.interactive
    });
  } catch (err) {
    throw new Error(`WebGL initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  renderer.setPixelRatio(options.interactive ? Math.min(window.devicePixelRatio, 2) : 1);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  controls.enableDamping = options.interactive;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.4;
  controls.maxDistance = 8.5;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minPolarAngle = 0.18;
  controls.enabled = options.interactive;

  const onStart = () => {
    options.onUserOrbit?.();
  };
  controls.addEventListener('start', onStart);

  const onResize = () => {
    if (options.fixedWidth && options.fixedHeight) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  function setOrbitCamera(azimuth: number, elevation: number, distance: number): void {
    const cosE = Math.cos(elevation);
    camera.position.set(
      TARGET.x + distance * cosE * Math.sin(azimuth),
      TARGET.y + distance * Math.sin(elevation),
      TARGET.z + distance * cosE * Math.cos(azimuth)
    );
    camera.lookAt(TARGET);
    controls.target.copy(TARGET);
  }

  setOrbitCamera(0.65, 0.36, 4.35);

  return {
    scene,
    camera,
    renderer,
    setOrbitCamera,
    renderFrame() {
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);
    },
    resetUserCamera() {
      setOrbitCamera(0.65, 0.36, 4.35);
    },
    setInteractiveControlsEnabled(enabled: boolean) {
      controls.enabled = enabled;
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onStart);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
```

- [ ] **Step 2: Create `src/hud/hud.css` and `src/hud/TelemetryHud.ts`**

Create `src/hud/hud.css`:
```css
:root {
  --hud-bg: rgba(24, 27, 32, 0.78);
  --hud-border: rgba(235, 240, 245, 0.14);
  --hud-text: #eef1f5;
  --hud-muted: #98a2b0;
  --hud-green: #39e58c;
  --hud-orange: #ff7a29;
  --hud-cyan: #78b7e8;
  --font-mono: 'JetBrains Mono', 'Cascadia Mono', 'Consolas', monospace;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app,
#viewport-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #e1d6c5;
  font-family: var(--font-mono);
}

#app {
  position: relative;
}

#viewport-root canvas {
  display: block;
}

#hud-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  padding: 20px 24px 16px;
  display: grid;
  grid-template-columns: 296px 1fr 296px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'top-left top-center top-right'
    'left-col center-clear right-col'
    'bottom-bar bottom-bar bottom-bar';
  gap: 14px;
  color: var(--hud-text);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.hud-panel {
  background: var(--hud-bg);
  border: 1px solid var(--hud-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 3px;
  padding: 12px 14px;
  box-shadow: 0 8px 28px rgba(15, 18, 24, 0.16);
}

.hud-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--hud-muted);
  font-size: 10px;
}

.hud-top-left {
  grid-area: top-left;
  align-self: start;
}

.unit-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #ffffff;
}

.unit-sub {
  font-size: 10px;
  color: var(--hud-muted);
  margin-top: 3px;
}

.status-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 9px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid transparent;
  font-variant-numeric: tabular-nums;
}

.status-pill.online {
  background: rgba(57, 229, 140, 0.13);
  border-color: rgba(57, 229, 140, 0.45);
  color: var(--hud-green);
  text-shadow: 0 0 10px rgba(57, 229, 140, 0.6);
}

.status-pill.standby {
  background: rgba(255, 122, 41, 0.14);
  border-color: rgba(255, 122, 41, 0.5);
  color: var(--hud-orange);
  text-shadow: 0 0 10px rgba(255, 122, 41, 0.65);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.hud-top-right {
  grid-area: top-right;
  align-self: start;
}

.cam-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
  font-variant-numeric: tabular-nums;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}

.metric-label {
  color: var(--hud-muted);
}

.metric-val {
  color: #ffffff;
  font-weight: 600;
}

.live-controls {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  pointer-events: auto;
}

.hud-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: var(--hud-text);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 2px;
  cursor: pointer;
}

.hud-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.hud-btn.active {
  border-color: var(--hud-orange);
  color: var(--hud-orange);
  background: rgba(255, 122, 41, 0.14);
}

.hud-left-col {
  grid-area: left-col;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-self: center;
}

.graph-canvas {
  width: 100%;
  height: 124px;
  display: block;
}

.gauge-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.gauge-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.gauge-svg {
  width: 108px;
  height: 76px;
}

.gauge-caption {
  font-size: 9px;
  color: var(--hud-muted);
  margin-top: 4px;
}

.hud-right-col {
  grid-area: right-col;
  align-self: center;
}

.servo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.servo-row {
  display: grid;
  grid-template-columns: 58px 1fr 38px;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.servo-name {
  color: var(--hud-muted);
}

.servo-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.09);
  border-radius: 1px;
  overflow: hidden;
}

.servo-fill {
  height: 100%;
  background: linear-gradient(90deg, #64b5f6 0%, #39e58c 75%, #ff7a29 100%);
  width: 50%;
}

.servo-pct {
  text-align: right;
  color: #f3f5f8;
}

.hud-bottom-bar {
  grid-area: bottom-bar;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 14px;
  font-size: 10px;
  color: var(--hud-muted);
  font-variant-numeric: tabular-nums;
}

.hud-bottom-bar strong {
  color: var(--hud-text);
  font-weight: 600;
}

.error-banner {
  position: absolute;
  inset: 24px;
  margin: auto;
  max-width: 540px;
  height: fit-content;
  background: #1b1e24;
  color: #ffb4a2;
  border: 1px solid #ff7a29;
  padding: 20px;
  font-family: var(--font-mono);
  font-size: 13px;
}
```

Create `src/hud/TelemetryHud.ts`:
```ts
import type { SimMode, SimulationState } from '../sim/types.ts';

export interface HudCallbacks {
  onToggleOrbit(): void;
  onChangeMode(mode: SimMode): void;
  onToggleWireframe(): void;
  onResetCamera(): void;
}

interface ServoDomRow {
  fill: HTMLElement;
  pct: HTMLElement;
}

export class TelemetryHud {
  private root: HTMLElement;
  private onlinePill!: HTMLElement;
  private standbyPill!: HTMLElement;
  private clockEl!: HTMLElement;
  private azEl!: HTMLElement;
  private elvEl!: HTMLElement;
  private distEl!: HTMLElement;
  private busEl!: HTMLElement;
  private graphCanvas!: HTMLCanvasElement;
  private graphCtx!: CanvasRenderingContext2D;
  private torqueArc!: SVGPathElement;
  private torqueVal!: HTMLElement;
  private psiArc!: SVGPathElement;
  private psiVal!: HTMLElement;
  private bottomDiagEl!: HTMLElement;
  private servoRows: Map<string, ServoDomRow> = new Map();
  private orbitBtn: HTMLButtonElement | null = null;
  private wireBtn: HTMLButtonElement | null = null;
  private modeBtns: Map<SimMode, HTMLButtonElement> = new Map();

  constructor(container: HTMLElement, isRecordMode: boolean, callbacks: HudCallbacks) {
    this.root = container;
    this.root.innerHTML = this.buildMarkup(isRecordMode);
    this.bindElements(isRecordMode, callbacks);
  }

  private buildMarkup(isRecordMode: boolean): string {
    const controlsHtml = isRecordMode
      ? ''
      : `
      <div class="live-controls">
        <button class="hud-btn" data-action="orbit">Pause Orbit</button>
        <button class="hud-btn" data-action="wire">CAD Wire</button>
        <button class="hud-btn" data-action="reset">Reset Cam</button>
        <button class="hud-btn active" data-mode="idle">Idle</button>
        <button class="hud-btn" data-mode="pincer">Pincer</button>
        <button class="hud-btn" data-mode="calibrate">Calibrate</button>
      </div>`;

    return `
      <section class="hud-panel hud-top-left">
        <div class="unit-title">SCORPIO SC-7</div>
        <div class="unit-sub">3D CAD ROBOTICS FIELD SIMULATOR // REV 4.2</div>
        <div class="status-row">
          <div class="status-pill online" id="hud-online"><span class="status-dot"></span>ONLINE</div>
          <div class="status-pill standby" id="hud-standby"><span class="status-dot"></span>OPERATION: STANDBY</div>
        </div>
      </section>

      <section class="hud-panel hud-top-right">
        <div class="hud-panel-header">
          <span>ORBIT TELEMETRY</span>
          <span id="hud-clock">T+00.00S</span>
        </div>
        <div class="cam-metrics">
          <div class="metric-item"><span class="metric-label">AZIMUTH</span><span class="metric-val" id="hud-az">000.0°</span></div>
          <div class="metric-item"><span class="metric-label">ELEV</span><span class="metric-val" id="hud-elv">+20.6°</span></div>
          <div class="metric-item"><span class="metric-label">RANGE</span><span class="metric-val" id="hud-dist">4.35 M</span></div>
          <div class="metric-item"><span class="metric-label">BUS V</span><span class="metric-val" id="hud-bus">47.8 V</span></div>
        </div>
        ${controlsHtml}
      </section>

      <aside class="hud-left-col">
        <section class="hud-panel">
          <div class="hud-panel-header">
            <span>REAL-TIME OSCILLATION</span>
            <span>HYD / GYRO / BUS</span>
          </div>
          <canvas class="graph-canvas" id="hud-graph" width="268" height="124"></canvas>
        </section>

        <section class="hud-panel">
          <div class="hud-panel-header">
            <span>ACTUATOR GAUGES</span>
            <span>NOMINAL</span>
          </div>
          <div class="gauge-grid">
            <div class="gauge-card">
              <svg class="gauge-svg" viewBox="0 0 110 78">
                <path d="M 15 64 A 40 40 0 1 1 95 64" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="7" stroke-linecap="round"/>
                <path id="gauge-torque-arc" d="M 15 64 A 40 40 0 1 1 95 64" fill="none" stroke="#39e58c" stroke-width="7" stroke-linecap="round" stroke-dasharray="168" stroke-dashoffset="70"/>
                <text id="gauge-torque-val" x="55" y="54" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">61%</text>
              </svg>
              <div class="gauge-caption">MAIN TORQUE</div>
            </div>
            <div class="gauge-card">
              <svg class="gauge-svg" viewBox="0 0 110 78">
                <path d="M 15 64 A 40 40 0 1 1 95 64" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="7" stroke-linecap="round"/>
                <path id="gauge-psi-arc" d="M 15 64 A 40 40 0 1 1 95 64" fill="none" stroke="#ff7a29" stroke-width="7" stroke-linecap="round" stroke-dasharray="168" stroke-dashoffset="52"/>
                <text id="gauge-psi-val" x="55" y="54" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700">2840</text>
              </svg>
              <div class="gauge-caption">HYD PSI</div>
            </div>
          </div>
        </section>
      </aside>

      <aside class="hud-panel hud-right-col">
        <div class="hud-panel-header">
          <span>SERVO LOAD MATRIX</span>
          <span>16 CH LIVE</span>
        </div>
        <div class="servo-list" id="hud-servo-list"></div>
      </aside>

      <footer class="hud-panel hud-bottom-bar">
        <span id="hud-bottom-diag">DIAGNOSTIC STANCE: <strong>ACTIVE</strong> // FLOOR CONTACT: <strong>8/8 PAD LOCK</strong></span>
        <span>CERAMIC-TI CHASSIS // STUDIO DIFFUSED // <strong>60.0 FPS</strong></span>
      </footer>
    `;
  }

  private bindElements(isRecordMode: boolean, callbacks: HudCallbacks): void {
    this.onlinePill = this.root.querySelector('#hud-online')!;
    this.standbyPill = this.root.querySelector('#hud-standby')!;
    this.clockEl = this.root.querySelector('#hud-clock')!;
    this.azEl = this.root.querySelector('#hud-az')!;
    this.elvEl = this.root.querySelector('#hud-elv')!;
    this.distEl = this.root.querySelector('#hud-dist')!;
    this.busEl = this.root.querySelector('#hud-bus')!;
    this.graphCanvas = this.root.querySelector('#hud-graph')!;
    this.graphCtx = this.graphCanvas.getContext('2d')!;
    this.torqueArc = this.root.querySelector('#gauge-torque-arc')!;
    this.torqueVal = this.root.querySelector('#gauge-torque-val')!;
    this.psiArc = this.root.querySelector('#gauge-psi-arc')!;
    this.psiVal = this.root.querySelector('#gauge-psi-val')!;
    this.bottomDiagEl = this.root.querySelector('#hud-bottom-diag')!;

    if (!isRecordMode) {
      this.orbitBtn = this.root.querySelector('[data-action="orbit"]');
      this.wireBtn = this.root.querySelector('[data-action="wire"]');
      const resetBtn = this.root.querySelector('[data-action="reset"]');
      this.orbitBtn?.addEventListener('click', () => callbacks.onToggleOrbit());
      this.wireBtn?.addEventListener('click', () => callbacks.onToggleWireframe());
      resetBtn?.addEventListener('click', () => callbacks.onResetCamera());

      this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
        const mode = btn.dataset.mode as SimMode;
        this.modeBtns.set(mode, btn);
        btn.addEventListener('click', () => callbacks.onChangeMode(mode));
      });
    }
  }

  private ensureServoRows(state: SimulationState): void {
    if (this.servoRows.size > 0) return;
    const container = this.root.querySelector('#hud-servo-list')!;
    for (const s of state.telemetry.servos) {
      const row = document.createElement('div');
      row.className = 'servo-row';

      const name = document.createElement('span');
      name.className = 'servo-name';
      name.textContent = s.label;

      const track = document.createElement('div');
      track.className = 'servo-track';
      const fill = document.createElement('div');
      fill.className = 'servo-fill';
      track.appendChild(fill);

      const pct = document.createElement('span');
      pct.className = 'servo-pct';
      pct.textContent = '0%';

      row.append(name, track, pct);
      container.appendChild(row);
      this.servoRows.set(s.id, { fill, pct });
    }
  }

  private drawOscilloscope(state: SimulationState): void {
    const ctx = this.graphCtx;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 44) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 31) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    const traces: Array<{ data: number[]; color: string }> = [
      { data: state.telemetry.graphSamples.hydraulic, color: '#39e58c' },
      { data: state.telemetry.graphSamples.gyro, color: '#ff7a29' },
      { data: state.telemetry.graphSamples.busLoad, color: '#78b7e8' }
    ];

    for (const trace of traces) {
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      trace.data.forEach((v, idx) => {
        const x = (idx / (trace.data.length - 1)) * w;
        const y = h - v * (h - 16) - 8;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  update(state: SimulationState, orbitPaused: boolean, wireframeOn: boolean): void {
    this.ensureServoRows(state);
    const tel = state.telemetry;

    this.onlinePill.style.opacity = tel.onlineFlicker.toFixed(3);
    this.standbyPill.style.opacity = tel.standbyFlicker.toFixed(3);

    this.clockEl.textContent = `T+${tel.timeSec.toFixed(2).padStart(5, '0')}S`;
    const degAz = ((state.cameraAzimuth * 180) / Math.PI) % 360;
    this.azEl.textContent = `${degAz.toFixed(1).padStart(5, '0')}°`;
    this.elvEl.textContent = `+${((state.cameraElevation * 180) / Math.PI).toFixed(1)}°`;
    this.distEl.textContent = `${state.cameraDistance.toFixed(2)} M`;
    this.busEl.textContent = `${tel.busVoltage.toFixed(1)} V`;

    const arcLen = 168;
    const torqueRatio = tel.mainTorquePct / 100;
    this.torqueArc.setAttribute('stroke-dashoffset', (arcLen * (1 - torqueRatio)).toFixed(1));
    this.torqueVal.textContent = `${Math.round(tel.mainTorquePct)}%`;

    const psiRatio = Math.min(1, Math.max(0, (tel.hydraulicPsi - 1800) / 1600));
    this.psiArc.setAttribute('stroke-dashoffset', (arcLen * (1 - psiRatio)).toFixed(1));
    this.psiVal.textContent = `${Math.round(tel.hydraulicPsi)}`;

    this.drawOscilloscope(state);

    for (const s of tel.servos) {
      const dom = this.servoRows.get(s.id);
      if (!dom) continue;
      dom.fill.style.width = `${s.pct.toFixed(1)}%`;
      dom.pct.textContent = `${Math.round(s.pct)}%`;
    }

    const modeLabel = state.mode.toUpperCase();
    this.bottomDiagEl.innerHTML = `DIAGNOSTIC MODE: <strong>${modeLabel}</strong> // GYRO DRIFT: <strong>${tel.gyroDriftDeg.toFixed(2)}°</strong> // FLOOR LOCK: <strong>8/8 PADS</strong>`;

    if (this.orbitBtn) {
      this.orbitBtn.textContent = orbitPaused ? 'Resume Orbit' : 'Pause Orbit';
      this.orbitBtn.classList.toggle('active', !orbitPaused);
    }
    if (this.wireBtn) {
      this.wireBtn.classList.toggle('active', wireframeOn);
    }
    this.modeBtns.forEach((btn, mode) => {
      btn.classList.toggle('active', mode === state.mode);
    });
  }

  dispose(): void {
    this.root.innerHTML = '';
  }
}
```

- [ ] **Step 3: Create `src/main.ts` uniting live mode and deterministic `?record=1` frame hooks**

Create `src/main.ts`:
```ts
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

  // Initial synchronous frame so textures/shaders compile before signalling readiness
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
```

- [ ] **Step 4: Run `npm run build` and `npx vitest run`, then commit**

Run: `npm run build && npx vitest run`  
Expected: TypeScript check, Vite production build (`dist/`), and all Vitest tests pass.

```bash
git add index.html src/scene/viewport.ts src/hud/ src/main.ts
git commit -m "feat: add studio viewport, semi-transparent edge telemetry HUD, and app entry"
```

---

### Task 5: Deterministic 1080p60 MP4 Recording Pipeline & Visual Verification

**Files:**
- Create: `scripts/record.mjs`

**Interfaces:**
- Consumes:
  - Vite production build in `dist/`
  - Local Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
  - Local `ffmpeg` and `ffprobe` on `PATH`
  - `window.__simReady` and `window.__renderFrame(frame, totalFrames)` on `/?record=1`
- Produces:
  - `output/scorpio-sc7-sim-1080p60.mp4` (`1920×1080`, `60 fps`, `15.0s`, `900` frames)

- [ ] **Step 1: Write `scripts/record.mjs`**

Create `scripts/record.mjs`:
```js
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
  const res = spawnSync(cmd, args, { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
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
  runSyncOrThrow('npm', ['run', 'build']);

  console.log('[record] Starting vite preview server...');
  const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
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

    console.log('[record] Spawning FFmpeg H.264 encoder...');
    ffmpegProc = spawn(
      'ffmpeg',
      [
        '-y',
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
```

- [ ] **Step 2: Run full capture, verify MP4 stream metadata with `ffprobe`, and extract visual check frames**

Run:
```powershell
npm run record
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames,duration -of default=noprint_wrappers=1 output/scorpio-sc7-sim-1080p60.mp4
ffmpeg -y -i output/scorpio-sc7-sim-1080p60.mp4 -vf "select='eq(n\,0)+eq(n\,225)+eq(n\,450)+eq(n\,675)'" -vsync 0 output/keyframe_%02d.png
```
Expected:
- `width=1920`, `height=1080`, `r_frame_rate=60/1`, `nb_frames=900`, `duration=15.000000`
- Visually inspect `output/keyframe_01.png`..`output/keyframe_04.png` via `read_file` to verify ceramic/titanium/orange detail, contact shadows, infinite warm beige floor, and unobstructed edge HUD framing. Clean up temporary `output/keyframe_*.png` after inspection.

- [ ] **Step 3: Commit recording script**

```bash
git add scripts/record.mjs
git commit -m "feat: add deterministic Playwright + FFmpeg 1080p60 MP4 recorder"
```
