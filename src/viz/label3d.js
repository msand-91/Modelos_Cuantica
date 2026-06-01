import * as THREE from 'three';

// Etiqueta de texto flotante en el espacio (billboard): un plano con textura de
// canvas que siempre encara a la camara. Vive en coordenadas de MUNDO (no se
// escala con el orbital), para que sea legible a cualquier zoom. Se usa en VR
// para mostrar el valor de la sonda (psi, |psi|^2) junto a ella.
export class Billboard {
  constructor(parent, { width = 0.17 } = {}) {
    this.W = 320;
    this.H = 212;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;

    const h = (width * this.H) / this.W;
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false, // siempre visible (HUD)
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);
    this.mesh.renderOrder = 12;
    this.mesh.visible = false;
    parent.add(this.mesh);

    this._lines = [];
  }

  setVisible(v) { this.mesh.visible = v; }

  setWorldPosition(v) { this.mesh.position.copy(v); }

  // Orienta el plano para que encare a la posicion dada (la camara).
  faceAt(camWorldPos) { this.mesh.lookAt(camWorldPos); }

  // lines: [{ text, color, big }]
  setLines(lines) {
    // Evita redibujar si no cambio el texto.
    const key = lines.map((l) => l.text).join('|');
    if (key === this._key) return;
    this._key = key;

    const c = this.ctx, W = this.W, H = this.H;
    c.clearRect(0, 0, W, H);
    c.beginPath();
    const r = 16;
    c.moveTo(r, 0); c.arcTo(W, 0, W, H, r); c.arcTo(W, H, 0, H, r);
    c.arcTo(0, H, 0, 0, r); c.arcTo(0, 0, W, 0, r); c.closePath();
    c.fillStyle = 'rgba(10,16,28,0.92)';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,212,121,0.7)';
    c.stroke();

    c.textAlign = 'left';
    c.textBaseline = 'middle';
    let y = 34;
    for (const l of lines) {
      c.fillStyle = l.color || '#eaf2ff';
      c.font = (l.big ? 'bold 30px' : '26px') + ' ui-monospace, monospace';
      c.fillText(l.text, 18, y);
      y += l.big ? 42 : 38;
    }
    this.texture.needsUpdate = true;
  }
}
