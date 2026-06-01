// Muestreo de un campo escalar f(x,y,z) en una rejilla cubica centrada en el
// origen, de semilado H y resolucion N puntos por eje.
//
// Devuelve un objeto reutilizable por las visualizaciones (isosuperficie,
// cortes) con la matriz de valores y metadatos para indexar/interpolar.
export function sampleField(fn, N, H) {
  const data = new Float32Array(N * N * N);
  const step = (2 * H) / (N - 1);
  let min = Infinity;
  let max = -Infinity;
  let absMax = 0;

  let idx = 0;
  for (let k = 0; k < N; k++) {
    const z = -H + k * step;
    for (let j = 0; j < N; j++) {
      const y = -H + j * step;
      for (let i = 0; i < N; i++) {
        const x = -H + i * step;
        const v = fn(x, y, z);
        data[idx++] = v;
        if (v < min) min = v;
        if (v > max) max = v;
        const a = Math.abs(v);
        if (a > absMax) absMax = a;
      }
    }
  }

  return { data, N, H, step, origin: -H, min, max, absMax };
}

// Indexado lineal i + N*(j + N*k).
export const fieldIndex = (N, i, j, k) => i + N * (j + N * k);
