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
  const localMaterials: THREE.Material[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  // Soft studio belly contact shadow on y = 0
  const bellyShadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  localMaterials.push(bellyShadowMat);
  const bellyShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.5), bellyShadowMat);
  bellyShadow.rotation.x = -Math.PI / 2;
  bellyShadow.position.y = 0.002;
  root.add(bellyShadow);

  // Exposed dark titanium inner frame & hydraulic manifold
  const coreFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 1.36), materials.titaniumDark);
  coreFrame.position.set(0, 0.02, 0.02);
  chassis.add(coreFrame);

  const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.62), materials.titaniumLight);
  manifold.position.set(0, 0.12, -0.05);
  chassis.add(manifold);

  // Cooling louver fins along dorsal spine recess
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.022), materials.titaniumDark);
    fin.position.set(0, 0.205, -0.14 + i * 0.055);
    chassis.add(fin);
  }

  // Layered chamfered matte off-white ceramic carapace plates
  const plateConfigs = [
    { w: 0.88, d: 0.56, t: 0.055, y: 0.165, z: 0.42, rx: 0.09 },
    { w: 0.98, d: 0.52, t: 0.055, y: 0.195, z: 0.02, rx: 0.03 },
    { w: 0.86, d: 0.50, t: 0.055, y: 0.175, z: -0.38, rx: -0.08 }
  ];

  for (const cfg of plateConfigs) {
    const geo = createBeveledPlate(cfg.w, cfg.d, cfg.t, 0.8, 0.018);
    const mesh = new THREE.Mesh(geo, materials.ceramicArmor);
    mesh.position.set(0, cfg.y, cfg.z);
    mesh.rotation.x = cfg.rx;
    chassis.add(mesh);

    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 22), materials.wireframeMat);
    wire.visible = false;
    mesh.add(wire);
    wireframeOverlays.push(wire);
  }

  // Dedicated flush SC-7 stencil badge with clean [0..1] UVs on front carapace
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.22), materials.decalPlate);
  badge.position.set(0, 0.214, 0.41);
  badge.rotation.x = -Math.PI / 2 + 0.09;
  chassis.add(badge);

  // Safety-orange flank accent stripes & hex bolts
  for (const side of [-1, 1] as const) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.88), materials.safetyOrange);
    stripe.position.set(side * 0.44, 0.13, 0.05);
    chassis.add(stripe);

    const sideGuard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 1.15), materials.ceramicDarkTrim);
    sideGuard.position.set(side * 0.42, 0.05, 0.02);
    chassis.add(sideGuard);

    for (const bz of [-0.36, 0.02, 0.38]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 6), materials.titaniumLight);
      bolt.position.set(side * 0.34, 0.215, bz);
      chassis.add(bolt);
    }
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

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.14, 8), materials.titaniumLight);
    antenna.position.set(side * 0.19, 0.14, 0.02);
    antenna.rotation.z = -side * 0.24;
    antenna.rotation.x = 0.2;
    headPod.add(antenna);
  }
  const statusBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.02), materials.opticGlowOrange);
  statusBeacon.position.set(0, 0.035, 0.165);
  headPod.add(statusBeacon);

  // 8 Articulated Hydraulic Legs (mounted in root space at solved hipWorld for exact floor lock)
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

    const femurTruss = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.72), materials.titaniumDark);
    femurTruss.position.set(0, 0, 0.36);
    femurGroup.add(femurTruss);

    const femurArmorGeo = createBeveledPlate(0.12, 0.58, 0.045, 0.78, 0.01);
    const femurArmor = new THREE.Mesh(femurArmorGeo, materials.ceramicArmor);
    femurArmor.position.set(0, 0.05, 0.35);
    femurGroup.add(femurArmor);

    const femurWire = new THREE.LineSegments(new THREE.EdgesGeometry(femurArmorGeo, 25), materials.wireframeMat);
    femurWire.visible = false;
    femurArmor.add(femurWire);
    wireframeOverlays.push(femurWire);

    const femurStripe = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.02, 0.06), materials.safetyOrange);
    femurStripe.position.set(0, 0.055, 0.16);
    femurGroup.add(femurStripe);

    const kneeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.12, 16), materials.titaniumLight);
    kneeDrum.rotation.z = Math.PI / 2;
    kneeDrum.position.set(0, 0, 0.72);
    femurGroup.add(kneeDrum);

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

    const coxaAnch = new THREE.Object3D();
    coxaAnch.position.set(0, -0.075, 0.04);
    coxaGroup.add(coxaAnch);

    const femurAnch = new THREE.Object3D();
    femurAnch.position.set(0, -0.055, 0.42);
    femurGroup.add(femurAnch);
    createPiston(root, coxaAnch, femurAnch, 0.25, 0.26, 0.018, materials, pistons);

    const femurUpperAnch = new THREE.Object3D();
    femurUpperAnch.position.set(0, 0.09, 0.48);
    femurGroup.add(femurUpperAnch);

    const tibiaUpperAnch = new THREE.Object3D();
    tibiaUpperAnch.position.set(0, 0.07, 0.34);
    tibiaGroup.add(tibiaUpperAnch);
    createPiston(root, femurUpperAnch, tibiaUpperAnch, 0.24, 0.24, 0.016, materials, pistons);

    const footPadGroup = new THREE.Group();
    footPadGroup.position.set(mount.footRestWorld.x, 0, mount.footRestWorld.z);
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

    const footShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    localMaterials.push(footShadowMat);
    const footShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), footShadowMat);
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

    const palm = new THREE.Mesh(createBeveledPlate(0.22, 0.22, 0.09, 0.75, 0.012), materials.ceramicDarkTrim);
    palm.position.set(0, 0, 0.1);
    wrist.add(palm);

    const palmAccent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.04), materials.safetyOrange);
    palmAccent.position.set(0, 0.052, 0.12);
    wrist.add(palmAccent);

    const lowerJaw = new THREE.Mesh(createBeveledPlate(0.09, 0.34, 0.036, 0.32, 0.008), materials.titaniumDark);
    lowerJaw.position.set(0, -0.036, 0.29);
    wrist.add(lowerJaw);

    const upperJaw = new THREE.Group();
    upperJaw.position.set(0, 0.025, 0.16);
    wrist.add(upperJaw);

    const upperJawBlade = new THREE.Mesh(createBeveledPlate(0.1, 0.34, 0.04, 0.3, 0.008), materials.ceramicArmor);
    upperJawBlade.position.set(0, 0.018, 0.15);
    upperJaw.add(upperJawBlade);

    // Serrated gripper teeth on upper jaw underside
    for (let tIdx = 0; tIdx < 3; tIdx++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.025), materials.titaniumLight);
      tooth.position.set(0, -0.006, 0.11 + tIdx * 0.065);
      upperJaw.add(tooth);
    }

    const clawTipStripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.06), materials.safetyOrange);
    clawTipStripe.position.set(0, 0.035, 0.22);
    upperJaw.add(clawTipStripe);

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

    // Side braided hydraulic hoses
    for (const side of [-1, 1] as const) {
      const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, len * 0.88, 8), materials.cableMat);
      hose.rotation.x = Math.PI / 2;
      hose.position.set(side * (w * 0.34), -0.01, -len * 0.5);
      segGroup.add(hose);
    }

    if (i === 2 || i === 4) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.025, 0.045), materials.safetyOrange);
      band.position.set(0, w * 0.31, -len * 0.5);
      segGroup.add(band);
    }

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
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      localMaterials.forEach((m) => m.dispose());
    }
  };
}
