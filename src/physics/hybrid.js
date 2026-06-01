// Orbitales HIBRIDOS: combinaciones lineales (reales) de 2s y 2p que dan los
// orbitales direccionales de la quimica del enlace.
//
//   sp   : 2 lobulos a 180°   (lineal)
//   sp²  : 3 lobulos a 120°   (trigonal plano, en el plano xy)
//   sp³  : 4 lobulos a 109.5° (tetraedrico)
//
// Cada lobulo es psi = sum_i c_i * psi_{2,l_i,m_i}, con los componentes 2s, 2px,
// 2py, 2pz ortonormales -> cada lobulo queda normalizado (sum c_i^2 = 1) y los
// lobulos de un conjunto son ortonormales entre si.
//
// Convencion de m del proyecto: m=0 -> pz, m=1 -> px, m=-1 -> py.

const S = { l: 0, m: 0 };
const PX = { l: 1, m: 1 };
const PY = { l: 1, m: -1 };
const PZ = { l: 1, m: 0 };

const R3 = 1 / Math.sqrt(3);
const R6 = 1 / Math.sqrt(6);
const R2 = Math.SQRT1_2; // 1/sqrt(2)
const S23 = Math.sqrt(2 / 3);

export const HYBRIDS = {
  sp: {
    label: 'sp', geom: 'lineal', angle: '180°', n: 2,
    lobes: [
      [{ ...S, c: R2 }, { ...PZ, c: R2 }],
      [{ ...S, c: R2 }, { ...PZ, c: -R2 }],
    ],
  },
  sp2: {
    label: 'sp²', geom: 'trigonal plana', angle: '120°', n: 2,
    lobes: [
      [{ ...S, c: R3 }, { ...PX, c: S23 }],
      [{ ...S, c: R3 }, { ...PX, c: -R6 }, { ...PY, c: R2 }],
      [{ ...S, c: R3 }, { ...PX, c: -R6 }, { ...PY, c: -R2 }],
    ],
  },
  sp3: {
    label: 'sp³', geom: 'tetraédrica', angle: '109.5°', n: 2,
    lobes: [
      [{ ...S, c: 0.5 }, { ...PX, c: 0.5 }, { ...PY, c: 0.5 }, { ...PZ, c: 0.5 }],
      [{ ...S, c: 0.5 }, { ...PX, c: 0.5 }, { ...PY, c: -0.5 }, { ...PZ, c: -0.5 }],
      [{ ...S, c: 0.5 }, { ...PX, c: -0.5 }, { ...PY, c: 0.5 }, { ...PZ, c: -0.5 }],
      [{ ...S, c: 0.5 }, { ...PX, c: -0.5 }, { ...PY, c: -0.5 }, { ...PZ, c: 0.5 }],
    ],
  },
};

export function hybridDef(type) {
  return HYBRIDS[type] || HYBRIDS.sp3;
}

// Etiqueta legible de un componente (2s, 2pₓ, 2pᵧ, 2p_z).
function compLabel(comp) {
  if (comp.l === 0) return '2s';
  if (comp.m === 1) return '2pₓ';
  if (comp.m === -1) return '2pᵧ';
  return '2p_z';
}

// Combinacion de un lobulo como texto, p.ej. "0.50·2s + 0.50·2pₓ − 0.50·2p_z".
export function lobeFormula(type, index) {
  const lobe = hybridDef(type).lobes[index];
  if (!lobe) return '';
  return lobe
    .map((t, i) => {
      const a = Math.abs(t.c).toFixed(2);
      const sign = t.c < 0 ? ' − ' : i === 0 ? '' : ' + ';
      return `${sign}${a}·${compLabel(t)}`;
    })
    .join('');
}
