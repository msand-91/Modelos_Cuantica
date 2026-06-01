// Particula en una caja de potencial infinito, en coordenadas cartesianas.
// Caja 1D, 2D y 3D. Estados estacionarios:
//
//   psi_n(x) = sqrt(2/L) * sin(n*pi*x / L)            (1D, x en [0, L])
//   psi(x,y) = psi_nx(x) * psi_ny(y)                  (2D, separable)
//   psi(x,y,z) = psi_nx(x)*psi_ny(y)*psi_nz(z)        (3D, separable)
//
// Energias (unidades de h^2 / (8 m L^2), tomando L como referencia):
//   E ∝ (nx/Lx)^2 + (ny/Ly)^2 + (nz/Lz)^2
// Aqui devolvemos el "numero cuantico de energia" E* = sum (n_i/L_i)^2 * L_ref^2
// para mostrar la progresion n^2 de forma adimensional.

const PI = Math.PI;

// Componente 1D normalizada en [0, L].
function comp(n, L, x) {
  if (x <= 0 || x >= L) return 0;
  return Math.sqrt(2 / L) * Math.sin((n * PI * x) / L);
}

export function psi1D(n, L, x) {
  return comp(n, L, x);
}

export function psi2D(nx, ny, Lx, Ly, x, y) {
  return comp(nx, Lx, x) * comp(ny, Ly, y);
}

export function psi3D(nx, ny, nz, Lx, Ly, Lz, x, y, z) {
  return comp(nx, Lx, x) * comp(ny, Ly, y) * comp(nz, Lz, z);
}

// Energia adimensional en multiplos de  h^2 / (8 m L_ref^2).
export function energyLevel(ns, Ls, Lref = 1) {
  let s = 0;
  for (let i = 0; i < ns.length; i++) {
    s += Math.pow((ns[i] * Lref) / Ls[i], 2);
  }
  return s; // p.ej. en una caja cubica de lado Lref: E* = nx^2+ny^2+nz^2
}

// Numero de nodos internos por eje = n - 1.
export const nodes1D = (n) => n - 1;
