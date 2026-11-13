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

  ctx.fillStyle = '#e8e2d7';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(32, 36, 44, 0.42)';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.fillStyle = '#ea5b1b';
  ctx.fillRect(28, 34, 148, 18);
  ctx.fillRect(188, 34, 32, 18);

  ctx.fillStyle = '#1b1e25';
  ctx.font = '700 46px "Consolas", "Segoe UI", monospace';
  ctx.fillText('SCORPIO SC-7', 28, 130);

  ctx.fillStyle = '#404652';
  ctx.font = '700 22px "Consolas", monospace';
  ctx.fillText('UNIT // 07-ALPHA  HYD-48V', 30, 176);

  ctx.fillStyle = '#ea5b1b';
  ctx.fillRect(28, 202, 456, 7);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createScorpioMaterials(): ScorpioMaterials {
  const grain = createMicroGrainTexture(256);
  const decalTex = createSc7DecalTexture();

  const ceramicArmor = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8e2d7'),
    roughness: 0.48,
    metalness: 0.04,
    clearcoat: 0.16,
    clearcoatRoughness: 0.52,
    bumpMap: grain,
    bumpScale: 0.003
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
