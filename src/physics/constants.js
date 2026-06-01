// Constantes y utilidades matematicas.
// Trabajamos en UNIDADES ATOMICAS: el radio de Bohr a0 = 1 y la energia en
// Hartree, salvo cuando mostramos energias del hidrogeno en eV.

export const A0 = 1.0;              // radio de Bohr (unidad de longitud)
export const HARTREE_EV = 27.211386; // 1 Hartree en eV
export const RYDBERG_EV = 13.605693; // |E_1| del hidrogeno en eV

// Factorial con memorizacion (suficiente para n,l pequenos).
const _fact = [1, 1];
export function factorial(n) {
  if (n < 0) return NaN;
  for (let i = _fact.length; i <= n; i++) _fact[i] = _fact[i - 1] * i;
  return _fact[n];
}

// Polinomio asociado de Laguerre L_n^alpha(x) por recurrencia estable.
//   L_0^a = 1
//   L_1^a = 1 + a - x
//   (k+1) L_{k+1}^a = (2k+1+a-x) L_k^a - (k+a) L_{k-1}^a
export function laguerre(n, alpha, x) {
  if (n === 0) return 1;
  let lkm1 = 1;
  let lk = 1 + alpha - x;
  for (let k = 1; k < n; k++) {
    const lkp1 = ((2 * k + 1 + alpha - x) * lk - (k + alpha) * lkm1) / (k + 1);
    lkm1 = lk;
    lk = lkp1;
  }
  return lk;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const TAU = Math.PI * 2;
