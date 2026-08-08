// TEORIA CUANTICA DE ATOMOS EN MOLECULAS (QTAIM, Bader).
//
// La idea de Bader: toda la informacion quimica esta en la DENSIDAD ELECTRONICA
// rho(r), un observable. Su topologia define los objetos quimicos:
//
//   * Puntos criticos (grad rho = 0), clasificados por el rango y la signatura
//     de los autovalores del hessiano (l1 <= l2 <= l3):
//       (3,-3) NCP  maximo   -> un ATOMO (nucleo atractor)
//       (3,-1) BCP  silla    -> un ENLACE (punto critico de enlace)
//       (3,+1) RCP  silla    -> un ANILLO
//       (3,+3) CCP  minimo   -> una CAJA
//     y deben cumplir la relacion de Poincare-Hopf:  n - b + r - c = 1.
//   * Las lineas de maximo gradiente que parten de un BCP hacia los dos nucleos
//     forman el CAMINO DE ENLACE.
//   * Las superficies de flujo cero de grad rho dividen el espacio en CUENCAS
//     atomicas; integrar rho en cada cuenca da la carga atomica de Bader, la
//     unica particion de la carga basada en la mecanica cuantica y no en la
//     base empleada.
//
// Indicadores en el BCP:
//   rho_b            fuerza del enlace
//   lap rho_b < 0    concentracion de carga -> enlace COMPARTIDO (covalente)
//   lap rho_b > 0    deplecion             -> capa cerrada (ionico, H-puente)
//   elipticidad      e = l1/l2 - 1, mide el caracter pi / la asimetria
//   H = G + V < 0    caracter covalente segun las densidades de energia

import { DensityAnalyzer, eigen3 } from './density.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dist = (a, b) => norm(sub(a, b));

// Resuelve el sistema 3x3 H dx = -g (paso de Newton).
function solve3(h, g) {
  const A = [
    [h[0], h[3], h[4], -g[0]],
    [h[3], h[1], h[5], -g[1]],
    [h[4], h[5], h[2], -g[2]],
  ];
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-14) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = c + 1; r < 3; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = A[i][3];
    for (let j = i + 1; j < 3; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

// Busqueda de un punto critico por Newton-Raphson con BUSQUEDA LINEAL sobre
// |grad rho|: el paso de Newton puro oscila entre dos puntos cuando el enlace
// es muy asimetrico (y entonces se pierden puntos criticos reales).
function findCP(da, seed, maxStep = 0.35, iters = 60) {
  let p = [...seed];
  let f = da.full(p[0], p[1], p[2]);
  if (f.rho < 1e-8) return null;

  // Nos quedamos con el MEJOR punto visitado: cerca de una silla el paso de
  // Newton puede empeorar |grad| en una iteracion y arreglarlo en la siguiente,
  // asi que solo amortiguamos los saltos claramente malos.
  let best = { p: [...p], f };
  let trust = 1;                       // radio de confianza relativo
  for (let it = 0; it < iters; it++) {
    if (f.gradNorm < 1e-12) break;
    const dx = solve3(f.h, f.g);
    if (!dx) break;
    const s = norm(dx);
    const k = (s > maxStep ? maxStep / s : 1) * trust;
    const q = [p[0] + k * dx[0], p[1] + k * dx[1], p[2] + k * dx[2]];
    if (norm(q) > 60) break;
    const fq = da.full(q[0], q[1], q[2]);
    // Si el paso empeora el gradiente encogemos el radio, pero seguimos
    // avanzando: cerca de una silla el camino a veces tiene que empeorar antes
    // de mejorar, y pararse ahi hace perder puntos criticos reales.
    trust = fq.gradNorm > f.gradNorm ? Math.max(trust * 0.5, 0.05) : Math.min(1, trust * 1.4);
    p = q; f = fq;
    if (f.gradNorm < best.f.gradNorm) best = { p: [...p], f };
  }
  return best.f.gradNorm < 1e-6 ? { p: best.p, f: best.f } : null;
}

// Radio (bohr) por debajo del cual dos puntos criticos DEL MISMO TIPO se
// consideran el mismo. findCP converge hasta |grad rho| < 1e-6, asi que dos
// semillas que caen en el mismo punto coinciden con muchas cifras.
const DEDUP_R = 0.08;

// Tolerancia relativa para considerar que dos celdas vecinas tienen la MISMA
// densidad (empate) en el reparto de cuencas de Bader.
const TIE_REL = 1e-11;

// Clasificacion (rango, signatura).
function classify(values, tol = 1e-6) {
  const signs = values.map((v) => (v > tol ? 1 : v < -tol ? -1 : 0));
  const rank = signs.filter((s) => s !== 0).length;
  const sig = signs.reduce((a, b) => a + b, 0);
  const type =
    rank === 3 && sig === -3 ? 'NCP' :
    rank === 3 && sig === -1 ? 'BCP' :
    rank === 3 && sig === 1 ? 'RCP' :
    rank === 3 && sig === 3 ? 'CCP' : 'degenerado';
  return { rank, sig, type };
}

// ---------------------------------------------------------------------------
// Analisis topologico completo.
//   atoms: [{Z, sym, pos}]  (bohr)
// ---------------------------------------------------------------------------
export function topology(basis, P, atoms, opts = {}) {
  const da = new DensityAnalyzer(basis, P);
  const cps = [];
  const seen = [];

  const add = (cand, kindHint) => {
    if (!cand) return null;
    const e = eigen3(cand.f.h);
    const cls = classify(e.values);
    const type = kindHint || cls.type;
    // Deduplicado: dos semillas distintas que convergen AL MISMO punto critico
    // caen practicamente encima (findCP afina hasta |grad| < 1e-6), asi que basta
    // un radio pequeno. Con el radio generoso de antes se perdian estructuras
    // reales muy compactas: en H3+ los tres BCP y el RCP del anillo estan a
    // ~0.16 bohr del centro y se absorbian entre si, dejando el anillo sin su
    // punto critico y rompiendo la relacion de Poincare-Hopf.
    for (const s of seen) {
      if (s.type !== type) continue;          // tipos distintos = puntos distintos
      if (dist(s.p, cand.p) < DEDUP_R) return null;
    }
    const rec = {
      p: cand.p, type, rank: cls.rank, sig: cls.sig,
      rho: cand.f.rho, lap: cand.f.lap,
      lambdas: e.values, vectors: e.vectors,
      ellipticity: Math.abs(e.values[1]) > 1e-12 ? e.values[0] / e.values[1] - 1 : 0,
      G: cand.f.G, V: cand.f.V, H: cand.f.H,
      elf: cand.f.elf,
    };
    seen.push(rec);
    cps.push(rec);
    return rec;
  };

  // 1) Nucleos: son los atractores (con gaussianas no hay cuspide exacta, pero
  //    el maximo esta practicamente sobre el nucleo).
  atoms.forEach((a, i) => {
    const f = da.full(a.pos[0], a.pos[1], a.pos[2]);
    const e = eigen3(f.h);
    const rec = {
      p: [...a.pos], type: 'NCP', rank: 3, sig: -3, atom: i, sym: a.sym,
      rho: f.rho, lap: f.lap, lambdas: e.values, vectors: e.vectors,
      ellipticity: 0, G: f.G, V: f.V, H: f.H, elf: f.elf,
    };
    seen.push(rec);
    cps.push(rec);
  });

  // 2) BCP: semillas repartidas a lo largo de cada par de atomos que pueda
  //    estar enlazado.
  //
  //    Que pares se prueban es delicado. Un limite estrecho por radios
  //    covalentes deja fuera los enlaces ESTIRADOS —al alargar el H2 con el
  //    control de distancia, el par se descartaba y el punto critico
  //    desaparecia aunque siga existiendo—. Y uno ancho mete pares "a traves"
  //    de la molecula (los dos H del acetileno, con el C≡C en medio), cuya
  //    busqueda cae en la zona plana del enlace central y produce un punto
  //    critico de mas.
  //
  //    Se combinan por eso dos criterios: distancia generosa Y que no haya otro
  //    atomo interpuesto entre los dos.
  const ANG_TO_BOHR = 1.8897259886;
  // Un maximo de rho a mas de 0.3 bohr de todos los nucleos no es un nucleo.
  const lejosDeNucleos = (p) => atoms.every((a) => dist(a.pos, p) > 0.3);
  const interpuesto = (i, j) => {
    const A = atoms[i].pos, B = atoms[j].pos;
    const ab = sub(B, A);
    const d2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    if (d2 <= 0) return false;
    for (let k = 0; k < atoms.length; k++) {
      if (k === i || k === j) continue;
      const ap = sub(atoms[k].pos, A);
      const t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / d2;
      if (t <= 0.08 || t >= 0.92) continue;       // se proyecta fuera del tramo
      const perp = norm([ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]]);
      if (perp < 0.45 * Math.sqrt(d2)) return true;
    }
    return false;
  };
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = dist(atoms[i].pos, atoms[j].pos);
      const rsum = ((atoms[i].rcov ?? 1.0) + (atoms[j].rcov ?? 1.0)) * ANG_TO_BOHR;
      if (d > (opts.bondFactor ?? 2.8) * rsum) continue;
      if (interpuesto(i, j)) continue;
      const dir = sub(atoms[j].pos, atoms[i].pos).map((v) => v / d);
      const punto = (t) => atoms[i].pos.map((v, k) => v + t * d * dir[k]);
      const seeds = [0.5, 0.35, 0.65, 0.25, 0.75].map(punto);
      for (const s of seeds) {
        const cp = findCP(da, s);
        if (!cp) continue;
        const e = eigen3(cp.f.h);
        const ty = classify(e.values).type;
        if (ty === 'BCP') {
          if (add(cp)) break;
        } else if (ty === 'NCP' && lejosDeNucleos(cp.p)) {
          // ATRACTOR NO NUCLEAR: un maximo de rho que no esta sobre ningun
          // nucleo. Existen de verdad (Li2 es el ejemplo clasico), pero con
          // bases modestas aparecen tambien donde no toca, sobre todo en
          // enlaces homonucleares muy planos. Hay que contarlos: si no, la
          // estructura queda mal descrita aunque Poincare-Hopf salga bien de
          // pura casualidad.
          if (add(cp, 'NNA')) {
            // Con un maximo en medio, los verdaderos puntos de enlace estan a
            // sus DOS lados: hay que buscarlos entre el maximo y cada nucleo.
            for (const t of [0.18, 0.30, 0.70, 0.82]) {
              const c2 = findCP(da, punto(t));
              if (c2 && classify(eigen3(c2.f.h).values).type === 'BCP') add(c2);
            }
          }
          break;
        }
      }
    }
  }

  // 3) RCP/CCP: semillas en los centroides de tercias y cuartetos de atomos.
  if (atoms.length >= 3) {
    for (let i = 0; i < atoms.length; i++)
      for (let j = i + 1; j < atoms.length; j++)
        for (let k = j + 1; k < atoms.length; k++) {
          const c = [0, 1, 2].map((t) => (atoms[i].pos[t] + atoms[j].pos[t] + atoms[k].pos[t]) / 3);
          const cp = findCP(da, c);
          if (cp) {
            const e = eigen3(cp.f.h);
            const ty = classify(e.values).type;
            if (ty === 'RCP' || ty === 'CCP') add(cp);
          }
        }
  }
  // Centroide global (cajas tipo cubano, o el centro de un anillo grande).
  if (atoms.length >= 4) {
    const c = [0, 1, 2].map((t) => atoms.reduce((s, a) => s + a.pos[t], 0) / atoms.length);
    const cp = findCP(da, c);
    if (cp) {
      const e = eigen3(cp.f.h);
      const ty = classify(e.values).type;
      if (ty === 'RCP' || ty === 'CCP') add(cp);
    }
  }

  const counts = { NCP: 0, NNA: 0, BCP: 0, RCP: 0, CCP: 0, degenerado: 0 };
  for (const c of cps) counts[c.type] = (counts[c.type] || 0) + 1;
  // Los atractores no nucleares cuentan como maximos en la relacion de
  // Poincare-Hopf, igual que los nucleos.
  const poincare = counts.NCP + counts.NNA - counts.BCP + counts.RCP - counts.CCP;

  // Etiquetar cada BCP con los dos atomos que une (los extremos de su camino).
  const bcps = cps.filter((c) => c.type === 'BCP');
  const nnas = cps.filter((c) => c.type === 'NNA');
  const paths = [];
  for (const b of bcps) {
    const path = bondPath(da, b, atoms);
    b.atoms = path.ends;
    // Un camino puede acabar en un atractor NO nuclear en vez de en un nucleo:
    // sin esto la etiqueta salia como «N2–?».
    const extremo = (i, rama) => {
      if (i >= 0) return `${atoms[i].sym}${i + 1}`;
      const fin = rama[rama.length - 1];
      return nnas.some((n) => dist(n.p, fin) < 0.35) ? 'ANN' : '?';
    };
    const ramas = [path.points.slice(0, Math.ceil(path.points.length / 2)).reverse(),
      path.points.slice(Math.floor(path.points.length / 2))];
    b.label = [extremo(path.ends[0], ramas[0]), extremo(path.ends[1], ramas[1])].join('–');
    b.pathLength = path.length;
    paths.push({ bcp: b, points: path.points, ends: path.ends });
  }

  return { cps, bcps, paths, counts, poincare, analyzer: da };
}

// ---------------------------------------------------------------------------
// Camino de enlace: ascenso por el gradiente desde el BCP en las dos
// direcciones del autovector de curvatura POSITIVA (l3).
// ---------------------------------------------------------------------------
export function bondPath(da, bcp, atoms, step = 0.06, maxSteps = 400) {
  const dirEigen = bcp.vectors[2]; // autovector de lambda_3 (> 0): eje del enlace
  const branches = [];
  const ends = [];

  for (const sgn of [1, -1]) {
    let p = [0, 1, 2].map((k) => bcp.p[k] + sgn * step * dirEigen[k]);
    const pts = [[...bcp.p], [...p]];
    let end = -1;
    let rhoPrev = da.rho(p[0], p[1], p[2]);
    for (let it = 0; it < maxSteps; it++) {
      const g = da.gradient(p[0], p[1], p[2]);
      const gn = norm(g);
      if (gn < 1e-7) break;               // llegamos a un maximo (atractor)
      // Paso adaptativo: al acercarse a un nucleo hay que ir mas fino o el
      // camino se pone a orbitar el maximo sin llegar nunca.
      let dn = Infinity;
      let near = -1;
      atoms.forEach((a, i) => { const d = dist(a.pos, p); if (d < dn) { dn = d; near = i; } });
      if (dn < 0.15) { pts.push([...atoms[near].pos]); end = near; break; }
      const st = Math.min(step, Math.max(0.01, dn * 0.5));
      p = [0, 1, 2].map((k) => p[k] + (st * g[k]) / gn);
      const rhoNow = da.rho(p[0], p[1], p[2]);
      pts.push([...p]);
      if (rhoNow < rhoPrev) break;        // hemos pasado de largo el maximo
      rhoPrev = rhoNow;
      if (norm(p) > 60) break;
    }
    // Si el camino acabo cerca de un nucleo (atractor desplazado), lo asignamos.
    if (end < 0) {
      const last = pts[pts.length - 1];
      atoms.forEach((a, i) => { if (dist(a.pos, last) < 0.6) end = i; });
    }
    branches.push(pts);
    ends.push(end);
  }

  // Une las dos ramas en una polilinea continua.
  const points = branches[0].slice().reverse().concat(branches[1].slice(1));
  let length = 0;
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i]);
  return { points, ends, length };
}

// ---------------------------------------------------------------------------
// CUENCAS ATOMICAS (cargas de Bader) sobre rejilla, por el metodo de PESOS de
// Yu-Trinkle.
//
// La superficie que separa dos cuencas es la de FLUJO CERO de grad rho. La
// forma ingenua de encontrarla es lanzar una trayectoria de ascenso desde cada
// punto y ver en que nucleo acaba; el problema es que cada celda se asigna
// entera a un solo atomo, y si ademas se memorizan las trayectorias el
// resultado depende del ORDEN de barrido: en N2, que es simetrico, un nitrogeno
// se quedaba con 0.6 electrones mas que el otro.
//
// El metodo de pesos evita las dos cosas. Se recorren las celdas de MAYOR a
// MENOR densidad y cada una reparte su pertenencia entre sus vecinas mas densas
// en proporcion al flujo que va hacia ellas:
//
//     w_i(A) = sum_j max(0, rho_j - rho_i) w_j(A) / sum_j max(0, rho_j - rho_i)
//
// Una celda del interior de una cuenca recibe peso 1 de un solo atomo; solo las
// de la superficie quedan repartidas, con lo que la frontera es fraccionaria
// (no dentada) y el resultado no depende de como caiga la rejilla. Los maximos
// locales —los nucleos— son el punto de partida: peso 1 para su propio atomo.
//
// Referencia: M. Yu y D. R. Trinkle, J. Chem. Phys. 134, 064111 (2011).
// ---------------------------------------------------------------------------
export function baderBasins(basis, P, atoms, opts = {}) {
  const N = opts.N ?? 72;
  const H = opts.H ?? 8;
  const da = new DensityAnalyzer(basis, P);
  const step = (2 * H) / (N - 1);
  const nCell = N * N * N;
  const nAt = atoms.length;
  const rho = new Float64Array(nCell);
  const idx = (i, j, k) => (k * N + j) * N + i;

  for (let k = 0; k < N; k++) {
    const z = -H + k * step;
    for (let j = 0; j < N; j++) {
      const y = -H + j * step;
      for (let i = 0; i < N; i++) {
        rho[idx(i, j, k)] = da.rho(-H + i * step, y, z);
      }
    }
    if (opts.onProgress) opts.onProgress((0.45 * (k + 1)) / N);
  }

  const nearestAtom = (x, y, z) => {
    let best = 0, bd = Infinity;
    for (let t = 0; t < nAt; t++) {
      const a = atoms[t].pos;
      const d = (a[0] - x) ** 2 + (a[1] - y) ** 2 + (a[2] - z) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  };

  // Celdas ordenadas por densidad DECRECIENTE. Es el unico orden que usa el
  // metodo, y es intrinseco a rho: de ahi que el resultado sea simetrico si la
  // molecula lo es.
  const order = new Int32Array(nCell);
  for (let c = 0; c < nCell; c++) order[c] = c;
  const rhoArr = rho;
  const ord = Array.prototype.sort.call(order, (a, b) => rhoArr[b] - rhoArr[a]);
  if (opts.onProgress) opts.onProgress(0.6);

  // Pesos. La inmensa mayoria de las celdas pertenece a UNA sola cuenca, asi que
  // se guarda solo el atomo (pure) y se reserva el mapa disperso para las de la
  // frontera.
  const pure = new Int16Array(nCell).fill(-1);
  const mixed = new Map();                       // celda -> Float64Array(nAt)
  const wOf = (c) => {
    const m = mixed.get(c);
    if (m) return m;
    const w = new Float64Array(nAt);
    const p = pure[c];
    if (p >= 0) w[p] = 1;
    return w;
  };
  const setW = (c, w) => {
    let nz = -1, cnt = 0;
    for (let t = 0; t < nAt; t++) {
      if (w[t] > 1e-8) { cnt++; nz = t; } else w[t] = 0;
    }
    if (cnt <= 1) { pure[c] = cnt === 1 ? nz : nearestAtomOfCell(c); return; }
    // Renormaliza (los truncamientos de arriba quitan una pizca).
    let s = 0;
    for (let t = 0; t < nAt; t++) s += w[t];
    if (s > 0) for (let t = 0; t < nAt; t++) w[t] /= s;
    mixed.set(c, w);
    let bi = 0;
    for (let t = 1; t < nAt; t++) if (w[t] > w[bi]) bi = t;
    pure[c] = bi;                                // dueno mayoritario (para dibujar)
  };
  const nearestAtomOfCell = (c) => {
    const i = c % N, j = ((c - i) / N) % N, k = (c - i - j * N) / (N * N);
    return nearestAtom(-H + i * step, -H + j * step, -H + k * step);
  };

  const wAcc = new Float64Array(nAt);
  for (let o = 0; o < nCell; o++) {
    const c = ord[o];
    const i = c % N, j = ((c - i) / N) % N, k = (c - i - j * N) / (N * N);
    const rc = rho[c];
    wAcc.fill(0);
    let fluxTot = 0;
    // Vecinos de cara con densidad MAYOR: son los que ya estan resueltos.
    const nb = [
      i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1,
      j > 0 ? c - N : -1, j < N - 1 ? c + N : -1,
      k > 0 ? c - N * N : -1, k < N - 1 ? c + N * N : -1,
    ];
    for (let n = 0; n < 6; n++) {
      const d = nb[n];
      if (d < 0) continue;
      const f = rho[d] - rc;
      // Solo cuesta arriba, y con un EMPATE relativo: dos celdas simetricas
      // respecto de la superficie interatomica tienen la misma densidad salvo
      // ruido de redondeo (~1e-14 relativo). Comparando en estricto, ese ruido
      // decide hacia donde va todo el flujo y rompe la simetria de la molecula:
      // en N2 se llevaba medio electron de un nitrogeno al otro.
      if (f <= TIE_REL * (Math.abs(rc) + Math.abs(rho[d]))) continue;
      fluxTot += f;
      const wd = wOf(d);
      for (let t = 0; t < nAt; t++) if (wd[t] > 0) wAcc[t] += f * wd[t];
    }
    if (fluxTot <= 0) {
      // Maximo local: un nucleo (o un maximo espurio en el vacio, que se asigna
      // por cercania y pesa cero en la integral).
      pure[c] = nearestAtom(-H + i * step, -H + j * step, -H + k * step);
      continue;
    }
    for (let t = 0; t < nAt; t++) wAcc[t] /= fluxTot;
    setW(c, wAcc.slice());
    if (opts.onProgress && (o & 0x3ffff) === 0) opts.onProgress(0.6 + (0.4 * o) / nCell);
  }

  // Integracion: cada celda reparte su carga segun sus pesos.
  const dV = step * step * step;
  const pop = atoms.map(() => 0);
  const vol = atoms.map(() => 0);
  for (let c = 0; c < nCell; c++) {
    const q = rho[c] * dV;
    const m = mixed.get(c);
    if (m) {
      for (let t = 0; t < nAt; t++) if (m[t] > 0) {
        pop[t] += q * m[t];
        if (rho[c] > 0.001) vol[t] += dV * m[t];
      }
    } else {
      const p = pure[c];
      pop[p] += q;
      if (rho[c] > 0.001) vol[p] += dV;
    }
  }

  // La suma de Riemann sobre la rejilla subestima la carga cerca de los nucleos
  // (donde rho varia muy deprisa). Reescalamos al numero de electrones exacto:
  // es lo que hacen los programas de rejilla, y mejora bastante las cargas.
  const nelec = opts.nelec ?? atoms.reduce((s, a) => s + a.Z, 0);
  const total = pop.reduce((a, b) => a + b, 0);
  const f = total > 0 ? nelec / total : 1;
  const popNorm = pop.map((v) => v * f);
  const charges = atoms.map((a, i) => a.Z - popNorm[i]);
  return {
    charges, pop: popNorm, popRaw: pop, vol, owner: pure, N, H, step, rho, dV,
    outside: 0, mixed: mixed.size, integrated: total, nelec, scale: f,
  };
}
