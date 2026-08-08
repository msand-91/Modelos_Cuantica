// Busca identificadores USADOS pero no declarados ni importados en cada módulo:
// justamente el fallo (physToScene) que la compilación no detecta.
import { parseAst } from 'rollup/parseAst';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALES = new Set([
  'console', 'Math', 'Object', 'Array', 'JSON', 'Number', 'String', 'Boolean', 'Date',
  'Promise', 'Set', 'Map', 'WeakMap', 'Symbol', 'Error', 'TypeError', 'RangeError',
  'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array',
  'Uint16Array', 'Uint32Array', 'BigInt', 'ArrayBuffer', 'DataView', 'Infinity', 'NaN',
  'undefined', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'globalThis', 'Proxy',
  'window', 'document', 'navigator', 'location', 'self', 'performance', 'requestAnimationFrame',
  'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'fetch', 'URL', 'URLSearchParams', 'Worker', 'Blob', 'FileReader', 'Image', 'CustomEvent',
  'devicePixelRatio', 'alert', 'structuredClone', 'queueMicrotask', 'process', 'crypto',
  'HTMLCanvasElement', 'ResizeObserver', 'matchMedia', 'atob', 'btoa', 'TextEncoder',
]);

function analizar(archivo) {
  const codigo = readFileSync(archivo, 'utf8');
  const ast = parseAst(codigo);
  const declarados = new Set();
  const usados = new Map();   // nombre -> linea aproximada

  // Recorrido simple: recoge todo lo declarado y todo lo referenciado. Es una
  // aproximación (no distingue ámbitos), pero basta para detectar un nombre que
  // no existe en NINGÚN sitio del módulo.
  const visitar = (n, padre) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((c) => visitar(c, padre)); return; }
    switch (n.type) {
      case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier':
        declarados.add(n.local.name);
        return;                       // `x as y`: `x` no es una referencia local
      case 'MetaProperty':
        return;                       // import.meta
      case 'FunctionExpression':
        if (n.id) declarados.add(n.id.name);   // IIFE con nombre
        break;
      case 'VariableDeclarator': case 'FunctionDeclaration': case 'ClassDeclaration':
        if (n.id) recogerPatron(n.id, declarados); break;
      case 'Property':
        if (n.shorthand === false && n.key && n.key.type === 'Identifier' && !n.computed) {
          visitar(n.value, n); return;   // la clave no es una referencia
        }
        break;
      case 'MethodDefinition': case 'PropertyDefinition':
        // El nombre del método no es una referencia a una variable.
        if (n.computed) visitar(n.key, n);
        visitar(n.value, n);
        return;
      case 'MemberExpression':
        visitar(n.object, n);
        if (n.computed) visitar(n.property, n);
        return;
      case 'Identifier':
        if (padre && padre.type === 'LabeledStatement') return;
        usados.set(n.name, n.loc ? n.loc.start.line : 0);
        return;
      default: break;
    }
    if (n.params) n.params.forEach((p) => recogerPatron(p, declarados));
    if (n.type === 'CatchClause' && n.param) recogerPatron(n.param, declarados);
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'type' || k === 'start' || k === 'end') continue;
      visitar(n[k], n);
    }
  };
  const recogerPatron = (p, set) => {
    if (!p) return;
    if (p.type === 'Identifier') set.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((q) => recogerPatron(q.value || q.argument, set));
    else if (p.type === 'ArrayPattern') p.elements.forEach((q) => recogerPatron(q, set));
    else if (p.type === 'AssignmentPattern') recogerPatron(p.left, set);
    else if (p.type === 'RestElement') recogerPatron(p.argument, set);
  };
  visitar(ast, null);

  const libres = [];
  for (const [nombre, linea] of usados) {
    if (!declarados.has(nombre) && !GLOBALES.has(nombre)) libres.push(`${nombre} (línea ~${linea})`);
  }
  return libres;
}

const raiz = new URL('../src', import.meta.url).pathname;
const archivos = [];
const recorrer = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) recorrer(p);
  else if (f.endsWith('.js')) archivos.push(p);
});
recorrer(raiz);

let total = 0;
for (const a of archivos.sort()) {
  const libres = analizar(a);
  if (libres.length) {
    total += libres.length;
    console.log(`${a.replace(raiz, 'src')}:`);
    libres.forEach((l) => console.log(`    ${l}`));
  }
}
console.log(total ? `\n${total} identificador(es) sin declarar` : `\n✓ ${archivos.length} módulos: ningún identificador sin declarar`);
