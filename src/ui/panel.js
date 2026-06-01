import GUI from 'lil-gui';
import { T } from './i18n.js';
import { buildCatalog, orbitalLabel } from '../physics/hydrogen.js';
import { SPECIES } from '../physics/species.js';

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

  // --- Visualizacion (compartida) ---
  const fV = gui.addFolder(T.visualizacion);
  fV.add(state, 'showIso').name(T.isosuperficie).onChange(cb.rebuild);
  fV.add(state, 'densityMode').name(T.densidad).onChange(cb.rebuild);
  fV.add(state, 'isoLevel', 0.02, 0.6, 0.005).name(T.nivelIso).onChange(cb.rebuild);
  fV.add(state, 'showNodes').name(T.nodos).onChange(cb.rebuild);
  fV.add(state, 'showPoints').name(T.nubePuntos).onChange(cb.rebuild);
  fV.add(state, 'cloudForm', { 'Puntos': 'puntos', 'Líneas (hilos)': 'lineas' }).name(T.formaNube).onChange(cb.rebuild);
  fV.add(state, 'cloudColor', { 'Rojo / Azul (signo)': 'sign', 'Azul / Violeta': 'violet' }).name(T.colorNube).onChange(cb.rebuild);
  fV.add(state, 'pointCount', 2000, 60000, 1000).name(T.numPuntos).onChange(cb.rebuild);
  fV.add(state, 'showSlices').name(T.cortes).onChange(cb.rebuild);
  fV.add(state, 'sliceXY').name(T.planoXY).onChange(cb.rebuild);
  fV.add(state, 'sliceXZ').name(T.planoXZ).onChange(cb.rebuild);
  fV.add(state, 'sliceYZ').name(T.planoYZ).onChange(cb.rebuild);
  fV.add(state, 'opacity', 0.15, 1, 0.05).name(T.opacidad).onChange(cb.rebuild);
  fV.add(state, 'gridN', 24, 96, 4).name(T.resolucion).onChange(cb.rebuild);

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
    const is3D = state.model === 'caja3d' || isH || isHyb;
    fH.show(isH);
    fHy.show(isHyb);
    fS.show(isH);
    fCmp.show(isH);
    fC.show(!isH && !isHyb);
    // En caja 1D/2D los y/z no aplican.
    cNy.show(state.model !== 'caja1d');
    cNz.show(state.model === 'caja3d');
    cLy.show(state.model !== 'caja1d');
    cLz.show(state.model === 'caja3d');
    // Las opciones 3D (iso/nube/cortes/malla) solo en modelos 3D.
    fV.show(is3D);
  }
  refreshVisibility();

  return { gui, refreshVisibility };
}
