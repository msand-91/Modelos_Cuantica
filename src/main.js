import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { createScene } from './core/scene.js';
import { createPanel } from './ui/panel.js';
import { Probe } from './viz/probe.js';
import { SpinIndicator } from './viz/spin.js';
import { VRMenu } from './viz/vrmenu.js';
import { Billboard } from './viz/label3d.js';
import { VRPlots } from './viz/vrplots.js';
import { Plots } from './viz/plots1d.js';
import { setupXR } from './core/xr.js';

import {
  radial, radialDistribution, angularReal, psiSpherical, psiCartesian,
  energyEV, buildCatalog, orbitalLabel, orbitalLabelHTML, radialNodes, angularNodes,
  characteristicRadius,
} from './physics/hydrogen.js';
import { energyLevel, nodes1D } from './physics/box.js';
import { SPECIES, speciesByKey, reducedMassFactor, spatialZ as speciesSpatialZ } from './physics/species.js';
import { radialFormulaHTML, angularFormulaHTML } from './physics/formulas.js';
import {
  avgR, deltaR, avgInvR, mostProbableR, potentialEnergyHartree, radialDensity,
} from './physics/observables.js';
import { hybridDef, lobeFormula } from './physics/hybrid.js';
import { fineEnergyEV, termSymbol, jFraction, spinAngularDensity } from './physics/finestructure.js';

import { sampleField } from './viz/field3d.js';
import {
  buildIsosurface, buildIsosurfaceStack, buildDensityIsosurface, buildNodalSurface,
} from './viz/isosurface.js';
import { buildPointCloud } from './viz/pointcloud.js';
import { buildSlices } from './viz/slices.js';
import { buildBox1D, buildBox2D, buildBox3D } from './viz/boxviz.js';
import { buildGradientField } from './viz/gradfield.js';

// --- Quimica cuantica: atomos polielectronicos y orbitales moleculares ---
import { QCClient } from './core/qcclient.js';
import { QCCharts } from './viz/charts.js';
import {
  buildNuclei, buildBonds, buildCriticalPoints, buildBondPaths, buildBasinCloud, buildCPLabels,
} from './viz/molecule.js';
import { buildMolecule, bondList, boxHalfSize, moleculeByKey, MOLECULES } from './physics/molecules.js';
import {
  ELEMENTS, elementBySym, configFor, configText, hundMultiplicity, hundTerm, HF_LIMIT, slaterZeta,
} from './physics/atoms.js';
import { moEvaluator, densityEvaluator, spinDensityEvaluator } from './physics/qchem.js';
import { DensityAnalyzer } from './physics/density.js';

// --------------------------------------------------------------------------
// Estado de la aplicacion.
// --------------------------------------------------------------------------
const catalog = buildCatalog(6, 3);
const state = {
  model: 'hidrogeno',
  // hidrogeno
  orbitalIndex: 0, n: 1, l: 0, m: 0,
  species: 'H', // especie hidrogenoide: H, D, T, He+, Li2+, Be3+ (ver physics/species.js)
  // visualizacion
  showIso: true, isoLevel: 0.12,
  showPoints: false, pointCount: 12000,
  cloudForm: 'puntos',  // 'puntos' | 'lineas'
  cloudColor: 'sign',   // 'sign' (rojo/azul) | 'violet' (azul/violeta)
  showSlices: false, sliceXY: false, sliceXZ: true, sliceYZ: false,
  opacity: 0.85, gridN: 56,
  isoStack: false,         // varias isosuperficies graduadas en vez de una
  // sonda
  probeOn: false, r: 2, thetaDeg: 90, phiDeg: 0,
  // espin (Fase 1: espin-orbital simple, no cambia la forma espacial)
  spinOn: false, ms: 0.5,
  spinFine: false, // Fase 2: estructura fina (acoplamiento espin-orbita)
  fsJPlus: true,   // j = l + 1/2 (si false, l - 1/2)
  fsMjx2: 1,       // m_j × 2 (entero impar); m_j = fsMjx2/2
  // comparar dos orbitales
  compareOn: false, orbitalIndexB: 4, // 2p_z por defecto
  // animacion de la sonda
  animateProbe: false, animateVar: 'theta', // 'theta' | 'phi'
  // unidades de presentacion (el calculo siempre es en u. atomicas)
  lenUnit: 'a0',  // 'a0' | 'angstrom' | 'pm'
  enUnit: 'eV',   // 'eV' | 'hartree'
  // hibridos
  hybType: 'sp3', hybShow: 'set', hybIndex: 0, // 'set' | 'single'
  // extras de visualizacion
  densityMode: false, // isosuperficie de |psi|^2 en vez de psi
  showNodes: false,   // superficies nodales (psi = 0)
  // caja
  nx: 1, ny: 1, nz: 1, Lx: 8, Ly: 8, Lz: 8,

  // --- atomos polielectronicos / moleculas (Hartree-Fock LCAO) ---
  qcElement: 'C',          // simbolo del atomo
  qcCharge: 0,             // carga del ion (cationes > 0, aniones < 0)
  qcMultAuto: true,        // multiplicidad por la regla de Hund
  qcMult: 3,
  molecule: 'H2O',
  bondFactor: 1,           // factor sobre la distancia de equilibrio (diatomicas)
  basisKind: 'sto',        // 'sto' | 'hidrogenoide' | 'gauss'
  basisNG: 3,              // gaussianas por funcion (STO-nG)
  basisQuality: 'sz',      // 'sz' | 'dz' | 'dzd' | 'dzp' | 'dzpd'
  zetaScale: 1,            // parametro variacional global sobre los zeta
  qcField: 'mo',           // 'mo' | 'rho' | 'lap' | 'elf' | 'spin'
  moIndex: 0,              // orbital molecular dibujado
  moIndexTouched: false,   // false -> se sigue al HOMO automaticamente
  moSpin: 'alpha',
  isoRho: 0.05,            // nivel iso absoluto para densidad (e/bohr^3)
  showNuclei: true, showBonds: true,
  qtaimOn: false,          // puntos criticos y caminos de enlace
  showGradField: false,    // campo vectorial grad rho
  gradFieldMode: 'plano',  // 'plano' (sobre los cortes) | 'volumen' (rejilla 3D)
  showCPLabels: true,
  baderN: 64,              // resolucion de la rejilla de cuencas
  showBasins: false,
};

// Parametros de la URL, para enlazar directamente a un sistema concreto:
//   ?model=molecula&mol=H2O&campo=rho&qtaim=1
//   ?model=atomo&elem=C&carga=0&base=dz
(function applyURLParams() {
  const q = new URLSearchParams(location.search);
  const MODELS = ['hidrogeno', 'hibrido', 'atomo', 'molecula', 'caja1d', 'caja2d', 'caja3d'];
  const FIELDS = ['mo', 'rho', 'lap', 'elf', 'spin'];
  if (MODELS.includes(q.get('model'))) state.model = q.get('model');
  if (q.get('mol')) state.molecule = q.get('mol');
  if (q.get('elem')) state.qcElement = q.get('elem');
  if (q.has('carga')) state.qcCharge = parseInt(q.get('carga'), 10) || 0;
  if (FIELDS.includes(q.get('campo'))) state.qcField = q.get('campo');
  if (q.get('base')) state.basisQuality = q.get('base');
  if (q.has('qtaim')) state.qtaimOn = q.get('qtaim') !== '0';
})();

// --------------------------------------------------------------------------
// Escena y utilidades.
// --------------------------------------------------------------------------
const { renderer, scene, camera, controls, group, xrPivot, refs } = createScene();
document.getElementById('app').appendChild(VRButton.createButton(renderer));

const probe = new Probe(group);
const spin = new SpinIndicator(group);
const probeLabel = new Billboard(scene); // lectura de la sonda en VR (mundo)
const plots = new Plots(document.getElementById('plots'));
const vrPlots = new VRPlots(scene, plots); // graficas de la sonda dentro de la VR
const infoEl = document.getElementById('info');

// Convierte coordenadas de ESCENA (Y arriba) a FISICAS (z = eje polar).
const sceneToPhys = (xs, ys, zs) => [xs, zs, ys];
// El cambio inverso (es su propio inverso): sirve para llevar VECTORES físicos
// —como el gradiente de la densidad— al sistema de la escena.
const physToSceneV = (x, y, z) => [x, z, y];

// --- Especie hidrogenoide activa ---
const currentSpecies = () => speciesByKey(state.species);
// Carga EFECTIVA para la parte ESPACIAL (incorpora la masa reducida): la psi
// solo depende de la combinacion Z*(mu/m_e), asi que muestreamos con ella.
const effectiveZ = () => speciesSpatialZ(currentSpecies());
// Factor de masa reducida mu/m_e (para la energia y el efecto isotopico).
const muFactor = () => reducedMassFactor(currentSpecies());

// --- Unidades de presentacion (el calculo interno es siempre en u. atomicas) ---
const LEN_UNITS = {
  a0: { f: 1, u: 'a₀' },
  angstrom: { f: 0.5291772, u: 'Å' },
  pm: { f: 52.91772, u: 'pm' },
};
const EN_UNITS = {
  eV: { f: 1, u: 'eV' },
  hartree: { f: 1 / 27.211386, u: 'Ha' },
};
const lenU = () => LEN_UNITS[state.lenUnit] || LEN_UNITS.a0;
const enU = () => EN_UNITS[state.enUnit] || EN_UNITS.eV;
// Formatea una longitud dada en a0 a la unidad elegida.
const fmtLen = (a0, dec = 2) => `${(a0 * lenU().f).toFixed(dec)} ${lenU().u}`;
// Formatea una energia dada en eV a la unidad elegida.
function fmtEn(eV) {
  const v = eV * enU().f;
  return `${state.enUnit === 'hartree' ? v.toFixed(4) : v.toFixed(3)} ${enU().u}`;
}

// Radio mas probable: memoizado (el calculo es iterativo y updateInfo se llama
// con frecuencia al mover la sonda).
const _mprCache = {};
function mostProbableRMemo(n, l, Z) {
  const k = `${n},${l},${Z.toFixed(4)}`;
  if (_mprCache[k] == null) _mprCache[k] = mostProbableR(n, l, Z);
  return _mprCache[k];
}

// Funcion psi del orbital de hidrogeno actual, en coordenadas de escena.
function hydrogenPsiScene() {
  const { n, l, m } = state;
  const Zeff = effectiveZ();
  return (xs, ys, zs) => {
    const [x, y, z] = sceneToPhys(xs, ys, zs);
    return psiCartesian(n, l, m, x, y, z, Zeff);
  };
}

// --------------------------------------------------------------------------
// Quimica cuantica (Hartree-Fock LCAO): estado del calculo.
//
// El SCF corre en un Web Worker; aqui solo se pide, se espera y se dibuja. Cada
// peticion lleva un numero de generacion para descartar resultados que lleguen
// tarde despues de que el usuario haya cambiado algo.
// --------------------------------------------------------------------------
const qc = new QCClient();
const qcCharts = new QCCharts(document.getElementById('qccharts'));
let qcResult = null;   // ultimo resultado del SCF (serializado)
let qcBasis = null;    // base reconstruida para evaluar en este hilo
let qcTopo = null;     // analisis topologico QTAIM
let qcBader = null;    // cuencas atomicas
let qcCurve = null;    // curva E(R) o E(kappa) a mostrar
// Ultimo campo 3D muestreado (y el semilado de su caja). Guardarlo permite
// redibujar al vuelo cuando solo cambia la FORMA de representarlo —isosuperficie
// sí/no, nube, cortes, opacidad—: no hay que rehacer el SCF ni volver a
// muestrear en el worker.
let qcFieldData = null;
let qcFieldH = 0;
let qcStatus = '';     // mensaje de progreso
let qcError = '';
let qcGen = 0;

const isQC = () => state.model === 'atomo' || state.model === 'molecula';

// Red de seguridad: un fallo dentro de una cadena asincrona (worker, dibujo)
// se quedaria mudo y con la escena vacia. Mejor mostrarlo en el panel.
window.addEventListener('unhandledrejection', (ev) => {
  qcError = (ev.reason && ev.reason.message) || String(ev.reason);
  qcStatus = '';
  try { updateInfo(); } catch { /* el panel ya esta en un estado raro */ }
});

// Descripcion del sistema segun el modelo activo.
function qcSystem() {
  if (state.model === 'atomo') {
    const el = elementBySym(state.qcElement);
    const nelec = el.Z - state.qcCharge;
    const mult = state.qcMultAuto ? hundMultiplicity(configFor(Math.max(nelec, 1))) : state.qcMult;
    return {
      atoms: [{ Z: el.Z, sym: el.sym, pos: [0, 0, 0], color: el.color, rcov: el.rcov }],
      charge: state.qcCharge, mult, kind: 'atomo',
    };
  }
  const def = moleculeByKey(state.molecule);
  const m = buildMolecule(state.molecule, def.bond ? def.bond * state.bondFactor : null);
  return { atoms: m.atoms, charge: m.charge, mult: m.mult, kind: 'molecula', def: m.def };
}

const qcBasisOpts = () => ({
  kind: state.basisKind,
  nG: state.basisNG,
  quality: state.basisQuality,
  zetaScale: state.zetaScale,
  ...(qcShellFactors ? { zetaScaleByShell: qcShellFactors } : {}),
});

// Semilado de la caja de muestreo.
function qcBoxSize(sys) {
  if (sys.kind === 'atomo') {
    const el = elementBySym(state.qcElement);
    return 6 + (el.Z > 10 ? 3 : 0) + (state.qcCharge < 0 ? 3 : 0);
  }
  return boxHalfSize(sys.atoms, 5.0);
}

// Reconstruye la base con tipos rapidos para evaluar orbitales en este hilo.
function rebuildLocalBasis(res) {
  qcBasis = res.basis.map((b) => ({
    center: b.center, powers: b.powers,
    exps: Float64Array.from(b.exps), coefs: Float64Array.from(b.coefs),
  }));
}

const asMatrix = (M) => (M ? M.map((r) => Float64Array.from(r)) : null);

// Evaluador (coordenadas de ESCENA) del campo elegido, para cortes y sonda.
function qcEvaluatorScene() {
  if (!qcResult || !qcBasis) return () => 0;
  const kind = state.qcField;
  let fn;
  if (kind === 'mo') {
    const C = state.moSpin === 'beta' && qcResult.Cb ? asMatrix(qcResult.Cb) : asMatrix(qcResult.C);
    fn = moEvaluator(qcBasis, C, Math.min(state.moIndex, qcResult.nmo - 1));
  } else if (kind === 'spin' && qcResult.Pa && qcResult.Pb) {
    fn = spinDensityEvaluator(qcBasis, asMatrix(qcResult.Pa), asMatrix(qcResult.Pb));
  } else if (kind === 'lap' || kind === 'elf') {
    const da = new DensityAnalyzer(qcBasis, asMatrix(qcResult.P));
    fn = kind === 'lap'
      ? (x, y, z) => -da.full(x, y, z).lap
      : (x, y, z) => da.full(x, y, z).elf;
  } else {
    fn = densityEvaluator(qcBasis, asMatrix(qcResult.P));
  }
  return (xs, ys, zs) => {
    const [x, y, z] = sceneToPhys(xs, ys, zs);
    return fn(x, y, z);
  };
}

// Gradiente de la densidad y densidad, en coordenadas de ESCENA. El gradiente
// es un vector: se transforma con el mismo cambio de ejes que las posiciones.
function qcGradScene() {
  if (!qcResult || !qcBasis) return null;
  const da = new DensityAnalyzer(qcBasis, asMatrix(qcResult.P));
  const out = [0, 0, 0];
  return {
    grad: (xs, ys, zs) => {
      const [x, y, z] = sceneToPhys(xs, ys, zs);
      da.gradient(x, y, z, out);
      return physToSceneV(out[0], out[1], out[2]);
    },
    rho: (xs, ys, zs) => {
      const [x, y, z] = sceneToPhys(xs, ys, zs);
      return da.rho(x, y, z);
    },
  };
}

// Nivel iso efectivo (en unidades atomicas) del campo actual.
function qcIsoLevel(field) {
  switch (state.qcField) {
    case 'mo': return state.isoLevel * field.absMax;
    case 'rho': return state.isoRho;
    case 'lap': return state.isoRho * 20;
    case 'elf': return Math.min(0.97, 0.4 + state.isoLevel);
    case 'spin': return state.isoRho / 10;
    default: return state.isoRho;
  }
}

const qcFieldSigned = () => state.qcField === 'mo' || state.qcField === 'lap' || state.qcField === 'spin';

// --- Ciclo completo: SCF -> campo -> (topologia) -> dibujo -------------------
async function rebuildQC() {
  const gen = ++qcGen;
  try {
    const sys = qcSystem();
    // El resultado anterior describe OTRO sistema: invalidarlo antes de pintar
    // nada. (Si no, el panel mezcla, p.ej., las cargas de un atomo con los
    // nucleos de una molecula.)
    qcResult = null; qcBasis = null; qcTopo = null; qcBader = null;
    qcFieldData = null;
    qcError = '';
    qcStatus = 'preparando la base…';
    updateInfo();
    updateQCCharts();

    const res = await qc.request('compute', {
      atoms: sys.atoms, charge: sys.charge, mult: sys.mult, basisOpts: qcBasisOpts(),
    }, (p) => {
      if (gen !== qcGen) return;
      qcStatus = `${p.stage}… ${Math.round((p.frac || 0) * 100)}%`;
      updateInfo();
    });
    if (gen !== qcGen) return;

    qcResult = res;
    rebuildLocalBasis(res);
    // Por defecto se dibuja el HOMO (salvo que el usuario haya elegido otro).
    if (!state.moIndexTouched || state.moIndex >= res.nmo || state.moIndex < 0) {
      state.moIndex = Math.max(0, res.homo);
    }
    if (panel.setMORange) panel.setMORange(res.nmo);

    if (state.qtaimOn) {
      qcStatus = 'buscando puntos críticos…';
      updateInfo();
      qcTopo = await qc.request('topology', {});
      if (gen !== qcGen) return;
    }

    qcStatus = '';
    await refreshQCField(gen);

    // Las cuencas de Bader se invalidan con cada sistema nuevo. Si la casilla
    // «Ver cuencas atómicas» sigue marcada hay que rehacerlas: antes se quedaba
    // marcada sin dibujar nada y sin decir por qué.
    if (state.showBasins && gen === qcGen) await runBader();
  } catch (err) {
    if (gen !== qcGen) return;
    qcError = err.message || String(err);
    qcStatus = '';
    updateInfo();
  }
}

// Solo vuelve a muestrear el campo (cambiar de orbital, de nivel, etc.).
async function refreshQCField(genIn = null) {
  if (!qcResult) return;
  const gen = genIn ?? qcGen;
  try {
    const sys = qcSystem();
    const H = qcBoxSize(sys);
    qcStatus = 'muestreando…';
    updateInfo();
    const field = await qc.request('field', {
      kind: state.qcField, gridN: state.gridN, H,
      moIndex: Math.min(state.moIndex, qcResult.nmo - 1), spin: state.moSpin,
    });
    if (gen !== qcGen) return;
    qcStatus = '';
    qcFieldData = field;
    qcFieldH = H;
    drawQC(field, sys, H);
  } catch (err) {
    if (gen !== qcGen) return;
    qcError = err.message || String(err);
    qcStatus = '';
    updateInfo();
  }
}

// Cada capa opcional se dibuja aislada: si una falla, el resto de la escena
// sigue apareciendo. Sin esto, un error en una sola capa dejaba la pantalla en
// negro —sin núcleos ni enlaces— y costaba entender de dónde venía.
function capa(nombre, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[visualización] la capa «${nombre}» falló:`, err);
    qcError = `No se pudo dibujar «${nombre}»: ${err.message}`;
  }
}

// Dibuja el resultado: campo 3D + esqueleto molecular + objetos QTAIM.
function drawQC(field, sys, H) {
  clearViz();
  vizGroup = new THREE.Group();

  const level = qcIsoLevel(field);
  const frac = field.absMax > 0 ? level / field.absMax : 0;

  if (state.showIso && frac > 0 && frac < 1) {
    if (qcFieldSigned()) {
      vizGroup.add(state.isoStack
        ? buildIsosurfaceStack(field, frac, state.opacity)
        : buildIsosurface(field, frac, state.opacity));
    } else {
      vizGroup.add(buildDensityIsosurface(field, frac, state.opacity,
        state.qcField === 'elf' ? 0xc08bff : 0x49e0a0));
    }
  }

  const evalScene = qcEvaluatorScene();
  if (state.showPoints) capa('nube de puntos', () => {
    const dens = qcFieldSigned()
      ? evalScene
      : (x, y, z) => Math.sqrt(Math.max(0, evalScene(x, y, z)));
    const maxAbs = qcFieldSigned() ? field.absMax : Math.sqrt(Math.max(field.absMax, 1e-12));
    vizGroup.add(buildPointCloud(dens, vrPointCount(state.pointCount), H, maxAbs,
      state.opacity, state.cloudForm, state.cloudColor));
  });
  if (state.showSlices) {
    capa('cortes', () => vizGroup.add(buildSlices(evalScene, H, field.absMax, slicePlanes(), 128)));
  }
  if (state.showGradField) {
    capa('campo ∇ρ', () => {
      const ev = qcGradScene();
      // Si no hay ningún plano marcado se usa el XZ: sin plano no habría nada.
      const planos = slicePlanes();
      if (ev) vizGroup.add(buildGradientField(ev.grad, ev.rho, H,
        planos.length ? planos : ['xz'], { modo: state.gradFieldMode }));
    });
  }

  // Esqueleto molecular.
  if (state.showNuclei) vizGroup.add(buildNuclei(sys.atoms));
  if (state.showBonds && sys.atoms.length > 1) {
    vizGroup.add(buildBonds(sys.atoms, bondList(sys.atoms, sys.def)));
  }

  // QTAIM.
  if (state.qtaimOn && qcTopo) {
    // Si los núcleos están ocultos, sus puntos críticos (los máximos de ρ) se
    // marcan aquí: de lo contrario solo se verían los puntos de SILLA.
    vizGroup.add(buildCriticalPoints(qcTopo.cps, { ncp: !state.showNuclei }));
    vizGroup.add(buildBondPaths(qcTopo.paths));
    if (state.showCPLabels) vizGroup.add(buildCPLabels(qcTopo.cps));
  }
  if (state.showBasins && qcBader) capa('cuencas', () => {
    vizGroup.add(buildBasinCloud(qcBader, sys.atoms, { rhoMin: 0.02 }));
  });

  group.add(vizGroup);
  updateProbe();
  updateInfo();
  updateQCCharts();
}

// Redibuja sin recalcular nada (activar/desactivar capas).
// Redibujo BARATO: reutiliza el campo ya muestreado. Solo vuelve al worker si
// todavía no hay campo en memoria.
function redrawQC() {
  if (!qcResult) return;
  if (!qcFieldData) { refreshQCField(); return; }
  drawQC(qcFieldData, qcSystem(), qcFieldH);
  updateInfo();
}

// --- Acciones pesadas bajo demanda ------------------------------------------
async function runBader() {
  if (!qcResult) return;
  const gen = qcGen;
  const sys = qcSystem();
  qcStatus = 'integrando cuencas atómicas…';
  updateInfo();
  try {
    qcBader = await qc.request('bader', { N: state.baderN, H: qcBoxSize(sys) + 2 }, (p) => {
      if (gen !== qcGen) return;
      qcStatus = `cuencas… ${Math.round((p.frac || 0) * 100)}%`;
      updateInfo();
    });
    if (gen !== qcGen) return;
    state.showBasins = true;
    qcStatus = '';
    refreshQCField(gen);
  } catch (err) {
    qcError = err.message || String(err);
    qcStatus = '';
    updateInfo();
  }
}

async function runOptimizeZeta(mode) {
  const gen = qcGen;
  const sys = qcSystem();
  // Igual que el barrido E(R): son decenas de SCF seguidos y el hilo de cálculo
  // no atiende nada más mientras tanto. Se avisa del coste esperado.
  const msSCF = qcResult && qcResult.ms ? qcResult.ms : 300;
  const nSCF = mode === 'global' ? 25 : 60;
  const segs = Math.round((msSCF * nSCF) / 1000);
  qcStatus = 'optimizando ζ (teorema variacional)…' +
    (segs > 8 ? ` · ~${segs} s, la vista no se actualiza hasta terminar` : '');
  updateInfo();
  try {
    const r = await qc.request('optimize', {
      mode,
      system: { atoms: sys.atoms, charge: sys.charge, mult: sys.mult, basisOpts: qcBasisOpts() },
      opts: {},
    });
    if (gen !== qcGen) return;
    if (mode === 'global') {
      state.zetaScale = +r.best.scale.toFixed(3);
      qcCurve = {
        title: `E(κ) · mínimo en κ=${r.best.scale.toFixed(3)}`,
        xLabel: 'κ (escala de ζ)',
        points: r.curve.map((p) => ({ x: p.scale, y: p.E })),
        marks: [{ x: r.best.scale, y: r.best.E, label: 'mín' }],
        color: '#c08bff',
      };
      qcOptInfo = `κ óptimo = ${r.best.scale.toFixed(3)} · ΔE = ${r.gain.toFixed(6)} Ha`;
    } else {
      qcOptInfo = 'ζ por subcapa: ' +
        Object.entries(r.factors).map(([k, v]) => `${k}×${v.toFixed(3)}`).join(' · ') +
        ` · ΔE = ${r.gain.toFixed(6)} Ha`;
      qcShellFactors = r.factors;
    }
    rebuildQC();
  } catch (err) {
    qcError = err.message || String(err);
    qcStatus = '';
    updateInfo();
  }
}

let qcOptInfo = '';
let qcShellFactors = null;

async function runScanBond() {
  const def = moleculeByKey(state.molecule);
  if (state.model !== 'molecula' || !def.bond) {
    qcError = 'La curva E(R) solo está disponible para moléculas diatómicas.';
    updateInfo();
    return;
  }
  const gen = qcGen;
  // El hilo de cálculo atiende de UNA petición en una: mientras dura el barrido,
  // todo lo demás (muestreo del campo, topología) espera en cola y la escena se
  // queda como está. Con bases caras eso son minutos, así que se estima el coste
  // a partir de lo que tardó el último SCF y se reduce el número de puntos.
  const msSCF = qcResult && qcResult.ms ? qcResult.ms : 300;
  const puntos = msSCF > 3000 ? 10 : msSCF > 1000 ? 14 : 20;
  const segs = Math.round((msSCF * puntos) / 1000);
  const aviso = segs > 8 ? ` · ~${segs} s, la vista no se actualiza hasta terminar` : '';
  qcStatus = `curva E(R)…${aviso}`;
  updateInfo();
  try {
    const r = await qc.request('scan', {
      molKey: state.molecule, basisOpts: qcBasisOpts(), opts: { points: puntos },
    }, (p) => {
      if (gen !== qcGen) return;
      qcStatus = `curva E(R)… ${Math.round((p.frac || 0) * 100)}%${aviso}`;
      updateInfo();
    });
    if (gen !== qcGen) return;
    qcCurve = {
      title: `E(R) · R_eq=${r.Req.toFixed(3)} Å (exp. ${r.Rexp})`,
      xLabel: 'R (Å)',
      points: r.points.map((p) => ({ x: p.R, y: p.E })),
      marks: [{ x: r.Req, y: r.Emin, label: 'R_eq' }],
      color: '#4dd17a',
    };
    qcScanInfo = `R_eq = ${r.Req.toFixed(3)} Å (exp. ${r.Rexp} Å) · D_e ≈ ${(r.De * 27.211386).toFixed(2)} eV`;
    qcStatus = '';
    updateInfo();
    updateQCCharts();
  } catch (err) {
    qcError = err.message || String(err);
    qcStatus = '';
    updateInfo();
  }
}

let qcScanInfo = '';

// --- Graficas 2D ------------------------------------------------------------
function updateQCCharts() {
  if (!isQC() || !qcResult) { qcCharts.setVisible(false); return; }
  qcCharts.setVisible(true);
  qcCharts.showLevels(true);

  const mk = (eps, occ) => Array.from(eps).map((e, i) => ({ e, occ: occ ? occ[i] : 0 }));
  const alpha = mk(qcResult.eps, qcResult.occ);
  const beta = qcResult.epsB ? mk(qcResult.epsB, qcResult.occB) : null;
  qcCharts.drawLevels({
    alpha, beta, unit: state.enUnit === 'hartree' ? 'Ha' : 'eV',
    homo: qcResult.homo, selected: state.qcField === 'mo' ? state.moIndex : -1,
    selectedSpin: state.moSpin,
  });

  if (qcCurve) qcCharts.drawCurve(qcCurve.points, qcCurve);
  else qcCharts.showCurve(false);
}

// --------------------------------------------------------------------------
// Construccion / reconstruccion de la visualizacion.
// --------------------------------------------------------------------------
let vizGroup = null;

function clearViz() {
  if (vizGroup) {
    group.remove(vizGroup);
    vizGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    vizGroup = null;
  }
}

function slicePlanes() {
  const p = [];
  if (state.sliceXY) p.push('xy');
  if (state.sliceXZ) p.push('xz');
  if (state.sliceYZ) p.push('yz');
  return p;
}

function rebuild() {
  clearViz();
  vizGroup = new THREE.Group();

  // Atomos polielectronicos y moleculas: el calculo es asincrono (worker), la
  // escena se dibuja cuando llega el resultado.
  if (isQC()) {
    group.add(vizGroup);
    rebuildQC();
    return;
  }
  qcCharts.setVisible(false);

  if (state.model === 'hidrogeno') {
    rebuildHydrogen();
  } else if (state.model === 'hibrido') {
    rebuildHybrid();
  } else if (state.model === 'caja1d') {
    vizGroup.add(buildBox1D(state.nx, state.Lx));
  } else if (state.model === 'caja2d') {
    vizGroup.add(buildBox2D(state.nx, state.ny, state.Lx, state.Ly));
  } else if (state.model === 'caja3d') {
    const { group: g } = buildBox3D(state.nx, state.ny, state.nz, state.Lx, state.Ly, state.Lz, {
      gridN: state.gridN, isoLevel: state.isoLevel, opacity: state.opacity,
      showIso: state.showIso, showPoints: state.showPoints, pointCount: state.pointCount,
      showSlices: state.showSlices, slicePlanes: slicePlanes(),
    });
    vizGroup.add(g);
  }

  group.add(vizGroup);
  updateProbe();
  updateSpin();
  updateInfo();
}

// En VR limitamos el nº de puntos/bucles (el Quest se traba con muchos sprites).
function vrPointCount(n) {
  return renderer.xr.isPresenting ? Math.min(n, 8000) : n;
}

// psi(escena) de un orbital dado {n,l,m}.
function orbPsiScene(o) {
  const Zeff = effectiveZ();
  return (xs, ys, zs) => {
    const [x, y, z] = sceneToPhys(xs, ys, zs);
    return psiCartesian(o.n, o.l, o.m, x, y, z, Zeff);
  };
}

// Datos del estado de estructura fina actual (j, m_j validos para l).
function fineState() {
  const l = state.l;
  const jPlus = l === 0 ? true : state.fsJPlus; // l=0 -> solo j=1/2
  const j = l + (jPlus ? 0.5 : -0.5);
  const mj = Math.max(-j, Math.min(j, state.fsMjx2 / 2));
  return { l, jPlus, j, mj };
}

// Densidad total |j,m_j>(escena) = R_nl(r)² · D(θ) (sumada sobre espin).
function fineDensityScene() {
  const { l, jPlus, mj } = fineState();
  const n = state.n;
  const Zeff = effectiveZ();
  return (xs, ys, zs) => {
    const [x, y, z] = sceneToPhys(xs, ys, zs);
    const r = Math.sqrt(x * x + y * y + z * z);
    const R = radial(n, l, r, Zeff);
    const theta = r > 0 ? Math.acos(z / r) : 0;
    const phi = Math.atan2(y, x);
    return R * R * spinAngularDensity(l, jPlus, mj, theta, phi);
  };
}

function rebuildHydrogen() {
  // Estructura fina: muestra la DENSIDAD del estado |n,l,j,m_j> (no el orbital).
  if (state.spinFine) {
    const H = characteristicRadius(state.n, effectiveZ());
    const densFn = fineDensityScene();
    const field = sampleField(densFn, state.gridN, H);
    if (state.showIso) vizGroup.add(buildDensityIsosurface(field, state.isoLevel, state.opacity));
    if (state.showPoints) {
      // buildPointCloud usa v² como densidad; pasamos √densidad para recuperarla.
      const sq = (x, y, z) => Math.sqrt(Math.max(0, densFn(x, y, z)));
      vizGroup.add(buildPointCloud(sq, vrPointCount(state.pointCount), H, Math.sqrt(field.absMax), state.opacity, state.cloudForm, state.cloudColor));
    }
    return;
  }
  if (state.compareOn) {
    const A = catalog[state.orbitalIndex];
    const B = catalog[state.orbitalIndexB];
    const HA = characteristicRadius(A.n, effectiveZ());
    const HB = characteristicRadius(B.n, effectiveZ());
    const d = Math.max(HA, HB) * 1.25;
    buildOrbitalVizAt(orbPsiScene(A), HA, -d);
    buildOrbitalVizAt(orbPsiScene(B), HB, +d);
  } else {
    buildOrbitalViz(hydrogenPsiScene(), characteristicRadius(state.n, effectiveZ()));
  }
}

// Igual que buildOrbitalViz pero en un subgrupo desplazado en x (para comparar).
function buildOrbitalVizAt(psiFn, H, dx) {
  const sub = new THREE.Group();
  buildOrbitalViz(psiFn, H, state.pointCount, sub);
  sub.position.x = dx;
  vizGroup.add(sub);
}

// Construye iso/densidad/nube/cortes/nodos para una psi(escena) dada. Compartida
// por el atomo, los lobulos hibridos y la comparacion.
function buildOrbitalViz(psiFn, H, pointCount = state.pointCount, target = vizGroup) {
  const field = sampleField(psiFn, state.gridN, H);

  if (state.showIso) {
    if (state.densityMode) {
      const dens = sampleField((x, y, z) => { const v = psiFn(x, y, z); return v * v; }, state.gridN, H);
      target.add(buildDensityIsosurface(dens, state.isoLevel, state.opacity));
    } else {
      target.add(state.isoStack
        ? buildIsosurfaceStack(field, state.isoLevel, state.opacity)
        : buildIsosurface(field, state.isoLevel, state.opacity));
    }
  }
  if (state.showPoints)
    target.add(buildPointCloud(psiFn, vrPointCount(pointCount), H, field.absMax, state.opacity, state.cloudForm, state.cloudColor));
  if (state.showSlices)
    target.add(buildSlices(psiFn, H, field.absMax, slicePlanes(), 128));
  if (state.showNodes)
    target.add(buildNodalSurface(field, 0.45));
}

// psi(escena) de un lobulo hibrido = suma de coef * psi_{2,l,m}.
function hybridLobePsiScene(lobe) {
  const Zeff = effectiveZ();
  return (xs, ys, zs) => {
    const [x, y, z] = sceneToPhys(xs, ys, zs);
    let s = 0;
    for (const t of lobe) s += t.c * psiCartesian(2, t.l, t.m, x, y, z, Zeff);
    return s;
  };
}

function rebuildHybrid() {
  const def = hybridDef(state.hybType);
  const H = characteristicRadius(2, effectiveZ());
  const lobes = state.hybShow === 'single'
    ? [def.lobes[state.hybIndex % def.lobes.length]]
    : def.lobes;
  const pc = Math.max(2000, Math.floor(state.pointCount / lobes.length));
  for (const lobe of lobes) buildOrbitalViz(hybridLobePsiScene(lobe), H, pc);
}

// --------------------------------------------------------------------------
// Sonda + graficas + panel de informacion.
// --------------------------------------------------------------------------
// Lectura de la densidad en la posicion de la sonda (modelos de quimica
// cuantica): rho, su laplaciano y la ELF, que es lo que interpreta QTAIM.
let _qcAnalyzer = null;
let _qcAnalyzerFor = null;
function qcProbeReadout() {
  if (!qcResult || !qcBasis) return null;
  if (_qcAnalyzerFor !== qcResult) {
    _qcAnalyzer = new DensityAnalyzer(qcBasis, asMatrix(qcResult.P));
    _qcAnalyzerFor = qcResult;
  }
  const theta = (state.thetaDeg * Math.PI) / 180;
  const phi = (state.phiDeg * Math.PI) / 180;
  const x = state.r * Math.sin(theta) * Math.cos(phi);
  const y = state.r * Math.sin(theta) * Math.sin(phi);
  const z = state.r * Math.cos(theta);
  return { at: [x, y, z], ...(_qcAnalyzer.full(x, y, z)) };
}

function updateProbe() {
  const isH = state.model === 'hidrogeno';
  if (isQC()) {
    probe.setVisible(state.probeOn);
    plots.setVisible(false);
    if (state.probeOn) {
      const theta = (state.thetaDeg * Math.PI) / 180;
      const phi = (state.phiDeg * Math.PI) / 180;
      probe.setSpherical(state.r, theta, phi);
      updateProbeLabel();
    }
    updateInfo();
    return;
  }
  probe.setVisible(isH && state.probeOn);
  if (!isH) { plots.setVisible(false); return; }

  const theta = (state.thetaDeg * Math.PI) / 180;
  const phi = (state.phiDeg * Math.PI) / 180;
  probe.setSpherical(state.r, theta, phi);

  plots.setVisible(state.probeOn);
  if (state.probeOn) {
    const { n, l, m } = state;
    const Zeff = effectiveZ();
    plots.update({
      radialFn: (r) => radial(n, l, r, Zeff),
      radialDistFn: (r) => radialDistribution(n, l, r, Zeff),
      angularFn: (th) => angularReal(l, m, th, phi),
      azimuthFn: (ph) => angularReal(l, m, theta, ph),
      rMax: characteristicRadius(n, Zeff),
      probe: { r: state.r, theta, phi },
    });
    vrPlots.sync();
  }
  updateProbeLabel();
  updateInfo();
}

// Texto de la etiqueta 3D de la sonda (lo que se ve en VR junto a ella).
function updateProbeLabel() {
  if (isQC()) {
    if (!state.probeOn) return;
    const d = qcProbeReadout();
    if (!d) return;
    probeLabel.setLines([
      { text: `r=${fmtLen(state.r)}  θ=${Math.round(state.thetaDeg)}°  φ=${Math.round(state.phiDeg)}°`, color: '#9bb3d4' },
      { text: `ρ = ${d.rho.toExponential(3)}`, color: '#ffd479', big: true },
      { text: `∇²ρ = ${d.lap.toFixed(4)}`, color: '#cfe3ff' },
      { text: `ELF = ${d.elf.toFixed(3)}`, color: '#c08bff' },
    ]);
    return;
  }
  if (state.model !== 'hidrogeno' || !state.probeOn) return;
  const { n, l, m } = state;
  const theta = (state.thetaDeg * Math.PI) / 180;
  const phi = (state.phiDeg * Math.PI) / 180;
  const psi = psiSpherical(n, l, m, state.r, theta, phi, effectiveZ());
  const Vr = potentialEnergyHartree(state.r, currentSpecies().Z) * 27.211386;
  probeLabel.setLines([
    { text: `r=${fmtLen(state.r)}  θ=${Math.round(state.thetaDeg)}°  φ=${Math.round(state.phiDeg)}°`, color: '#9bb3d4' },
    { text: `ψ = ${psi.toExponential(2)}`, color: '#ffd479', big: true },
    { text: `|ψ|² = ${(psi * psi).toExponential(2)}`, color: '#cfe3ff' },
    { text: `V = ${fmtEn(Vr)}`, color: '#9bb3d4' },
  ]);
}

// Modo espin-orbital (Fase 1): solo muestra la flecha de S_z. La parte de
// espin no depende de las coordenadas, asi que NO se reconstruye el campo.
function updateSpin() {
  const isH = state.model === 'hidrogeno';
  spin.setVisible(isH && state.spinOn);
  if (isH && state.spinOn) spin.setSpin(state.ms);
  updateInfo();
}

// Panel de informacion del calculo Hartree-Fock (atomo o molecula).
function qcInfoHTML() {
  const sep = '<hr style="border-color:rgba(255,255,255,0.12)">';
  const sys = qcSystem();
  let html = '';

  // Encabezado: sistema y configuracion.
  if (state.model === 'atomo') {
    const el = elementBySym(state.qcElement);
    const nelec = el.Z - state.qcCharge;
    const cfg = configFor(Math.max(nelec, 1));
    const term = hundTerm(cfg);
    const ionLabel = state.qcCharge > 0 ? `<sup>${state.qcCharge > 1 ? state.qcCharge : ''}+</sup>`
      : state.qcCharge < 0 ? `<sup>${state.qcCharge < -1 ? -state.qcCharge : ''}−</sup>` : '';
    html += `<h3>${el.sym}${ionLabel} · ${el.name}</h3>`;
    html += `Z = ${el.Z} · ${nelec} e⁻ · término ${term.label}<br>`;
    html += `<span class="muted">Configuración: ${configText(cfg)}</span><br>`;
    html += `<span class="muted">ζ de Slater: ` +
      cfg.map((s) => `${s.n}${'spdf'[s.l]}=${(slaterZeta(el.Z, cfg, s.n, s.l) * state.zetaScale).toFixed(2)}`).join(' · ') +
      `</span><br>`;
  } else {
    const def = sys.def;
    html += `<h3>${def.name}</h3>`;
    html += `${sys.atoms.length} núcleos · ${qcResult ? qcResult.nelec : '—'} e⁻` +
      (sys.charge ? ` · carga ${sys.charge > 0 ? '+' : ''}${sys.charge}` : '') +
      ` · multiplicidad ${sys.mult}<br>`;
    if (def.bond) {
      html += `<span class="muted">R = ${(def.bond * state.bondFactor).toFixed(3)} Å ` +
        `(equilibrio experimental ${def.bond} Å)</span><br>`;
    }
  }

  if (qcError) return html + `<span class="warn">⚠ ${qcError}</span>`;
  if (qcStatus) html += `<span class="busy">⏳ ${qcStatus}</span><br>`;
  if (!qcResult) return html + '<span class="muted">Calculando el campo autoconsistente…</span>';

  const r = qcResult;
  const nG = state.basisKind === 'gauss' ? '' : `-${Math.max(state.basisNG, 1)}G`;
  html += `<span class="muted">Base: ${state.basisKind === 'sto' ? `STO${nG}` : state.basisKind === 'hidrogenoide' ? `hidrogenoide${nG}` : 'gaussianas'} ` +
    `· ${state.basisQuality} · ${r.nbf} ${r.nbf === 1 ? 'función' : 'funciones'}</span><br>`;
  html += `<span class="${r.converged ? 'ok' : 'warn'}">${r.method} ${r.converged ? 'convergido' : 'SIN convergencia'} ` +
    `(${r.iterations} iteraciones)</span><br>`;

  // Energias.
  html += sep;
  html += `<b>Energía</b> <span class="muted">(teorema variacional: E ≥ E₀)</span><br>`;
  html += `E total = <span class="val">${r.E.toFixed(6)} Ha</span> ` +
    `<span class="muted">(${(r.E * 27.211386).toFixed(2)} eV)</span><br>`;
  html += `<span class="muted">E electrónica = ${r.Eelec.toFixed(5)} Ha · repulsión nuclear = ${r.Enuc.toFixed(5)} Ha</span><br>`;
  html += `<span class="muted">⟨T⟩ = ${r.Ekin.toFixed(4)} · ⟨V_ne⟩ = ${r.Ene.toFixed(4)} · ⟨V_ee⟩ = ${r.Eee.toFixed(4)} Ha</span><br>`;
  html += `<span class="muted">−V/T = ${r.virial.toFixed(4)} (virial exacto: 2)</span><br>`;
  if (state.model === 'atomo' && state.qcCharge === 0) {
    const lim = HF_LIMIT[state.qcElement];
    if (lim) {
      const pct = (100 * (r.E / lim)).toFixed(3);
      html += `<span class="muted">Límite HF (base infinita): ${lim.toFixed(4)} Ha → capturas el <b>${pct}%</b>. ` +
        `Lo que falta a la energía exacta es la <b>correlación</b>.</span><br>`;
    }
  }
  if (qcOptInfo) html += `<span class="ok">⚡ ${qcOptInfo}</span><br>`;
  if (qcScanInfo) html += `<span class="ok">📈 ${qcScanInfo}</span><br>`;

  // Determinante de Slater.
  html += sep;
  const nocc = r.method === 'RHF' ? r.nocc * 2 : r.nalpha + r.nbeta;
  html += `<b>Determinante de Slater</b><br>`;
  html += `<span class="muted">Ψ = (1/√${nocc}!) det |` +
    (r.method === 'RHF'
      ? Array.from({ length: Math.min(r.nocc, 4) }, (_, i) => `φ${i + 1}α φ${i + 1}β`).join(' ')
      : Array.from({ length: Math.min(r.nalpha, 4) }, (_, i) => `φ${i + 1}α`).join(' ') + ' …') +
    `${nocc > 8 ? ' …' : ''}|</span><br>`;
  html += `${nocc} espín-orbitales ocupados` +
    (r.method === 'UHF' ? ` (${r.nalpha}α + ${r.nbeta}β)` : ` (${r.nocc} orbitales × 2)`) + `<br>`;
  if (r.s2 != null) {
    html += `<span class="muted">⟨S²⟩ = ${r.s2.toFixed(4)} (exacto ${r.s2exact.toFixed(2)}` +
      `${Math.abs(r.s2 - r.s2exact) > 0.05 ? ' → contaminación de espín' : ''})</span><br>`;
  }

  // Orbitales frontera.
  html += sep;
  // En un átomo son orbitales ATÓMICOS; solo en una molécula son moleculares.
  const esAtomo = state.model === 'atomo';
  html += `<b>${esAtomo ? 'Orbitales atómicos' : 'Orbitales moleculares'}</b><br>`;
  const eU = state.enUnit === 'hartree' ? 1 : 27.211386;
  const eUn = state.enUnit === 'hartree' ? 'Ha' : 'eV';
  // Se listan TODOS los orbitales ocupados (antes solo se veía una ventana de
  // cinco alrededor del HOMO y faltaban las capas internas) más unos cuantos
  // virtuales. En capa abierta (UHF) alfa y beta tienen orbitales y energías
  // distintos: se muestran en columnas separadas para que el recuento de
  // electrones cuadre a simple vista.
  const dec = state.enUnit === 'hartree' ? 3 : 2;
  const abierta = !!r.epsB;
  const nOcup = abierta ? Math.max(r.nalpha, r.nbeta) : r.nocc;
  const hi = Math.min(r.nmo - 1, Math.max(nOcup + 2, r.homo + 2));
  const compDe = (i) => {
    const o = r.orbitals && r.orbitals[i];
    return (o && o.comp || []).map((c) => `${c.label} ${(c.w * 100).toFixed(0)}%`).join(', ');
  };
  html += `<table class="qc"><tr><th>${esAtomo ? 'OA' : 'OM'}</th>` +
    (abierta
      ? '<th>α</th><th>ε<sub>α</sub></th><th>β</th><th>ε<sub>β</sub></th>'
      : '<th>e⁻</th><th>ε</th>') +
    '<th>composición</th></tr>';
  for (let i = 0; i <= hi; i++) {
    const tag = i === r.homo ? ' HOMO' : i === r.homo + 1 ? ' LUMO' : '';
    if (abierta) {
      const oa = r.occ ? r.occ[i] : 0;
      const ob = r.occB ? r.occB[i] : 0;
      html += `<tr><td>${i + 1}${tag}</td>` +
        `<td>${oa ? '↑' : '·'}</td><td>${(r.eps[i] * eU).toFixed(dec)}</td>` +
        `<td>${ob ? '↓' : '·'}</td><td>${(r.epsB[i] * eU).toFixed(dec)}</td>` +
        `<td>${compDe(i)}</td></tr>`;
    } else {
      html += `<tr><td>${i + 1}${tag}</td><td>${r.occ ? r.occ[i] : ''}</td>` +
        `<td>${(r.eps[i] * eU).toFixed(dec)}</td><td>${compDe(i)}</td></tr>`;
    }
  }
  html += '</table>';
  html += `<span class="muted">${nOcup} orbital${nOcup === 1 ? '' : 'es'} ocupado${nOcup === 1 ? '' : 's'}` +
    (abierta
      ? ` (${r.nalpha}↑ + ${r.nbeta}↓ = ${r.nalpha + r.nbeta} e⁻)`
      : ` × 2 e⁻ = ${2 * r.nocc} e⁻`) +
    `${hi < r.nmo - 1 ? ` · se omiten ${r.nmo - 1 - hi} virtuales` : ''}</span><br>`;
  if (r.homo >= 0 && r.lumo > 0 && r.lumo < r.nmo) {
    const ie = -r.eps[r.homo] * 27.211386;
    const gap = (r.eps[r.lumo] - r.eps[r.homo]) * 27.211386;
    html += `<span class="muted">Koopmans: I ≈ ${ie.toFixed(2)} eV · hueco HOMO-LUMO = ${gap.toFixed(2)} eV</span><br>`;
  }
  if (state.qcField === 'mo') {
    html += `<span class="muted">Dibujando el ${esAtomo ? 'orbital' : 'OM'} ${state.moIndex + 1}` +
      `${r.epsB ? ` (espín ${state.moSpin === 'beta' ? 'β' : 'α'})` : ''}</span><br>`;
  } else {
    const names = { rho: 'densidad electrónica ρ(r)', lap: 'laplaciano −∇²ρ', elf: 'ELF', spin: 'densidad de espín' };
    html += `<span class="muted">Dibujando: ${names[state.qcField]}</span><br>`;
    if (state.qcField === 'spin' && !r.epsB) {
      html += `<span class="muted">(capa cerrada: la densidad de espín es idénticamente cero, se muestra ρ)</span><br>`;
    }
  }

  // Cargas. (Solo si el resultado corresponde a este sistema; durante un
  // recalculo pueden no coincidir.)
  if (r.charges.length !== sys.atoms.length) return html;
  html += sep;
  html += `<b>Cargas atómicas</b><br>`;
  html += '<table class="qc"><tr><th>átomo</th><th>Mulliken</th>' +
    (qcBader && qcBader.charges.length === sys.atoms.length ? '<th>Bader</th>' : '') + '</tr>';
  sys.atoms.forEach((a, i) => {
    const qm = r.charges[i] ?? 0;
    const qb = qcBader && qcBader.charges.length === sys.atoms.length ? qcBader.charges[i] : null;
    html += `<tr><td>${a.sym}${sys.atoms.length > 1 ? i + 1 : ''}</td>` +
      `<td>${qm >= 0 ? '+' : ''}${qm.toFixed(3)}</td>` +
      (qb !== null ? `<td>${qb >= 0 ? '+' : ''}${qb.toFixed(3)}</td>` : '') +
      '</tr>';
  });
  html += '</table>';
  if (!qcBader) {
    html += state.showBasins
      ? `<span class="muted warn">Las cuencas atómicas están pedidas pero aún no calculadas para ` +
        `este sistema: pulsa <b>Calcular cargas de Bader</b>.</span>`
      : `<span class="muted">Mulliken depende mucho de la base; las cargas de <b>Bader</b> (botón en QTAIM) se obtienen de la densidad.</span>`;
  }

  // QTAIM.
  if (qcTopo) {
    html += sep;
    const c = qcTopo.counts;
    html += `<b>QTAIM · topología de ρ(r)</b><br>`;
    html += `<span class="muted">${c.NCP} núcleos${c.NNA ? ` (+${c.NNA} no nuclear${c.NNA > 1 ? 'es' : ''})` : ''} · ` +
      `${c.BCP} enlaces · ${c.RCP} anillos · ${c.CCP} cajas → ` +
      `n−b+r−c = <b>${qcTopo.poincare}</b> ${qcTopo.poincare === 1 ? '✔' : '(debería ser 1)'}</span><br>`;
    if (c.NNA) {
      html += `<span class="muted warn">Hay un máximo de ρ que no está sobre ningún núcleo ` +
        `(<b>atractor no nuclear</b>, esfera azul claro). Es real en metales alcalinos como el Li₂, ` +
        `pero en enlaces homonucleares suele ser un artefacto de la base: cámbiala y comprueba si ` +
        `sobrevive.</span><br>`;
    }
    if (qcTopo.poincare !== 1) {
      // Casi siempre es un problema de BASE, no del buscador de puntos críticos:
      // una base pobre aplana el 1s de los hidrógenos (sobre todo si el vecino es
      // muy electronegativo o la especie es un catión) hasta que el núcleo deja de
      // ser un máximo de ρ, y con él desaparecen su cuenca y su punto crítico.
      html += `<span class="muted warn">Faltan (o sobran) puntos críticos. Suele ser la base: con pocas ` +
        `gaussianas el máximo de ρ sobre los hidrógenos se aplana y el átomo pierde su cuenca. ` +
        `Prueba <b>doble ζ</b> y <b>nº de gaussianas ≥ 4</b>.</span><br>`;
    }
    const bcps = qcTopo.cps.filter((x) => x.type === 'BCP');
    if (bcps.length) {
      html += '<table class="qc"><tr><th>enlace</th><th>ρ<sub>b</sub></th><th>∇²ρ</th><th>ε</th><th>tipo</th></tr>';
      for (const b of bcps.slice(0, 8)) {
        // Clasificacion de Cremer-Kraka: el signo del laplaciano y el de la
        // densidad de energia total H distinguen los tres regimenes.
        const tipo = b.lap < 0 && b.H < 0 ? 'compartido'
          : b.H < 0 ? 'polar' : 'capa cerrada';
        html += `<tr><td>${b.label || '—'}</td><td>${b.rho.toFixed(3)}</td>` +
          `<td>${b.lap.toFixed(3)}</td><td>${b.ellipticity.toFixed(2)}</td>` +
          `<td>${tipo}</td></tr>`;
      }
      html += '</table>';
      html += `<span class="muted">∇²ρ&lt;0 y H&lt;0 → covalente (compartido); ∇²ρ&gt;0 con H&lt;0 → enlace polar; ` +
        `∇²ρ&gt;0 con H&gt;0 → capa cerrada (iónico, puente de H). ε mide el carácter π.</span>`;
    }
  }

  // Sonda: lectura local de la densidad.
  if (state.probeOn) {
    const d = qcProbeReadout();
    if (d) {
      html += sep;
      html += `<span class="muted">Sonda en (r=${fmtLen(state.r)}, θ=${Math.round(state.thetaDeg)}°, φ=${Math.round(state.phiDeg)}°)</span><br>`;
      html += `ρ = <span class="val">${d.rho.toExponential(3)}</span> e/bohr³<br>`;
      html += `∇²ρ = <span class="val">${d.lap.toFixed(4)}</span> · |∇ρ| = ${d.gradNorm.toExponential(2)}<br>`;
      html += `ELF = <span class="val">${d.elf.toFixed(3)}</span> · G = ${d.G.toFixed(4)} · V = ${d.V.toFixed(4)} Ha/bohr³`;
    }
  }
  return html;
}

function updateInfo() {
  let html = '';
  if (isQC()) {
    infoEl.innerHTML = qcInfoHTML();
    return;
  }
  if (state.model === 'hidrogeno') {
    const { n, l, m } = state;
    const sp = currentSpecies();
    const Z = sp.Z;
    const mu = muFactor();
    const Zeff = effectiveZ();
    const label = orbitalLabelHTML(n, l, m);
    html += `<h3>${sp.symbol} · Orbital ${label}</h3>`;
    html += `<span class="muted">${sp.label}</span><br>`;
    if (state.compareOn) {
      const B = catalog[state.orbitalIndexB];
      html += `<span style="color:#49e0a0">Comparando: ${orbitalLabel(n, l, m)} (izq.) vs ${orbitalLabel(B.n, B.l, B.m)} (der.)</span><br>`;
    }
    html += `n=${n}, l=${l}, m=${m} &nbsp; (Z=${Z})<br>`;
    html += `Energía: <span class="val">${fmtEn(energyEV(n, Z, mu))}</span><br>`;
    html += `Nodos radiales: <span class="val">${radialNodes(n, l)}</span> · `;
    html += `angulares: <span class="val">${angularNodes(l)}</span><br>`;
    html += `<span class="muted">μ/mₑ = ${mu.toFixed(6)}</span><br>`;

    // Funcion de onda explicita: psi = R_nl(r) · Y(θ,φ), angular REAL en cos/sin.
    const sub = 'spdf'[l];
    const Yname = label.replace(/^\d+/, ''); // descriptor angular sin el n (p.ej. "p_z")
    const Rstr = radialFormulaHTML(n, l, Z);
    const Ystr = angularFormulaHTML(l, m);
    html += `<hr style="border-color:rgba(255,255,255,0.12)">`;
    html += `<div class="formula">`;
    html += `<b>Función de onda</b> <span class="muted">(a₀=1)</span><br>`;
    html += `ψ = R<sub>${n}${sub}</sub>(r) · Y<sub>${Yname}</sub>(θ,φ)<br>`;
    html += `<span class="frow">R<sub>${n}${sub}</sub>(r) = ${Rstr}</span><br>`;
    html += `<span class="frow">Y<sub>${Yname}</sub>(θ,φ) = ${Ystr}</span>`;
    html += `</div>`;

    // Propiedades del orbital (valores esperados de operadores).
    const rAvg = avgR(n, l, Zeff);
    const dr = deltaR(n, l, Zeff);
    const rmp = mostProbableRMemo(n, l, Zeff);
    const invr = avgInvR(n, l, Zeff);
    const E = energyEV(n, Z, mu);
    html += `<hr style="border-color:rgba(255,255,255,0.12)">`;
    html += `<b>Propiedades</b><br>`;
    html += `⟨r⟩ = <span class="val">${fmtLen(rAvg)}</span> · Δr = <span class="val">${fmtLen(dr)}</span><br>`;
    html += `r más probable = <span class="val">${fmtLen(rmp.r)}</span><br>`;
    html += `<span class="muted">(r²|R|²)máx = ${rmp.density.toExponential(2)} a₀⁻¹ · ⟨1/r⟩ = ${invr.toFixed(3)} a₀⁻¹</span><br>`;
    html += `⟨T⟩ = <span class="val">${fmtEn(-E)}</span> · ⟨V⟩ = <span class="val">${fmtEn(2 * E)}</span><br>`;
    html += `<span class="muted">teorema del virial: ⟨V⟩ = 2E, ⟨T⟩ = −E</span>`;
    if (state.spinFine) {
      const { l: fl, jPlus, j, mj } = fineState();
      const Efs = fineEnergyEV(n, j, Z);
      html += `<hr style="border-color:rgba(255,255,255,0.12)">`;
      html += `<span style="color:#49e0a0">Estructura fina · ${termSymbol(n, fl, j)} (j=${jFraction(j)})</span><br>`;
      html += `m<sub>j</sub> = ${jFraction(mj === 0 ? 0 : mj)}${mj < 0 ? ' (−)' : ''} · acoplamiento L·S<br>`;
      html += `E<sub>fina</sub> = <span class="val">${fmtEn(Efs)}</span><br>`;
      if (fl >= 1) {
        const dE = fineEnergyEV(n, fl + 0.5, Z) - fineEnergyEV(n, fl - 0.5, Z);
        html += `<span class="muted">Desdoblamiento ${termSymbol(n, fl, 0)}<sub>${jFraction(fl + 0.5)}</sub>−${termSymbol(n, fl, 0).replace(/^\d+/, '')}<sub>${jFraction(fl - 0.5)}</sub> = ${(dE * 1000).toExponential(2)} meV</span><br>`;
      }
      html += `<span class="muted">Se muestra la <b>densidad</b> |j,m<sub>j</sub>|². Nota: los estados j=½ son esféricamente simétricos.</span>`;
    } else if (state.spinOn) {
      const up = state.ms >= 0;
      const spinSym = up ? '↑' : '↓';
      const spinFn = up ? 'α' : 'β';
      const msStr = up ? '+½' : '−½';
      html += `<hr style="border-color:rgba(255,255,255,0.12)">`;
      html += `<span style="color:#49e0a0">Espín-orbital ${spinSym}</span><br>`;
      html += `χ = ψ<sub>${n}${'spdf'[l] || ''}</sub> · ${spinFn} &nbsp; (m<sub>s</sub> = ${msStr})<br>`;
      html += `<span class="muted">El espín no cambia la forma espacial: ψ↑ y ψ↓ son idénticas. `;
      html += `Cada orbital aloja 2 e⁻ (Pauli) → capa n: <b>2n² = ${2 * n * n}</b> estados.</span>`;
    }
    if (state.probeOn) {
      const theta = (state.thetaDeg * Math.PI) / 180;
      const phi = (state.phiDeg * Math.PI) / 180;
      const psi = psiSpherical(n, l, m, state.r, theta, phi, Zeff);
      html += `<hr style="border-color:rgba(255,255,255,0.12)">`;
      html += `<span class="muted">Sonda en (r=${fmtLen(state.r)}, θ=${state.thetaDeg}°, φ=${state.phiDeg}°)</span><br>`;
      const Vr = potentialEnergyHartree(state.r, Z) * 27.211386; // eV, Z real
      const rd = radialDensity(n, l, state.r, Zeff);
      html += `ψ = <span class="val">${psi.toExponential(3)}</span><br>`;
      html += `|ψ|² = <span class="val">${(psi * psi).toExponential(3)}</span><br>`;
      html += `V(r) = <span class="val">${fmtEn(Vr)}</span> <span class="muted">(potencial del e⁻)</span><br>`;
      html += `r²|R|² = <span class="val">${rd.toExponential(3)}</span> <span class="muted">(densidad radial)</span>`;
    } else {
      html += `<span class="muted">Activa la sonda para ver ψ(r,θ,φ).</span>`;
    }
  } else if (state.model === 'hibrido') {
    const def = hybridDef(state.hybType);
    const k = def.lobes.length;
    html += `<h3>Híbridos ${def.label}</h3>`;
    html += `Geometría: <span class="val">${def.geom}</span> · ángulo <span class="val">${def.angle}</span><br>`;
    html += `${k} lóbulos equivalentes (de 2s + 2p)<br>`;
    if (state.hybShow === 'single') {
      const i = state.hybIndex % k;
      html += `<span class="muted">Mostrando lóbulo ${i + 1} de ${k}</span><br>`;
      html += `<div class="formula"><span class="frow">ψ = ${lobeFormula(state.hybType, i)}</span></div>`;
    } else {
      html += `<span class="muted">Conjunto completo (los ${k} lóbulos comparten el núcleo).</span>`;
    }
  } else {
    const dim = state.model === 'caja1d' ? 1 : state.model === 'caja2d' ? 2 : 3;
    const ns = [state.nx, state.ny, state.nz].slice(0, dim);
    const Ls = [state.Lx, state.Ly, state.Lz].slice(0, dim);
    const E = energyLevel(ns, Ls, Math.min(...Ls));
    html += `<h3>Partícula en caja ${dim}D</h3>`;
    html += `n = (${ns.join(', ')})<br>`;
    html += `L = (${Ls.map((v) => v.toFixed(1)).join(', ')})<br>`;
    html += `Energía ∝ <span class="val">${E.toFixed(3)}</span> · (h²/8mL²)<br>`;
    html += `Nodos internos: <span class="val">${ns.map((n) => nodes1D(n)).join(', ')}</span>`;
  }
  infoEl.innerHTML = html;
}

// --------------------------------------------------------------------------
// Panel de control y callbacks.
// --------------------------------------------------------------------------
function resetView() {
  camera.position.set(8, 6, 12);
  controls.target.set(0, 0, 0);
  controls.update();
}

function screenshot() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const lbl = state.model === 'hidrogeno' ? orbitalLabel(state.n, state.l, state.m) : state.model;
  a.href = url;
  a.download = `cuantica-${lbl}.png`;
  a.click();
}

const panel = createPanel(state, {
  rebuild,
  probe: updateProbe,
  spin: updateSpin,
  units: () => { updateInfo(); updateProbeLabel(); updateQCCharts(); vrMenu.redraw(); },
  screenshot,
  model: rebuild,
  reset: resetView,
  // Quimica cuantica.
  qc: () => {                       // cambia el sistema o la base -> SCF completo
    qcShellFactors = null;
    qcOptInfo = '';
    qcScanInfo = '';
    qcCurve = null;
    state.moIndexTouched = false;   // volver a seguir al HOMO
    rebuild();
  },
  qcField: () => refreshQCField(),  // solo cambia lo que se dibuja
  qcRedraw: () => redrawQC(),
  // Marcar «Ver cuencas atómicas» sin haberlas calculado no hacía nada y
  // parecía que la casilla estuviera rota: ahora lanza el cálculo.
  basins: () => { if (state.showBasins && !qcBader) runBader(); else redrawQC(); },
  // Controles de VISUALIZACIÓN. En átomos y moléculas cambiar de isosuperficie
  // a nube de puntos no toca la función de onda: sería absurdo repetir las
  // integrales y el SCF, que es lo que hacía al llamar a rebuild().
  viz: () => { if (isQC()) redrawQC(); else rebuild(); },
  // Igual, pero cuando hace falta volver a MUESTREAR el campo (cambia la malla).
  vizField: () => { if (isQC()) refreshQCField(); else rebuild(); },
  // Recorrer los orbitales moleculares sin pelearse con el deslizador. Cambiar
  // de OM no rehace el SCF: solo se vuelve a muestrear el campo.
  moStep: (dir) => cycleOrbital(dir),
  moGo: (donde) => goFrontier(donde),
  qtaim: async () => {
    if (!state.qtaimOn) { qcTopo = null; redrawQC(); return; }
    if (!qcResult) { rebuild(); return; }
    const gen = qcGen;
    qcStatus = 'buscando puntos críticos…';
    updateInfo();
    try {
      qcTopo = await qc.request('topology', {});
      if (gen !== qcGen) return;
      qcStatus = '';
      refreshQCField(gen);
    } catch (err) {
      qcError = err.message; qcStatus = ''; updateInfo();
    }
  },
  bader: () => runBader(),
  optimizeZeta: (mode) => runOptimizeZeta(mode),
  scanBond: () => runScanBond(),
});

// Las gráficas van abajo a la derecha, donde el panel de control ocupa todo el
// borde: sin este margen quedan DETRÁS de él y parece que no se dibujan (era el
// caso de la curva E(R)). Se mide el ancho real del panel, que lil-gui puede
// cambiar, y se rehace al redimensionar la ventana.
function placeCharts() {
  const gui = panel.gui && panel.gui.domElement;
  // lil-gui puede estar aún sin medir al arrancar: nunca menos de su ancho
  // por defecto, o las gráficas vuelven a quedar debajo.
  const w = Math.max(gui ? gui.getBoundingClientRect().width : 0, 245);
  document.getElementById('qccharts').style.right = `${Math.round(w) + 16}px`;
}
placeCharts();
window.addEventListener('resize', placeCharts);
// El panel tarda un instante en tener su ancho definitivo (fuentes, plegado).
requestAnimationFrame(placeCharts);
setTimeout(placeCharts, 400);

// --------------------------------------------------------------------------
// VR.
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Menu de control DENTRO de la VR (el panel HTML no se ve en modo inmersivo).
// --------------------------------------------------------------------------
// Salta al HOMO o al LUMO. Lo usan el panel del computador y el menu de VR.
function goFrontier(donde) {
  if (!qcResult) return;
  const homo = Math.max(0, qcResult.homo);
  state.qcField = 'mo';
  state.moIndex = donde === 'lumo' ? Math.min(homo + 1, qcResult.nmo - 1) : homo;
  state.moIndexTouched = true;
  refreshQCField();
}

function cycleOrbital(dir) {
  // En los modelos de quimica cuantica el "orbital" es el OM que se dibuja:
  // cambiarlo no exige rehacer el SCF, solo volver a muestrear el campo.
  if (isQC()) {
    if (!qcResult) return;
    state.qcField = 'mo';
    const N = qcResult.nmo;
    state.moIndex = ((state.moIndex + dir) % N + N) % N;
    // El usuario ha elegido explícitamente un OM: deja de seguirse al HOMO.
    state.moIndexTouched = true;
    refreshQCField();
    return;
  }
  const N = catalog.length;
  state.orbitalIndex = ((state.orbitalIndex + dir) % N + N) % N;
  const o = catalog[state.orbitalIndex];
  state.n = o.n; state.l = o.l; state.m = o.m;
  rebuild();
  if (renderer.xr.isPresenting) fitInVR();
}
function cycleSpecies(dir) {
  // En los modelos de quimica cuantica este mando cambia el sistema: la
  // molecula del catalogo o el elemento de la tabla periodica.
  if (state.model === 'molecula') {
    const i = MOLECULES.findIndex((m) => m.key === state.molecule);
    const j = ((i + dir) % MOLECULES.length + MOLECULES.length) % MOLECULES.length;
    state.molecule = MOLECULES[j].key;
    state.moIndexTouched = false;
    rebuild();
    if (renderer.xr.isPresenting) fitInVR();
    return;
  }
  if (state.model === 'atomo') {
    const i = ELEMENTS.findIndex((e) => e.sym === state.qcElement);
    const j = ((i + dir) % ELEMENTS.length + ELEMENTS.length) % ELEMENTS.length;
    state.qcElement = ELEMENTS[j].sym;
    state.moIndexTouched = false;
    rebuild();
    if (renderer.xr.isPresenting) fitInVR();
    return;
  }
  let i = SPECIES.findIndex((s) => s.key === state.species);
  i = ((i + dir) % SPECIES.length + SPECIES.length) % SPECIES.length;
  state.species = SPECIES[i].key;
  rebuild();
  if (renderer.xr.isPresenting) fitInVR();
}

// Al alternar capas de visualizacion en VR no hace falta rehacer el SCF: en los
// modelos de quimica cuantica basta con volver a muestrear el campo.
// Alternar capas en VR no toca la funcion de onda: en atomo/molecula basta con
// repintar el campo que ya esta muestreado (redrawQC), sin ir al worker.
const vrRebuild = () => { if (isQC()) redrawQC(); else rebuild(); };

const vrActions = {
  prevOrbital: () => cycleOrbital(-1),
  nextOrbital: () => cycleOrbital(+1),
  prevSpecies: () => cycleSpecies(-1),
  nextSpecies: () => cycleSpecies(+1),
  toggleIso: () => { state.showIso = !state.showIso; vrRebuild(); },
  togglePoints: () => { state.showPoints = !state.showPoints; vrRebuild(); },
  toggleSlices: () => { state.showSlices = !state.showSlices; vrRebuild(); },
  toggleProbe: () => { state.probeOn = !state.probeOn; updateProbe(); },
  isoDown: () => { state.isoLevel = Math.max(0.02, +(state.isoLevel - 0.02).toFixed(3)); vrRebuild(); },
  isoUp: () => { state.isoLevel = Math.min(0.6, +(state.isoLevel + 0.02).toFixed(3)); vrRebuild(); },
  scaleDown: () => scaleVR(1 / 1.25),
  scaleUp: () => scaleVR(1.25),
  recenter: () => fitInVR(),
  cycleForm: () => {
    state.cloudForm = state.cloudForm === 'lineas' ? 'puntos' : 'lineas';
    if (!state.showPoints) state.showPoints = true; // la nube debe estar activa
    vrRebuild();
  },
  cycleColor: () => {
    state.cloudColor = state.cloudColor === 'violet' ? 'sign' : 'violet';
    vrRebuild();
  },
  goHomo: () => goFrontier('homo'),
  goLumo: () => goFrontier('lumo'),
};

function vrStatus() {
  const sp = currentSpecies();
  if (isQC()) {
    const sys = qcSystem();
    return {
      qc: true, esAtomo: state.model === 'atomo',
      species: state.model === 'atomo' ? state.qcElement : moleculeByKey(state.molecule).key,
      orbital: qcResult
        ? (state.qcField === 'mo'
          ? `${state.model === 'atomo' ? 'OA' : 'OM'} ${state.moIndex + 1}/${qcResult.nmo}`
          : state.qcField)
        : (qcStatus || '…'),
      energy: qcResult ? fmtEn(qcResult.E * 27.211386) : '—',
      iso: state.showIso, points: state.showPoints, slices: state.showSlices,
      probe: state.probeOn, isoLevel: state.isoLevel,
      lineas: state.cloudForm === 'lineas',
    };
  }
  return {
    qc: false, esAtomo: false,
    species: sp.symbol,
    orbital: state.model === 'hidrogeno' ? orbitalLabel(state.n, state.l, state.m) : '—',
    energy: fmtEn(energyEV(state.n, sp.Z, muFactor())),
    iso: state.showIso, points: state.showPoints, slices: state.showSlices,
    probe: state.probeOn, isoLevel: state.isoLevel,
    lineas: state.cloudForm === 'lineas',
  };
}

const vrMenu = new VRMenu(scene, vrActions, vrStatus);

// Ajusta escala y posicion para que el orbital quepa comodo frente al usuario
// (radio ~0.4 m), centrado y de pie. Rescata de quedar "dentro" del orbital.
function fitInVR() {
  const cam = renderer.xr.getCamera();
  if (group.parent !== xrPivot) xrPivot.attach(group);
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.scale.setScalar(1);

  const nSize = state.model === 'hibrido' ? 2 : state.n;
  const H = isQC() ? qcBoxSize(qcSystem()) : characteristicRadius(nSize, effectiveZ());
  xrPivot.scale.setScalar(0.4 / Math.max(H, 1e-3));

  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  cam.getWorldPosition(camPos);
  cam.getWorldQuaternion(camQuat);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  xrPivot.position.copy(camPos).add(fwd.multiplyScalar(0.9));
  xrPivot.position.y = camPos.y - 0.1;
}

function scaleVR(factor) {
  const s = THREE.MathUtils.clamp(xrPivot.scale.x * factor, 1e-4, 100);
  xrPivot.scale.setScalar(s);
}

const xr = setupXR(renderer, scene, group, refs, {
  menu: vrMenu,
  onStickLeft: () => cycleOrbital(-1),
  onStickRight: () => cycleOrbital(+1),
  onProbeMove: (worldPoint) => {
    if ((state.model !== 'hidrogeno' && !isQC()) || !state.probeOn) return;
    const local = group.worldToLocal(worldPoint.clone());
    const sph = probe.setSceneCartesian(local.x, local.y, local.z);
    state.r = sph.r;
    state.thetaDeg = (sph.theta * 180) / Math.PI;
    state.phiDeg = ((sph.phi * 180) / Math.PI + 360) % 360;
    updateProbeLabel();
    updateInfo();
  },
});

// Al entrar en VR: ajustar el orbital y mostrar el menu frente al usuario. La
// pose de la camara solo es valida ya dentro del bucle XR, asi que lo diferimos.
let pendingFit = false;
renderer.xr.addEventListener('sessionstart', () => { pendingFit = true; });

// --------------------------------------------------------------------------
// Bucle de render (compatible con WebXR).
// --------------------------------------------------------------------------
const clock = new THREE.Clock();
let probeSweepDir = 1;

rebuild();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);

  // Animacion del barrido de la sonda: theta (ping-pong 0..180) o phi (vuelta
  // completa 0..360, periodica).
  if ((state.model === 'hidrogeno' || isQC()) && state.probeOn && state.animateProbe) {
    const v = state.animateVar;
    if (v === 'phi' || v === 'both') {
      state.phiDeg = (state.phiDeg + dt * 60) % 360; // 60 °/s (periodico)
    }
    if (v === 'theta' || v === 'both') {
      let th = state.thetaDeg + probeSweepDir * dt * 45; // 45 °/s (ping-pong)
      if (th >= 180) { th = 180; probeSweepDir = -1; }
      else if (th <= 0) { th = 0; probeSweepDir = 1; }
      state.thetaDeg = th;
    }
    updateProbe();
  }

  if (renderer.xr.isPresenting) {
    if (pendingFit) {
      fitInVR();
      vrMenu.placeInFront(renderer.xr.getCamera());
      vrMenu.setVisible(true);
      pendingFit = false;
    }
    xr.update();

    // Etiqueta de la sonda: la colocamos junto a la sonda y la encaramos a la
    // camara, para ver psi/|psi|^2 en vivo dentro de la VR.
    const showLabel = (state.model === 'hidrogeno' || isQC()) && state.probeOn;
    probeLabel.setVisible(showLabel);
    vrPlots.setVisible(showLabel && state.model === 'hidrogeno');
    if (showLabel) {
      const cam = new THREE.Vector3();
      const camQ = new THREE.Quaternion();
      renderer.xr.getCamera().getWorldPosition(cam);
      renderer.xr.getCamera().getWorldQuaternion(camQ);

      const wp = new THREE.Vector3();
      probe.marker.getWorldPosition(wp);
      wp.y += 0.07; // un poco por encima de la esfera de la sonda
      probeLabel.setWorldPosition(wp);
      probeLabel.faceAt(cam);

      // Graficas a la derecha del orbital, encarando al usuario.
      const center = new THREE.Vector3();
      xrPivot.getWorldPosition(center);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
      vrPlots.setWorldPosition(center.add(right.multiplyScalar(0.5)));
      vrPlots.faceAt(cam);
    }
  } else {
    probeLabel.setVisible(false);
    vrPlots.setVisible(false);
  }
  controls.update();
  renderer.render(scene, camera);
});
