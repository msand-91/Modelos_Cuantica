// Algebra lineal minima para el motor SCF.
//
// Todas las matrices son "densas pequenas" (n < 60 funciones de base), asi que
// usamos arrays de Float64Array y algoritmos directos y legibles: Jacobi para
// diagonalizar matrices simetricas y eliminacion gaussiana para resolver.

export function zeros(n, m = n) {
  const A = new Array(n);
  for (let i = 0; i < n; i++) A[i] = new Float64Array(m);
  return A;
}

export function identity(n) {
  const A = zeros(n);
  for (let i = 0; i < n; i++) A[i][i] = 1;
  return A;
}

export function cloneMat(A) {
  return A.map((row) => Float64Array.from(row));
}

export function matmul(A, B) {
  const n = A.length;
  const k = B.length;
  const m = B[0].length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const Ai = A[i];
    const Ci = C[i];
    for (let t = 0; t < k; t++) {
      const a = Ai[t];
      if (a === 0) continue;
      const Bt = B[t];
      for (let j = 0; j < m; j++) Ci[j] += a * Bt[j];
    }
  }
  return C;
}

export function transpose(A) {
  const n = A.length;
  const m = A[0].length;
  const B = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) B[j][i] = A[i][j];
  return B;
}

// Producto triple X^T A X (cambio de base).
export function congruence(X, A) {
  return matmul(transpose(X), matmul(A, X));
}

// Traza(A·B) para matrices simetricas: sum_ij A_ij B_ij.
export function traceProd(A, B) {
  let s = 0;
  for (let i = 0; i < A.length; i++) {
    const Ai = A[i];
    const Bi = B[i];
    for (let j = 0; j < Ai.length; j++) s += Ai[j] * Bi[j];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Diagonalizacion de matrices simetricas (Jacobi ciclico).
// Devuelve autovalores en orden ASCENDENTE y autovectores en COLUMNAS.
// ---------------------------------------------------------------------------
export function jacobiEigen(Ain, tol = 1e-12, maxSweeps = 100) {
  const n = Ain.length;
  const A = cloneMat(Ain);
  const V = identity(n);

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    // Suma de los cuadrados fuera de la diagonal.
    let off = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (Math.sqrt(2 * off) < tol) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = A[i][i];

  // Ordenar de menor a mayor (autovectores en columnas).
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const evals = new Float64Array(n);
  const evecs = zeros(n);
  order.forEach((src, dst) => {
    evals[dst] = values[src];
    for (let k = 0; k < n; k++) evecs[k][dst] = V[k][src];
  });
  return { values: evals, vectors: evecs };
}

// ---------------------------------------------------------------------------
// Ortogonalizacion CANONICA de la base:  X = U s^{-1/2}
// Cumple X^T S X = 1. Descarta los autovalores de S por debajo de `thresh`,
// lo que evita que una base casi linealmente dependiente (habitual al anadir
// funciones difusas) haga estallar el SCF. Devuelve X de tamano n x m, m <= n.
// ---------------------------------------------------------------------------
export function canonicalOrtho(S, thresh = 1e-6) {
  const { values, vectors } = jacobiEigen(S);
  const n = values.length;
  const keep = [];
  for (let i = 0; i < n; i++) if (values[i] > thresh) keep.push(i);
  const m = keep.length;
  const X = zeros(n, m);
  keep.forEach((col, j) => {
    const inv = 1 / Math.sqrt(values[col]);
    for (let i = 0; i < n; i++) X[i][j] = vectors[i][col] * inv;
  });
  return { X, dropped: n - m };
}

// ---------------------------------------------------------------------------
// Resolucion de A x = b por eliminacion gaussiana con pivoteo parcial.
// Devuelve null si el sistema es singular (lo usa DIIS para reiniciarse).
// ---------------------------------------------------------------------------
export function solveLinear(Ain, bin) {
  const n = Ain.length;
  const A = Ain.map((row) => Float64Array.from(row));
  const b = Float64Array.from(bin);

  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-14) return null;
    if (piv !== col) {
      const tmp = A[piv]; A[piv] = A[col]; A[col] = tmp;
      const tb = b[piv]; b[piv] = b[col]; b[col] = tb;
    }
    const d = A[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }

  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}
