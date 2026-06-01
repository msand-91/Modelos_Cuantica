// Funciones de onda del atomo de hidrogeno (un electron, Z ajustable).
//
//   psi_nlm(r, theta, phi) = R_nl(r) * Y_lm(theta, phi)
//
// Usamos ARMONICOS ESFERICOS REALES, que son las combinaciones que dan los
// orbitales "de quimica" (s, p_x, p_y, p_z, d_z2, d_xz, ...). Todo en unidades
// atomicas (a0 = 1). r en unidades de a0.

import { factorial, laguerre } from './constants.js';

// ---------------------------------------------------------------------------
// Parte radial  R_nl(r)
//   R_nl(r) = N * (2Zr/n)^l * exp(-Zr/n) * L_{n-l-1}^{2l+1}(2Zr/n)
//   N = sqrt( (2Z/n)^3 * (n-l-1)! / (2n (n+l)!) )
// ---------------------------------------------------------------------------
export function radial(n, l, r, Z = 1) {
  if (l > n - 1) return 0;
  const rho = (2 * Z * r) / n;
  const norm = Math.sqrt(
    Math.pow((2 * Z) / n, 3) * (factorial(n - l - 1) / (2 * n * factorial(n + l)))
  );
  return norm * Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}

// Distribucion de probabilidad radial  P(r) = r^2 * R_nl(r)^2
// (la "probabilidad de encontrar el electron en un cascaron a distancia r").
export function radialDistribution(n, l, r, Z = 1) {
  const R = radial(n, l, r, Z);
  return r * r * R * R;
}

// ---------------------------------------------------------------------------
// Parte angular: armonicos esfericos REALES Y_lm(theta, phi)
// Convencion del proyecto para el indice m:
//   m = 0            -> termino "z" (cos)
//   m > 0            -> termino tipo coseno
//   m < 0            -> termino tipo seno
// theta = angulo polar desde +z (0..pi); phi = azimut en el plano xy (0..2pi).
// ---------------------------------------------------------------------------
const SQRT = Math.sqrt;
const PI = Math.PI;

export function angularReal(l, m, theta, phi) {
  // Cosenos directores (vector unitario sobre la esfera).
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const x = st * Math.cos(phi);
  const y = st * Math.sin(phi);
  const z = ct;

  switch (l) {
    case 0:
      return 0.5 * SQRT(1 / PI);

    case 1:
      if (m === 0) return SQRT(3 / (4 * PI)) * z;      // p_z
      if (m === 1) return SQRT(3 / (4 * PI)) * x;      // p_x
      return SQRT(3 / (4 * PI)) * y;                   // p_y  (m = -1)

    case 2:
      if (m === 0) return 0.25 * SQRT(5 / PI) * (3 * z * z - 1);       // d_z2
      if (m === 1) return 0.5 * SQRT(15 / PI) * x * z;                 // d_xz
      if (m === -1) return 0.5 * SQRT(15 / PI) * y * z;                // d_yz
      if (m === 2) return 0.25 * SQRT(15 / PI) * (x * x - y * y);      // d_x2-y2
      return 0.5 * SQRT(15 / PI) * x * y;                             // d_xy (m=-2)

    case 3:
      if (m === 0) return 0.25 * SQRT(7 / PI) * z * (5 * z * z - 3);          // f_z3
      if (m === 1) return 0.25 * SQRT(21 / (2 * PI)) * x * (5 * z * z - 1);   // f_xz2
      if (m === -1) return 0.25 * SQRT(21 / (2 * PI)) * y * (5 * z * z - 1);  // f_yz2
      if (m === 2) return 0.25 * SQRT(105 / PI) * z * (x * x - y * y);        // f_z(x2-y2)
      if (m === -2) return 0.5 * SQRT(105 / PI) * x * y * z;                  // f_xyz
      if (m === 3) return 0.25 * SQRT(35 / (2 * PI)) * x * (x * x - 3 * y * y); // f_x(x2-3y2)
      return 0.25 * SQRT(35 / (2 * PI)) * y * (3 * x * x - y * y);            // f_y(3x2-y2)

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Funcion de onda completa en coordenadas esfericas y cartesianas.
// ---------------------------------------------------------------------------
export function psiSpherical(n, l, m, r, theta, phi, Z = 1) {
  return radial(n, l, r, Z) * angularReal(l, m, theta, phi);
}

export function psiCartesian(n, l, m, x, y, z, Z = 1) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) {
    // En el origen solo los orbitales s tienen valor finito no nulo.
    return l === 0 ? radial(n, 0, 0, Z) * angularReal(0, 0, 0, 0) : 0;
  }
  const theta = Math.acos(z / r);
  const phi = Math.atan2(y, x);
  return psiSpherical(n, l, m, r, theta, phi, Z);
}

// Energia del nivel n (eV).  E_n = -13.6 * (mu/m_e) * Z^2 / n^2
// El factor de masa reducida muFactor = mu/m_e (=1 para nucleo infinito) da el
// efecto isotopico entre H, D y T.
export function energyEV(n, Z = 1, muFactor = 1) {
  return (-13.605693 * muFactor * Z * Z) / (n * n);
}

// ---------------------------------------------------------------------------
// Catalogo de orbitales seleccionables (n = 1..4) con etiqueta quimica.
// ---------------------------------------------------------------------------
const SUBSHELL = ['s', 'p', 'd', 'f'];
const ANG_LABEL = {
  '0,0': '',
  '1,0': 'z', '1,1': 'x', '1,-1': 'y',
  '2,0': 'z²', '2,1': 'xz', '2,-1': 'yz', '2,2': 'x²-y²', '2,-2': 'xy',
  '3,0': 'z³', '3,1': 'xz²', '3,-1': 'yz²', '3,2': 'z(x²-y²)',
  '3,-2': 'xyz', '3,3': 'x(x²-3y²)', '3,-3': 'y(3x²-y²)',
};

// Etiqueta en texto plano (p.ej. "2pz", "3dxy"). Sin guion bajo: apta para
// los <option> del desplegable, que no admiten HTML.
export function orbitalLabel(n, l, m) {
  const sub = SUBSHELL[l] || `l${l}`;
  const ang = ANG_LABEL[`${l},${m}`] || '';
  return `${n}${sub}${ang}`;
}

// Etiqueta con el descriptor angular como subindice HTML (p.ej. "2p<sub>z</sub>").
// Para titulos en HTML (panel de informacion), NO para <option>.
export function orbitalLabelHTML(n, l, m) {
  const sub = SUBSHELL[l] || `l${l}`;
  const ang = ANG_LABEL[`${l},${m}`] || '';
  return ang ? `${n}${sub}<sub>${ang}</sub>` : `${n}${sub}`;
}

// maxL limita el momento angular (la parte angular real solo llega a l=3 = f).
export function buildCatalog(maxN = 4, maxL = 3) {
  const list = [];
  for (let n = 1; n <= maxN; n++) {
    for (let l = 0; l < n && l <= maxL; l++) {
      for (let m = -l; m <= l; m++) {
        list.push({ n, l, m, label: orbitalLabel(n, l, m) });
      }
    }
  }
  return list;
}

// Numero de nodos.
export const radialNodes = (n, l) => n - l - 1;
export const angularNodes = (l) => l;

// Radio caracteristico para fijar el tamano del muestreo de cada orbital.
// Aproximadamente el alcance de la nube electronica del nivel n.
export function characteristicRadius(n, Z = 1) {
  return (2.5 * n * n) / Z + 6;
}
