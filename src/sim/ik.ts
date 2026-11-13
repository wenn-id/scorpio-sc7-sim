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
