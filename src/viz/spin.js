import * as THREE from 'three';

// Indicador de ESPIN para el modo espin-orbital (Fase 1).
//
// El espin-orbital es  chi = psi_{nlm}(r,theta,phi) * sigma_{m_s},  donde la
// parte de espin (alpha = arriba, beta = abajo) NO depende de las coordenadas
// espaciales. Por eso la FORMA del orbital no cambia al elegir el espin; lo
// unico que aniadimos es esta flecha que representa la proyeccion S_z del espin
// (hacia +z para m_s = +1/2, hacia -z para m_s = -1/2).
//
// Convencion de escena: el eje fisico z se dibuja como el eje Y de Three.js.
export class SpinIndicator {
  constructor(parent, length = 3.2) {
    this.group = new THREE.Group();
    this.group.name = 'espin';

    const color = 0x49e0a0; // verde-cian, bien distinguible del rojo/azul de psi
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), // direccion inicial (arriba)
      new THREE.Vector3(0, 0, 0), // origen (nucleo)
      length,
      color,
      length * 0.28, // largo de la punta
      length * 0.18  // ancho de la punta
    );
    // Que se vea por delante del orbital (como los ejes de referencia).
    this.arrow.line.material.depthTest = false;
    this.arrow.cone.material.depthTest = false;
    this.arrow.line.renderOrder = 3;
    this.arrow.cone.renderOrder = 3;
    this.arrow.line.material.linewidth = 2;
    this.group.add(this.arrow);

    parent.add(this.group);
    this.group.visible = false;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  // m_s = +0.5 -> flecha hacia +z (Y de escena);  m_s = -0.5 -> hacia -z.
  setSpin(ms) {
    const dir = ms >= 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
    this.arrow.setDirection(dir);
  }
}
