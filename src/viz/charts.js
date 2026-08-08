// Graficas 2D del modulo de quimica cuantica:
//   * Diagrama de niveles de los orbitales moleculares (con sus ocupaciones).
//   * Curvas: energia frente a la distancia de enlace E(R) y frente al
//     parametro variacional E(kappa).

const W = 250;
const H = 300;
const HC = 150;

export class QCCharts {
  constructor(container) {
    this.container = container;

    this.levelWrap = document.createElement('div');
    this.levelWrap.className = 'chart-wrap';
    this.levelLabel = document.createElement('div');
    this.levelLabel.className = 'chart-label';
    this.levelLabel.textContent = 'Niveles de energía (OM)';
    this.levels = document.createElement('canvas');
    this.levels.width = W; this.levels.height = H;
    this.levelWrap.appendChild(this.levels);
    this.levelWrap.appendChild(this.levelLabel);

    this.curveWrap = document.createElement('div');
    this.curveWrap.className = 'chart-wrap';
    this.curveLabel = document.createElement('div');
    this.curveLabel.className = 'chart-label';
    this.curve = document.createElement('canvas');
    this.curve.width = W; this.curve.height = HC;
    this.curveWrap.appendChild(this.curve);
    this.curveWrap.appendChild(this.curveLabel);

    container.appendChild(this.levelWrap);
    container.appendChild(this.curveWrap);
    this.setVisible(false);
    this.showCurve(false);
  }

  setVisible(v) { this.container.style.display = v ? 'flex' : 'none'; }
  showCurve(v) { this.curveWrap.style.display = v ? 'block' : 'none'; }
  showLevels(v) { this.levelWrap.style.display = v ? 'block' : 'none'; }

  // --- Diagrama de niveles --------------------------------------------------
  // orbitals: [{ e, occ, spin }]  (energia en hartree)
  drawLevels(spec) {
    const ctx = this.levels.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const { alpha, beta, unit = 'eV', homo = -1, selected = -1, selectedSpin = 'alpha' } = spec;
    const conv = unit === 'eV' ? 27.211386 : 1;
    const cols = beta ? 2 : 1;

    const all = alpha.concat(beta || []);
    if (!all.length) return;
    // Rango: nos centramos en la zona de valencia (los core se salen mucho).
    const occE = all.filter((o) => o.occ > 0).map((o) => o.e);
    const virE = all.filter((o) => o.occ === 0).map((o) => o.e);
    const hi = Math.max(virE.length ? Math.min(...virE) + 0.35 : 0.4, 0.15);
    const loRef = occE.length ? Math.max(...occE) : 0;
    const lo = Math.min(loRef - 1.6, -0.6);
    const pad = 26;
    const yOf = (e) => {
      const t = (Math.min(Math.max(e, lo), hi) - lo) / (hi - lo);
      return H - pad - t * (H - 2 * pad);
    };

    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // Eje.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(28, pad - 8); ctx.lineTo(28, H - pad + 8); ctx.stroke();
    ctx.fillStyle = 'rgba(232,236,244,0.6)';
    ctx.textAlign = 'right';
    for (const e of [hi, (hi + lo) / 2, lo]) {
      ctx.fillText((e * conv).toFixed(unit === 'eV' ? 0 : 2), 26, yOf(e));
    }

    const drawCol = (list, x0, width, spin) => {
      list.forEach((o, i) => {
        if (o.e < lo - 0.5) return; // orbitales de core fuera de rango
        const y = yOf(o.e);
        const isSel = i === selected && (!beta || spin === selectedSpin);
        ctx.strokeStyle = isSel ? '#ffd479' : o.occ > 0 ? '#5aa9ff' : 'rgba(232,236,244,0.35)';
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x0, y); ctx.lineTo(x0 + width, y);
        ctx.stroke();

        // Flechas de ocupacion.
        ctx.fillStyle = isSel ? '#ffd479' : '#cfe3ff';
        ctx.textAlign = 'center';
        if (o.occ >= 2) ctx.fillText('↑↓', x0 + width / 2, y - 7);
        else if (o.occ === 1) ctx.fillText(spin === 'beta' ? '↓' : '↑', x0 + width / 2, y - 7);

        if (i === homo && !beta) {
          ctx.fillStyle = '#49e0a0';
          ctx.textAlign = 'left';
          ctx.fillText('HOMO', x0 + width + 3, y);
        }
      });
    };

    if (cols === 1) {
      drawCol(alpha, 40, W - 90, 'both');
    } else {
      drawCol(alpha, 40, (W - 100) / 2, 'alpha');
      drawCol(beta, 40 + (W - 100) / 2 + 20, (W - 100) / 2, 'beta');
      ctx.fillStyle = 'rgba(232,236,244,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('α', 40 + (W - 100) / 4, H - 8);
      ctx.fillText('β', 40 + (W - 100) * 0.75 + 20, H - 8);
    }
    this.levelLabel.textContent = `Niveles OM (${unit})`;
  }

  // --- Curva generica --------------------------------------------------------
  // points: [{x, y}], marks: [{x, y, color, label}]
  drawCurve(points, opts = {}) {
    const ctx = this.curve.getContext('2d');
    ctx.clearRect(0, 0, W, HC);
    if (!points || points.length < 2) return;
    const pad = 22;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (opts.yPad !== false) {
      const dy = (y1 - y0) || 1;
      y0 -= dy * 0.1; y1 += dy * 0.1;
    }
    const sx = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 1.6 * pad);
    const sy = (y) => HC - pad - ((y - y0) / (y1 - y0 || 1)) * (HC - 1.7 * pad);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, HC - pad); ctx.lineTo(W - pad * 0.6, HC - pad);
    ctx.moveTo(pad, HC - pad); ctx.lineTo(pad, pad * 0.5);
    ctx.stroke();

    ctx.strokeStyle = opts.color || '#4dd17a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const px = sx(p.x), py = sy(p.y);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();

    for (const m of opts.marks || []) {
      ctx.fillStyle = m.color || '#ffd479';
      ctx.beginPath();
      ctx.arc(sx(m.x), sy(m.y), 4, 0, Math.PI * 2);
      ctx.fill();
      if (m.label) {
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, sx(m.x), sy(m.y) - 8);
      }
    }

    ctx.fillStyle = 'rgba(232,236,244,0.6)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.xLabel || '', W / 2, HC - 6);
    this.curveLabel.textContent = opts.title || '';
    this.showCurve(true);
  }
}
