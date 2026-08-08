// Cliente del hilo de calculo: envuelve el Worker en promesas y encola las
// peticiones (el worker atiende de una en una).

export class QCClient {
  constructor() {
    this.worker = new Worker(new URL('./qcworker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.nextId = 1;
    this.queue = Promise.resolve();
    this.worker.onmessage = (ev) => {
      const { id, type } = ev.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      if (type === 'progress') { if (entry.onProgress) entry.onProgress(ev.data); return; }
      this.pending.delete(id);
      if (type === 'error') entry.reject(new Error(ev.data.message));
      else entry.resolve(ev.data.result);
    };
    this.worker.onerror = (e) => {
      for (const [, entry] of this.pending) entry.reject(new Error(e.message || 'Error en el hilo de cálculo'));
      this.pending.clear();
    };
  }

  // Encola una peticion; devuelve una promesa con el resultado.
  request(type, payload, onProgress) {
    const run = () => new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, type, payload });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
}
