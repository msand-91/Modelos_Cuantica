// Mini-graficas 2D (canvas) que muestran como cambia la funcion al variar cada
// variable por separado:
//   - Parte radial R_nl(r)
//   - Distribucion radial de probabilidad r^2 |R_nl(r)|^2
//   - Parte angular a lo largo de theta (al phi actual de la sonda)
// Cada grafica marca el valor en la posicion actual de la sonda.

const W = 232;
const H = 124;

export class Plots {
  constructor(container) {
    this.container = container;
    this.panels = {};
    for (const key of ['radial', 'radialDist', 'angular', 'azimuth']) {
      const wrap = document.createElement('div');
      wrap.className = 'plot-wrap';
      const label = document.createElement('div');
      label.className = 'plot-label';
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      wrap.appendChild(canvas);
      wrap.appendChild(label);
      container.appendChild(wrap);
      this.panels[key] = { canvas, label, ctx: canvas.getContext('2d'), wrap };
    }
    this.panels.radial.label.innerHTML = 'R<sub>nl</sub>(r)  — parte radial';
    this.panels.radialDist.label.innerHTML = 'r²·|R<sub>nl</sub>|²  — distribución radial';
    this.panels.angular.label.innerHTML = 'Parte angular vs θ (polar)';
    this.panels.azimuth.label.innerHTML = 'Parte angular vs φ (azimut)';
    this.setVisible(false);
  }

  setVisible(v) {
    this.container.style.display = v ? 'flex' : 'none';
  }

  _curve(key, fn, x0, x1, marker, opts = {}) {
    const { ctx } = this.panels[key];
    ctx.clearRect(0, 0, W, H);
    const pad = 14;
    const samples = 200;
    let ymin = Infinity, ymax = -Infinity;
    const ys = new Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = x0 + ((x1 - x0) * i) / (samples - 1);
      const y = fn(x);
      ys[i] = y;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (ymax === ymin) ymax = ymin + 1;
    const yr = ymax - ymin;
    ymin -= yr * 0.08;
    ymax += yr * 0.08;

    const sx = (x) => pad + ((x - x0) / (x1 - x0)) * (W - 2 * pad);
    const sy = (y) => H - pad - ((y - ymin) / (ymax - ymin)) * (H - 2 * pad);

    // Eje y = 0.
    if (ymin < 0 && ymax > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, sy(0));
      ctx.lineTo(W - pad, sy(0));
      ctx.stroke();
    }

    // Curva.
    ctx.strokeStyle = opts.color || '#5aa9ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const x = x0 + ((x1 - x0) * i) / (samples - 1);
      const px = sx(x);
      const py = sy(ys[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Marcador de la posicion actual.
    if (marker !== undefined && marker >= x0 && marker <= x1) {
      const mx = sx(marker);
      const my = sy(fn(marker));
      ctx.strokeStyle = 'rgba(255,212,121,0.5)';
      ctx.beginPath();
      ctx.moveTo(mx, pad);
      ctx.lineTo(mx, H - pad);
      ctx.stroke();
      ctx.fillStyle = '#ffd479';
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Actualiza las tres graficas. `spec` aporta las funciones del orbital actual.
  update(spec) {
    const { radialFn, radialDistFn, angularFn, azimuthFn, rMax, probe } = spec;
    this._curve('radial', radialFn, 0, rMax, probe.r, { color: '#5aa9ff' });
    this._curve('radialDist', radialDistFn, 0, rMax, probe.r, { color: '#4dd17a' });
    this._curve('angular', angularFn, 0, Math.PI, probe.theta, { color: '#ff5a6e' });
    this._curve('azimuth', azimuthFn, 0, 2 * Math.PI, probe.phi, { color: '#c08bff' });
  }
}
