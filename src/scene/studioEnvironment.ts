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

  const boxMeshes: THREE.Mesh[] = [];
  const addSoftbox = (
    w: number,
    h: number,
    color: THREE.Color,
    pos: [number, number, number],
    rotX?: number
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    mesh.position.set(...pos);
    if (rotX !== undefined) {
      mesh.rotation.x = rotX;
    } else {
      mesh.lookAt(0, 0.5, 0);
    }
    envScene.add(mesh);
    boxMeshes.push(mesh);
  };

  addSoftbox(14, 14, new THREE.Color(2.4, 2.34, 2.24), [0, 7.5, 0], Math.PI / 2);
  addSoftbox(10, 6, new THREE.Color(1.45, 1.48, 1.54), [-8, 3.2, 2]);
  addSoftbox(10, 5, new THREE.Color(1.85, 1.72, 1.52), [8, 2.8, -3]);
  addSoftbox(24, 24, new THREE.Color('#cfc3b0'), [0, -3, 0], -Math.PI / 2);

  const rt = pmrem.fromScene(envScene, 0.04);
  for (const m of boxMeshes) {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
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
  grad.addColorStop(0, 'rgba(42, 34, 25, 0.54)');
  grad.addColorStop(0.38, 'rgba(48, 38, 28, 0.28)');
  grad.addColorStop(0.75, 'rgba(54, 44, 34, 0.07)');
  grad.addColorStop(1, 'rgba(54, 44, 34, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
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

  // Subtle calibration rings around the robot stage
  ctx.strokeStyle = 'rgba(130, 114, 92, 0.12)';
  ctx.lineWidth = 1.5;
  for (const r of [110, 175, 240]) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

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

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.92,
    metalness: 0.0
  });
  const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(36, 96), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.2, color: new THREE.Color('#3b3024') })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.0015;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

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
