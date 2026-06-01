import * as THREE from 'three';

// Interaccion en VR (Meta Quest) con los mandos:
//   - GRIP (squeeze) con UN mando: agarrar y rotar/mover la visualizacion.
//   - GRIP con LOS DOS mandos: escalar (acercar/alejar los mandos) y desplazar.
//   - GATILLO (trigger): si apuntas al MENU, activa el boton; si no, mueve la
//     "sonda" al punto frente al mando (hidrogeno con la sonda activa).
//   - Boton A/X o B/Y: mostrar/ocultar el menu VR.
//   - Joystick izquierda/derecha: orbital anterior/siguiente.
//
// Las referencias (ejes/rejilla) cuelgan del propio `group`, asi que se mueven
// con el atomo automaticamente.
// Devuelve { update } para llamar en el bucle de animacion.
export function setupXR(renderer, scene, group, refs, callbacks = {}) {
  const xr = renderer.xr;
  const parent = group.parent; // xrPivot

  const controllers = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const btnPrev = {}; // estado previo de botones/joystick por mano (deteccion de flanco)

  for (let i = 0; i < 2; i++) {
    const c = xr.getController(i);
    c.userData.squeeze = false;
    c.userData.prevSqueeze = false;
    c.userData.trigger = false;
    c.userData.prevTrigger = false;
    c.userData.menuConsumed = false;
    c.userData.draggingMenu = false;
    c.addEventListener('squeezestart', () => { c.userData.squeeze = true; });
    c.addEventListener('squeezeend', () => { c.userData.squeeze = false; });
    c.addEventListener('selectstart', () => { c.userData.trigger = true; });
    c.addEventListener('selectend', () => { c.userData.trigger = false; });

    // Rayo laser de referencia.
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]),
      new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.6 })
    );
    ray.scale.z = 1.5;
    c.add(ray);

    scene.add(c);
    controllers.push(c);
  }

  // Estado de manipulacion.
  let mode = 'none';
  let startDist = 0;
  let startScale = 1;
  let startMid = new THREE.Vector3();
  let startGroupPos = new THREE.Vector3();

  let menuDragController = null;

  function gripping() {
    // Excluye el mando que esta arrastrando el menu (no agarra el orbital).
    return controllers.filter((c) => c.userData.squeeze && !c.userData.draggingMenu);
  }

  // --- Botones/joystick (gamepad) para el menu y navegacion rapida ---
  function pollGamepads() {
    const session = xr.getSession();
    if (!session) return;
    const menu = callbacks.menu;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const hand = src.handedness || 'x';

      // A/X (4) o B/Y (5): mostrar/ocultar menu.
      const toggle = (gp.buttons[4] && gp.buttons[4].pressed) ||
                     (gp.buttons[5] && gp.buttons[5].pressed);
      const tkey = hand + '_toggle';
      if (toggle && !btnPrev[tkey] && menu) menu.toggle(xr.getCamera());
      btnPrev[tkey] = toggle;

      // Joystick X (eje 2 en Oculus Touch; respaldo eje 0): cambiar orbital.
      const ax = (gp.axes.length > 2 ? gp.axes[2] : gp.axes[0]) || 0;
      const skey = hand + '_stick';
      if (ax > 0.7) {
        if (btnPrev[skey] !== 'r') { callbacks.onStickRight && callbacks.onStickRight(); btnPrev[skey] = 'r'; }
      } else if (ax < -0.7) {
        if (btnPrev[skey] !== 'l') { callbacks.onStickLeft && callbacks.onStickLeft(); btnPrev[skey] = 'l'; }
      } else if (Math.abs(ax) < 0.3) {
        btnPrev[skey] = null;
      }
    }
  }

  function update() {
    const menu = callbacks.menu;

    // --- Menu: hover + arrastre con grip ---
    for (const c of controllers) {
      c.userData.hoverId = menu ? menu.raycast(c) : null;

      const squeezePressed = c.userData.squeeze && !c.userData.prevSqueeze;
      const squeezeReleased = !c.userData.squeeze && c.userData.prevSqueeze;

      // Empezar a arrastrar el menu si se aprieta grip apuntandolo.
      if (squeezePressed && menu && menu.visible && c.userData.hoverId !== null && !menuDragController) {
        c.attach(menu.mesh); // el menu sigue al mando preservando su pose
        c.userData.draggingMenu = true;
        menuDragController = c;
      }
      // Soltar el menu: vuelve a la escena conservando su posicion.
      if (squeezeReleased && c.userData.draggingMenu) {
        scene.attach(menu.mesh);
        c.userData.draggingMenu = false;
        if (menuDragController === c) menuDragController = null;
      }
      c.userData.prevSqueeze = c.userData.squeeze;
    }

    const grips = gripping();

    // --- Transiciones de modo (grip) ---
    if (grips.length === 2) {
      if (mode !== 'two') {
        if (group.parent !== parent) parent.attach(group);
        grips[0].getWorldPosition(tmpA);
        grips[1].getWorldPosition(tmpB);
        startDist = tmpA.distanceTo(tmpB) || 1e-4;
        startScale = group.scale.x;
        startMid.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        startGroupPos.copy(group.getWorldPosition(new THREE.Vector3()));
        mode = 'two';
      }
    } else if (grips.length === 1) {
      if (mode !== 'one') {
        grips[0].attach(group); // reparenta preservando la transformacion mundial
        mode = 'one';
      }
    } else {
      if (mode !== 'none') {
        if (group.parent !== parent) parent.attach(group);
        mode = 'none';
      }
    }

    // --- Accion continua en modo dos manos: escalar + desplazar ---
    if (mode === 'two') {
      grips[0].getWorldPosition(tmpA);
      grips[1].getWorldPosition(tmpB);
      const dist = tmpA.distanceTo(tmpB) || 1e-4;
      const s = THREE.MathUtils.clamp((startScale * dist) / startDist, 0.005, 5);
      group.scale.setScalar(s);
      const mid = tmpA.add(tmpB).multiplyScalar(0.5);
      const deltaMid = mid.sub(startMid);
      const worldTarget = startGroupPos.clone().add(deltaMid);
      const localTarget = parent.worldToLocal(worldTarget.clone());
      group.position.copy(localTarget);
    }

    // --- Menu VR: clic con el gatillo sobre el boton apuntado ---
    for (const c of controllers) {
      const id = c.userData.hoverId;
      const pressed = c.userData.trigger && !c.userData.prevTrigger;
      if (pressed && id && menu) { menu.click(id); c.userData.menuConsumed = true; }
      if (!c.userData.trigger) c.userData.menuConsumed = false;
    }

    // --- Sonda con el gatillo (solo si NO se esta usando el menu) ---
    for (const c of controllers) {
      if (
        c.userData.trigger && !c.userData.menuConsumed && !c.userData.hoverId &&
        callbacks.onProbeMove
      ) {
        c.getWorldQuaternion(tmpQ);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(tmpQ);
        const origin = c.getWorldPosition(new THREE.Vector3());
        const point = origin.add(forward.multiplyScalar(0.4));
        callbacks.onProbeMove(point);
      }
      c.userData.prevTrigger = c.userData.trigger;
    }

    pollGamepads();
  }

  return { update, controllers };
}
