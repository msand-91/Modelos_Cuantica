import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Construye el escenario base: renderer (con WebXR activado), escena, camara,
// luces, controles de orbita y elementos de referencia (ejes + rejilla).
//
// Devuelve tambien un `group` (THREE.Group) que CONTIENE toda la visualizacion.
// En VR este grupo es el que se agarra / rota / escala con los mandos, de modo
// que la camara del usuario no se ve afectada.
export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  // Nitidez en VR: subir la resolucion del framebuffer XR y desactivar la
  // foveacion (que difumina la periferia) para que la nube de puntos y los
  // bordes se vean menos borrosos en el Quest.
  renderer.xr.setFramebufferScaleFactor(1.3);
  renderer.xr.setFoveation(0);
  renderer.setClearColor(0x0a0e17, 1);
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  );
  camera.position.set(8, 6, 12);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Iluminacion.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(5, 10, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
  fill.position.set(-6, -4, -8);
  scene.add(fill);

  // Grupo contenedor de la visualizacion (se manipula en VR).
  const group = new THREE.Group();
  scene.add(group);

  // En VR colocamos el contenido a la altura de los ojos y un poco al frente.
  const xrPivot = new THREE.Group();
  xrPivot.add(group);
  scene.add(xrPivot);
  scene.remove(group);

  // Referencias visuales (ejes + rejilla del plano XZ). Van DENTRO del grupo del
  // orbital para que se muevan, roten y escalen junto con el atomo (son su
  // sistema de coordenadas).
  const refs = createReferences();
  group.add(refs);

  // Reaccionar al cambio de tamano de ventana.
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Al entrar/salir de VR ajustamos posicion y escala del contenido. (El ajuste
  // fino al tamano del orbital lo hace main.js con fitInVR; esto es el valor por
  // defecto.) Las referencias cuelgan de `group`, asi que se mueven con el.
  renderer.xr.addEventListener('sessionstart', () => {
    xrPivot.position.set(0, 1.4, -1.2);
    xrPivot.scale.setScalar(0.12); // las escenas en a0 son grandes; reducir para VR
  });
  renderer.xr.addEventListener('sessionend', () => {
    xrPivot.position.set(0, 0, 0);
    xrPivot.scale.setScalar(1);
  });

  return { renderer, scene, camera, controls, group, xrPivot, refs };
}

function createReferences() {
  const g = new THREE.Group();
  g.name = 'referencias';

  const axes = new THREE.AxesHelper(6);
  axes.material.depthTest = false;
  axes.renderOrder = 1;
  g.add(axes);

  const grid = new THREE.GridHelper(20, 20, 0x33405c, 0x1c2536);
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  g.add(grid);

  // Etiquetas de los ejes FISICOS. Mapeo escena->fisica: X=x, Y=z, Z=y.
  g.add(axisLabel('x', '#ff6b6b', 6.7, 0, 0));
  g.add(axisLabel('z', '#7bdc8b', 0, 6.7, 0)); // eje vertical de escena = z fisico
  g.add(axisLabel('y', '#6b9bff', 0, 0, 6.7));

  return g;
}

// Etiqueta de texto como sprite (siempre encara a la camara).
function axisLabel(text, color, x, y, z) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = color;
  c.font = 'bold 48px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 32, 32);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true,
  }));
  spr.position.set(x, y, z);
  spr.scale.set(1.3, 1.3, 1.3);
  spr.renderOrder = 2;
  return spr;
}
