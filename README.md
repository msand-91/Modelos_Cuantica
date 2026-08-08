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
2. **Átomos polielectrónicos** (H … Ar, con sus cationes y aniones) resueltos
   por **Hartree-Fock**: la función de onda es un **determinante de Slater** y
   los orbitales se optimizan con el **teorema variacional** (SCF).
3. **Moléculas**: **orbitales moleculares** como combinación lineal de orbitales
   atómicos (LCAO), con un catálogo de ~28 moléculas de geometría experimental.
4. **Densidad de carga y QTAIM** (teoría de átomos en moléculas de Bader):
   ρ(r), su laplaciano, la ELF, los puntos críticos de enlace, los caminos de
   enlace y las **cargas de Bader** por integración de las cuencas atómicas.
5. **Partícula en una caja** 1D, 2D y 3D, en coordenadas cartesianas.

Construido con **Three.js + WebXR** y **Vite**. Interfaz en español. Todo el
cálculo (integrales moleculares, SCF, topología de la densidad) está escrito
desde cero en JavaScript, sin dependencias de cálculo, y corre en un **Web
Worker** para no bloquear el render ni la VR.

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

Vite sirve por **HTTP simple en el puerto 5174** → `http://localhost:5174/`.
No hacen falta certificados: `localhost` (y `127.0.0.1`) es **contexto seguro**
para el navegador, así que **WebXR funciona** ahí sin HTTPS.

Recomendado: **Chrome** o **Edge** de escritorio.

## Ejecutar en las gafas Meta Quest

Para que aparezca el botón **ENTER VR** la página debe cargarse en un contexto
seguro. Con este servidor eso significa una de estas dos rutas:

| Ruta | URL en el Quest | Contexto seguro |
|---|---|---|
| **Cable USB** (`adb reverse`) | `http://localhost:5174/` | sí (`localhost`) |
| **Despliegue en Netlify** (Wi-Fi, o cualquier persona) | `https://quimcuant.netlify.app/` | sí (HTTPS) |

Abrir `http://<IP-del-PC>:5174/` por Wi-Fi **carga la página pero no da VR**: una
IP por HTTP no es contexto seguro. Para Wi-Fi, usa el despliegue.

### Preparar el puente Windows → WSL2 (una vez)

Si ejecutas la app dentro de WSL2, el Quest no puede alcanzar la IP interna de
WSL directamente. Hay que **reenviar el puerto** de Windows hacia WSL2:

1. Deja `npm run dev` corriendo en WSL (puerto 5174).
2. En **Windows**, abre **PowerShell como administrador** y ejecuta:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/quest-vr-setup.ps1
   ```
   El script detecta la IP de WSL2, crea el reenvío del puerto 5174 —incluido el
   puente `127.0.0.1` que necesita el modo USB— y abre el firewall.
3. (Prueba) Abre `http://localhost:5174/` en el navegador del **PC**: si carga,
   el reenvío va bien.

Para deshacerlo: `scripts/quest-vr-remove.ps1` (como administrador). Vuelve a
ejecutar el de *setup* tras reiniciar el PC o WSL (la IP de WSL cambia).

### Ver en el Quest por **cable USB** (recomendado en desarrollo)

No depende de la red ni de IPs. Usa `adb reverse` para tunelizar el puerto por
el cable; el Quest abre `http://localhost:5174/`.

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
3. En el navegador del Quest abre **`http://localhost:5174/`** y pulsa
   **ENTER VR**.

## Publicar (Netlify)

[netlify.toml](netlify.toml) define **cómo** se construye (`npm run build`,
publicando `dist/`), pero para que el despliegue sea automático el sitio de
Netlify tiene que estar **enlazado al repositorio**: en el panel, *Site
configuration → Build & deploy → Repository → Link repository*. Mientras
aparezca «Not linked», los push a GitHub **no** despliegan nada.

Con el repositorio enlazado, cada push a `main` publica solo. Sin enlazar, la
alternativa es arrastrar la carpeta `dist/` a la zona de *deploys* de Netlify.

La URL pública (HTTPS válido, apta para VR por Wi-Fi) es
<https://quimcuant.netlify.app/> y la guía queda en
<https://quimcuant.netlify.app/guia.pdf>. En local, `npm run build` y
`npm run preview`.

### Controles en VR
- **Menú dentro de la VR**: al entrar aparece un panel flotante (el panel HTML no
  se ve en modo inmersivo). Apúntalo con el **rayo del mando** y pulsa el
  **gatillo** sobre un botón para: cambiar **orbital** (◀ ▶), **especie** (◀ ▶),
  activar **Iso / Puntos / Cortes / Sonda**, subir/bajar el **nivel iso**, y
  **Tamaño −/+** y **Recentrar** (vuelve a colocar el orbital a tamaño cómodo
  frente a ti — útil si quedas "dentro" de una nube grande).
- **Botón A/X o B/Y**: mostrar/ocultar el menú.
- **Joystick izquierda/derecha**: orbital anterior/siguiente.
- En **átomo polielectrónico** y **molécula** los mismos controles cambian de
  **orbital molecular** (◀ ▶ de orbital) y de **molécula o elemento** (◀ ▶ de
  especie), sin repetir el cálculo SCF salvo que haga falta.
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
  - **Modelo**: hidrógeno / híbridos / átomo polielectrónico / molécula /
    caja 1D / 2D / 3D.
  - **Especie (átomo)**: ¹H, ²H, ³H, He⁺, Li²⁺, Be³⁺.
  - **Orbital**: selección 1s … 4f.
  - **Visualización**: isosuperficie + nivel iso, nube de puntos + nº de puntos,
    cortes (planos XY/XZ/YZ), opacidad y resolución de malla.
  - **Sonda (r, θ, φ)**: actívala y mueve los deslizadores para ver el valor de
    ψ y |ψ|² en vivo y las mini-gráficas (abajo a la derecha).
  - **Caja**: números cuánticos n_x, n_y, n_z y dimensiones L.
  - **Qué se dibuja** (átomo y molécula): el campo (orbital, ρ, −∇²ρ, ELF,
    densidad de espín) y el orbital concreto. Además del deslizador hay botones
    **◀ anterior / siguiente ▶** e **Ir al HOMO / Ir al LUMO**: cambiar de
    orbital no repite el SCF, solo vuelve a muestrear el campo.

Los orbitales se numeran **desde 1**, igual en el panel de la izquierda que en
los controles, y en un átomo se llaman *atómicos* (no «moleculares»). El panel
lista **todos** los orbitales ocupados; en capa abierta (UHF) separa las
columnas α y β, que tienen orbitales y energías distintos.

Los controles de **Visualización** solo redibujan: en átomos y moléculas no
relanzan el cálculo. La única excepción es *Resolución malla*, que obliga a
volver a muestrear el campo.

## Átomos polielectrónicos, moléculas y QTAIM

Estos tres modelos comparten el mismo motor: **Hartree-Fock-Roothaan** sobre una
base de gaussianas contraídas.

### Qué se calcula

1. **Base atómica**. Se parte de las **reglas de Slater** (ζ = (Z − σ)/n\*) para
   cada subcapa ocupada y se elige la forma de las funciones:
   - **STO-nG**: orbitales de Slater `r^(n−1) e^(−ζr)` ajustados por mínimos
     cuadrados a n gaussianas (el ajuste se hace en tiempo real; para el 1s con
     ζ=1 reproduce los exponentes clásicos 2.22766 / 0.405771 / 0.109818).
   - **Hidrogenoides**: las R_nl(r) exactas con carga efectiva de Slater,
     expandidas también en gaussianas.
   - **Gaussianas even-tempered** sin contraer: el SCF elige los coeficientes,
     y la energía se acerca mucho más al límite Hartree-Fock.

   Calidades: mínima, doble-ζ, con funciones **difusas** (necesarias para los
   aniones) y con **polarización**.

2. **Integrales moleculares** (solapamiento, cinética, atracción nuclear y
   repulsión bielectrónica) por el método de **McMurchie-Davidson**, con función
   de Boys, datos de pares precalculados y cribado de Schwarz.

3. **SCF**: RHF para capa cerrada y **UHF** para capa abierta (radicales, O₂,
   cationes y aniones), con DIIS, arranque GWH, desplazamiento de nivel y
   selección de la solución de menor energía entre varios arranques.

4. **Teorema variacional en vivo**: el botón *Optimizar ζ* recorre el parámetro
   de escala de los exponentes y dibuja la curva E(κ). En el helio da
   ζ ≈ 1.687, el clásico **27/16** de los libros de texto.

5. **Curva E(R)** para las diatómicas: mínimo, distancia de equilibrio y energía
   de disociación en la aproximación Hartree-Fock.

### QTAIM (átomos en moléculas)

De la densidad electrónica ρ(r) —con gradiente y hessiano **analíticos**— se
obtiene:

- **Puntos críticos** (∇ρ = 0) clasificados por los autovalores del hessiano:
  núcleos (3,−3), **enlaces** (3,−1), **anillos** (3,+1) y cajas (3,+3). Se
  comprueba la relación de Poincaré-Hopf `n − b + r − c = 1`.
- **Caminos de enlace** integrando el gradiente desde cada punto crítico.
- Indicadores en el punto crítico de enlace: ρ_b, ∇²ρ, elipticidad ε y las
  densidades de energía G, V y H, que distinguen enlace **compartido**
  (covalente) de **capa cerrada** (iónico). Ejemplos que se ven en la app: N₂
  con ρ_b ≈ 0.62 y ∇²ρ < 0; LiF con ρ_b ≈ 0.05 y ∇²ρ > 0; el C=C del etileno
  con ε ≈ 0.25 (carácter π) frente a ε ≈ 0.01 en los C–H.
- **Cargas de Bader**: integración de ρ en cada cuenca atómica siguiendo las
  trayectorias del gradiente. Para LiF da ≈ ±0.93 con base doble-ζ.
- Otros campos dibujables: **laplaciano** −∇²ρ (capas de concentración de
  carga), **ELF** (pares enlazantes y solitarios) y densidad de espín.

### Enlaces directos

La URL admite parámetros para abrir un sistema concreto:

```
?model=molecula&mol=H2O&campo=rho&qtaim=1
?model=atomo&elem=C&carga=0&base=dz
```

### Alcance y límites

- Elementos hasta Z = 20 (funciones s, p y d).
- Hartree-Fock **no incluye correlación electrónica**: la app muestra qué
  fracción del límite HF captura la base y recuerda que lo que falta hasta la
  energía exacta es justo la correlación.
- El coste de las integrales crece como N⁴: las moléculas del catálogo tardan
  entre milisegundos y unos segundos (el benceno, con 36 funciones, unos 8 s).

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
  style.css            # estilos de los paneles en pantalla
  core/
    scene.js           # renderer (WebXR), cámara, luces, OrbitControls, ejes/grid
    xr.js              # mandos VR: agarrar/rotar/escalar, sonda con gatillo
    colormap.js        # color por signo (±) y mapas viridis/divergente
    qcworker.js        # hilo de cálculo: SCF, campos 3D, QTAIM, Bader
    qcclient.js        # cliente con promesas del hilo de cálculo
  physics/
    constants.js       # a₀, factorial, polinomios de Laguerre
    hydrogen.js        # R_nl, armónicos esféricos reales, ψ, catálogo, energías
    species.js         # especies hidrogenoides (H/D/T, He⁺, Li²⁺, Be³⁺) y masa reducida
    box.js             # partícula en caja 1D/2D/3D, energías
    formulas.js        # ψ explícita: R_nl(r) y parte angular real (cos/sin) en HTML
    observables.js     # valores esperados ⟨r⟩, Δr, ⟨1/r⟩, r más probable, V(r)
    hybrid.js          # orbitales híbridos sp, sp², sp³ (combinaciones de 2s+2p)
    finestructure.js   # estructura fina: energía espín-órbita, |n,l,j,mⱼ⟩, densidad
    atoms.js           # tabla periódica (Z≤20), configuraciones y reglas de Slater
    basis.js           # bases STO-nG / hidrogenoides / even-tempered (ajuste en runtime)
    gto.js             # integrales sobre gaussianas (McMurchie-Davidson, Boys)
    linalg.js          # matrices, Jacobi, ortogonalización canónica
    scf.js             # Hartree-Fock RHF/UHF con DIIS y desplazamiento de nivel
    qchem.js           # sistema completo: SCF + poblaciones + determinante de Slater
    molecules.js       # catálogo de moléculas con geometrías experimentales
    density.js         # ρ, ∇ρ, hessiano, G, V, H y ELF (analíticos)
    qtaim.js           # puntos críticos, caminos de enlace y cuencas de Bader
    variational.js     # optimización de ζ y curva E(R)
    optimize.js        # sección áurea y Nelder-Mead
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
    molecule.js        # núcleos, enlaces, puntos críticos, caminos y cuencas
    charts.js          # diagrama de niveles OM y curvas E(R) / E(κ)
  ui/
    panel.js           # panel de control (lil-gui)
    i18n.js            # textos en español
scripts/
  guia-datos.mjs       # ejecuta el motor y vuelca los datos de la guía (JSON)
  guia-figuras.py      # figuras de la guía (matplotlib)
  guia-pdf.py          # monta docs/guia.pdf
  quest-vr-*.ps1       # puente de red / USB de Windows hacia WSL2 para el Quest
public/
  guia.pdf             # guía de funcionamiento y divulgación (se publica)
docs/
  figs/                # figuras generadas
```

## Validación del motor de cálculo

Las piezas nuevas se han contrastado con valores publicados:

| Prueba | Resultado | Referencia |
|---|---|---|
| Integrales de H₂ (STO-3G, ζ=1.24, R=1.4 a₀) | S₁₂=0.6593, T₁₁=0.7600, (11\|11)=0.7746 | Szabo & Ostlund, tabla 3.x |
| H₂ RHF/STO-3G | −1.116714 Ha | −1.116714 Ha |
| He RHF/STO-3G | −2.807784 Ha | −2.807784 Ha |
| H₂O RHF/STO-3G (base tabulada) | −74.9630 Ha, Mulliken O −0.366 | ≈ −74.966, O ≈ −0.33 |
| Ajuste STO-3G del 1s (ζ=1) | α = 2.227654, 0.405771, 0.109817 | 2.22766, 0.405771, 0.109818 |
| ζ óptimo del He (variacional) | 1.6875 | 27/16 = 1.6875 |
| Cargas de Bader de LiF (doble-ζ) | ±0.95 | ≈ ±0.94 |
| Cargas de Bader de CO | ±1.22 | ≈ ±1.2 |
| Simetría de las cuencas (N₂, CH₄) | exacta: 0.000/−0.000 y los 4 H idénticos | por simetría |
| Topología del catálogo (27 moléculas) | n−b+r−c = 1 en **todas** (doble-ζ, nG=4) | Poincaré-Hopf |

Todos los átomos de H a Ar y las moléculas del catálogo convergen y respetan el
límite Hartree-Fock (E_SCF ≥ E_HF) en las cinco calidades de base.

La batería completa se regenera con:

```bash
node scripts/guia-datos.mjs          # energías, topología y cargas de todo el catálogo
```

### Límites detectados (y por qué)

- Con **base mínima** el máximo de densidad sobre algunos hidrógenos desaparece
  (HeH⁺, H₃O⁺, NH₄⁺): la expansión en pocas gaussianas no reproduce la cúspide,
  el átomo se queda sin cuenca y con ella se pierden su punto crítico de enlace y
  su camino. No es un fallo del buscador de puntos críticos sino de la base; la
  app lo detecta (Poincaré-Hopf ≠ 1) y sugiere subir a doble-ζ con nG ≥ 4.
- Las **cargas de Bader** dependen de la calidad de la base más de lo que sugiere
  su fama de robustez: en el metano, con estas bases pequeñas, el carbono sale
  ligeramente positivo mientras que con bases grandes la bibliografía da negativo.

## Guía en PDF

[public/guia.pdf](public/guia.pdf) (37 páginas) está organizada en tres partes:

1. **Manejar la aplicación** — cómo leer los colores y los marcadores de la
   escena, y **qué hace cada control**, modelo por modelo, con el nombre exacto
   que aparece en pantalla; termina con recetas del tipo «qué tocar para
   conseguir esta imagen».
2. **La física, modelo a modelo** — hidrógeno, híbridos, caja, estructura fina,
   átomo polielectrónico (Hartree-Fock desglosado paso a paso, reglas de Slater
   con ejemplos resueltos, SCF, correlación), moléculas y QTAIM.
3. **Referencia** — tabla de notación (qué es ζ, σ, n\*, ε…), validación y
   límites, guion de nueve demostraciones para divulgar y glosario.

Todas las figuras y tablas las calcula el propio motor. Se regenera con:

```bash
node scripts/guia-datos.mjs      # calcula todo (~1.5 min) → docs/guia-datos.json
python3 scripts/guia-figuras.py  # figuras (matplotlib)   → docs/figs/
python3 scripts/guia-pdf.py      # monta el documento     → public/guia.pdf
```
