// Hilo de calculo (Web Worker) para la quimica cuantica.
//
// El SCF, el analisis topologico y las cuencas de Bader tardan de decimas de
// segundo a varios segundos: ejecutarlos aqui deja el bucle de render (y sobre
// todo la VR, donde una pausa se nota muchisimo) completamente libre.

import { computeSystem, moEvaluator, densityEvaluator, spinDensityEvaluator } from '../physics/qchem.js';
import { topology, baderBasins } from '../physics/qtaim.js';
import { DensityAnalyzer } from '../physics/density.js';
import { sampleField } from '../viz/field3d.js';
import { optimizeGlobalZeta, optimizeShellZetas, scanBond } from '../physics/variational.js';

// Ultimo sistema calculado (lo reutilizan los campos, la topologia y Bader).
let current = null;
let currentAtoms = null;

// Coordenadas de ESCENA (Y arriba) -> FISICAS (z = eje polar).
const sceneToPhys = (xs, ys, zs) => [xs, zs, ys];

const post = (msg, transfer) => self.postMessage(msg, transfer || []);

// Quita de un resultado lo que no se puede clonar (funciones, instancias).
const mat = (M) => (M ? M.map((row) => Array.from(row)) : null);

function serializable(r) {
  return {
    atoms: r.atoms, meta: r.meta, nelec: r.nelec, charge: r.charge, mult: r.mult,
    basis: r.basis.map((b) => ({
      center: b.center, powers: b.powers,
      exps: Array.from(b.exps), coefs: Array.from(b.coefs),
    })),
    // Matrices necesarias para evaluar orbitales y densidad en el hilo
    // principal (cortes, nube de puntos y sonda), en arrays normales.
    C: mat(r.scf.Ca || r.scf.C), Cb: r.scf.Cb ? mat(r.scf.Cb) : null,
    P: mat(r.scf.P), Pa: r.scf.Pa ? mat(r.scf.Pa) : null, Pb: r.scf.Pb ? mat(r.scf.Pb) : null,
    E: r.Etot, Eelec: r.Eelec, Enuc: r.Enuc,
    Ekin: r.Ekin, Ene: r.Ene, Eee: r.Eee, virial: r.virial,
    charges: r.charges, spinPop: r.spinPop, orbitals: r.orbitals,
    nbf: r.nbf, method: r.method, converged: r.converged, iterations: r.iterations,
    eps: Array.from(r.scf.eps || r.scf.epsA || []),
    epsB: r.scf.epsB ? Array.from(r.scf.epsB) : null,
    occ: r.scf.occ || r.scf.occA, occB: r.scf.occB || null,
    nocc: r.scf.nocc ?? r.scf.nalpha, nalpha: r.scf.nalpha, nbeta: r.scf.nbeta,
    homo: r.scf.homo, lumo: r.scf.lumo, s2: r.scf.s2 ?? null, s2exact: r.scf.s2exact ?? null,
    nmo: r.scf.nmo, dropped: r.scf.dropped,
  };
}

// Evaluador del campo pedido, en coordenadas de ESCENA.
function fieldFunction(kind, opts) {
  const { basis, scf } = current;
  if (kind === 'mo') {
    const C = opts.spin === 'beta' && scf.Cb ? scf.Cb : (scf.Ca || scf.C);
    const fn = moEvaluator(basis, C, opts.moIndex);
    return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return fn(p[0], p[1], p[2]); };
  }
  if (kind === 'spin' && scf.Pa && scf.Pb) {
    const fn = spinDensityEvaluator(basis, scf.Pa, scf.Pb);
    return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return fn(p[0], p[1], p[2]); };
  }
  const da = new DensityAnalyzer(basis, scf.P);
  if (kind === 'rho') {
    return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return da.rho(p[0], p[1], p[2]); };
  }
  if (kind === 'lap') {
    return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return -da.full(p[0], p[1], p[2]).lap; };
  }
  if (kind === 'elf') {
    return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return da.full(p[0], p[1], p[2]).elf; };
  }
  // Por defecto, densidad.
  return (xs, ys, zs) => { const p = sceneToPhys(xs, ys, zs); return da.rho(p[0], p[1], p[2]); };
}

self.onmessage = async (ev) => {
  const { id, type, payload } = ev.data;
  const progress = (info) => post({ id, type: 'progress', ...info });

  try {
    if (type === 'compute') {
      const t0 = Date.now();
      current = computeSystem(payload, progress);
      currentAtoms = payload.atoms;
      post({ id, type: 'done', result: { ...serializable(current), ms: Date.now() - t0 } });

    } else if (type === 'field') {
      if (!current) throw new Error('No hay ningún sistema calculado.');
      const fn = fieldFunction(payload.kind, payload);
      const f = sampleField(fn, payload.gridN, payload.H);
      const data = new Float32Array(f.data);
      post({
        id, type: 'done',
        result: { data, N: f.N, H: f.H, step: f.step, origin: f.origin, min: f.min, max: f.max, absMax: f.absMax },
      }, [data.buffer]);

    } else if (type === 'topology') {
      if (!current) throw new Error('No hay ningún sistema calculado.');
      const topo = topology(current.basis, current.scf.P, currentAtoms);
      post({
        id, type: 'done',
        result: {
          counts: topo.counts, poincare: topo.poincare,
          cps: topo.cps.map((c) => ({
            p: c.p, type: c.type, rho: c.rho, lap: c.lap, lambdas: c.lambdas,
            ellipticity: c.ellipticity, G: c.G, V: c.V, H: c.H, elf: c.elf,
            label: c.label || null, atoms: c.atoms || null, sym: c.sym || null,
            pathLength: c.pathLength ?? null,
          })),
          paths: topo.paths.map((p) => ({ points: p.points, ends: p.ends })),
        },
      });

    } else if (type === 'bader') {
      if (!current) throw new Error('No hay ningún sistema calculado.');
      const b = baderBasins(current.basis, current.scf.P, currentAtoms, {
        N: payload.N, H: payload.H, nelec: current.nelec,
        onProgress: (f) => progress({ frac: f, stage: 'cuencas' }),
      });
      const owner = b.owner;
      const rho = Float32Array.from(b.rho); // para pintar la nube de cuencas
      post({
        id, type: 'done',
        result: {
          charges: b.charges, pop: b.pop, vol: b.vol, owner, rho,
          N: b.N, H: b.H, step: b.step, integrated: b.integrated, scale: b.scale,
        },
      }, [owner.buffer, rho.buffer]);

    } else if (type === 'optimize') {
      const r = payload.mode === 'shell'
        ? optimizeShellZetas(payload.system, payload.opts)
        : optimizeGlobalZeta(payload.system, payload.opts);
      post({ id, type: 'done', result: r });

    } else if (type === 'scan') {
      const r = scanBond(payload.molKey, payload.basisOpts, {
        ...payload.opts,
        onPoint: (frac, R, E) => progress({ frac, stage: 'curva', R, E }),
      });
      post({ id, type: 'done', result: r });

    } else {
      throw new Error(`Petición desconocida: ${type}`);
    }
  } catch (err) {
    post({ id, type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
