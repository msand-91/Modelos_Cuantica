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
import { buildIsosurface, buildDensityIsosurface, buildNodalSurface } from './viz/isosurface.js';
import { buildPointCloud } from './viz/pointcloud.js';
import { buildSlices } from './viz/slices.js';
import { buildBox1D, buildBox2D, buildBox3D } from './viz/boxviz.js';

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
};

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
      vizGroup.add(buildPointCloud(sq, state.pointCount, H, Math.sqrt(field.absMax), state.opacity, state.cloudForm, state.cloudColor));
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
      target.add(buildIsosurface(field, state.isoLevel, state.opacity));
    }
  }
  if (state.showPoints)
    target.add(buildPointCloud(psiFn, pointCount, H, field.absMax, state.opacity, state.cloudForm, state.cloudColor));
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
function updateProbe() {
  const isH = state.model === 'hidrogeno';
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

function updateInfo() {
  let html = '';
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

createPanel(state, {
  rebuild,
  probe: updateProbe,
  spin: updateSpin,
  units: () => { updateInfo(); updateProbeLabel(); vrMenu.redraw(); },
  screenshot,
  model: rebuild,
  reset: resetView,
});

// --------------------------------------------------------------------------
// VR.
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Menu de control DENTRO de la VR (el panel HTML no se ve en modo inmersivo).
// --------------------------------------------------------------------------
function cycleOrbital(dir) {
  const N = catalog.length;
  state.orbitalIndex = ((state.orbitalIndex + dir) % N + N) % N;
  const o = catalog[state.orbitalIndex];
  state.n = o.n; state.l = o.l; state.m = o.m;
  rebuild();
  if (renderer.xr.isPresenting) fitInVR();
}
function cycleSpecies(dir) {
  let i = SPECIES.findIndex((s) => s.key === state.species);
  i = ((i + dir) % SPECIES.length + SPECIES.length) % SPECIES.length;
  state.species = SPECIES[i].key;
  rebuild();
  if (renderer.xr.isPresenting) fitInVR();
}

const vrActions = {
  prevOrbital: () => cycleOrbital(-1),
  nextOrbital: () => cycleOrbital(+1),
  prevSpecies: () => cycleSpecies(-1),
  nextSpecies: () => cycleSpecies(+1),
  toggleIso: () => { state.showIso = !state.showIso; rebuild(); },
  togglePoints: () => { state.showPoints = !state.showPoints; rebuild(); },
  toggleSlices: () => { state.showSlices = !state.showSlices; rebuild(); },
  toggleProbe: () => { state.probeOn = !state.probeOn; updateProbe(); },
  isoDown: () => { state.isoLevel = Math.max(0.02, +(state.isoLevel - 0.02).toFixed(3)); rebuild(); },
  isoUp: () => { state.isoLevel = Math.min(0.6, +(state.isoLevel + 0.02).toFixed(3)); rebuild(); },
  scaleDown: () => scaleVR(1 / 1.25),
  scaleUp: () => scaleVR(1.25),
  recenter: () => fitInVR(),
};

function vrStatus() {
  const sp = currentSpecies();
  return {
    species: sp.symbol,
    orbital: state.model === 'hidrogeno' ? orbitalLabel(state.n, state.l, state.m) : '—',
    energy: fmtEn(energyEV(state.n, sp.Z, muFactor())),
    iso: state.showIso, points: state.showPoints, slices: state.showSlices,
    probe: state.probeOn, isoLevel: state.isoLevel,
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
  const H = characteristicRadius(nSize, effectiveZ());
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
    if (state.model !== 'hidrogeno' || !state.probeOn) return;
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
  if (state.model === 'hidrogeno' && state.probeOn && state.animateProbe) {
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
    const showLabel = state.model === 'hidrogeno' && state.probeOn;
    probeLabel.setVisible(showLabel);
    vrPlots.setVisible(showLabel);
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
