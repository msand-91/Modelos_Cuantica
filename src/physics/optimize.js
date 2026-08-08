// Optimizadores sin derivadas, usados para APLICAR EL TEOREMA VARIACIONAL:
// buscar los parametros (exponentes de la base) que MINIMIZAN la energia.
//
// Como E[base] >= E_exacta siempre, bajar la energia es literalmente mejorar la
// funcion de onda: no hace falta conocer la solucion exacta para saber que un
// parametro es mejor que otro.

// Busqueda de la seccion aurea para 1 parametro en [a, b] (funcion unimodal).
export function goldenSection(f, a, b, tol = 1e-4, maxIter = 60) {
  const gr = (Math.sqrt(5) - 1) / 2;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  let fc = f(c);
  let fd = f(d);
  let evals = 2;
  for (let i = 0; i < maxIter && Math.abs(b - a) > tol; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    evals++;
  }
  const x = (a + b) / 2;
  return { x, f: f(x), evals: evals + 1 };
}

// Nelder-Mead (simplex) para varios parametros.
export function nelderMead(f, x0, opts = {}) {
  const n = x0.length;
  const step = opts.step ?? 0.35;
  const tol = opts.tol ?? 1e-6;
  const maxIter = opts.maxIter ?? 400;

  const pts = [Float64Array.from(x0)];
  for (let i = 0; i < n; i++) {
    const p = Float64Array.from(x0);
    p[i] += step * (Math.abs(p[i]) > 1e-8 ? 1 : 1);
    pts.push(p);
  }
  let vals = pts.map(f);
  let evals = pts.length;

  const order = () => {
    const idx = pts.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    const np = idx.map((i) => pts[i]);
    const nv = idx.map((i) => vals[i]);
    for (let i = 0; i <= n; i++) { pts[i] = np[i]; vals[i] = nv[i]; }
  };

  for (let it = 0; it < maxIter; it++) {
    order();
    if (Math.abs(vals[n] - vals[0]) < tol * (Math.abs(vals[0]) + tol)) break;

    // Centroide de los n mejores.
    const c = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;

    const reflect = new Float64Array(n);
    for (let j = 0; j < n; j++) reflect[j] = c[j] + (c[j] - pts[n][j]);
    const fr = f(reflect); evals++;

    if (fr < vals[0]) {
      const expand = new Float64Array(n);
      for (let j = 0; j < n; j++) expand[j] = c[j] + 2 * (c[j] - pts[n][j]);
      const fe = f(expand); evals++;
      if (fe < fr) { pts[n] = expand; vals[n] = fe; } else { pts[n] = reflect; vals[n] = fr; }
    } else if (fr < vals[n - 1]) {
      pts[n] = reflect; vals[n] = fr;
    } else {
      const contract = new Float64Array(n);
      for (let j = 0; j < n; j++) contract[j] = c[j] + 0.5 * (pts[n][j] - c[j]);
      const fc = f(contract); evals++;
      if (fc < vals[n]) { pts[n] = contract; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) {
          for (let j = 0; j < n; j++) pts[i][j] = pts[0][j] + 0.5 * (pts[i][j] - pts[0][j]);
          vals[i] = f(pts[i]); evals++;
        }
      }
    }
  }
  order();
  return { x: Array.from(pts[0]), f: vals[0], evals };
}
