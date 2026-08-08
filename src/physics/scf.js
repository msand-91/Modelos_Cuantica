// Campo autoconsistente de HARTREE-FOCK (Roothaan-Hall).
//
// La funcion de onda es UN DETERMINANTE DE SLATER construido con espin-orbitales
// que se expanden en la base atomica:   phi_i = sum_u C_ui  chi_u   (LCAO).
//
// El teorema variacional es literalmente el motor del metodo: E[C] = <D|H|D> se
// minimiza respecto de los coeficientes C con la ligadura de ortonormalidad, y
// eso da la ecuacion de pseudo-autovalores  F C = S C eps , que se resuelve
// iterando hasta autoconsistencia (F depende de C).
//
//   RHF  -> capa cerrada: cada orbital espacial aloja 2 e- (alfa y beta).
//   UHF  -> capa abierta: alfa y beta tienen orbitales espaciales distintos
//           (radicales, cationes/aniones de capa abierta, O2 triplete...).
//
// Todo en unidades atomicas (hartree).

import {
  zeros, matmul, transpose, jacobiEigen, canonicalOrtho, solveLinear, cloneMat,
} from './linalg.js';

const MAXDIIS = 8;

// --- Constructor de la matriz de Coulomb J y de intercambio K ---------------
// J_uv = sum_ls P_ls (uv|ls)      K_uv = sum_ls P_ls (ul|sv)
function buildJK(eri, P, n) {
  const J = zeros(n);
  const K = zeros(n);
  for (let u = 0; u < n; u++) {
    for (let v = 0; v <= u; v++) {
      let j = 0;
      let k = 0;
      for (let l = 0; l < n; l++) {
        const Pl = P[l];
        const base1 = ((u * n + v) * n + l) * n;
        for (let s = 0; s < n; s++) {
          const p = Pl[s];
          if (p === 0) continue;
          j += p * eri[base1 + s];
          k += p * eri[((u * n + l) * n + s) * n + v];
        }
      }
      J[u][v] = J[v][u] = j;
      K[u][v] = K[v][u] = k;
    }
  }
  return { J, K };
}

// --- Aceleracion DIIS (Pulay) ----------------------------------------------
class Diis {
  constructor() { this.fs = []; this.es = []; }

  push(F, e) {
    this.fs.push(cloneMat(F));
    this.es.push(cloneMat(e));
    if (this.fs.length > MAXDIIS) { this.fs.shift(); this.es.shift(); }
  }

  extrapolate() {
    const m = this.fs.length;
    if (m < 2) return null;
    const B = [];
    for (let i = 0; i <= m; i++) B.push(new Float64Array(m + 1));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let a = 0; a < this.es[i].length; a++)
          for (let b = 0; b < this.es[i][a].length; b++) s += this.es[i][a][b] * this.es[j][a][b];
        B[i][j] = s;
      }
      B[i][m] = -1;
      B[m][i] = -1;
    }
    B[m][m] = 0;
    const rhs = new Float64Array(m + 1);
    rhs[m] = -1;
    const c = solveLinear(B, rhs);
    if (!c) return null;

    const n = this.fs[0].length;
    const F = zeros(n);
    for (let i = 0; i < m; i++) {
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++) F[a][b] += c[i] * this.fs[i][a][b];
    }
    return F;
  }
}

// Vector de error de DIIS en la base ortogonal: X^T (F P S - S P F) X.
function errorVector(F, P, S, X) {
  const FPS = matmul(F, matmul(P, S));
  const SPF = matmul(S, matmul(P, F));
  const n = F.length;
  const e = zeros(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) e[i][j] = FPS[i][j] - SPF[i][j];
  return matmul(transpose(X), matmul(e, X));
}

const rms = (A) => {
  let s = 0, c = 0;
  for (const row of A) for (const v of row) { s += v * v; c++; }
  return Math.sqrt(s / Math.max(c, 1));
};

// Densidad P_uv = f * sum_i^{occ} C_ui C_vi   (f = 2 en RHF, 1 por espin en UHF)
function densityFrom(C, nocc, f) {
  const n = C.length;
  const P = zeros(n);
  for (let u = 0; u < n; u++) {
    for (let v = 0; v <= u; v++) {
      let s = 0;
      for (let i = 0; i < nocc; i++) s += C[u][i] * C[v][i];
      P[u][v] = P[v][u] = f * s;
    }
  }
  return P;
}

// Arranque de Wolfsberg-Helmholz generalizado (GWH):
//   F_uv ~ 0.875 S_uv (H_uu + H_vv)
// Es mucho mejor punto de partida que el hamiltoniano de core desnudo, sobre
// todo en atomos pesados, donde el core puro lleva el SCF a soluciones falsas.
function gwhGuess(H, S) {
  const n = H.length;
  const F = zeros(n);
  for (let u = 0; u < n; u++) {
    F[u][u] = H[u][u];
    for (let v = 0; v < u; v++) {
      const f = 0.5 * 1.75 * S[u][v] * (H[u][u] + H[v][v]);
      F[u][v] = F[v][u] = f;
    }
  }
  return F;
}

// Desplazamiento de nivel: sube en `shift` hartree los orbitales virtuales
//   F' <- F' + shift (1 - sum_occ |c><c|)
// Rompe las oscilaciones de periodo 2 tipicas de los sistemas ionicos (el SCF
// salta entre dos repartos de carga). En el punto autoconsistente el proyector
// conmuta con F, asi que la solucion final no cambia.
function levelShiftFock(Fp, Cp, nocc, shift) {
  const m = Fp.length;
  const out = cloneMat(Fp);
  for (let a = 0; a < m; a++) {
    for (let b = 0; b < m; b++) {
      let proj = 0;
      for (let i = 0; i < nocc; i++) proj += Cp[a][i] * Cp[b][i];
      out[a][b] += shift * ((a === b ? 1 : 0) - proj);
    }
  }
  return out;
}

const dot2 = (A, B) => {
  let s = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) s += A[i][j] * B[i][j];
  return s;
};

// ---------------------------------------------------------------------------
// RHF: capa cerrada (nelec par, todos los orbitales doblemente ocupados).
// ---------------------------------------------------------------------------
export function rhf(ints, nelec, opts = {}) {
  const { S, H, T, V, eri, n } = ints;
  const nocc = nelec / 2;
  const maxIter = opts.maxIter ?? 150;
  const eTol = opts.eTol ?? 1e-9;
  const dTol = opts.dTol ?? 1e-7;

  const { X, dropped } = canonicalOrtho(S, opts.orthoThresh ?? 1e-5);
  const nmo = X[0].length;
  if (nocc > nmo) throw new Error('La base es demasiado pequena para tantos electrones.');

  // Densidad de partida (GWH o hamiltoniano de core desnudo).
  const F0 = opts.guess === 'core' ? H : gwhGuess(H, S);
  const g0 = jacobiEigen(matmul(transpose(X), matmul(F0, X)));
  let C = matmul(X, g0.vectors);
  let eps = g0.values;
  let P = densityFrom(C, nocc, 2);
  let Cp = g0.vectors;
  let E = 0, Eold = 0;
  const diis = new Diis();
  let converged = false;
  let iter = 0;
  // Traza del ciclo: energia y norma del gradiente (FPS - SPF) en cada paso.
  // Sirve para ver de un vistazo si DIIS esta haciendo su trabajo.
  const history = [];

  for (iter = 1; iter <= maxIter; iter++) {
    const { J, K } = buildJK(eri, P, n);
    const F = zeros(n);
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) F[u][v] = H[u][v] + J[u][v] - 0.5 * K[u][v];

    // Energia electronica: 1/2 sum P (H + F)
    let Eelec = 0;
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) Eelec += 0.5 * P[u][v] * (H[u][v] + F[u][v]);
    E = Eelec;

    const err = errorVector(F, P, S, X);
    const errNorm = rms(err);
    history.push({ iter, E, err: errNorm });
    diis.push(F, err);
    const Fe = iter > 1 ? diis.extrapolate() : null;
    const Fuse = Fe || F;

    let Fp = matmul(transpose(X), matmul(Fuse, X));
    const shift = opts.levelShift ?? 0;
    if (shift > 0 && Cp && errNorm > 1e-5) Fp = levelShiftFock(Fp, Cp, nocc, shift);
    const { values, vectors } = jacobiEigen(Fp);
    Cp = vectors;
    eps = values;
    C = matmul(X, vectors);

    const Pnew = densityFrom(C, nocc, 2);
    const dP = rms(Pnew.map((row, i) => row.map((v2, j) => v2 - P[i][j])));
    // Amortiguacion las primeras iteraciones (evita oscilaciones).
    const damp = opts.damp ?? 0;
    const mix = iter <= damp ? 0.3 : iter < 3 ? 0.7 : 1;
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) P[u][v] = mix * Pnew[u][v] + (1 - mix) * P[u][v];

    // Convergencia REAL: no basta con que la energia deje de moverse, el
    // gradiente (FPS - SPF) tiene que anularse; si no, un ciclo estancado se
    // confunde con una solucion.
    if (iter > 1 && Math.abs(E - Eold) < eTol && errNorm < 1e-6 && dP < dTol * 100) {
      converged = true;
      break;
    }
    Eold = E;
  }

  // Fock final SIN desplazamiento de nivel: energia, orbitales y energias
  // orbitales definitivas, coherentes con la densidad convergida.
  {
    const jk = buildJK(eri, P, n);
    const F = zeros(n);
    let Ef = 0;
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) F[u][v] = H[u][v] + jk.J[u][v] - 0.5 * jk.K[u][v];
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) Ef += 0.5 * P[u][v] * (H[u][v] + F[u][v]);
    E = Ef;
    const fin = jacobiEigen(matmul(transpose(X), matmul(F, X)));
    eps = fin.values;
    C = matmul(X, fin.vectors);
  }

  const Ekin = dot2(P, T);
  const Ene = dot2(P, V);
  return {
    method: 'RHF', E, Eelec: E, C, eps, P, Pa: P.map((r) => r.map((v2) => v2 / 2)),
    nocc, nmo, dropped, converged, iterations: iter, history,
    Ekin, Ene, Eee: E - Ekin - Ene,
    homo: nocc - 1, lumo: nocc < nmo ? nocc : -1,
    occ: Array.from({ length: nmo }, (_, i) => (i < nocc ? 2 : 0)),
  };
}

// ---------------------------------------------------------------------------
// UHF: capa abierta (alfa y beta con orbitales espaciales independientes).
// ---------------------------------------------------------------------------
export function uhf(ints, nalpha, nbeta, opts = {}) {
  const { S, H, T, V, eri, n } = ints;
  const maxIter = opts.maxIter ?? 250;
  const eTol = opts.eTol ?? 1e-9;

  const { X, dropped } = canonicalOrtho(S, opts.orthoThresh ?? 1e-5);
  const nmo = X[0].length;
  if (Math.max(nalpha, nbeta) > nmo) throw new Error('La base es demasiado pequena para tantos electrones.');

  const F0 = opts.guess === 'core' ? H : gwhGuess(H, S);
  const g0 = jacobiEigen(matmul(transpose(X), matmul(F0, X)));
  let Ca = matmul(X, g0.vectors);
  let Cb = Ca;
  let epsA = g0.values, epsB = g0.values;
  // El desequilibrio alfa/beta del arranque ya rompe la simetria de espin.
  let Pa = densityFrom(Ca, nalpha, 1);
  let Pb = densityFrom(Cb, nbeta, 1);
  let CpA = g0.vectors, CpB = g0.vectors;
  let E = 0, Eold = 0;
  const diisA = new Diis();
  const diisB = new Diis();
  let converged = false;
  let iter = 0;
  const history = [];   // traza del ciclo (energia y gradiente por iteracion)

  for (iter = 1; iter <= maxIter; iter++) {
    const Ptot = zeros(n);
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) Ptot[u][v] = Pa[u][v] + Pb[u][v];
    const { J } = buildJK(eri, Ptot, n);
    const Ka = buildJK(eri, Pa, n).K;
    const Kb = buildJK(eri, Pb, n).K;

    const Fa = zeros(n), Fb = zeros(n);
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) {
        Fa[u][v] = H[u][v] + J[u][v] - Ka[u][v];
        Fb[u][v] = H[u][v] + J[u][v] - Kb[u][v];
      }

    E = 0.5 * (dot2(Ptot, H) + dot2(Pa, Fa) + dot2(Pb, Fb));

    const errA = errorVector(Fa, Pa, S, X);
    const errB = errorVector(Fb, Pb, S, X);
    const errNorm = Math.max(rms(errA), rms(errB));
    history.push({ iter, E, err: errNorm });
    diisA.push(Fa, errA);
    diisB.push(Fb, errB);
    const FaU = (iter > 1 ? diisA.extrapolate() : null) || Fa;
    const FbU = (iter > 1 ? diisB.extrapolate() : null) || Fb;

    let FpA = matmul(transpose(X), matmul(FaU, X));
    let FpB = matmul(transpose(X), matmul(FbU, X));
    const shift = opts.levelShift ?? 0;
    if (shift > 0 && CpA && errNorm > 1e-5) {
      FpA = levelShiftFock(FpA, CpA, nalpha, shift);
      FpB = levelShiftFock(FpB, CpB, nbeta, shift);
    }
    const ea = jacobiEigen(FpA);
    const eb = jacobiEigen(FpB);
    CpA = ea.vectors; CpB = eb.vectors;
    epsA = ea.values; epsB = eb.values;
    Ca = matmul(X, ea.vectors);
    Cb = matmul(X, eb.vectors);

    const PaNew = densityFrom(Ca, nalpha, 1);
    const PbNew = densityFrom(Cb, nbeta, 1);
    const damp = opts.damp ?? 0;
    const mix = iter <= damp ? 0.3 : iter < 3 ? 0.6 : 1;
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) {
        Pa[u][v] = mix * PaNew[u][v] + (1 - mix) * Pa[u][v];
        Pb[u][v] = mix * PbNew[u][v] + (1 - mix) * Pb[u][v];
      }

    if (iter > 2 && Math.abs(E - Eold) < eTol && errNorm < 1e-6) { converged = true; break; }
    Eold = E;
  }

  // Fock final sin desplazamiento (orbitales y energias definitivas).
  {
    const Pt = zeros(n);
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) Pt[u][v] = Pa[u][v] + Pb[u][v];
    const { J } = buildJK(eri, Pt, n);
    const Ka = buildJK(eri, Pa, n).K;
    const Kb = buildJK(eri, Pb, n).K;
    const Fa = zeros(n), Fb = zeros(n);
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++) {
        Fa[u][v] = H[u][v] + J[u][v] - Ka[u][v];
        Fb[u][v] = H[u][v] + J[u][v] - Kb[u][v];
      }
    E = 0.5 * (dot2(Pt, H) + dot2(Pa, Fa) + dot2(Pb, Fb));
    const ea = jacobiEigen(matmul(transpose(X), matmul(Fa, X)));
    const eb = jacobiEigen(matmul(transpose(X), matmul(Fb, X)));
    epsA = ea.values; epsB = eb.values;
    Ca = matmul(X, ea.vectors);
    Cb = matmul(X, eb.vectors);
  }

  const Ptot = zeros(n);
  for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) Ptot[u][v] = Pa[u][v] + Pb[u][v];
  const Ekin = dot2(Ptot, T);
  const Ene = dot2(Ptot, V);

  // <S^2> = S_z(S_z+1) + N_beta - sum_ij |<a_i|b_j>|^2
  const sz = (nalpha - nbeta) / 2;
  let overlapSum = 0;
  const SC = matmul(S, Cb);
  for (let i = 0; i < nalpha; i++) {
    for (let j = 0; j < nbeta; j++) {
      let s = 0;
      for (let u = 0; u < n; u++) s += Ca[u][i] * SC[u][j];
      overlapSum += s * s;
    }
  }
  const s2 = sz * (sz + 1) + nbeta - overlapSum;

  return {
    method: 'UHF', E, Eelec: E, Ca, Cb, epsA, epsB, Pa, Pb, P: Ptot,
    C: Ca, eps: epsA, nalpha, nbeta, nmo, dropped, converged, iterations: iter, history,
    Ekin, Ene, Eee: E - Ekin - Ene, s2, s2exact: sz * (sz + 1),
    homo: nalpha - 1, lumo: nalpha < nmo ? nalpha : -1,
    occA: Array.from({ length: nmo }, (_, i) => (i < nalpha ? 1 : 0)),
    occB: Array.from({ length: nmo }, (_, i) => (i < nbeta ? 1 : 0)),
  };
}

// ---------------------------------------------------------------------------
// Lanzador. Las ecuaciones de Hartree-Fock pueden tener VARIAS soluciones
// autoconsistentes (sobre todo en capa abierta y en enlaces ionicos), y el SCF
// cae en una u otra segun el punto de partida. Como el teorema variacional dice
// que la buena es la de MENOR energia, probamos varios arranques y nos quedamos
// con la mejor: es barato comparado con el calculo de las integrales.
// ---------------------------------------------------------------------------
export function runSCF(ints, nelec, multiplicity = 1, opts = {}) {
  const nunpaired = multiplicity - 1;
  if ((nelec - nunpaired) % 2 !== 0)
    throw new Error(`Multiplicidad ${multiplicity} incompatible con ${nelec} electrones.`);
  const nbeta = (nelec - nunpaired) / 2;
  const nalpha = nbeta + nunpaired;
  if (nbeta < 0) throw new Error('Multiplicidad demasiado alta para ese numero de electrones.');

  const solve = (o) => (multiplicity === 1 && !opts.forceUHF
    ? rhf(ints, nelec, o)
    : uhf(ints, nalpha, nbeta, o));

  const better = (a, b) => {
    if (!a) return b;
    if (a.converged !== b.converged) return a.converged ? a : b;
    return b.E < a.E - 1e-9 ? b : a;
  };

  let best = null;
  for (const st of [{ guess: 'gwh' }, { guess: 'core' }]) {
    best = better(best, solve({ ...opts, ...st }));
  }
  if (!best.converged) {
    for (const st of [
      { guess: 'gwh', levelShift: 0.5 },
      { guess: 'core', levelShift: 0.5 },
      { guess: 'gwh', damp: 25, levelShift: 1.0 },
      { guess: 'core', damp: 25 },
    ]) {
      best = better(best, solve({ ...opts, ...st, maxIter: 300 }));
      if (best.converged) break;
    }
  }
  return best;
}
