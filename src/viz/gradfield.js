import * as THREE from 'three';

// CAMPO VECTORIAL DEL GRADIENTE DE LA DENSIDAD, grad rho.
//
// Es el objeto que define toda la teoria de atomos en moleculas: cada flecha
// apunta "cuesta arriba" en densidad electronica, y la trayectoria que se
// obtiene siguiendo las flechas SIEMPRE acaba en un nucleo. El conjunto de
// trayectorias que terminan en el mismo nucleo es su CUENCA atomica, y la
// superficie que separa dos haces de trayectorias —la que ninguna flecha cruza—
// es la superficie de flujo cero.
//
// Conviene no confundirlo con el laplaciano: grad rho dice hacia donde CRECE la
// densidad; lap rho dice si en ese punto la densidad esta amontonada o hueca
// respecto de su entorno. Son derivadas distintas de la misma funcion.
//
//   gradFn(x, y, z) -> [gx, gy, gz]   en coordenadas de ESCENA
//   rhoFn(x, y, z)  -> rho            en coordenadas de ESCENA
//   planes: 'xy' | 'xz' | 'yz' (mismo convenio que los cortes)

const ejes = {
  xy: [[1, 0, 0], [0, 1, 0]],
  xz: [[1, 0, 0], [0, 0, 1]],
  yz: [[0, 1, 0], [0, 0, 1]],
};

// Modo VOLUMEN: flechas sobre una rejilla 3D, con el gradiente completo (no su
// proyeccion). Se usa una rejilla mucho mas basta que en el plano porque en
// volumen las flechas se tapan entre si enseguida.
function campoVolumen(gradFn, rhoFn, H, opts) {
  const g = new THREE.Group();
  g.name = 'campo-gradiente-3d';
  const n = opts.n3 ?? 9;
  const rhoMin = opts.rhoMin3 ?? 8e-3;
  const step = (2 * H) / (n - 1);
  const len = step * 0.40;
  const barb = len * 0.40;
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const lo = Math.log10(opts.gMin ?? 1e-3);
  const hi = Math.log10(opts.gMax ?? 3);
  const tmp = new THREE.Vector3();
  const u = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const eje = new THREE.Vector3();

  for (let k = 0; k < n; k++) {
    const z = -H + k * step;
    for (let j = 0; j < n; j++) {
      const y = -H + j * step;
      for (let i = 0; i < n; i++) {
        const x = -H + i * step;
        if (rhoFn(x, y, z) < rhoMin) continue;
        const gr = gradFn(x, y, z);
        u.set(gr[0], gr[1], gr[2]);
        const gn = u.length();
        if (!(gn > 0)) continue;
        u.divideScalar(gn);

        const t = Math.min(1, Math.max(0, (Math.log10(gn) - lo) / (hi - lo)));
        c.setHSL(0.52 - 0.12 * t, 0.75, 0.35 + 0.42 * t);
        const push = (v) => { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); };

        const cola = tmp.set(x, y, z).addScaledVector(u, -len).clone();
        const punta = tmp.set(x, y, z).addScaledVector(u, len).clone();
        push(cola); push(punta);
        // Barbas: en el plano que forman u y una direccion cualquiera no paralela.
        eje.set(Math.abs(u.x) < 0.9 ? 1 : 0, Math.abs(u.x) < 0.9 ? 0 : 1, 0);
        perp.copy(eje).cross(u).normalize();
        for (const sgn of [1, -1]) {
          push(punta);
          push(tmp.copy(punta).addScaledVector(u, -barb).addScaledVector(perp, sgn * barb * 0.6).clone());
        }
      }
    }
  }
  if (!pos.length) return g;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: opts.opacity ?? 0.75, depthWrite: false,
  })));
  return g;
}

export function buildGradientField(gradFn, rhoFn, H, planes = ['xz'], opts = {}) {
  if (opts.modo === 'volumen') return campoVolumen(gradFn, rhoFn, H, opts);
  const g = new THREE.Group();
  g.name = 'campo-gradiente';
  const n = opts.n ?? 17;                    // flechas por lado
  const rhoMin = opts.rhoMin ?? 2e-3;        // por debajo no hay nada que contar
  const step = (2 * H) / (n - 1);
  const len = step * 0.44;                   // media longitud de cada flecha
  const barb = len * 0.42;                   // longitud de las barbas de la punta

  const pos = [];
  const col = [];
  const c = new THREE.Color();
  // Escala de color: el gradiente varia muchos ordenes de magnitud, asi que se
  // usa el logaritmo. Claro = gradiente fuerte (cerca de los nucleos).
  const lo = Math.log10(opts.gMin ?? 1e-3);
  const hi = Math.log10(opts.gMax ?? 3);

  for (const plane of planes) {
    const [ea, eb] = ejes[plane] || ejes.xz;
    for (let j = 0; j < n; j++) {
      const vb = -H + j * step;
      for (let i = 0; i < n; i++) {
        const va = -H + i * step;
        const x = ea[0] * va + eb[0] * vb;
        const y = ea[1] * va + eb[1] * vb;
        const z = ea[2] * va + eb[2] * vb;
        if (rhoFn(x, y, z) < rhoMin) continue;

        const gr = gradFn(x, y, z);
        // Proyeccion sobre el plano: fuera de el la flecha no se veria.
        const ga = gr[0] * ea[0] + gr[1] * ea[1] + gr[2] * ea[2];
        const gb = gr[0] * eb[0] + gr[1] * eb[1] + gr[2] * eb[2];
        const gn = Math.hypot(ga, gb);
        if (!(gn > 0)) continue;
        const ua = ga / gn, ub = gb / gn;

        const t = Math.min(1, Math.max(0, (Math.log10(gn) - lo) / (hi - lo)));
        c.setHSL(0.52 - 0.12 * t, 0.75, 0.35 + 0.42 * t);

        const push = (aa, bb) => {
          pos.push(ea[0] * aa + eb[0] * bb, ea[1] * aa + eb[1] * bb, ea[2] * aa + eb[2] * bb);
          col.push(c.r, c.g, c.b);
        };
        const a0 = va - ua * len, b0 = vb - ub * len;   // cola
        const a1 = va + ua * len, b1 = vb + ub * len;   // punta
        push(a0, b0); push(a1, b1);
        // Punta de flecha: dos barbas a ±30° del eje.
        for (const s of [1, -1]) {
          const ang = Math.atan2(ub, ua) + s * 2.6;     // ~150° respecto al avance
          push(a1, b1);
          push(a1 + Math.cos(ang) * barb, b1 + Math.sin(ang) * barb);
        }
      }
    }
  }
  if (!pos.length) return g;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: opts.opacity ?? 0.9, depthWrite: false,
  });
  g.add(new THREE.LineSegments(geom, mat));
  return g;
}
