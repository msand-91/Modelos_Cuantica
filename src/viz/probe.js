import * as THREE from 'three';

// "Sonda": un marcador 3D que el usuario coloca en el espacio (mediante los
// sliders r, theta, phi en el panel, o con el mando en VR). Reporta en vivo el
// valor de psi y |psi|^2 en ese punto. Sirve para ver COMO cambia el valor de
// la funcion al variar las variables radial y angulares.
export class Probe {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = 'sonda';

    // Esfera marcadora.
    const sphereGeom = new THREE.SphereGeometry(0.18, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffd479,
      emissive: 0x553300,
      roughness: 0.3,
    });
    this.marker = new THREE.Mesh(sphereGeom, sphereMat);
    this.group.add(this.marker);

    // Linea desde el origen hasta la sonda (vector posicion r).
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    this.line = new THREE.Line(
      lineGeom,
      new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.7 })
    );
    this.group.add(this.line);

    parent.add(this.group);
    this.visible = false;
    this.group.visible = false;
    this.r = 1;
    this.theta = Math.PI / 2;
    this.phi = 0;
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  // Coloca la sonda a partir de coordenadas esfericas (r, theta, phi).
  setSpherical(r, theta, phi) {
    this.r = r;
    this.theta = theta;
    this.phi = phi;
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(theta);
    // Convencion de Three.js: Y es "arriba". Mapeamos z(fisico) -> Y(escena).
    this.marker.position.set(x, z, y);
    const pts = this.line.geometry.attributes.position;
    pts.setXYZ(1, x, z, y);
    pts.needsUpdate = true;
  }

  // Reposiciona la sonda en coordenadas cartesianas de escena y devuelve las
  // coordenadas esfericas fisicas (para VR, donde se mueve con el mando).
  setSceneCartesian(x, yScene, zScene) {
    // Deshacer el mapeo z(fisico)->Y(escena).
    const xf = x, yf = zScene, zf = yScene;
    const r = Math.sqrt(xf * xf + yf * yf + zf * zf);
    const theta = r > 0 ? Math.acos(zf / r) : 0;
    const phi = Math.atan2(yf, xf);
    this.setSpherical(r, theta, phi);
    return { r, theta, phi };
  }

  setScale(s) {
    this.marker.scale.setScalar(s);
  }
}
