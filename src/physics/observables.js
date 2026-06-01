// Propiedades del orbital asociadas a OPERADORES (valores esperados) y lecturas
// LOCALES en un punto. Para el atomo hidrogenoide hay formas cerradas exactas.
// Unidades atomicas (a0 = 1); Z es la carga efectiva usada por la psi.
//
//   <r>    = [3n^2 - l(l+1)] / (2Z)                      (radio promedio)
//   <r^2>  = n^2 [5n^2 + 1 - 3 l(l+1)] / (2 Z^2)
//   <1/r>  = Z / n^2
//   Dr     = sqrt(<r^2> - <r>^2)                          (incertidumbre radial)
//
// Verificadas numericamente contra la integral de la R_nl del codigo.

import { radial } from './hydrogen.js';

export const avgR = (n, l, Z = 1) => (3 * n * n - l * (l + 1)) / (2 * Z);

export const avgR2 = (n, l, Z = 1) =>
  (n * n * (5 * n * n + 1 - 3 * l * (l + 1))) / (2 * Z * Z);

export const avgInvR = (n, l, Z = 1) => Z / (n * n);

export const deltaR = (n, l, Z = 1) =>
  Math.sqrt(Math.max(0, avgR2(n, l, Z) - avgR(n, l, Z) ** 2));

// Radio mas probable y el valor del PICO de la distribucion radial r^2 R^2.
// Devuelve { r, density } con r en a0 y density = (r^2|R|^2)_max en a0^-1.
export function mostProbableR(n, l, Z = 1) {
  const rmax = (2.5 * n * n) / Z + 8;
  const N = 4000;
  let best = 0, bestV = -1;
  for (let i = 1; i <= N; i++) {
    const r = (rmax * i) / N;
    const R = radial(n, l, r, Z);
    const p = r * r * R * R;
    if (p > bestV) { bestV = p; best = r; }
  }
  return { r: best, density: bestV };
}

// Energia potencial coulombiana que siente el electron a distancia r (Hartree):
//   V(r) = - Z / r       (Z = carga nuclear real)
export const potentialEnergyHartree = (r, Z = 1) => (r > 0 ? -Z / r : -Infinity);

// Densidad de probabilidad radial r^2 |R|^2 a distancia r.
export function radialDensity(n, l, r, Z = 1) {
  const R = radial(n, l, r, Z);
  return r * r * R * R;
}
