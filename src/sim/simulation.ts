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
    const baseLoad = 48 + (idx % 2) * 6 + lateralShift * 280;
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
    const pitch = basePitch + 0.045 * tailBoost * Math.sin(w * 3 - i * 0.45);
    const yaw = 0.065 * tailBoost * segRatio * Math.sin(w * 2 - i * 0.35);
    const roll = 0.025 * tailBoost * Math.cos(w * 2 - i * 0.4);
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
