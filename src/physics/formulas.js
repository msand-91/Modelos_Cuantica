// Cadenas HTML con la FORMA EXPLICITA de la funcion de onda del hidrogeno
// (parte radial y parte angular REAL, en cos/sin, no en exponenciales e^{imφ}).
// Unidades atomicas (a0 = 1); Z es la carga nuclear. r en a0.
//
//   psi_{nlm}(r,θ,φ) = R_{nl}(r) · Y_{lm}(θ,φ)
//
// La tabla radial codifica cada R_{nl} como:
//   R_{nl}(r) = C · Z^{3/2} · P(Zr) · e^{−Zr/n}
// donde P es un polinomio en (Zr) con coeficientes enteros (de menor a mayor
// grado). Las constantes C estan verificadas numericamente contra radial() de
// hydrogen.js (ver scripts/verify-formulas — coincidencia exacta).

export const RADIAL_TABLE = {
  // n,l : { cstr (coeficiente para mostrar), cnum (valor), poly (coef. en Zr), n }
  '1,0': { cstr: '2',          cnum: 2,                          poly: [1],            n: 1 },
  '2,0': { cstr: '1/(2√2)',    cnum: 1 / (2 * Math.SQRT2),       poly: [2, -1],        n: 2 },
  '2,1': { cstr: '1/(2√6)',    cnum: 1 / (2 * Math.sqrt(6)),     poly: [0, 1],         n: 2 },
  '3,0': { cstr: '2/(81√3)',   cnum: 2 / (81 * Math.sqrt(3)),    poly: [27, -18, 2],   n: 3 },
  '3,1': { cstr: '4/(81√6)',   cnum: 4 / (81 * Math.sqrt(6)),    poly: [0, 6, -1],     n: 3 },
  '3,2': { cstr: '4/(81√30)',  cnum: 4 / (81 * Math.sqrt(30)),   poly: [0, 0, 1],      n: 3 },
  '4,0': { cstr: '1/768',      cnum: 1 / 768,                    poly: [192, -144, 24, -1], n: 4 },
  '4,1': { cstr: '1/(256√15)', cnum: 1 / (256 * Math.sqrt(15)),  poly: [0, 80, -20, 1],     n: 4 },
  '4,2': { cstr: '1/(768√5)',  cnum: 1 / (768 * Math.sqrt(5)),   poly: [0, 0, 12, -1],      n: 4 },
  '4,3': { cstr: '1/(768√35)', cnum: 1 / (768 * Math.sqrt(35)),  poly: [0, 0, 0, 1],        n: 4 },
};

// Valor numerico de R_{nl} segun la tabla (solo para verificacion).
export function radialFromTable(n, l, r, Z = 1) {
  const e = RADIAL_TABLE[`${n},${l}`];
  if (!e) return NaN;
  const t = Z * r;
  let P = 0;
  for (let i = e.poly.length - 1; i >= 0; i--) P = P * t + e.poly[i];
  return e.cnum * Math.pow(Z, 1.5) * P * Math.exp(-t / e.n);
}

// --- Formato de un polinomio en (Zr) como HTML ---
const POW = ['', 'Zr', '(Zr)²', '(Zr)³'];
function polyToHTML(poly) {
  // Caso especial: polinomio constante 1 -> sin factor visible.
  if (poly.length === 1 && poly[0] === 1) return '';
  const terms = [];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i];
    if (c === 0) continue;
    const a = Math.abs(c);
    const sign = c < 0 ? ' − ' : (terms.length ? ' + ' : '');
    const coef = a === 1 && i > 0 ? '' : `${a}`;
    terms.push(`${sign}${coef}${POW[i]}`);
  }
  const body = terms.join('').replace(/^ \+ /, '');
  return `(${body})`;
}

// R_{nl}(r) en HTML.
export function radialFormulaHTML(n, l, Z = 1) {
  const e = RADIAL_TABLE[`${n},${l}`];
  if (!e) return '';
  const poly = polyToHTML(e.poly);
  const exp = e.n === 1 ? 'e<sup>−Zr</sup>' : `e<sup>−Zr/${e.n}</sup>`;
  const parts = [`${e.cstr}·Z<sup>3/2</sup>`];
  if (poly) parts.push(poly);
  parts.push(exp);
  return parts.join(' ');
}

// --- Parte angular REAL Y_{lm}(θ,φ) en cos/sin ---
// Coinciden con angularReal() de hydrogen.js. Pi se escribe "π".
const ANGULAR_HTML = {
  '0,0': '1/(2√π)',

  '1,0': '√(3/4π)·cosθ',
  '1,1': '√(3/4π)·sinθ cosφ',
  '1,-1': '√(3/4π)·sinθ sinφ',

  '2,0': '¼√(5/π)·(3cos²θ − 1)',
  '2,1': '½√(15/π)·sinθ cosθ cosφ',
  '2,-1': '½√(15/π)·sinθ cosθ sinφ',
  '2,2': '¼√(15/π)·sin²θ cos2φ',
  '2,-2': '¼√(15/π)·sin²θ sin2φ',

  '3,0': '¼√(7/π)·(5cos³θ − 3cosθ)',
  '3,1': '¼√(21/2π)·sinθ (5cos²θ − 1) cosφ',
  '3,-1': '¼√(21/2π)·sinθ (5cos²θ − 1) sinφ',
  '3,2': '¼√(105/π)·sin²θ cosθ cos2φ',
  '3,-2': '¼√(105/π)·sin²θ cosθ sin2φ',
  '3,3': '¼√(35/2π)·sin³θ cos3φ',
  '3,-3': '¼√(35/2π)·sin³θ sin3φ',
};

export function angularFormulaHTML(l, m) {
  return ANGULAR_HTML[`${l},${m}`] || '';
}
