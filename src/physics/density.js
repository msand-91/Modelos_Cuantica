// DENSIDAD ELECTRONICA y sus derivadas analiticas.
//
//   rho(r)      = sum_uv P_uv chi_u(r) chi_v(r)
//   grad rho    = 2 sum_uv P_uv chi_v grad chi_u
//   Hess rho    = 2 sum_uv P_uv (chi_v Hess chi_u + grad chi_u (x) grad chi_v)
//
// Con gaussianas cartesianas todo esto es analitico, que es justo lo que exige
// la TEORIA DE ATOMOS EN MOLECULAS (QTAIM): sus puntos criticos se localizan
// resolviendo grad rho = 0 y se clasifican con los autovalores del hessiano.
//
// Ademas se calculan las densidades de energia locales:
//   G(r) = 1/2 sum_uv P_uv grad chi_u . grad chi_v      (cinetica positiva)
//   V(r) = 1/4 lap rho - 2 G                            (teorema del virial local)
//   H(r) = G + V
// y la funcion de localizacion electronica ELF.

// Valor, gradiente y hessiano de una funcion de base contraida.
// Devuelve [v, gx, gy, gz, hxx, hyy, hzz, hxy, hxz, hyz].
export function evalBFD2(bf, x, y, z, out = new Float64Array(10)) {
  const X = x - bf.center[0];
  const Y = y - bf.center[1];
  const Z = z - bf.center[2];
  const r2 = X * X + Y * Y + Z * Z;
  const [i, j, k] = bf.powers;

  const pw = (t, p) => (p <= 0 ? (p === 0 ? 1 : 0) : Math.pow(t, p));
  const u = pw(X, i), up = i * pw(X, i - 1), upp = i * (i - 1) * pw(X, i - 2);
  const v = pw(Y, j), vp = j * pw(Y, j - 1), vpp = j * (j - 1) * pw(Y, j - 2);
  const w = pw(Z, k), wp = k * pw(Z, k - 1), wpp = k * (k - 1) * pw(Z, k - 2);

  out.fill(0);
  for (let p = 0; p < bf.exps.length; p++) {
    const a = bf.exps[p];
    const e = bf.coefs[p] * Math.exp(-a * r2);
    // Derivadas de u(X) exp(-a X^2) etc.
    const ux = up - 2 * a * X * u;
    const vy = vp - 2 * a * Y * v;
    const wz = wp - 2 * a * Z * w;
    const uxx = upp - 2 * a * (2 * i + 1) * u + 4 * a * a * X * X * u;
    const vyy = vpp - 2 * a * (2 * j + 1) * v + 4 * a * a * Y * Y * v;
    const wzz = wpp - 2 * a * (2 * k + 1) * w + 4 * a * a * Z * Z * w;

    out[0] += e * u * v * w;
    out[1] += e * ux * v * w;
    out[2] += e * u * vy * w;
    out[3] += e * u * v * wz;
    out[4] += e * uxx * v * w;
    out[5] += e * u * vyy * w;
    out[6] += e * u * v * wzz;
    out[7] += e * ux * vy * w;
    out[8] += e * ux * v * wz;
    out[9] += e * u * vy * wz;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Analizador de densidad reutilizable (evita reservar memoria en cada punto:
// se llama millones de veces al muestrear rejillas).
// ---------------------------------------------------------------------------
export class DensityAnalyzer {
  constructor(basis, P) {
    this.basis = basis;
    this.P = P;
    this.n = basis.length;
    this.d = new Float64Array(10 * this.n);
    this.tmp = new Float64Array(10);
    this.t = new Float64Array(this.n);
    this.sx = new Float64Array(this.n);
    this.sy = new Float64Array(this.n);
    this.sz = new Float64Array(this.n);
  }

  // Rellena las derivadas de todas las funciones de base en (x,y,z).
  _fill(x, y, z) {
    const { basis, n, d, tmp } = this;
    for (let u = 0; u < n; u++) {
      evalBFD2(basis[u], x, y, z, tmp);
      d.set(tmp, 10 * u);
    }
    // Contracciones con la matriz densidad.
    const { P, t, sx, sy, sz } = this;
    for (let u = 0; u < n; u++) {
      let a = 0, bx = 0, by = 0, bz = 0;
      const Pu = P[u];
      for (let v = 0; v < n; v++) {
        const p = Pu[v];
        if (p === 0) continue;
        const o = 10 * v;
        a += p * d[o];
        bx += p * d[o + 1];
        by += p * d[o + 2];
        bz += p * d[o + 3];
      }
      t[u] = a; sx[u] = bx; sy[u] = by; sz[u] = bz;
    }
  }

  // rho, gradiente, hessiano (matriz 3x3 en forma de array de 6), laplaciano,
  // densidad de energia cinetica G y ELF.
  full(x, y, z) {
    this._fill(x, y, z);
    const { n, d, t, sx, sy, sz } = this;
    let rho = 0, gx = 0, gy = 0, gz = 0;
    let hxx = 0, hyy = 0, hzz = 0, hxy = 0, hxz = 0, hyz = 0;
    let G = 0;
    for (let u = 0; u < n; u++) {
      const o = 10 * u;
      const f = d[o], fx = d[o + 1], fy = d[o + 2], fz = d[o + 3];
      const tu = t[u];
      rho += f * tu;
      gx += 2 * fx * tu;
      gy += 2 * fy * tu;
      gz += 2 * fz * tu;
      hxx += 2 * (d[o + 4] * tu + fx * sx[u]);
      hyy += 2 * (d[o + 5] * tu + fy * sy[u]);
      hzz += 2 * (d[o + 6] * tu + fz * sz[u]);
      hxy += 2 * (d[o + 7] * tu + fx * sy[u]);
      hxz += 2 * (d[o + 8] * tu + fx * sz[u]);
      hyz += 2 * (d[o + 9] * tu + fy * sz[u]);
      G += 0.5 * (fx * sx[u] + fy * sy[u] + fz * sz[u]);
    }
    const lap = hxx + hyy + hzz;
    const g2 = gx * gx + gy * gy + gz * gz;
    const Vloc = 0.25 * lap - 2 * G;
    return {
      rho, g: [gx, gy, gz], gradNorm: Math.sqrt(g2),
      h: [hxx, hyy, hzz, hxy, hxz, hyz], lap,
      G, V: Vloc, H: G + Vloc,
      elf: elfFrom(rho, g2, G),
    };
  }

  rho(x, y, z) {
    const { basis, n } = this;
    // Camino rapido: solo el valor (para muestrear rejillas grandes).
    const vals = this._vals || (this._vals = new Float64Array(n));
    for (let u = 0; u < n; u++) {
      const bf = basis[u];
      const X = x - bf.center[0], Y = y - bf.center[1], Z = z - bf.center[2];
      const r2 = X * X + Y * Y + Z * Z;
      const [i, j, k] = bf.powers;
      let ang = 1;
      for (let q = 0; q < i; q++) ang *= X;
      for (let q = 0; q < j; q++) ang *= Y;
      for (let q = 0; q < k; q++) ang *= Z;
      let rad = 0;
      for (let p = 0; p < bf.exps.length; p++) rad += bf.coefs[p] * Math.exp(-bf.exps[p] * r2);
      vals[u] = ang * rad;
    }
    let s = 0;
    for (let u = 0; u < n; u++) {
      const vu = vals[u];
      if (vu === 0) continue;
      s += this.P[u][u] * vu * vu;
      for (let v = 0; v < u; v++) s += 2 * this.P[u][v] * vu * vals[v];
    }
    return s;
  }

  gradient(x, y, z, out = [0, 0, 0]) {
    this._fill(x, y, z);
    const { n, d, t } = this;
    let gx = 0, gy = 0, gz = 0;
    for (let u = 0; u < n; u++) {
      const o = 10 * u;
      gx += 2 * d[o + 1] * t[u];
      gy += 2 * d[o + 2] * t[u];
      gz += 2 * d[o + 3] * t[u];
    }
    out[0] = gx; out[1] = gy; out[2] = gz;
    return out;
  }
}

// ELF de Becke-Edgecombe:  ELF = 1 / (1 + chi^2)
//   chi = D / D_0,  D = G - |grad rho|^2/(8 rho),  D_0 = 3/10 (3 pi^2)^{2/3} rho^{5/3}
const CF = 0.3 * Math.pow(3 * Math.PI * Math.PI, 2 / 3);
export function elfFrom(rho, gradSq, G) {
  if (rho < 1e-10) return 0;
  const D = Math.max(G - gradSq / (8 * rho), 0);
  const D0 = CF * Math.pow(rho, 5 / 3);
  const chi = D / Math.max(D0, 1e-30);
  return 1 / (1 + chi * chi);
}

// ---------------------------------------------------------------------------
// Autovalores y autovectores de la matriz simetrica 3x3 del hessiano
// (h = [xx, yy, zz, xy, xz, yz]). Metodo de Jacobi, 3 dimensiones.
// ---------------------------------------------------------------------------
export function eigen3(h) {
  let a = [
    [h[0], h[3], h[4]],
    [h[3], h[1], h[5]],
    [h[4], h[5], h[2]],
  ];
  let v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  for (let sweep = 0; sweep < 30; sweep++) {
    let off = a[0][1] * a[0][1] + a[0][2] * a[0][2] + a[1][2] * a[1][2];
    if (off < 1e-24) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p][q];
      if (Math.abs(apq) < 1e-18) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const na = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) na[i][j] = a[i][j];
      for (let k = 0; k < 3; k++) {
        na[k][p] = c * a[k][p] - s * a[k][q];
        na[k][q] = s * a[k][p] + c * a[k][q];
      }
      const nb = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) nb[i][j] = na[i][j];
      for (let k = 0; k < 3; k++) {
        nb[p][k] = c * na[p][k] - s * na[q][k];
        nb[q][k] = s * na[p][k] + c * na[q][k];
      }
      a = nb;
      const nv = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) nv[i][j] = v[i][j];
      for (let k = 0; k < 3; k++) {
        nv[k][p] = c * v[k][p] - s * v[k][q];
        nv[k][q] = s * v[k][p] + c * v[k][q];
      }
      v = nv;
    }
  }

  const vals = [a[0][0], a[1][1], a[2][2]];
  const idx = [0, 1, 2].sort((x, y) => vals[x] - vals[y]);
  return {
    values: idx.map((i) => vals[i]),
    vectors: idx.map((i) => [v[0][i], v[1][i], v[2][i]]),
  };
}
