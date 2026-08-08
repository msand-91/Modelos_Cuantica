// Representacion del esqueleto molecular y de los objetos de la teoria de
// atomos en moleculas: nucleos, enlaces, puntos criticos, caminos de enlace y
// cuencas atomicas.
//
// Convenio de coordenadas: la fisica usa z como eje polar; la escena usa Y
// hacia arriba. El mapeo es  (x, y, z)_fisica -> (x, z, y)_escena.

import * as THREE from 'three';

export const physToScene = (x, y, z) => [x, z, y];
export const vecScene = (p) => new THREE.Vector3(p[0], p[2], p[1]);

const ANG_TO_BOHR = 1.8897259886;

// --- Nucleos ---------------------------------------------------------------
export function buildNuclei(atoms, opts = {}) {
  const g = new THREE.Group();
  g.name = 'nucleos';
  const scale = opts.scale ?? 1;
  for (const a of atoms) {
    const rb = (a.rcov || 0.4) * ANG_TO_BOHR;
    const r = (0.16 + 0.22 * rb) * scale;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(a.color || '#cccccc'),
        roughness: 0.35, metalness: 0.1,
        emissive: new THREE.Color(a.color || '#cccccc').multiplyScalar(0.12),
      })
    );
    mesh.position.copy(vecScene(a.pos));
    g.add(mesh);
  }
  return g;
}

// --- Enlaces (barras) ------------------------------------------------------
export function buildBonds(atoms, bonds, opts = {}) {
  const g = new THREE.Group();
  g.name = 'enlaces';
  const radius = (opts.radius ?? 0.09) * (opts.scale ?? 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fb2cc, roughness: 0.5, metalness: 0.1 });
  for (const b of bonds) {
    const A = vecScene(atoms[b.i].pos);
    const B = vecScene(atoms[b.j].pos);
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    const geom = new THREE.CylinderGeometry(radius, radius, len, 12, 1, true);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(A).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.add(mesh);
  }
  return g;
}

// --- Puntos criticos de la densidad ----------------------------------------
const CP_STYLE = {
  BCP: { color: 0xffd479, r: 0.10 },   // enlace
  RCP: { color: 0x49e0a0, r: 0.09 },   // anillo
  CCP: { color: 0xc08bff, r: 0.09 },   // caja
  NCP: { color: 0xffffff, r: 0.07 },   // nucleo (maximo de rho)
  NNA: { color: 0x5ae0ff, r: 0.11 },   // atractor NO nuclear (maximo sin nucleo)
};

// `opts.ncp`: dibujar tambien los puntos criticos NUCLEARES. Se activa cuando
// las esferas de los nucleos estan ocultas; si no, quedarian a la vista solo los
// puntos de SILLA (los de enlace, anillo y caja) y la escena contradiria al
// panel, que cuenta los nucleos en la relacion de Poincare-Hopf.
export function buildCriticalPoints(cps, opts = {}) {
  const g = new THREE.Group();
  g.name = 'puntos-criticos';
  const scale = opts.scale ?? 1;
  for (const cp of cps) {
    if (cp.type === 'NCP' && !opts.ncp) continue;   // los NNA se dibujan siempre
    const st = CP_STYLE[cp.type];
    if (!st || st.r === 0) continue;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(st.r * scale, 16, 12),
      new THREE.MeshStandardMaterial({
        color: st.color, emissive: st.color, emissiveIntensity: 0.6, roughness: 0.3,
      })
    );
    mesh.position.copy(vecScene(cp.p));
    mesh.userData.cp = cp;
    g.add(mesh);
  }
  return g;
}

// --- Caminos de enlace ------------------------------------------------------
export function buildBondPaths(paths, opts = {}) {
  const g = new THREE.Group();
  g.name = 'caminos-enlace';
  const mat = new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.9 });
  for (const path of paths) {
    if (!path.points || path.points.length < 2) continue;
    const pts = path.points.map((p) => vecScene(p));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  return g;
}

// --- Superficies interatomicas / cuencas -----------------------------------
// Nube de puntos de la densidad coloreada por CUENCA atomica: es la imagen
// directa de la particion de Bader (cada color es un "atomo en la molecula").
export function buildBasinCloud(bader, atoms, opts = {}) {
  const { owner, rho, N, H, step } = bader;
  const rhoMin = opts.rhoMin ?? 0.02;
  const maxPoints = opts.maxPoints ?? 60000;

  // Primera pasada: contar candidatos para decidir el submuestreo.
  let candidates = 0;
  for (let c = 0; c < rho.length; c++) if (rho[c] > rhoMin) candidates++;
  const keep = candidates > maxPoints ? maxPoints / candidates : 1;

  const positions = [];
  const colors = [];
  const col = new THREE.Color();
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let k = 0; k < N; k++) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const c = (k * N + j) * N + i;
        if (rho[c] <= rhoMin) continue;
        if (keep < 1 && rnd() > keep) continue;
        const o = owner[c];
        if (o < 0 || o >= atoms.length) continue;
        const x = -H + i * step, y = -H + j * step, z = -H + k * step;
        const s = physToScene(x, y, z);
        positions.push(s[0], s[1], s[2]);
        col.set(atoms[o].color || '#ffffff');
        colors.push(col.r, col.g, col.b);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: (opts.size ?? 0.06) * (opts.scale ?? 1),
    vertexColors: true, transparent: true, opacity: opts.opacity ?? 0.85,
    sizeAttenuation: true, depthWrite: false,
  });
  const pts = new THREE.Points(geom, mat);
  pts.name = 'cuencas';
  return pts;
}

// Etiquetas flotantes para los puntos criticos (sprites con texto).
export function buildCPLabels(cps, opts = {}) {
  const g = new THREE.Group();
  g.name = 'etiquetas-cp';
  for (const cp of cps) {
    if (cp.type !== 'BCP' || !cp.label) continue;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(10,14,23,0.75)';
    c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#ffd479';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${cp.label}  ρ=${cp.rho.toFixed(3)}`, 128, 32);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false,
    }));
    spr.position.copy(vecScene(cp.p));
    spr.position.y += 0.25;
    const s = (opts.scale ?? 1) * 1.1;
    spr.scale.set(s, s / 4, 1);
    spr.renderOrder = 3;
    g.add(spr);
  }
  return g;
}
