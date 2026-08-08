import GUI from 'lil-gui';
import { T } from './i18n.js';
import { buildCatalog, orbitalLabel } from '../physics/hydrogen.js';
import { SPECIES } from '../physics/species.js';
import { ELEMENTS } from '../physics/atoms.js';
import { MOLECULES } from '../physics/molecules.js';
import { BASIS_KINDS, BASIS_QUALITY } from '../physics/basis.js';

// Construye el panel de control en pantalla (computador). Modifica el objeto
// `state` y notifica mediante los callbacks:
//   cb.rebuild()  -> reconstruir la visualizacion (operacion pesada)
//   cb.probe()    -> actualizar solo la sonda + info + graficas (ligero)
//   cb.model()    -> cambio de modelo (reorganiza visibilidad del panel)
//   cb.reset()    -> reiniciar camara
export function createPanel(state, cb) {
  const gui = new GUI({ title: 'Controles' });

  const catalog = buildCatalog(6, 3);
  const orbitalOptions = {};
  catalog.forEach((o, i) => { orbitalOptions[o.label] = i; });

  // --- Selector de modelo ---
  const modelOptions = {
    [T.hidrogeno]: 'hidrogeno',
    [T.hibrido]: 'hibrido',
    [T.atomo]: 'atomo',
    [T.molecula]: 'molecula',
    [T.caja1d]: 'caja1d',
    [T.caja2d]: 'caja2d',
    [T.caja3d]: 'caja3d',
  };
  gui.add(state, 'model', modelOptions).name(T.modelo).onChange(() => {
    refreshVisibility();
    cb.model();
  });

  // --- Hidrogeno: especie + orbital ---
  const fH = gui.addFolder(T.hidrogeno);

  // Selector de especie hidrogenoide (isotopos y cationes con un electron).
  const speciesOptions = {};
  SPECIES.forEach((s) => { speciesOptions[s.label] = s.key; });
  fH.add(state, 'species', speciesOptions).name(T.especie).onChange(cb.rebuild);

  const orbProxy = { orbital: state.orbitalIndex };
  fH.add(orbProxy, 'orbital', orbitalOptions).name(T.orbital).onChange((idx) => {
    const o = catalog[idx];
    state.orbitalIndex = idx;
    state.n = o.n; state.l = o.l; state.m = o.m;
    cb.rebuild();
  });

  // Espin-orbital (Fase 1): no cambia la forma, solo aniade m_s y la flecha S_z.
  fH.add(state, 'spinOn').name(T.espin).onChange(cb.spin);
  fH.add(state, 'ms', { '↑  +½': 0.5, '↓  −½': -0.5 }).name(T.ms).onChange(cb.spin);
  fH.add(state, 'spinFine').name(T.estructuraFina).onChange(cb.rebuild);
  fH.add(state, 'fsJPlus').name('j = l + ½').onChange(cb.rebuild);
  fH.add(state, 'fsMjx2', -7, 7, 2).name('mⱼ × 2').onChange(cb.rebuild);

  // --- Hibridos ---
  const fHy = gui.addFolder(T.hibrido);
  fHy.add(state, 'hybType', { 'sp': 'sp', 'sp²': 'sp2', 'sp³': 'sp3' }).name(T.hibridacion).onChange(cb.rebuild);
  fHy.add(state, 'hybShow', { 'Conjunto completo': 'set', 'Lóbulo individual': 'single' }).name(T.mostrarHib).onChange(cb.rebuild);
  fHy.add(state, 'hybIndex', 0, 3, 1).name(T.lobulo).onChange(cb.rebuild);

  // --- Atomo polielectronico (Slater + SCF) ---
  const fA = gui.addFolder(T.atomo);
  const elemOptions = {};
  ELEMENTS.forEach((e) => { elemOptions[`${e.sym} — ${e.name} (Z=${e.Z})`] = e.sym; });
  fA.add(state, 'qcElement', elemOptions).name(T.elemento).onChange(cb.qc);
  fA.add(state, 'qcCharge', -2, 3, 1).name(T.carga).onChange(cb.qc);
  fA.add(state, 'qcMultAuto').name(T.multAuto).onChange(cb.qc);
  fA.add(state, 'qcMult', 1, 7, 1).name(T.multiplicidad).onChange(cb.qc);

  // --- Molecula (OM = combinacion lineal de orbitales atomicos) ---
  const fM = gui.addFolder(T.molecula);
  const molOptions = {};
  MOLECULES.forEach((m) => { molOptions[m.name] = m.key; });
  fM.add(state, 'molecule', molOptions).name(T.moleculaSel).onChange(cb.qc);
  fM.add(state, 'bondFactor', 0.6, 2.2, 0.02).name(T.distancia).onChange(cb.qc);
  fM.add({ curva: () => cb.scanBond() }, 'curva').name(T.curvaER);

  // --- Base y teorema variacional (comun a atomo y molecula) ---
  const fB = gui.addFolder(T.base);
  const kindOptions = {};
  BASIS_KINDS.forEach((k) => { kindOptions[k.label] = k.key; });
  fB.add(state, 'basisKind', kindOptions).name(T.tipoBase).onChange(cb.qc);
  fB.add(state, 'basisNG', 1, 6, 1).name(T.numGauss).onChange(cb.qc);
  const qualOptions = {};
  BASIS_QUALITY.forEach((q) => { qualOptions[q.label] = q.key; });
  fB.add(state, 'basisQuality', qualOptions).name(T.calidadBase).onChange(cb.qc);
  fB.add(state, 'zetaScale', 0.6, 1.8, 0.01).name(T.zetaEscala).onChange(cb.qc).listen();
  fB.add({ opt: () => cb.optimizeZeta('global') }, 'opt').name(T.optimizarZeta);
  fB.add({ opt: () => cb.optimizeZeta('shell') }, 'opt').name(T.optimizarCapas);

  // --- Que se dibuja del resultado ---
  const fF = gui.addFolder(T.campo);
  fF.add(state, 'qcField', {
    'Orbital (ψ)': 'mo',
    'Densidad electrónica ρ': 'rho',
    'Laplaciano −∇²ρ': 'lap',
    'ELF (localización)': 'elf',
    'Densidad de espín': 'spin',
  }).name(T.campo).onChange(cb.qcField);
  // El deslizador cuenta desde 1, igual que la tabla de orbitales del panel de
  // la izquierda (antes uno empezaba en 0 y el otro en 1, y no coincidían).
  // Internamente `state.moIndex` sigue siendo 0-based: el proxy traduce.
  const moProxy = {};
  Object.defineProperty(moProxy, 'om', {
    get: () => state.moIndex + 1,
    set: (v) => { state.moIndex = Math.round(v) - 1; },
    enumerable: true,
  });
  const moCtl = fF.add(moProxy, 'om', 1, 21, 1).name(T.orbitalOM).listen()
    .onChange(() => { state.moIndexTouched = true; cb.qcField(); });
  // Botones para recorrer los orbitales: el deslizador es incómodo cuando hay
  // treinta OM y lo normal es querer moverse de uno en uno o saltar al HOMO.
  const moNav = {
    prev: () => cb.moStep(-1),
    next: () => cb.moStep(+1),
    homo: () => cb.moGo('homo'),
    lumo: () => cb.moGo('lumo'),
  };
  const moPrev = fF.add(moNav, 'prev').name(T.omAnterior);
  const moNext = fF.add(moNav, 'next').name(T.omSiguiente);
  fF.add(moNav, 'homo').name(T.irHomo);
  fF.add(moNav, 'lumo').name(T.irLumo);
  fF.add(state, 'moSpin', { 'α': 'alpha', 'β': 'beta' }).name(T.espinOM).onChange(cb.qcField);
  fF.add(state, 'isoRho', 0.002, 0.4, 0.002).name(T.nivelRho).onChange(cb.qcField);
  fF.add(state, 'showNuclei').name(T.nucleos).onChange(cb.qcRedraw);
  fF.add(state, 'showBonds').name(T.enlaces).onChange(cb.qcRedraw);

  // --- QTAIM ---
  const fQ = gui.addFolder(T.qtaim);
  fQ.add(state, 'qtaimOn').name(T.puntosCriticos).onChange(cb.qtaim);
  fQ.add(state, 'showCPLabels').name(T.etiquetasCP).onChange(cb.qcRedraw);
  fQ.add(state, 'baderN', { '48 (rápido)': 48, '64': 64, '80': 80, '96 (fino)': 96 }).name(T.resolucionBader);
  fQ.add({ bader: () => cb.bader() }, 'bader').name(T.cargasBader);
  fQ.add(state, 'showBasins').name(T.cuencas).onChange(cb.basins);
  fQ.add(state, 'showGradField').name(T.campoGrad).onChange(cb.qcRedraw);
  fQ.add(state, 'gradFieldMode', { 'Sobre los planos': 'plano', 'En volumen (3D)': 'volumen' })
    .name(T.campoGradModo).onChange(cb.qcRedraw);

  // --- Visualizacion (compartida) ---
  // Estos controles solo cambian COMO se dibuja lo ya calculado: en atomos y
  // moleculas usan `cb.viz`, que redibuja al instante en vez de repetir el SCF.
  // La excepcion es la resolucion de la malla, que obliga a muestrear de nuevo.
  const fV = gui.addFolder(T.visualizacion);
  fV.add(state, 'showIso').name(T.isosuperficie).onChange(cb.viz);
  fV.add(state, 'densityMode').name(T.densidad).onChange(cb.viz);
  fV.add(state, 'isoLevel', 0.02, 0.6, 0.005).name(T.nivelIso).onChange(cb.viz);
  fV.add(state, 'isoStack').name(T.isoGradiente).onChange(cb.viz);
  fV.add(state, 'showNodes').name(T.nodos).onChange(cb.viz);
  fV.add(state, 'showPoints').name(T.nubePuntos).onChange(cb.viz);
  fV.add(state, 'cloudForm', { 'Puntos': 'puntos', 'Líneas (hilos)': 'lineas' }).name(T.formaNube).onChange(cb.viz);
  fV.add(state, 'cloudColor', {
    'Rojo / Azul (signo)': 'sign',
    'Degradado continuo (±)': 'continuo',
    'Azul / Violeta': 'violet',
  }).name(T.colorNube).onChange(cb.viz);
  fV.add(state, 'pointCount', 2000, 60000, 1000).name(T.numPuntos).onChange(cb.viz);
  fV.add(state, 'showSlices').name(T.cortes).onChange(cb.viz);
  fV.add(state, 'sliceXY').name(T.planoXY).onChange(cb.viz);
  fV.add(state, 'sliceXZ').name(T.planoXZ).onChange(cb.viz);
  fV.add(state, 'sliceYZ').name(T.planoYZ).onChange(cb.viz);
  fV.add(state, 'opacity', 0.15, 1, 0.05).name(T.opacidad).onChange(cb.viz);
  fV.add(state, 'gridN', 24, 96, 4).name(T.resolucion).onChange(cb.vizField);

  // --- Comparar dos orbitales ---
  const fCmp = gui.addFolder(T.comparar);
  fCmp.add(state, 'compareOn').name(T.activarComparar).onChange(cb.rebuild);
  const cmpProxy = { orbital: state.orbitalIndexB };
  fCmp.add(cmpProxy, 'orbital', orbitalOptions).name(T.orbitalB).onChange((idx) => {
    state.orbitalIndexB = idx;
    cb.rebuild();
  });

  // --- Sonda ---
  const fS = gui.addFolder(T.sonda);
  fS.add(state, 'probeOn').name(T.activarSonda).onChange(cb.probe);
  fS.add(state, 'animateProbe').name(T.animarSonda).onChange(cb.probe);
  fS.add(state, 'animateVar', { 'θ (polar)': 'theta', 'φ (azimut)': 'phi', 'Ambos (θ y φ)': 'both' }).name(T.varAnimada).onChange(cb.probe);
  fS.add(state, 'r', 0, 60, 0.1).name(T.radial_r).onChange(cb.probe).listen();
  fS.add(state, 'thetaDeg', 0, 180, 1).name(T.theta).onChange(cb.probe).listen();
  fS.add(state, 'phiDeg', 0, 360, 1).name(T.phi).onChange(cb.probe).listen();

  // --- Caja ---
  const fC = gui.addFolder(T.caja);
  const cNx = fC.add(state, 'nx', 1, 6, 1).name('n_x').onChange(cb.rebuild);
  const cNy = fC.add(state, 'ny', 1, 6, 1).name('n_y').onChange(cb.rebuild);
  const cNz = fC.add(state, 'nz', 1, 6, 1).name('n_z').onChange(cb.rebuild);
  const cLx = fC.add(state, 'Lx', 2, 14, 0.5).name('L_x').onChange(cb.rebuild);
  const cLy = fC.add(state, 'Ly', 2, 14, 0.5).name('L_y').onChange(cb.rebuild);
  const cLz = fC.add(state, 'Lz', 2, 14, 0.5).name('L_z').onChange(cb.rebuild);

  // --- Unidades de presentacion ---
  const fU = gui.addFolder(T.unidades);
  fU.add(state, 'lenUnit', { 'a₀ (Bohr)': 'a0', 'Ångström': 'angstrom', 'picómetro (pm)': 'pm' })
    .name(T.longitud).onChange(cb.units);
  fU.add(state, 'enUnit', { 'eV': 'eV', 'Hartree': 'hartree' })
    .name(T.energia).onChange(cb.units);

  gui.add({ captura: () => cb.screenshot() }, 'captura').name(T.captura);
  gui.add({ reset: () => cb.reset() }, 'reset').name(T.reiniciar);

  // Muestra/oculta secciones segun el modelo activo.
  function refreshVisibility() {
    const isH = state.model === 'hidrogeno';
    const isHyb = state.model === 'hibrido';
    const isAtom = state.model === 'atomo';
    const isMol = state.model === 'molecula';
    const isQC = isAtom || isMol;
    const isBox = !isH && !isHyb && !isQC;
    const is3D = state.model === 'caja3d' || isH || isHyb || isQC;
    fH.show(isH);
    fHy.show(isHyb);
    fS.show(isH);
    fCmp.show(isH);
    fA.show(isAtom);
    fM.show(isMol);
    fB.show(isQC);
    fF.show(isQC);
    fQ.show(isQC);
    fC.show(isBox);
    // En un átomo los orbitales no son «moleculares»: se renombra el bloque.
    moCtl.name(isAtom ? T.orbitalOA : T.orbitalOM);
    moPrev.name(isAtom ? T.oaAnterior : T.omAnterior);
    moNext.name(isAtom ? T.oaSiguiente : T.omSiguiente);
    // En caja 1D/2D los y/z no aplican.
    cNy.show(state.model !== 'caja1d');
    cNz.show(state.model === 'caja3d');
    cLy.show(state.model !== 'caja1d');
    cLz.show(state.model === 'caja3d');
    // Las opciones 3D (iso/nube/cortes/malla) solo en modelos 3D.
    fV.show(is3D);
  }
  refreshVisibility();

  // Ajusta el rango del selector de orbital molecular al numero de OM (1..nmo).
  function setMORange(nmo) {
    moCtl.min(1);
    moCtl.max(Math.max(1, nmo));
    moCtl.updateDisplay();
  }

  return { gui, refreshVisibility, setMORange };
}
