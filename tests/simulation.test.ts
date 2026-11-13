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
  it('loops seamlessly between t=0 and t=CYCLE_SECONDS after full 360 orbit', () => {
    const start = evaluateSimulation(0, 'idle');
    const nearEnd = evaluateSimulation(CYCLE_SECONDS - 1e-6, 'idle');
    const end = evaluateSimulation(CYCLE_SECONDS, 'idle');

    expect(end.chassisOffset.x).toBeCloseTo(start.chassisOffset.x, 6);
    expect(end.chassisOffset.y).toBeCloseTo(start.chassisOffset.y, 6);
    expect(end.chassisOffset.z).toBeCloseTo(start.chassisOffset.z, 6);
    expect(nearEnd.cameraAzimuth - start.cameraAzimuth).toBeCloseTo(Math.PI * 2, 4);
    expect(end.cameraAzimuth).toBeCloseTo(start.cameraAzimuth, 6);
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
