// Especies HIDROGENOIDES (un solo electron): isotopos del hidrogeno y cationes
// con un electron. Cada especie queda definida por dos parametros fisicos:
//
//   Z      -> carga nuclear (numero de protones).
//   massU  -> masa del NUCLEO en unidades de masa atomica (u).
//
// Efectos sobre el atomo de un electron:
//
//   * La carga Z contrae el orbital  (~ 1/Z)  y escala la energia  (~ Z^2).
//   * La masa finita del nucleo entra por la MASA REDUCIDA
//         mu = m_e * M / (m_e + M)
//     que produce el "efecto isotopico": H, D y T (mismo Z=1) tienen energias
//     y tamanos ligerisimamente distintos.
//
// Energia:   E_n = -13.6057 eV * (mu/m_e) * Z^2 / n^2
// Tamano:    el radio escala como (m_e/mu)/Z  =>  la funcion de onda espacial
//            se obtiene usando una carga efectiva  Z_eff = Z * (mu/m_e),
//            porque psi solo depende de la combinacion  Z/a_mu = Z*(mu/m_e)/a0.

// 1 unidad de masa atomica expresada en masas del electron.
const U_IN_ME = 1822.888486;

// Catalogo. Las masas son del NUCLEO (masa atomica del isotopo menos los
// electrones), pero el efecto de esa correccion es minusculo.
export const SPECIES = [
  { key: 'H',    label: '¹H — hidrógeno',   symbol: 'H',    Z: 1, massU: 1.0072765 },
  { key: 'D',    label: '²H — deuterio',    symbol: 'D',    Z: 1, massU: 2.0135532 },
  { key: 'T',    label: '³H — tritio',      symbol: 'T',    Z: 1, massU: 3.0155007 },
  { key: 'He+',  label: 'He⁺ — helio (+)',  symbol: 'He⁺',  Z: 2, massU: 4.0015061 },
  { key: 'Li2+', label: 'Li²⁺ — litio (2+)', symbol: 'Li²⁺', Z: 3, massU: 7.0143577 },
  { key: 'Be3+', label: 'Be³⁺ — berilio (3+)', symbol: 'Be³⁺', Z: 4, massU: 9.0099887 },
];

export function speciesByKey(key) {
  return SPECIES.find((s) => s.key === key) || SPECIES[0];
}

// Factor de masa reducida  mu/m_e  para una especie dada.
export function reducedMassFactor(species) {
  const M = species.massU * U_IN_ME; // masa del nucleo en masas del electron
  return M / (M + 1);
}

// Carga "efectiva" que usa la parte espacial de la funcion de onda, que
// incorpora la correccion de masa reducida.  Z_eff = Z * (mu/m_e).
export function spatialZ(species) {
  return species.Z * reducedMassFactor(species);
}
