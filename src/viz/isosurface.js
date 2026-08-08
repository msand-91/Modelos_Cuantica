import * as THREE from 'three';
import { edgeTable, triTable } from './mctables.js';

// Marching Cubes sobre un campo escalar (objeto de field3d.js).
// Extrae la superficie donde data == level y devuelve una BufferGeometry.
function marchingCubes(field, level) {
  const { data, N, step, origin } = field;
  const positions = [];

  // Aristas del cubo: pares de vertices (0..7).
  const edgeVerts = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  // Desplazamientos de los 8 vertices del cubo.
  const vo = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];

  const idx = (i, j, k) => i + N * (j + N * k);
  const val = new Float64Array(8);
  const pos = new Array(8);
  const edgeP = new Array(12);

  for (let k = 0; k < N - 1; k++) {
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        let cubeindex = 0;
        for (let v = 0; v < 8; v++) {
          const o = vo[v];
          const value = data[idx(i + o[0], j + o[1], k + o[2])];
          val[v] = value;
          pos[v] = [
            origin + (i + o[0]) * step,
            origin + (j + o[1]) * step,
            origin + (k + o[2]) * step,
          ];
          if (value < level) cubeindex |= 1 << v;
        }

        const edges = edgeTable[cubeindex];
        if (edges === 0) continue;

        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) {
            const a = edgeVerts[e][0];
            const b = edgeVerts[e][1];
            const va = val[a];
            const vb = val[b];
            let t = (level - va) / (vb - va);
            if (!isFinite(t)) t = 0.5;
            const pa = pos[a];
            const pb = pos[b];
            edgeP[e] = [
              pa[0] + t * (pb[0] - pa[0]),
              pa[1] + t * (pb[1] - pa[1]),
              pa[2] + t * (pb[2] - pa[2]),
            ];
          }
        }

        const tris = triTable[cubeindex];
        for (let t = 0; t < tris.length; t += 3) {
          const p0 = edgeP[tris[t]];
          const p1 = edgeP[tris[t + 1]];
          const p2 = edgeP[tris[t + 2]];
          positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Construye un grupo con dos isosuperficies: una para el lobulo positivo
// (+level) y otra para el negativo (-level), coloreadas por signo.
// `level` es una fraccion (0..1) del valor absoluto maximo del campo.
export function buildIsosurface(field, levelFraction, opacity = 0.85) {
  const group = new THREE.Group();
  group.name = 'isosuperficie';
  const lvl = levelFraction * field.absMax;

  const mat = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.0,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      flatShading: false,
    });

  const posGeom = marchingCubes(field, lvl);
  if (posGeom.getAttribute('position').count > 0) {
    group.add(new THREE.Mesh(posGeom, mat(0xff5a6e)));
  }

  // Para el lobulo negativo extraemos la superficie a -lvl.
  const negGeom = marchingCubes(field, -lvl);
  if (negGeom.getAttribute('position').count > 0) {
    group.add(new THREE.Mesh(negGeom, mat(0x4d8bff)));
  }

  return group;
}

// PILA de isosuperficies: varias capas anidadas en progresion geometrica, con
// el color y la opacidad graduados segun el valor. Una sola isosuperficie
// convierte un campo continuo en una dicotomia (dentro/fuera, rojo/azul); con
// varias capas se recupera la nocion de GRADIENTE sin renunciar a ver la forma.
//
// Los niveles crecen en potencias de 2 porque los campos de este programa
// abarcan varios ordenes de magnitud (el laplaciano va de 1e-2 a 1e5): en
// escala lineal las capas se amontonarian todas en el mismo sitio.
export function buildIsosurfaceStack(field, levelFraction, opacity = 0.85, nLayers = 3) {
  const group = new THREE.Group();
  group.name = 'isosuperficies';
  const base = levelFraction * field.absMax;

  for (let k = 0; k < nLayers; k++) {
    const lvl = base * Math.pow(2, k);
    if (lvl >= field.absMax) break;
    const t = nLayers > 1 ? k / (nLayers - 1) : 1;

    // El gradiente se lleva en la OPACIDAD, no en desaturar el color. Aclarar
    // las capas exteriores hacia el gris parecia buena idea, pero al
    // superponerse varias translucidas —roja sobre azul— la mezcla se vuelve
    // parda y se pierde el signo. Manteniendo el tono saturado y variando solo
    // la transparencia, cada capa conserva su color y el degradado se lee.
    const alpha = opacity * (0.10 + 0.45 * t * t);
    const mezcla = (a, b) => a + (b - a) * t;
    const rojo = [mezcla(1.00, 0.90), mezcla(0.45, 0.16), mezcla(0.50, 0.24)];
    const azul = [mezcla(0.42, 0.13), mezcla(0.60, 0.34), mezcla(1.00, 0.95)];

    const mat = (rgb) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
      roughness: 0.45, metalness: 0,
      transparent: true, opacity: Math.min(1, alpha),
      depthWrite: t > 0.85,
      // Solo la capa interna se dibuja por las dos caras: con DoubleSide cada
      // cascara translucida se mezcla dos veces y el conjunto se emblanquece.
      side: t > 0.85 ? THREE.DoubleSide : THREE.FrontSide,
    });

    const gp = marchingCubes(field, lvl);
    if (gp.getAttribute('position').count > 0) group.add(new THREE.Mesh(gp, mat(rojo)));
    const gn = marchingCubes(field, -lvl);
    if (gn.getAttribute('position').count > 0) group.add(new THREE.Mesh(gn, mat(azul)));
  }
  return group;
}

// Isosuperficie de DENSIDAD |psi|^2 (siempre >= 0): una sola superficie de un
// color (no hay signo). `field` debe ser el muestreo de |psi|^2.
export function buildDensityIsosurface(field, levelFraction, opacity = 0.85, color = 0x49e0a0) {
  const group = new THREE.Group();
  group.name = 'densidad';
  const lvl = levelFraction * field.absMax;
  const geom = marchingCubes(field, lvl);
  if (geom.getAttribute('position').count > 0) {
    group.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0,
      transparent: opacity < 1, opacity, side: THREE.DoubleSide,
    })));
  }
  return group;
}

// Superficie NODAL: el lugar donde psi = 0 (frontera entre lobulos + y -).
// Incluye nodos radiales (esferas) y angulares (planos/conos). `field` es psi.
export function buildNodalSurface(field, opacity = 0.45, color = 0xffe066) {
  const group = new THREE.Group();
  group.name = 'nodos';
  const geom = marchingCubes(field, 0);
  if (geom.getAttribute('position').count > 0) {
    group.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      color, roughness: 0.5, metalness: 0,
      transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    })));
  }
  return group;
}
