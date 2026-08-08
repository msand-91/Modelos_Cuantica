import * as THREE from 'three';

// Textura circular (disco con borde suave) compartida, para que cada punto sea
// un circulo nitido en vez del cuadrado por defecto (que se ve borroso en VR).
let _discTex = null;
function discTexture() {
  if (_discTex) return _discTex;
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.7, 'rgba(255,255,255,1)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  _discTex = new THREE.CanvasTexture(cv);
  return _discTex;
}

// Nube de puntos cuya DENSIDAD representa |psi|^2 (probabilidad de presencia
// del electron). Se genera por muestreo por rechazo: se proponen puntos al azar
// en el cubo [-H,H]^3 y se aceptan con probabilidad |psi|^2 / max(|psi|^2).
// Cada punto se colorea por el signo de psi (rojo +, azul -).
// form: 'puntos' | 'lineas'   colorScheme: 'sign' (rojo/azul) | 'violet' (azul/violeta)
export function buildPointCloud(psiFn, count, H, maxAbs, opacity = 0.9, form = 'puntos', colorScheme = 'sign') {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const maxDensity = maxAbs * maxAbs || 1;

  const POS = colorScheme === 'violet' ? [0.66, 0.55, 1.0] : [1.0, 0.353, 0.43];
  const NEG = colorScheme === 'violet' ? [0.40, 0.80, 1.0] : [0.302, 0.545, 1.0];

  // Escala CONTINUA: en vez de dos colores planos por signo, un degradado que
  // recorre el valor del campo. Se usa escala logaritmica con signo porque
  // estos campos abarcan varios ordenes de magnitud y en lineal casi todos los
  // puntos caerian en el mismo tono.
  const continuo = colorScheme === 'continuo';
  const v0 = Math.max(1e-6, maxAbs * 1e-3);
  const kLog = Math.log1p(maxAbs / v0) || 1;
  const rampa = (v, out) => {
    const t = Math.sign(v) * Math.log1p(Math.abs(v) / v0) / kLog;   // −1 … +1
    const a = Math.min(1, Math.abs(t));
    if (t >= 0) {                     // gris pálido -> rojo intenso
      out[0] = 0.86 + 0.14 * a;
      out[1] = 0.86 - 0.51 * a;
      out[2] = 0.86 - 0.43 * a;
    } else {                          // gris pálido -> azul intenso
      out[0] = 0.86 - 0.56 * a;
      out[1] = 0.86 - 0.32 * a;
      out[2] = 0.86 + 0.14 * a;
    }
    return out;
  };
  const tmpCol = [0, 0, 0];

  let accepted = 0;
  let attempts = 0;
  const maxAttempts = count * 400;
  while (accepted < count && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() * 2 - 1) * H;
    const y = (Math.random() * 2 - 1) * H;
    const z = (Math.random() * 2 - 1) * H;
    const v = psiFn(x, y, z);
    const density = v * v;
    if (Math.random() < density / maxDensity) {
      const o = accepted * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
      const c = continuo ? rampa(v, tmpCol) : (v >= 0 ? POS : NEG);
      colors[o] = c[0];
      colors[o + 1] = c[1];
      colors[o + 2] = c[2];
      accepted++;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, accepted * 3), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, accepted * 3), 3));

  // Estilo 'lines': bucles SUAVES (circunferencias) repartidos por las capas de
  // radio, con cada vertice iluminado segun la densidad |psi|^2 (brilla donde
  // hay probabilidad, se atenua donde no). Curvas suaves por construccion ->
  // aspecto ordenado tipo qbit.lab. Se devuelve como LineSegments.
  if (form === 'lineas') {
    const SEGS = 160;
    const THRESH = 0.1; // solo se dibujan los arcos con densidad relativa > THRESH
    const nLoops = Math.max(50, Math.min(260, Math.floor(count / 220)));
    const verts = [];
    const cols = [];

    const randDir = () => {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [s * Math.cos(t), s * Math.sin(t), u];
    };
    const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

    let made = 0, tries = 0;
    while (made < nLoops && tries < nLoops * 30) {
      tries++;
      const r = Math.random() * H;
      // Plano del bucle: normal aleatoria n y base ortonormal (u, v).
      const n = randDir();
      const a0 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const dot = a0[0] * n[0] + a0[1] * n[1] + a0[2] * n[2];
      const u = norm([a0[0] - dot * n[0], a0[1] - dot * n[1], a0[2] - dot * n[2]]);
      const v = cross(n, u);

      // Densidad media del bucle (muestra rapida) para aceptar capas con peso.
      let mean = 0;
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const val = psiFn(r * (u[0] * dx + v[0] * dy), r * (u[1] * dx + v[1] * dy), r * (u[2] * dx + v[2] * dy));
        mean += (val * val) / maxDensity;
      }
      mean /= 8;
      if (Math.random() > Math.min(1, Math.sqrt(mean) * 2.2)) continue; // rechaza capas poco probables
      made++;

      let prev = null, prevC = null, prevI = 0;
      for (let s = 0; s <= SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const x = r * (u[0] * dx + v[0] * dy);
        const y = r * (u[1] * dx + v[1] * dy);
        const z = r * (u[2] * dx + v[2] * dy);
        const val = psiFn(x, y, z);
        const dens = (val * val) / maxDensity;
        const inten = Math.min(1, Math.pow(dens, 0.45) * 1.7);
        const base = val >= 0 ? POS : NEG;
        const col = [base[0] * inten, base[1] * inten, base[2] * inten];
        // Solo se dibuja el segmento donde HAY densidad -> emergen los lobulos.
        if (prev && Math.max(prevI, inten) > THRESH) {
          verts.push(prev[0], prev[1], prev[2], x, y, z);
          cols.push(prevC[0], prevC[1], prevC[2], col[0], col[1], col[2]);
        }
        prev = [x, y, z]; prevC = col; prevI = inten;
      }
    }

    const lgeom = new THREE.BufferGeometry();
    lgeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    lgeom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: Math.min(0.7, opacity),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lgeom, lineMat);
    lines.name = 'nube-lineas';
    return lines;
  }

  const mat = new THREE.PointsMaterial({
    size: H * 0.016,
    map: discTexture(),
    alphaTest: 0.4, // circulos nitidos que ocluyen bien
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: true,
  });

  const points = new THREE.Points(geom, mat);
  points.name = 'nube-puntos';
  return points;
}
