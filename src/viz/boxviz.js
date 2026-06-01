import * as THREE from 'three';
import { psi1D, psi2D, psi3D } from '../physics/box.js';
import { sampleField } from './field3d.js';
import { buildIsosurface } from './isosurface.js';
import { buildPointCloud } from './pointcloud.js';
import { buildSlices } from './slices.js';

// Marco (caja) de alambre para dar contexto espacial.
function boxFrame(Lx, Ly, Lz) {
  const geom = new THREE.BoxGeometry(Lx, Lz, Ly); // mapeo z_fisico -> Y_escena
  const edges = new THREE.EdgesGeometry(geom);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.5 })
  );
  return line;
}

// ---- Caja 1D: curva psi_n(x) dibujada como altura sobre el eje x ----
export function buildBox1D(n, L, amp = 2.5) {
  const group = new THREE.Group();
  const pts = [];
  const samples = 200;
  for (let i = 0; i < samples; i++) {
    const x = (L * i) / (samples - 1);
    const v = psi1D(n, L, x);
    pts.push(new THREE.Vector3(x - L / 2, v * amp, 0));
  }
  const curve = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xff5a6e, linewidth: 2 })
  );
  group.add(curve);

  // Linea base (la caja) y paredes.
  const base = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-L / 2, 0, 0),
      new THREE.Vector3(L / 2, 0, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.6 })
  );
  group.add(base);
  return group;
}

// ---- Caja 2D: superficie de altura psi(x,y) coloreada por signo ----
export function buildBox2D(nx, ny, Lx, Ly, amp = 2.0) {
  const group = new THREE.Group();
  const res = 60;
  const geom = new THREE.PlaneGeometry(Lx, Ly, res, res);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + Lx / 2;
    const py = pos.getY(i) + Ly / 2;
    const v = psi2D(nx, ny, Lx, Ly, px, py);
    pos.setZ(i, v * amp);
    if (v >= 0) { colors[i * 3] = 1; colors[i * 3 + 1] = 0.35; colors[i * 3 + 2] = 0.43; }
    else { colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 1; }
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5 })
  );
  mesh.rotation.x = -Math.PI / 2; // tumbar sobre el plano XZ, altura -> Y
  group.add(mesh);
  group.add(boxFrame(Lx, Ly, 0.02));
  return group;
}

// ---- Caja 3D: misma maquinaria que el hidrogeno (iso/nube/cortes) ----
export function buildBox3D(nx, ny, nz, Lx, Ly, Lz, opts) {
  const group = new THREE.Group();
  const H = Math.max(Lx, Ly, Lz) / 2;
  // psi centrada en el origen de la escena.
  const psiFn = (x, y, z) =>
    psi3D(nx, ny, nz, Lx, Ly, Lz, x + Lx / 2, y + Ly / 2, z + Lz / 2);

  group.add(boxFrame(Lx, Ly, Lz));

  const field = sampleField((x, y, z) => psiFn(x, y, z), opts.gridN, H);

  if (opts.showIso) group.add(buildIsosurface(field, opts.isoLevel, opts.opacity));
  if (opts.showPoints)
    group.add(buildPointCloud(psiFn, opts.pointCount, H, field.absMax, opts.opacity));
  if (opts.showSlices)
    group.add(buildSlices(psiFn, H, field.absMax, opts.slicePlanes, 128));

  return { group, psiFn, H };
}
