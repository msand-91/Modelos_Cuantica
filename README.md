# Modelos Cuánticos · Visualizador 3D / VR

Aplicación web interactiva para **visualizar modelos de mecánica cuántica** tanto
en el computador como en gafas **Meta Quest** (WebXR), pensada para el estudio de
**estados estacionarios** en química:

1. **Átomos hidrogenoides** (un electrón) — orbitales 3D (1s … 4f) con tres
   estilos: isosuperficie, nube de puntos (densidad |ψ|²) y cortes/planos de
   color. Se puede elegir la **especie**: isótopos del hidrógeno **¹H, ²H
   (deuterio), ³H (tritio)** y cationes **He⁺, Li²⁺, Be³⁺**. Una **sonda** móvil
   permite ver cómo cambia el valor de ψ al variar las variables **radial (r)** y
   **angulares (θ, φ)**, con mini-gráficas de la parte radial R(r), la
   distribución radial r²|R|² y la parte angular.
2. **Partícula en una caja** 1D, 2D y 3D, en coordenadas cartesianas.

Construido con **Three.js + WebXR** y **Vite**. Interfaz en español.

## Requisitos

- Node.js 18 o superior (incluye `npm`).

## Instalación

```bash
npm install
```

## Ejecutar en el computador

```bash
npm run dev
```

Vite sirve la app por **HTTPS** (necesario para WebXR). Abre la URL que muestra
(por ejemplo `https://localhost:5173`). Como el certificado es autofirmado, el
navegador pedirá aceptar la advertencia de seguridad la primera vez.

Recomendado: **Chrome** o **Edge** de escritorio.

## Ejecutar en las gafas Meta Quest

1. Asegúrate de que el PC y el Quest están en la **misma red Wi-Fi**.
2. Con `npm run dev` corriendo, Vite muestra también una URL de red, del tipo
   `https://192.168.x.x:5173`.
3. En el Quest abre el **navegador** (Meta Quest Browser) y entra a esa URL.
4. Acepta la advertencia del certificado autofirmado.
5. Pulsa el botón **"ENTER VR"** abajo.

### Ver en Meta Quest **desde WSL2** (Windows + Linux)

Si ejecutas la app dentro de WSL2, el Quest no puede alcanzar la IP interna de
WSL directamente. Hay que **reenviar el puerto** de Windows hacia WSL2:

1. Deja `npm run dev -- --port 5174 --strictPort` corriendo en WSL.
2. En **Windows**, abre **PowerShell como administrador** y ejecuta:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/quest-vr-setup.ps1
   ```
   El script detecta la IP de WSL2, crea el reenvío del puerto 5174 y abre el
   firewall. Te imprime la URL (`https://<IP-Wi-Fi-del-PC>:5174/`).
3. (Prueba) Abre esa URL en el navegador del **PC**: si carga, el reenvío va bien.
4. En el **Quest** abre el navegador y entra a esa misma URL; acepta el aviso de
   certificado y pulsa **ENTER VR**.

Para deshacerlo: `scripts/quest-vr-remove.ps1` (como administrador). Vuelve a
ejecutar el de *setup* tras reiniciar el PC o WSL (la IP de WSL cambia).

### Alternativa por **cable USB** (independiente de la Wi-Fi)

Más robusta: no depende de la red ni de IPs. Usa `adb reverse` para tunelizar
el puerto por el cable. El Quest abre `https://localhost:5174/`.

Requisitos (una vez):
- **Modo Desarrollador** en el Quest (app móvil Meta Quest → tu dispositivo →
  Modo desarrollador → ON; requiere una cuenta/organización de desarrollador).
- **adb** en Windows: `winget install Google.PlatformTools`.
- Haber corrido `scripts/quest-vr-setup.ps1` una vez (crea el puente
  `127.0.0.1:5174 → WSL` que usa adb; ese puente apunta a WSL, no a la Wi-Fi).

Cada vez:
1. Conecta el Quest por **USB-C** (cable de datos) y acepta *"Permitir
   depuración USB"* dentro de las gafas.
2. En Windows (no necesita admin):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/quest-vr-usb.ps1
   ```
3. En el navegador del Quest abre **`https://localhost:5174/`**, acepta el
   certificado y pulsa **ENTER VR**.

### Controles en VR
- **Menú dentro de la VR**: al entrar aparece un panel flotante (el panel HTML no
  se ve en modo inmersivo). Apúntalo con el **rayo del mando** y pulsa el
  **gatillo** sobre un botón para: cambiar **orbital** (◀ ▶), **especie** (◀ ▶),
  activar **Iso / Puntos / Cortes / Sonda**, subir/bajar el **nivel iso**, y
  **Tamaño −/+** y **Recentrar** (vuelve a colocar el orbital a tamaño cómodo
  frente a ti — útil si quedas "dentro" de una nube grande).
- **Botón A/X o B/Y**: mostrar/ocultar el menú.
- **Joystick izquierda/derecha**: orbital anterior/siguiente.
- **Gatillo (trigger)** apuntando *fuera* del menú: mueve la **sonda** al punto
  frente al mando (solo en hidrógeno con la sonda activada).
- **Grip (botón lateral)** con **un** mando: agarrar y **rotar/mover** el orbital
  (los ejes y la rejilla se mueven con él).
- **Grip con los dos** mandos: **escalar** (acercar/alejar los mandos) y desplazar.
- Al entrar en VR y al cambiar de orbital, la escena se **ajusta automáticamente**
  a un tamaño cómodo y se centra frente a ti.

## Controles en el computador

- **Ratón**: orbitar (clic izq.), desplazar (clic der.), zoom (rueda).
- **Panel "Controles"** (arriba a la derecha):
  - **Modelo**: hidrógeno / caja 1D / 2D / 3D.
  - **Especie (átomo)**: ¹H, ²H, ³H, He⁺, Li²⁺, Be³⁺.
  - **Orbital**: selección 1s … 4f.
  - **Visualización**: isosuperficie + nivel iso, nube de puntos + nº de puntos,
    cortes (planos XY/XZ/YZ), opacidad y resolución de malla.
  - **Sonda (r, θ, φ)**: actívala y mueve los deslizadores para ver el valor de
    ψ y |ψ|² en vivo y las mini-gráficas (abajo a la derecha).
  - **Caja**: números cuánticos n_x, n_y, n_z y dimensiones L.

## Notas físicas

- Unidades atómicas (radio de Bohr a₀ = 1); energías en eV
  (`E_n = −13.6·(μ/mₑ)·Z²/n²`). La carga **Z** contrae el orbital (∝1/Z) y escala
  la energía (∝Z²). La **masa reducida** μ = mₑ·M/(mₑ+M) da el **efecto
  isotópico**: ¹H, ²H y ³H (mismo Z=1) difieren ligerísimamente en energía y
  tamaño. La parte espacial de ψ se muestrea con una carga efectiva
  `Z_eff = Z·(μ/mₑ)` ya que ψ solo depende de esa combinación.
- Se usan **armónicos esféricos reales** → orbitales "de química"
  (s, p_x/p_y/p_z, d_z², d_xz, …). Color por signo de ψ: **rojo (+)** / **azul (−)**.
- Nodos: radiales `n−l−1`, angulares `l` (se indican en el panel de información).
- **Espín** (espín-orbital, Fase 1): `χ = ψ_nlm · σ` con σ = α (↑) ó β (↓). La
  parte de espín no depende de las coordenadas, así que **la forma 3D no
  cambia**; solo se añade mₛ = ±½, una flecha que representa Sz y la nota de que
  cada orbital aloja 2 e⁻ (Pauli → 2n² estados por capa). *(Pendiente Fase 2:
  estructura fina con acoplamiento espín-órbita y estados \|n,l,j,mⱼ⟩.)*
- Partícula en caja: `ψ ∝ sin(nπx/L)` por eje; energía `∝ (n_x/L_x)²+…`.

## Estructura del proyecto

```
src/
  main.js              # orquestador: estado, escena, reconstrucción, sonda
  core/
    scene.js           # renderer (WebXR), cámara, luces, OrbitControls, ejes/grid
    xr.js              # mandos VR: agarrar/rotar/escalar, sonda con gatillo
    colormap.js        # color por signo (±) y mapas viridis/divergente
  physics/
    constants.js       # a₀, factorial, polinomios de Laguerre
    hydrogen.js        # R_nl, armónicos esféricos reales, ψ, catálogo, energías
    species.js         # especies hidrogenoides (H/D/T, He⁺, Li²⁺, Be³⁺) y masa reducida
    box.js             # partícula en caja 1D/2D/3D, energías
    formulas.js        # ψ explícita: R_nl(r) y parte angular real (cos/sin) en HTML
    observables.js     # valores esperados ⟨r⟩, Δr, ⟨1/r⟩, r más probable, V(r)
    hybrid.js          # orbitales híbridos sp, sp², sp³ (combinaciones de 2s+2p)
    finestructure.js   # estructura fina: energía espín-órbita, |n,l,j,mⱼ⟩, densidad
  viz/
    field3d.js         # muestreo de un campo escalar en rejilla 3D
    isosurface.js      # marching cubes → malla (color por signo)
    mctables.js        # tablas estándar de marching cubes
    pointcloud.js      # nube de puntos por densidad |ψ|² (muestreo por rechazo)
    slices.js          # planos de color del valor de ψ
    probe.js           # sonda móvil (r, θ, φ)
    spin.js            # indicador de espín (flecha Sz) para el modo espín-orbital
    vrmenu.js          # panel de control dentro de la VR (canvas + rayo del mando)
    label3d.js         # etiqueta flotante (billboard) — lectura de la sonda en VR
    vrplots.js         # panel de gráficas R(r)/r²|R|²/angular dentro de la VR
    plots1d.js         # mini-gráficas R(r), r²|R|², angular
    boxviz.js          # render de caja 1D/2D/3D
  ui/
    panel.js           # panel de control (lil-gui)
    i18n.js            # textos en español
```
