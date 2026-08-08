// Integrales moleculares sobre GAUSSIANAS CARTESIANAS CONTRAIDAS.
//
// Toda la quimica cuantica de este proyecto (atomos polielectronicos y
// orbitales moleculares) se apoya en estas cuatro integrales:
//
//   S_uv = <u|v>                         solapamiento
//   T_uv = <u|-1/2 nabla^2|v>            energia cinetica
//   V_uv = <u|-sum_C Z_C/|r-R_C| |v>     atraccion nuclear
//   (uv|ls) = int int u(1)v(1) 1/r12 l(2)s(2)   repulsion electronica
//
// Se calculan por el metodo de McMurchie-Davidson: el producto de dos
// gaussianas se expande en gaussianas de HERMITE centradas en el punto P, y
// las integrales de Coulomb se obtienen de la funcion de Boys F_n(T).
// Referencia: Helgaker, Jorgensen & Olsen, "Molecular Electronic-Structure
// Theory", cap. 9.
//
// Una funcion de base contraida se representa como:
//   { center: [x,y,z], powers: [i,j,k], exps: Float64Array, coefs: Float64Array }
// donde `coefs` YA incluye la normalizacion de cada primitiva y la de la
// funcion completa (ver normalizeBasis).
//
// Unidades atomicas en todo el modulo (longitudes en bohr, energias en hartree).

// Momento angular maximo soportado (d). Fija el tamano de los buffers de R.
const LMAX = 2;
const RSTRIDE = 4 * LMAX + 1; // indices t,u,v de 0..4*LMAX
const RNMAX = 3 * (4 * LMAX) + 1;

// ---------------------------------------------------------------------------
// Funcion de Boys  F_n(T) = int_0^1 t^{2n} exp(-T t^2) dt
//   T pequeno  -> serie de Taylor (todos los terminos positivos, sin
//                 cancelaciones) y recursion descendente.
//   T grande   -> F_0 = 1/2 sqrt(pi/T) y recursion ascendente (estable).
// ---------------------------------------------------------------------------
export function boysArray(nmax, T, out = new Float64Array(nmax + 1)) {
  if (T < 1e-12) {
    for (let n = 0; n <= nmax; n++) out[n] = 1 / (2 * n + 1);
    return out;
  }
  if (T < 30) {
    // Serie para el orden mas alto y luego bajamos.
    let term = 1 / (2 * nmax + 1);
    let sum = term;
    for (let k = 1; k < 200; k++) {
      term *= (2 * T) / (2 * nmax + 2 * k + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    const eT = Math.exp(-T);
    out[nmax] = sum * eT;
    for (let n = nmax; n > 0; n--) out[n - 1] = (2 * T * out[n] + eT) / (2 * n - 1);
    return out;
  }
  // T grande: la cola exp(-T) es despreciable frente a 1/2 sqrt(pi/T).
  const eT = Math.exp(-T);
  out[0] = 0.5 * Math.sqrt(Math.PI / T);
  for (let n = 0; n < nmax; n++) out[n + 1] = ((2 * n + 1) * out[n] - eT) / (2 * T);
  return out;
}

// ---------------------------------------------------------------------------
// Coeficientes de expansion de Hermite E_t^{ij} (una dimension cartesiana).
// E[i][j][t] con el prefactor exp(-mu*(A-B)^2) ya incluido.
// ---------------------------------------------------------------------------
function etable(la, lb, a, b, Ax, Bx) {
  const p = a + b;
  const mu = (a * b) / p;
  const Px = (a * Ax + b * Bx) / p;
  const PA = Px - Ax;
  const PB = Px - Bx;
  const AB = Ax - Bx;
  const tmax = la + lb;

  const E = new Array(la + 1);
  for (let i = 0; i <= la; i++) {
    E[i] = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) E[i][j] = new Float64Array(tmax + 2);
  }
  E[0][0][0] = Math.exp(-mu * AB * AB);

  const inv2p = 1 / (2 * p);
  for (let i = 0; i < la; i++) {
    const row = E[i][0];
    const dst = E[i + 1][0];
    for (let t = 0; t <= i + 1; t++) {
      dst[t] = (t > 0 ? row[t - 1] * inv2p : 0) + PA * row[t] + (t + 1) * row[t + 1];
    }
  }
  for (let i = 0; i <= la; i++) {
    for (let j = 0; j < lb; j++) {
      const row = E[i][j];
      const dst = E[i][j + 1];
      for (let t = 0; t <= i + j + 1; t++) {
        dst[t] = (t > 0 ? row[t - 1] * inv2p : 0) + PB * row[t] + (t + 1) * row[t + 1];
      }
    }
  }
  return E;
}

// ---------------------------------------------------------------------------
// Integrales de Coulomb de Hermite  R_{tuv}^{(0)}(alpha, PQ).
// Se escriben en un buffer compartido (los resultados se consumen al vuelo).
// ---------------------------------------------------------------------------
const RBUF = [];
for (let n = 0; n <= RNMAX; n++) RBUF.push(new Float64Array(RSTRIDE * RSTRIDE * RSTRIDE));
const FBUF = new Float64Array(RNMAX + 1);
const ridx = (t, u, v) => (t * RSTRIDE + u) * RSTRIDE + v;

function hermiteR(alpha, PQx, PQy, PQz, tmax, umax, vmax) {
  const T = alpha * (PQx * PQx + PQy * PQy + PQz * PQz);
  const nmax = tmax + umax + vmax;
  boysArray(nmax, T, FBUF);

  let f = 1;
  for (let n = 0; n <= nmax; n++) {
    RBUF[n][0] = f * FBUF[n];
    f *= -2 * alpha;
  }

  for (let level = 1; level <= nmax; level++) {
    for (let t = 0; t <= Math.min(level, tmax); t++) {
      for (let u = 0; u <= Math.min(level - t, umax); u++) {
        const v = level - t - u;
        if (v > vmax) continue;
        const dst = ridx(t, u, v);
        for (let n = 0; n <= nmax - level; n++) {
          const up = RBUF[n + 1];
          let val;
          if (t > 0) {
            val = PQx * up[ridx(t - 1, u, v)];
            if (t > 1) val += (t - 1) * up[ridx(t - 2, u, v)];
          } else if (u > 0) {
            val = PQy * up[ridx(t, u - 1, v)];
            if (u > 1) val += (u - 1) * up[ridx(t, u - 2, v)];
          } else {
            val = PQz * up[ridx(t, u, v - 1)];
            if (v > 1) val += (v - 1) * up[ridx(t, u, v - 2)];
          }
          RBUF[n][dst] = val;
        }
      }
    }
  }
  return RBUF[0];
}

// ---------------------------------------------------------------------------
// Normalizacion de una primitiva cartesiana x^i y^j z^k exp(-a r^2).
// ---------------------------------------------------------------------------
const dfact = (n) => { // (n)!! con (-1)!! = 1
  let r = 1;
  for (let k = n; k > 1; k -= 2) r *= k;
  return r;
};

export function primitiveNorm(a, i, j, k) {
  const l = i + j + k;
  return (
    Math.pow((2 * a) / Math.PI, 0.75) *
    Math.pow(4 * a, l / 2) /
    Math.sqrt(dfact(2 * i - 1) * dfact(2 * j - 1) * dfact(2 * k - 1))
  );
}

// ---------------------------------------------------------------------------
// Integrales de una y dos funciones de base contraidas.
// ---------------------------------------------------------------------------
export function overlap(A, B) {
  const [ia, ja, ka] = A.powers;
  const [ib, jb, kb] = B.powers;
  let s = 0;
  for (let p = 0; p < A.exps.length; p++) {
    const a = A.exps[p];
    for (let q = 0; q < B.exps.length; q++) {
      const b = B.exps[q];
      const pp = a + b;
      const Ex = etable(ia, ib, a, b, A.center[0], B.center[0]);
      const Ey = etable(ja, jb, a, b, A.center[1], B.center[1]);
      const Ez = etable(ka, kb, a, b, A.center[2], B.center[2]);
      s += A.coefs[p] * B.coefs[q] *
        Ex[ia][ib][0] * Ey[ja][jb][0] * Ez[ka][kb][0] *
        Math.pow(Math.PI / pp, 1.5);
    }
  }
  return s;
}

export function kinetic(A, B) {
  const [ia, ja, ka] = A.powers;
  const [ib, jb, kb] = B.powers;
  let t = 0;
  for (let p = 0; p < A.exps.length; p++) {
    const a = A.exps[p];
    for (let q = 0; q < B.exps.length; q++) {
      const b = B.exps[q];
      const pp = a + b;
      const pref = Math.sqrt(Math.PI / pp);
      // Solapamientos 1D con j, j+2 y j-2 (necesarios para la segunda derivada).
      const Ex = etable(ia, ib + 2, a, b, A.center[0], B.center[0]);
      const Ey = etable(ja, jb + 2, a, b, A.center[1], B.center[1]);
      const Ez = etable(ka, kb + 2, a, b, A.center[2], B.center[2]);
      const sx = (j) => (j < 0 ? 0 : Ex[ia][j][0] * pref);
      const sy = (j) => (j < 0 ? 0 : Ey[ja][j][0] * pref);
      const sz = (j) => (j < 0 ? 0 : Ez[ka][j][0] * pref);

      const d2 = (S, j) => -2 * b * b * S(j + 2) + b * (2 * j + 1) * S(j) -
        0.5 * j * (j - 1) * S(j - 2);

      const tx = d2(sx, ib) * sy(jb) * sz(kb);
      const ty = sx(ib) * d2(sy, jb) * sz(kb);
      const tz = sx(ib) * sy(jb) * d2(sz, kb);
      t += A.coefs[p] * B.coefs[q] * (tx + ty + tz);
    }
  }
  return t;
}

export function nuclearAttraction(A, B, nuclei) {
  const [ia, ja, ka] = A.powers;
  const [ib, jb, kb] = B.powers;
  const tmax = ia + ib;
  const umax = ja + jb;
  const vmax = ka + kb;
  let v = 0;

  for (let p = 0; p < A.exps.length; p++) {
    const a = A.exps[p];
    for (let q = 0; q < B.exps.length; q++) {
      const b = B.exps[q];
      const pp = a + b;
      const Px = (a * A.center[0] + b * B.center[0]) / pp;
      const Py = (a * A.center[1] + b * B.center[1]) / pp;
      const Pz = (a * A.center[2] + b * B.center[2]) / pp;
      const Ex = etable(ia, ib, a, b, A.center[0], B.center[0])[ia][ib];
      const Ey = etable(ja, jb, a, b, A.center[1], B.center[1])[ja][jb];
      const Ez = etable(ka, kb, a, b, A.center[2], B.center[2])[ka][kb];
      const cc = A.coefs[p] * B.coefs[q] * ((2 * Math.PI) / pp);

      for (const nuc of nuclei) {
        const R = hermiteR(pp, Px - nuc.pos[0], Py - nuc.pos[1], Pz - nuc.pos[2], tmax, umax, vmax);
        let acc = 0;
        for (let t = 0; t <= tmax; t++) {
          const ex = Ex[t];
          if (ex === 0) continue;
          for (let u = 0; u <= umax; u++) {
            const ey = Ey[u];
            if (ey === 0) continue;
            const exy = ex * ey;
            for (let w = 0; w <= vmax; w++) {
              const ez = Ez[w];
              if (ez === 0) continue;
              acc += exy * ez * R[ridx(t, u, w)];
            }
          }
        }
        v -= nuc.Z * cc * acc;
      }
    }
  }
  return v;
}

// Integral de repulsion (AB|CD) en notacion de quimicos.
export function eriInt(A, B, C, D) {
  const [ia, ja, ka] = A.powers;
  const [ib, jb, kb] = B.powers;
  const [ic, jc, kc] = C.powers;
  const [id, jd, kd] = D.powers;
  const t1 = ia + ib, u1 = ja + jb, v1 = ka + kb;
  const t2 = ic + id, u2 = jc + jd, v2 = kc + kd;
  let total = 0;

  for (let p = 0; p < A.exps.length; p++) {
    const a = A.exps[p];
    for (let q = 0; q < B.exps.length; q++) {
      const b = B.exps[q];
      const pp = a + b;
      const Px = (a * A.center[0] + b * B.center[0]) / pp;
      const Py = (a * A.center[1] + b * B.center[1]) / pp;
      const Pz = (a * A.center[2] + b * B.center[2]) / pp;
      const E1x = etable(ia, ib, a, b, A.center[0], B.center[0])[ia][ib];
      const E1y = etable(ja, jb, a, b, A.center[1], B.center[1])[ja][jb];
      const E1z = etable(ka, kb, a, b, A.center[2], B.center[2])[ka][kb];
      const cAB = A.coefs[p] * B.coefs[q];

      for (let r = 0; r < C.exps.length; r++) {
        const c = C.exps[r];
        for (let s = 0; s < D.exps.length; s++) {
          const d = D.exps[s];
          const qq = c + d;
          const Qx = (c * C.center[0] + d * D.center[0]) / qq;
          const Qy = (c * C.center[1] + d * D.center[1]) / qq;
          const Qz = (c * C.center[2] + d * D.center[2]) / qq;
          const E2x = etable(ic, id, c, d, C.center[0], D.center[0])[ic][id];
          const E2y = etable(jc, jd, c, d, C.center[1], D.center[1])[jc][jd];
          const E2z = etable(kc, kd, c, d, C.center[2], D.center[2])[kc][kd];

          const alpha = (pp * qq) / (pp + qq);
          const R = hermiteR(alpha, Px - Qx, Py - Qy, Pz - Qz, t1 + t2, u1 + u2, v1 + v2);
          const pref = (2 * Math.pow(Math.PI, 2.5)) / (pp * qq * Math.sqrt(pp + qq));

          let acc = 0;
          for (let t = 0; t <= t1; t++) {
            if (E1x[t] === 0) continue;
            for (let u = 0; u <= u1; u++) {
              if (E1y[u] === 0) continue;
              for (let w = 0; w <= v1; w++) {
                if (E1z[w] === 0) continue;
                const e1 = E1x[t] * E1y[u] * E1z[w];
                for (let tt = 0; tt <= t2; tt++) {
                  if (E2x[tt] === 0) continue;
                  for (let uu = 0; uu <= u2; uu++) {
                    if (E2y[uu] === 0) continue;
                    for (let vv = 0; vv <= v2; vv++) {
                      if (E2z[vv] === 0) continue;
                      const sign = (tt + uu + vv) % 2 === 0 ? 1 : -1;
                      acc += sign * e1 * E2x[tt] * E2y[uu] * E2z[vv] * R[ridx(t + tt, u + uu, w + vv)];
                    }
                  }
                }
              }
            }
          }
          total += cAB * C.coefs[r] * D.coefs[s] * pref * acc;
        }
      }
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Normalizacion de la base: escala cada funcion contraida para que <u|u> = 1.
// ---------------------------------------------------------------------------
export function normalizeBasis(basis) {
  for (const bf of basis) {
    const s = overlap(bf, bf);
    const f = 1 / Math.sqrt(s);
    for (let i = 0; i < bf.coefs.length; i++) bf.coefs[i] *= f;
  }
  return basis;
}

// ---------------------------------------------------------------------------
// Datos de PARES de funciones de base.
//
// El producto de dos gaussianas es otra gaussiana centrada en P: precalcular
// esa informacion una sola vez por pareja (en vez de por cuarteto) es lo que
// hace viable el bucle N^4 de las repulsiones en JavaScript.
// ---------------------------------------------------------------------------
function makePairs(basis) {
  const n = basis.length;
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const A = basis[i], B = basis[j];
      const [ia, ja, ka] = A.powers;
      const [ib, jb, kb] = B.powers;
      const prims = [];
      for (let p = 0; p < A.exps.length; p++) {
        const a = A.exps[p];
        for (let q = 0; q < B.exps.length; q++) {
          const b = B.exps[q];
          const pp = a + b;
          prims.push({
            p: pp,
            Px: (a * A.center[0] + b * B.center[0]) / pp,
            Py: (a * A.center[1] + b * B.center[1]) / pp,
            Pz: (a * A.center[2] + b * B.center[2]) / pp,
            Ex: etable(ia, ib, a, b, A.center[0], B.center[0])[ia][ib],
            Ey: etable(ja, jb, a, b, A.center[1], B.center[1])[ja][jb],
            Ez: etable(ka, kb, a, b, A.center[2], B.center[2])[ka][kb],
            coef: A.coefs[p] * B.coefs[q],
          });
        }
      }
      pairs.push({ i, j, t: ia + ib, u: ja + jb, v: ka + kb, prims });
    }
  }
  return pairs;
}

// (ij|kl) a partir de los datos de dos parejas.
function eriPair(P1, P2) {
  let total = 0;
  for (const A of P1.prims) {
    for (const B of P2.prims) {
      const alpha = (A.p * B.p) / (A.p + B.p);
      const R = hermiteR(alpha, A.Px - B.Px, A.Py - B.Py, A.Pz - B.Pz,
        P1.t + P2.t, P1.u + P2.u, P1.v + P2.v);
      const pref = (2 * Math.pow(Math.PI, 2.5)) / (A.p * B.p * Math.sqrt(A.p + B.p));
      let acc = 0;
      for (let t = 0; t <= P1.t; t++) {
        const ex = A.Ex[t]; if (ex === 0) continue;
        for (let u = 0; u <= P1.u; u++) {
          const ey = A.Ey[u]; if (ey === 0) continue;
          const exy = ex * ey;
          for (let w = 0; w <= P1.v; w++) {
            const ez = A.Ez[w]; if (ez === 0) continue;
            const e1 = exy * ez;
            for (let tt = 0; tt <= P2.t; tt++) {
              const fx = B.Ex[tt]; if (fx === 0) continue;
              for (let uu = 0; uu <= P2.u; uu++) {
                const fy = B.Ey[uu]; if (fy === 0) continue;
                const fxy = fx * fy;
                for (let vv = 0; vv <= P2.v; vv++) {
                  const fz = B.Ez[vv]; if (fz === 0) continue;
                  const sign = (tt + uu + vv) % 2 === 0 ? 1 : -1;
                  acc += sign * e1 * fxy * fz * R[ridx(t + tt, u + uu, w + vv)];
                }
              }
            }
          }
        }
      }
      total += A.coef * B.coef * pref * acc;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Matrices de integrales de todo el sistema.
// El array de repulsion se guarda completo (n^4) para acceso directo; con las
// bases de este proyecto (n < 40) son unos pocos MB.
// ---------------------------------------------------------------------------
export function buildIntegrals(basis, nuclei, onProgress) {
  const n = basis.length;
  const S = [], T = [], V = [], H = [];
  for (let i = 0; i < n; i++) {
    S.push(new Float64Array(n));
    T.push(new Float64Array(n));
    V.push(new Float64Array(n));
    H.push(new Float64Array(n));
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const s = overlap(basis[i], basis[j]);
      const t = kinetic(basis[i], basis[j]);
      const v = nuclearAttraction(basis[i], basis[j], nuclei);
      S[i][j] = S[j][i] = s;
      T[i][j] = T[j][i] = t;
      V[i][j] = V[j][i] = v;
      H[i][j] = H[j][i] = t + v;
    }
  }

  const pairs = makePairs(basis);
  const np = pairs.length;

  // Cribado de Schwarz:  |(ij|kl)| <= sqrt((ij|ij)) sqrt((kl|kl)).
  const Q = new Float64Array(np);
  for (let a = 0; a < np; a++) Q[a] = Math.sqrt(Math.abs(eriPair(pairs[a], pairs[a])));

  const eri = new Float64Array(n * n * n * n);
  const put = (i, j, k, l, val) => { eri[((i * n + j) * n + k) * n + l] = val; };
  const THRESH = 1e-11;

  for (let a = 0; a < np; a++) {
    const { i, j } = pairs[a];
    for (let b = 0; b <= a; b++) {
      if (Q[a] * Q[b] < THRESH) continue;
      const { i: k, j: l } = pairs[b];
      const val = eriPair(pairs[a], pairs[b]);
      // Las 8 permutaciones equivalentes de (ij|kl) con funciones reales.
      put(i, j, k, l, val); put(j, i, k, l, val);
      put(i, j, l, k, val); put(j, i, l, k, val);
      put(k, l, i, j, val); put(l, k, i, j, val);
      put(k, l, j, i, val); put(l, k, j, i, val);
    }
    if (onProgress) onProgress((a + 1) / np);
  }

  return { S, T, V, H, eri, n };
}

// Repulsion nuclear  sum_{A<B} Z_A Z_B / R_AB  (hartree).
export function nuclearRepulsion(nuclei) {
  let e = 0;
  for (let i = 0; i < nuclei.length; i++) {
    for (let j = i + 1; j < nuclei.length; j++) {
      const dx = nuclei[i].pos[0] - nuclei[j].pos[0];
      const dy = nuclei[i].pos[1] - nuclei[j].pos[1];
      const dz = nuclei[i].pos[2] - nuclei[j].pos[2];
      e += (nuclei[i].Z * nuclei[j].Z) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return e;
}

// Valor de una funcion de base contraida en un punto (para visualizar).
export function evalBF(bf, x, y, z) {
  const dx = x - bf.center[0];
  const dy = y - bf.center[1];
  const dz = z - bf.center[2];
  const r2 = dx * dx + dy * dy + dz * dz;
  const [i, j, k] = bf.powers;
  let ang = 1;
  for (let t = 0; t < i; t++) ang *= dx;
  for (let t = 0; t < j; t++) ang *= dy;
  for (let t = 0; t < k; t++) ang *= dz;
  if (ang === 0) return 0;
  let radial = 0;
  for (let p = 0; p < bf.exps.length; p++) {
    radial += bf.coefs[p] * Math.exp(-bf.exps[p] * r2);
  }
  return ang * radial;
}
