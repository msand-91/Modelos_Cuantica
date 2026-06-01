import * as THREE from 'three';

// Panel flotante en VR que muestra las tres mini-graficas de la sonda
// (R(r), r²|R|², parte angular). Reutiliza los canvas que ya dibuja la clase
// Plots, componiendolos en una sola textura. Vive en coordenadas de mundo.
export class VRPlots {
  constructor(parent, plots, { width = 0.34 } = {}) {
    this.plots = plots;
    this.W = 300;
    this.H = 570;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;

    const h = (width * this.H) / this.W;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, h),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false })
    );
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  setVisible(v) { this.mesh.visible = v; }
  setWorldPosition(v) { this.mesh.position.copy(v); }
  faceAt(camWorldPos) { this.mesh.lookAt(camWorldPos); }

  // Compone los tres canvas de Plots en la textura.
  sync() {
    const c = this.ctx, W = this.W, H = this.H;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,16,28,0.92)';
    c.fillRect(0, 0, W, H);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(90,169,255,0.5)';
    c.strokeRect(1, 1, W - 2, H - 2);

    const items = [
      { key: 'radial', title: 'R(r) — parte radial' },
      { key: 'radialDist', title: 'r²·|R|² — distribución radial' },
      { key: 'angular', title: 'Parte angular vs θ' },
      { key: 'azimuth', title: 'Parte angular vs φ' },
    ];
    let y = 10;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    for (const it of items) {
      const panel = this.plots.panels[it.key];
      c.fillStyle = '#9bb3d4';
      c.font = '15px sans-serif';
      c.fillText(it.title, 12, y + 14);
      if (panel) c.drawImage(panel.canvas, 12, y + 22, W - 24, 110);
      y += 140;
    }
    this.texture.needsUpdate = true;
  }
}
