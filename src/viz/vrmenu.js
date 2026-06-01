import * as THREE from 'three';

// Panel de control DENTRO de la VR. En modo inmersivo el panel HTML (lil-gui)
// no se ve, asi que dibujamos un menu sobre un plano con textura de canvas y lo
// hacemos interactivo: el usuario lo apunta con el rayo del mando y pulsa el
// gatillo para activar un boton.
//
//   actions: objeto con las funciones que mutan el estado y reconstruyen
//            (prevOrbital, nextOrbital, prevSpecies, nextSpecies, toggleIso,
//             togglePoints, toggleSlices, toggleProbe, isoDown, isoUp).
//   getStatus: () => { species, orbital, energy, iso, points, slices, probe, isoLevel }
export class VRMenu {
  constructor(parent, actions, getStatus) {
    this.actions = actions;
    this.getStatus = getStatus;
    this.W = 512;
    this.H = 604;
    this.hover = null;

    // Botones (rectangulos en pixeles del canvas).
    this.buttons = [
      { id: 'prevOrbital', label: '◀', x: 24, y: 168, w: 72, h: 72 },
      { id: 'nextOrbital', label: '▶', x: 416, y: 168, w: 72, h: 72 },
      { id: 'prevSpecies', label: '◀', x: 24, y: 262, w: 72, h: 72 },
      { id: 'nextSpecies', label: '▶', x: 416, y: 262, w: 72, h: 72 },
      { id: 'toggleIso', label: 'Iso', x: 24, y: 360, w: 148, h: 62, activeKey: 'iso' },
      { id: 'togglePoints', label: 'Puntos', x: 182, y: 360, w: 148, h: 62, activeKey: 'points' },
      { id: 'toggleSlices', label: 'Cortes', x: 340, y: 360, w: 148, h: 62, activeKey: 'slices' },
      { id: 'toggleProbe', label: 'Sonda', x: 24, y: 432, w: 210, h: 62, activeKey: 'probe' },
      { id: 'isoDown', label: 'Iso −', x: 250, y: 432, w: 110, h: 62 },
      { id: 'isoUp', label: 'Iso +', x: 372, y: 432, w: 116, h: 62 },
      { id: 'scaleDown', label: 'Tamaño −', x: 24, y: 504, w: 148, h: 62 },
      { id: 'scaleUp', label: 'Tamaño +', x: 182, y: 504, w: 148, h: 62 },
      { id: 'recenter', label: 'Recentrar', x: 340, y: 504, w: 148, h: 62 },
    ];

    // Canvas + textura.
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;

    const planeW = 0.46;
    const planeH = (planeW * this.H) / this.W;
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false, // siempre visible por encima del orbital (HUD)
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    parent.add(this.mesh);

    // Raycaster reutilizable.
    this._ray = new THREE.Raycaster();
    this._tmpM = new THREE.Matrix4();

    this.redraw();
  }

  get visible() { return this.mesh.visible; }

  setVisible(v) { this.mesh.visible = v; if (v) this.redraw(); }

  toggle(camera) {
    if (this.mesh.visible) { this.mesh.visible = false; return; }
    this.placeInFront(camera);
    this.mesh.visible = true;
    this.redraw();
  }

  // Coloca el panel frente a la camara (usuario), mirando hacia el.
  placeInFront(camera) {
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    camera.getWorldPosition(camPos);
    camera.getWorldQuaternion(camQuat);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    forward.y *= 0.25; // casi horizontal, ligeramente segun la mirada
    forward.normalize();
    this.mesh.position.copy(camPos).add(forward.multiplyScalar(0.85));
    this.mesh.quaternion.copy(camQuat); // su normal (+z) apunta al usuario
  }

  // Devuelve el id del boton apuntado por el mando (o null) y resalta.
  raycast(controller) {
    if (!this.mesh.visible) return null;
    this._tmpM.identity().extractRotation(controller.matrixWorld);
    this._ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this._ray.ray.direction.set(0, 0, -1).applyMatrix4(this._tmpM);
    const hits = this._ray.intersectObject(this.mesh, false);
    if (!hits.length || !hits[0].uv) return this._setHover(null);
    const px = hits[0].uv.x * this.W;
    const py = (1 - hits[0].uv.y) * this.H;
    const b = this.buttons.find(
      (b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
    );
    return this._setHover(b ? b.id : null);
  }

  _setHover(id) {
    if (id !== this.hover) { this.hover = id; this.redraw(); }
    return id;
  }

  // Activa el boton indicado.
  click(id) {
    const b = this.buttons.find((b) => b.id === id);
    if (!b) return;
    const fn = this.actions[b.id];
    if (fn) fn();
    this.redraw();
  }

  // --- Dibujo ---
  redraw() {
    const c = this.ctx;
    const s = this.getStatus();
    const W = this.W, H = this.H;
    c.clearRect(0, 0, W, H);

    // Fondo.
    roundRect(c, 4, 4, W - 8, H - 8, 22);
    c.fillStyle = 'rgba(10,16,28,0.94)';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(90,169,255,0.5)';
    c.stroke();

    // Cabecera.
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillStyle = '#5aa9ff';
    c.font = 'bold 34px sans-serif';
    c.fillText(`${s.species} · ${s.orbital}`, 26, 52);
    c.fillStyle = '#cfe3ff';
    c.font = '24px sans-serif';
    c.fillText(`E = ${s.energy}`, 26, 90);
    c.fillStyle = '#9bb3d4';
    c.font = '20px sans-serif';
    c.fillText(`nivel iso = ${(+s.isoLevel).toFixed(2)}`, 26, 120);

    // Rotulos de fila centrados.
    c.textAlign = 'center';
    c.fillStyle = '#9bb3d4';
    c.font = '22px sans-serif';
    c.fillText('Orbital', W / 2, 212);
    c.fillText('Especie', W / 2, 306);

    // Botones.
    for (const b of this.buttons) {
      const active = b.activeKey ? !!s[b.activeKey] : false;
      const hovered = this.hover === b.id;
      roundRect(c, b.x, b.y, b.w, b.h, 12);
      if (hovered) c.fillStyle = 'rgba(90,169,255,0.55)';
      else if (active) c.fillStyle = 'rgba(73,224,160,0.30)';
      else c.fillStyle = 'rgba(40,56,84,0.85)';
      c.fill();
      c.lineWidth = hovered ? 3 : 1.5;
      c.strokeStyle = hovered ? '#bcd9ff' : (active ? '#49e0a0' : 'rgba(120,150,190,0.5)');
      c.stroke();

      c.fillStyle = '#eaf2ff';
      c.font = (b.label.length <= 2 ? 'bold 36px' : 'bold 24px') + ' sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      c.textBaseline = 'alphabetic';
    }

    this.texture.needsUpdate = true;
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
