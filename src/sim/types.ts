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
