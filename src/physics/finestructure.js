// FASE 2 del espin: estructura fina (acoplamiento espin-orbita).
//
// El termino L·S acopla l y s=1/2 en el momento total j = l ± 1/2. Los estados
// son |n, l, j, m_j>. Aqui calculamos:
//   - la energia con la correccion de estructura fina (formula de Dirac),
//   - los coeficientes de Clebsch-Gordan del acoplamiento,
//   - la DENSIDAD total (sumada sobre espin) del estado |j, m_j>, que NO es la
//     del orbital puro: p.ej. los estados con j = 1/2 dan densidad ESFERICA.
//
// Unidades atomicas; energias en eV. alpha = constante de estructura fina.

import { angularReal } from './hydrogen.js';

export const ALPHA = 1 / 137.035999;
const SUB = ['s', 'p', 'd', 'f'];

// Energia del nivel con correccion de estructura fina (depende de n y j):
//   E_{nj} = E_n [ 1 + (Zα)²/n² ( n/(j+1/2) − 3/4 ) ]
export function fineEnergyEV(n, j, Z = 1) {
  const En = (-13.605693 * Z * Z) / (n * n);
  const corr = 1 + ((Z * ALPHA) ** 2 / (n * n)) * (n / (j + 0.5) - 0.75);
  return En * corr;
}

// Simbolo de termino: p.ej. n=2,l=1,j=1.5 -> "2p" con j=3/2.
export function termSymbol(n, l, j) {
  return `${n}${SUB[l] || '?'}`;
}
export function jFraction(j) {
  return `${Math.round(2 * j)}/2`;
}

// |Y_l^m|² del armonico esferico COMPLEJO, obtenido de los reales del proyecto:
//   m=0:  |Y_l^0|² = (Y_{l0})²
//   m≠0:  |Y_l^{±|m|}|² = ½[(Y_{l,|m|}^cos)² + (Y_{l,|m|}^sin)²]
// Es independiente de φ (simetria axial).
export function complexYsq(l, m, theta, phi) {
  if (m === 0) {
    const y = angularReal(l, 0, theta, phi);
    return y * y;
  }
  const am = Math.abs(m);
  const yc = angularReal(l, am, theta, phi);
  const ys = angularReal(l, -am, theta, phi);
  return 0.5 * (yc * yc + ys * ys);
}

// Coeficientes de Clebsch-Gordan para |j, m_j> = a|m_l=m_j−½,↑> + b|m_l=m_j+½,↓>.
export function cg(l, jPlus, mj) {
  const denom = 2 * l + 1;
  const ml1 = mj - 0.5;
  const ml2 = mj + 0.5;
  const p = Math.max(0, l + mj + 0.5);
  const q = Math.max(0, l - mj + 0.5);
  let a, b;
  if (jPlus) { a = Math.sqrt(p / denom); b = Math.sqrt(q / denom); }
  else { a = Math.sqrt(q / denom); b = -Math.sqrt(p / denom); }
  return { a, ml1, b, ml2 };
}

// Factor angular de densidad D(θ) = a²|Y_l^{ml1}|² + b²|Y_l^{ml2}|²
// (el termino cruzado se anula al sumar sobre espin). La densidad total es
// R_nl(r)² · D(θ).
export function spinAngularDensity(l, jPlus, mj, theta, phi) {
  const { a, ml1, b, ml2 } = cg(l, jPlus, mj);
  let D = 0;
  if (Math.abs(ml1) <= l) D += a * a * complexYsq(l, ml1, theta, phi);
  if (Math.abs(ml2) <= l) D += b * b * complexYsq(l, ml2, theta, phi);
  return D;
}
