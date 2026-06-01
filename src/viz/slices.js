import * as THREE from 'three';
import { diverging } from '../core/colormap.js';

// Cortes (planos) que cruzan el campo mostrando el VALOR de psi como mapa de
// color divergente (azul - / blanco 0 / rojo +). Utiles para ver los nodos
// radiales y angulares. Se generan planos XY, XZ y/o YZ a discrecion.
//
// psiFn: (x,y,z) -> valor;  H: semilado;  res: resolucion de la textura.
function makeSliceTexture(psiFn, plane, H, res, absMax) {
  const data = new Uint8Array(res * res * 4);
  const col = new THREE.Color();
  const scale = absMax || 1;
  let idx = 0;
  for (let b = 0; b < res; b++) {
    const vb = -H + (2 * H * b) / (res - 1);
    for (let a = 0; a < res; a++) {
      const va = -H + (2 * H * a) / (res - 1);
      let x = 0, y = 0, z = 0;
      if (plane === 'xy') { x = va; y = vb; }
      else if (plane === 'xz') { x = va; z = vb; }
      else { y = va; z = vb; } // yz
      const v = psiFn(x, y, z);
      diverging(v / scale, col);
      data[idx] = col.r * 255;
      data[idx + 1] = col.g * 255;
      data[idx + 2] = col.b * 255;
      data[idx + 3] = 255;
      idx += 4;
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function buildSlices(psiFn, H, absMax, planes = ['xz'], res = 128) {
  const group = new THREE.Group();
  group.name = 'cortes';
  const size = 2 * H;

  for (const plane of planes) {
    const tex = makeSliceTexture(psiFn, plane, H, res, absMax);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const geom = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geom, mat);
    if (plane === 'xy') mesh.rotation.set(0, 0, 0);
    else if (plane === 'xz') mesh.rotation.set(-Math.PI / 2, 0, 0);
    else mesh.rotation.set(0, Math.PI / 2, 0); // yz
    group.add(mesh);
  }
  return group;
}
