// Construccion de la BASE ATOMICA para el calculo LCAO-SCF.
//
// Un orbital (atomico o molecular) se escribe como combinacion lineal de
// funciones de base centradas en los nucleos. Aqui se ofrecen tres familias,
// que es exactamente la eleccion que plantea la quimica cuantica practica:
//
//   1. STO-nG   -> orbitales de SLATER  r^(n-1) e^(-zeta r), ajustados por
//                  minimos cuadrados a una suma de n gaussianas (asi las
//                  integrales bicentricas son analiticas).
//   2. Hidrogenoide -> las R_nl(r) exactas del atomo de un electron con carga
//                  efectiva de Slater, tambien expandidas en gaussianas.
//   3. Gaussianas puras (even-tempered, sin contraer) -> el SCF elige libremente
//                  los coeficientes: mas flexible y mas cerca del limite HF.
//
// Los exponentes de partida salen de las REGLAS DE SLATER; el modulo
// variacional puede despues reescalarlos para bajar la energia.

import { solveLinear } from './linalg.js';
import { nelderMead } from './optimize.js';
import { configFor, slaterZeta, slaterZeff, SUBSHELL, elementByZ } from './atoms.js';
import { radial as hydrogenicRadial } from './hydrogen.js';

// Componentes cartesianas de cada capa (l = 0, 1, 2).
const CART = [
  [[0, 0, 0]],
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1]],
];
const CART_LABEL = [
  [''],
  ['x', 'y', 'z'],
  ['x²', 'y²', 'z²', 'xy', 'xz', 'yz'],
];

const GAMMA_L32 = [0.8862269254527580, 1.3293403881791370, 3.3233509704478426]; // Γ(l+3/2)

// ---------------------------------------------------------------------------
// Cuadratura radial: r = rmax * t^2 concentra puntos cerca del nucleo, donde
// las gaussianas del core varian muy deprisa.
// ---------------------------------------------------------------------------
function radialQuadrature(rmax, N = 2000) {
  const r = new Float64Array(N + 1);
  const w = new Float64Array(N + 1);
  const h = 1 / N;
  for (let i = 0; i <= N; i++) {
    const t = i * h;
    r[i] = rmax * t * t;
    // Simpson en t, con el jacobiano dr/dt = 2 rmax t.
    const sw = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
    w[i] = ((sw * h) / 3) * 2 * rmax * t;
  }
  return { r, w, N };
}

// ---------------------------------------------------------------------------
// Ajuste de una funcion radial f(r) a  sum_k c_k r^l exp(-alpha_k r^2)
// en la metrica <u|v> = int u v r^2 dr.
//
// Para exponentes fijos los coeficientes optimos son lineales: c = S^-1 b.
// Los exponentes se optimizan con Nelder-Mead maximizando el solapamiento
// (criterio clasico de Hehre-Stewart-Pople para las bases STO-nG).
// ---------------------------------------------------------------------------
const fitCache = new Map();

export function fitRadialGaussians(fn, l, nG, scale = 1, cacheKey = null, rmaxIn = null) {
  if (cacheKey && fitCache.has(cacheKey)) return fitCache.get(cacheKey);

  const rmax = rmaxIn ?? Math.max(12, 9 / Math.sqrt(scale));
  const { r, w } = radialQuadrature(rmax);
  const N = r.length;

  // Precalculo de f(r) r^(l+2) w  y de <f|f>.
  const fr = new Float64Array(N);
  let ff = 0;
  for (let i = 0; i < N; i++) {
    const v = fn(r[i]);
    fr[i] = v * Math.pow(r[i], l + 2) * w[i];
    ff += v * v * r[i] * r[i] * w[i];
  }

  const gamma = GAMMA_L32[l];
  const overlapMatrix = (a) => {
    const S = [];
    for (let i = 0; i < nG; i++) {
      S.push(new Float64Array(nG));
      for (let j = 0; j < nG; j++) S[i][j] = gamma / (2 * Math.pow(a[i] + a[j], l + 1.5));
    }
    return S;
  };
  const targetVector = (a) => {
    const b = new Float64Array(nG);
    for (let k = 0; k < nG; k++) {
      const ak = a[k];
      let s = 0;
      for (let i = 0; i < N; i++) s += fr[i] * Math.exp(-ak * r[i] * r[i]);
      b[k] = s;
    }
    return b;
  };

  // Parametrizacion con SEPARACION MINIMA entre exponentes:
  //   alpha_0 = e^{x0},   alpha_k = alpha_{k-1} * exp(ln RMIN + x_k^2)
  // Sin esta ligadura el optimizador tiende a juntar dos exponentes y emular una
  // derivada con coeficientes gigantes de signo opuesto: el ajuste "parece"
  // bueno pero la contraccion se evalua como diferencia de numeros enormes y la
  // cancelacion destruye la precision de las integrales.
  const LN_RMIN = Math.log(1.45);
  const expsFrom = (x) => {
    const a = new Float64Array(nG);
    a[0] = Math.exp(x[0]);
    for (let k = 1; k < nG; k++) a[k] = a[k - 1] * Math.exp(LN_RMIN + x[k] * x[k]);
    return a;
  };

  // Objetivo: 1 - (solapamiento normalizado)^2  -> minimizar.
  const objective = (x) => {
    const a = expsFrom(x);
    for (let i = 0; i < nG; i++) if (!isFinite(a[i]) || a[i] < 1e-6 || a[i] > 1e4) return 1e3;
    const S = overlapMatrix(a);
    const b = targetVector(a);
    const c = solveLinear(S, b);
    if (!c) return 1e3;
    let bc = 0;
    for (let k = 0; k < nG; k++) bc += b[k] * c[k];
    return 1 - bc / ff;
  };

  // Semillas even-tempered (varios arranques: el ajuste no lineal tiene minimos
  // locales y este ajuste se hace una sola vez, asi que compensa explorar).
  const range = Math.pow(3.2, nG - 1);
  const aMin = 0.11 * scale * Math.pow(20 / Math.max(range, 1e-9), 0.25);
  let res = null;
  for (const aFac of [0.25, 1, 4]) {
    for (const ratio of [2.4, 3.2, 4.6]) {
      const gapSeed = Math.sqrt(Math.max(Math.log(ratio) - LN_RMIN, 1e-6));
      const seed = [Math.log(aMin * aFac)];
      for (let k = 1; k < nG; k++) seed.push(gapSeed);
      const r = nelderMead(objective, seed, { step: 0.4, tol: 1e-10, maxIter: 500 });
      if (!res || r.f < res.f) res = r;
    }
  }
  const exps = Array.from(expsFrom(res.x)).sort((a, b) => b - a);
  const coefs = solveLinear(overlapMatrix(exps), targetVector(exps)) || new Float64Array(nG);

  const out = {
    exps: Float64Array.from(exps),
    coefs: Float64Array.from(coefs),
    quality: 1 - res.f, // solapamiento^2 con la funcion objetivo
  };
  if (cacheKey) fitCache.set(cacheKey, out);
  return out;
}

// Funciones radiales objetivo -----------------------------------------------
export const slaterRadial = (nq, zeta) => (r) => Math.pow(r, nq - 1) * Math.exp(-zeta * r);
export const hydrogenicR = (nq, l, Zeff) => (r) => hydrogenicRadial(nq, l, r, Zeff);

// Exponentes de polarizacion (gaussiana unica), del estilo de 6-31G*.
const POL_EXP = {
  H: 1.10, He: 1.10,
  Li: 0.20, Be: 0.40, B: 0.60, C: 0.80, N: 0.80, O: 0.80, F: 0.80, Ne: 0.80,
  Na: 0.18, Mg: 0.18, Al: 0.33, Si: 0.45, P: 0.55, S: 0.65, Cl: 0.75, Ar: 0.85,
  K: 0.20, Ca: 0.20,
};

// Factores del desdoblamiento doble-zeta de la capa de valencia. El primero es
// 1.0 a proposito: asi la base DZ CONTIENE a la base minima y el teorema
// variacional garantiza que la energia solo puede bajar al ampliarla.
const DZ_IN = 1.0;
const DZ_OUT = 0.45;
// El HIDROGENO necesita un desdoblamiento mucho mas suave. Con la funcion
// externa tan difusa (0.45 zeta) el SCF la usa para llevar densidad a la zona
// del enlace y el 1s del H se aplana tanto que DEJA DE SER UN MAXIMO de rho
// cuando el vecino es muy electronegativo (H2O, H3O+, HF): entonces el atomo
// pierde su cuenca, su punto critico de enlace y su camino de enlace, y la
// relacion de Poincare-Hopf falla. Los valores de abajo son del orden de los de
// 6-31G reescalados (interna ~1.5, externa ~0.9 en unidades de zeta) y
// conservan la topologia sin renunciar a la mejora variacional.
const DZ_IN_H = 1.25;
const DZ_OUT_H = 0.75;
// Exponente de la funcion difusa (aniones): muy separado del de valencia.
const DIFFUSE = 0.15;

export const BASIS_KINDS = [
  { key: 'sto', label: 'Slater (STO-nG)' },
  { key: 'hidrogenoide', label: 'Hidrogenoide (R_nl)' },
  { key: 'gauss', label: 'Gaussianas even-tempered' },
];
export const BASIS_QUALITY = [
  { key: 'sz', label: 'Mínima (1 función por subcapa)' },
  { key: 'dz', label: 'Doble zeta (valencia desdoblada)' },
  { key: 'dzd', label: 'DZ + difusa (aniones)' },
  { key: 'dzp', label: 'DZ + polarización' },
  { key: 'dzpd', label: 'DZ + polarización + difusa' },
];

// ---------------------------------------------------------------------------
// Capas de un atomo. Devuelve descripciones {n, l, zeta, exps, coefs, kind}.
// `opts`: { kind, nG, quality, zetaScale }
// ---------------------------------------------------------------------------
export function atomShells(Z, opts = {}) {
  const kind = opts.kind ?? 'sto';
  const nG = Math.max(1, Math.min(8, opts.nG ?? 3));
  const quality = opts.quality ?? 'sz';
  const scale = opts.zetaScale ?? 1;
  const el = elementByZ(Z);
  const cfg = configFor(Z);                 // configuracion del atomo NEUTRO
  const shells = [];

  const valenceN = Math.max(...cfg.map((s) => s.n));
  const wantDZ = quality !== 'sz';
  const wantDiffuse = quality === 'dzd' || quality === 'dzpd';
  const wantPol = quality === 'dzp' || quality === 'dzpd';

  if (kind === 'gauss') {
    // Even-tempered sin contraer: una primitiva por funcion, el SCF decide.
    const byL = new Map();
    for (const sh of cfg) {
      if (!byL.has(sh.l)) byL.set(sh.l, []);
      byL.get(sh.l).push(sh);
    }
    for (const [l, list] of byL) {
      const zetas = list.map((sh) => slaterZeta(Z, cfg, sh.n, sh.l) * scale);
      const zMax = Math.max(...zetas);
      const zMin = Math.min(...zetas);
      // El rango debe llegar arriba (core: alfa ~ 20 zeta^2, como en STO-6G) y
      // abajo (cola de valencia), con suficientes funciones para cubrirlo.
      const extra = quality === 'sz' ? 4 : 6;
      const nFun = list.length + extra;
      const aMax = 20.0 * zMax * zMax;
      const aMin = (wantDiffuse ? 0.02 : 0.06) * zMin * zMin;
      const beta = Math.pow(aMax / aMin, 1 / (nFun - 1));
      for (let k = 0; k < nFun; k++) {
        const a = aMin * Math.pow(beta, k);
        shells.push({
          n: list[0].n, l, zeta: Math.sqrt(a), kind: 'gauss',
          exps: Float64Array.from([a]),
          coefs: Float64Array.from([1]),
          base: SUBSHELL[l], qual: `α=${a.toPrecision(3)}`,
          quality: 1,
        });
      }
    }
    if (wantPol) {
      const lp = Math.max(...cfg.map((s) => s.l)) + 1;
      if (lp <= 2) {
        const a = (POL_EXP[el.sym] ?? 0.8) * scale * scale;
        shells.push({
          n: valenceN, l: lp, zeta: Math.sqrt(a), kind: 'pol',
          exps: Float64Array.from([a]), coefs: Float64Array.from([1]),
          base: SUBSHELL[lp], qual: 'pol.', quality: 1,
        });
      }
    }
    return shells;
  }

  // STO-nG / hidrogenoide: una contraccion de nG gaussianas por funcion.
  //
  // El ajuste se hace UNA sola vez con exponente unidad y despues se reescala:
  //   f_zeta(r) = zeta^(l-n+1) f_1(zeta r)  =>  alpha_k -> alpha_k zeta^2
  // Es la misma propiedad que permite tabular las STO-nG de una vez por todas,
  // y aqui ademas hace instantaneo el barrido variacional de zeta.
  const addFitted = (nq, l, zeta, tag, base, qual = '') => {
    const nGuse = Math.max(nG, nq); // 2s/3s necesitan al menos tantas gaussianas
    const key = `${kind}|${nq}|${l}|${nGuse}|${kind === 'hidrogenoide' ? Z : ''}`;
    const unitFn = kind === 'hidrogenoide'
      ? hydrogenicR(nq, l, 1)
      : slaterRadial(nq, 1);
    const fit = fitRadialGaussians(unitFn, l, nGuse, 1, key, 12 + 9 * nq);
    // Para la base hidrogenoide el "exponente" que escala es Z_ef/1 (R_nl(r;Z)
    // = Z^{3/2} R_nl(Zr;1)); para la de Slater es zeta.
    const k = kind === 'hidrogenoide'
      ? Math.max(slaterZeff(Z, cfg, nq, l), 0.4) * (zeta / (slaterZeta(Z, cfg, nq, l) || 1))
      : zeta;
    const exps = Float64Array.from(fit.exps, (a) => a * k * k);
    shells.push({
      n: nq, l, zeta: k, kind: tag, exps, coefs: Float64Array.from(fit.coefs),
      quality: fit.quality, base, qual,
    });
  };

  const byShell = opts.zetaScaleByShell || null; // factores independientes por subcapa
  const dzIn = opts.dzIn ?? (Z <= 2 ? DZ_IN_H : DZ_IN);
  const dzOut = opts.dzOut ?? (Z <= 2 ? DZ_OUT_H : DZ_OUT);
  for (const sh of cfg) {
    const extra = byShell ? (byShell[`${sh.n}${SUBSHELL[sh.l]}`] ?? 1) : 1;
    const z0 = slaterZeta(Z, cfg, sh.n, sh.l) * scale * extra;
    const isValence = sh.n === valenceN;
    const name = `${sh.n}${SUBSHELL[sh.l]}`;
    if (wantDZ && isValence) {
      addFitted(sh.n, sh.l, z0 * dzIn, 'valencia', name, 'int.');
      addFitted(sh.n, sh.l, z0 * dzOut, 'valencia', name, 'ext.');
    } else {
      addFitted(sh.n, sh.l, z0, isValence ? 'valencia' : 'core', name);
    }
    if (wantDiffuse && isValence) {
      // Bastante mas difusa que la externa: si se parecen, la base se vuelve
      // casi linealmente dependiente y el SCF se descompone.
      addFitted(sh.n, sh.l, z0 * DIFFUSE, 'difusa', name, 'dif.');
    }
  }

  if (wantPol) {
    const lp = Math.max(...cfg.map((s) => s.l)) + 1;
    if (lp <= 2) {
      const a = (POL_EXP[el.sym] ?? 0.8) * scale * scale;
      shells.push({
        n: valenceN, l: lp, zeta: Math.sqrt(a), kind: 'pol',
        exps: Float64Array.from([a]), coefs: Float64Array.from([1]),
        base: SUBSHELL[lp], qual: 'pol.', quality: 1,
      });
    }
  }
  return shells;
}

// ---------------------------------------------------------------------------
// Base completa de un sistema (uno o varios nucleos).
// `atoms`: [{ Z, pos: [x,y,z] (bohr), sym }]
// Devuelve { basis, meta } donde meta[i] describe la funcion i.
// ---------------------------------------------------------------------------
// Exponentes "moleculares" recomendados frente a los que dan las reglas de
// Slater. El caso clasico es el HIDROGENO: las reglas dan zeta = 1 (exacto para
// el atomo aislado), pero en una molecula el 1s se contrae y el valor optimo es
// ~1.24 (Hehre-Stewart-Pople). Con zeta = 1 el H queda tan difuso que hasta
// pierde su maximo de densidad, y con el se pierden su cuenca y su punto
// critico de enlace en el analisis QTAIM.
const MOLECULAR_ZETA = { H: 1.24 };

export function buildBasis(atoms, opts = {}) {
  const basis = [];
  const meta = [];
  const isMolecule = atoms.length > 1;
  atoms.forEach((atom, ai) => {
    const elemScale = isMolecule && !opts.pureSlater ? (MOLECULAR_ZETA[atom.sym] ?? 1) : 1;
    const shells = atomShells(atom.Z, elemScale === 1
      ? opts
      : { ...opts, zetaScale: (opts.zetaScale ?? 1) * elemScale });
    for (const sh of shells) {
      const comps = CART[sh.l];
      comps.forEach((powers, ci) => {
        // Los coeficientes del ajuste se refieren a primitivas SIN normalizar
        // (r^l e^{-a r^2}); la parte angular es comun a toda la capa, asi que
        // los pesos relativos valen tal cual. normalizeBasis() fija la escala.
        basis.push({
          center: atom.pos, powers, exps: sh.exps, coefs: Float64Array.from(sh.coefs),
        });
        meta.push({
          atom: ai, sym: atom.sym, n: sh.n, l: sh.l, zeta: sh.zeta, kind: sh.kind,
          label: `${sh.base}${CART_LABEL[sh.l][ci]}${sh.qual ? ` ${sh.qual}` : ''}`,
          quality: sh.quality,
        });
      });
    }
  });
  return { basis, meta };
}

// Numero de funciones de base que generaria una configuracion (para avisar
// antes de lanzar un calculo caro: el coste de las integrales va como N^4).
export function basisSize(atoms, opts = {}) {
  let n = 0;
  for (const atom of atoms) {
    for (const sh of atomShells(atom.Z, opts)) n += CART[sh.l].length;
  }
  return n;
}
