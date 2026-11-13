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
