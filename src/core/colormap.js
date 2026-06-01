import * as THREE from 'three';

// Color por SIGNO de la funcion de onda: rojo (+) / azul (-).
// Es la convencion habitual en quimica para los lobulos de los orbitales.
export const POS_COLOR = new THREE.Color(0xff5a6e); // psi > 0
export const NEG_COLOR = new THREE.Color(0x4d8bff); // psi < 0

export function signColor(value) {
  return value >= 0 ? POS_COLOR : NEG_COLOR;
}

// Mapa tipo "viridis" aproximado para densidad |psi|^2 (0..1).
const VIRIDIS = [
  [0.267, 0.005, 0.329],
  [0.283, 0.141, 0.458],
  [0.254, 0.265, 0.53],
  [0.207, 0.372, 0.553],
  [0.164, 0.471, 0.558],
  [0.128, 0.567, 0.551],
  [0.135, 0.659, 0.518],
  [0.267, 0.749, 0.441],
  [0.478, 0.821, 0.318],
  [0.741, 0.873, 0.15],
  [0.993, 0.906, 0.144],
];

export function viridis(t, target = new THREE.Color()) {
  t = Math.min(1, Math.max(0, t));
  const f = t * (VIRIDIS.length - 1);
  const i = Math.floor(f);
  const j = Math.min(VIRIDIS.length - 1, i + 1);
  const a = f - i;
  const c0 = VIRIDIS[i];
  const c1 = VIRIDIS[j];
  return target.setRGB(
    c0[0] + (c1[0] - c0[0]) * a,
    c0[1] + (c1[1] - c0[1]) * a,
    c0[2] + (c1[2] - c0[2]) * a
  );
}

// Mapa divergente azul-blanco-rojo para valores con signo normalizados a [-1,1].
export function diverging(t, target = new THREE.Color()) {
  t = Math.min(1, Math.max(-1, t));
  if (t >= 0) return target.setRGB(1, 1 - t * 0.65, 1 - t * 0.55).lerp(POS_COLOR, t * 0.6);
  const s = -t;
  return target.setRGB(1 - s * 0.55, 1 - s * 0.5, 1).lerp(NEG_COLOR, s * 0.6);
}
