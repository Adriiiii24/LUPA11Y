---
name: LupA11y
description: "Auditoría de accesibilidad como óptica. La web se mira a través de lentes: círculos, píldoras y radios extremos sobre un zinc profundo, con los dos colores del logo: un azul y un verde."
colors:
  bg: "#09090b"
  raised: "#111113"
  surface: "#18181b"
  surface-2: "#1f1f23"
  text: "#fafafa"
  text-muted: "#b4b4bc"
  iris: "#6be35a"
  iris-strong: "#c8f7b6"
  azure: "#56c2f2"
  azure-strong: "#bfeaff"
  azure-deep: "#3b8fc4"
  cta: "#9cf08a"
  cta-from: "#8fdcf9"
  cta-hover: "#b8f5a8"
  cta-hover-from: "#b9ecfc"
  on-cta: "#09090b"
  sev-low: "#2f8a3c"
  sev-medium: "#45b34f"
  sev-high: "#6be35a"
  sev-critical: "#c8f7b6"
  capture-ink: "#09090b"
  capture-mark: "#1565c0"
  capture-stitch: "#56c2f2"
  capture-route: "#0f7a26"
  capture-glow: "#6be35a"
  pupil: "#0b0d12"
  pupil-rim: "#0c2c34"
  teal-shade: "#1f8f7a"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 1.4rem + 3.6vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  display-close:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "'ss01', 'cv11'"
  ui:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  data-core:
    fontFamily: "Geist Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "clamp(2.25rem, 1.6rem + 2vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\" 1"
  data:
    fontFamily: "Geist Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  code:
    fontFamily: "Geist Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.85
    fontFeature: "\"tnum\" 1"
rounded:
  full: "9999px"
  shell-xl: "3rem"
  shell-lg: "2.5rem"
  shell-md: "2.25rem"
  shell: "2rem"
  inset-lg: "1.75rem"
  inset: "1.5rem"
  inset-sm: "1.25rem"
  crop: "1rem"
  capture: "8px"
  capture-sm: "6px"
spacing:
  page-x: "16px"
  page-x-sm: "24px"
  container: "84rem"
  header-max: "70rem"
  header: "64px"
  hero-top: "128px"
  section: "112px"
  section-lg: "144px"
  band: "96px"
  band-lg: "128px"
  column-gap: "40px"
  dock-gap: "12px"
  panel-pad: "28px"
  panel-pad-lg: "40px"
  target: "44px"
  target-lg: "56px"
components:
  button-cta:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 28px"
    height: "56px"
  button-cta-hover:
    backgroundColor: "{colors.cta-hover}"
    textColor: "{colors.on-cta}"
  button-cta-header:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "48px"
  button-cancel:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "0 28px"
    height: "56px"
  pill-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  input-iris:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.data}"
    rounded: "{rounded.full}"
    padding: "8px"
    height: "72px"
  tab-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "4px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  tab-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
  toggle-severity:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  toggle-severity-pressed:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
  option-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-muted}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "48px"
  option-pill-checked:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
  finding-bubble:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.data}"
    rounded: "{rounded.full}"
  finding-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.inset-lg}"
    padding: "16px"
  finding-row-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.inset-lg}"
  finding-number:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.data}"
    rounded: "{rounded.full}"
    size: "36px"
  selector-chip:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.azure-strong}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  badge-current:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.on-cta}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.shell-md}"
  panel-raised:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.shell-lg}"
    padding: "40px"
  code-block:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    rounded: "{rounded.inset-lg}"
  nav-pill:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    height: "64px"
  capture-box:
    backgroundColor: "transparent"
    rounded: "{rounded.capture}"
  placard:
    backgroundColor: "{colors.capture-ink}"
    textColor: "{colors.text}"
    rounded: "{rounded.inset-sm}"
    padding: "10px 16px"
  badge-new:
    backgroundColor: "{colors.azure-strong}"
    textColor: "{colors.on-cta}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  share-button:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  comparison-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.inset}"
    padding: "12px 20px"
---

# Design System: LupA11y

## Overview

**Creative North Star: "Fluid Optics"**

LupA11y mira la web a través de lentes. Todo lo que se toca es un círculo o una píldora, todo lo que contiene es un recipiente de radio extremo, y el resultado de una auditoría se lee en anillos concéntricos y burbujas que salen de la misma lente en la que se pegó la URL. El fondo es un zinc casi negro y la luz llega de dentro: degradados radiales finos, un canto interior blanco a muy baja opacidad y los dos colores del logo: el azul para lo interactivo y lo medido, y el verde para el progreso y la gravedad, con su rampa ordinal.

La página es serena y el instrumento es denso. El primer pantallazo pone el titular y el iris a la izquierda y el observatorio a la derecha, con tres lentes translúcidas que se cruzan en modo «pantalla» detrás y derivan muy despacio. El informe es una ventana redondeada con la captura real y un dock de pestañas en píldora, cosidos por una curva azul. Mientras audita, la captura y las cajas aparecen fase a fase; al terminar, el informe dice qué cambió frente a la auditoría anterior de la misma página y se puede llevar (JSON, SARIF, Markdown o enlace). Las secciones se separan por espacio negativo y por ondas suaves, nunca por un filete. El sistema es solo oscuro, por decisión del usuario.

El mundo se audita a sí mismo: texto a 15,7:1 o más sobre todas las superficies, texto secundario a 7,97:1 o más, verde a 10:1 y azul a 8,1:1 o más, aro de foco azul visible sobre cualquier superficie, objetivos de 44 px o más y ninguna información solo por tono o tamaño. Historia: Neo-Glass, Señalética accesible y Galerada corregida los rechazó el usuario (2026-10-01 / 2026-10-02) y no se reintroducen; de ellos solo sobrevive la lupa óptica.

**Key Characteristics:**
- Dos tonos con croma, los del logo: azul para lo interactivo y lo medido, verde (con su rampa ordinal de severidad) para el progreso y la gravedad; nada más tiene croma.
- Ninguna esquina a 90 grados: píldoras y círculos para lo interactivo, 1,75 a 3 rem para los recipientes.
- Volumen por luz interior (degradados radiales y cantos inset), no por bordes ni por neones.
- Geist para leer y titular; Geist Mono con cifras tabulares para lo que el motor mide o el usuario copia.
- Movimiento óptico: muelles suaves, aparición escalonada desde escala 0,8, trazos que se dibujan, flotación y deriva lentas; todo quieto con movimiento reducido.
- Firma: la lente única que viaja del iris al observatorio, late mientras audita y se convierte en el núcleo de los anillos.

## Colors

Zinc profundo en cuatro escalones, blanco cálido para leer y los dos colores del logo (muestreados y suavizados para que no sean neón): un azul y un verde. Cada uno tiene su oficio, y solo se juntan donde el logo los junta.

### Primary
- **Verde** (`iris`): progreso y gravedad. Anillo de severidad, burbujas, ruta del tabulador, puntos de las listas de datos, «+» de los diffs y el reflejo derecho de las esferas. 12:1 sobre `bg` y 10:1 o más sobre todas las superficies, así que también vale como texto.
- **Iris claro** (`iris-strong`): el iris en su punto más luminoso, una menta. «Tab.» en el H1, selectores en Mono, la cota «0 px²» y la pupila exterior de las lentes. 16,5:1 sobre `bg`.
- **Azul** (`azure`, `azure-strong`, `azure-deep`): lo interactivo y lo que se mide. Aro de foco, caret, subrayado de los enlaces, anillo de fases, anillo de foco visible (`azure-strong`) y débil (`azure-deep`), filas activas del informe, cajas de hallazgos y la costura. 9,85:1 sobre `bg` y 8,13:1 sobre `surface-2`.
- **Luz de botón** (`cta-from` → `cta`, en hover `cta-hover-from` → `cta-hover`): el degradado azul→verde del logo que rellena la acción principal, «En vigor» y las opciones marcadas, siempre con texto `on-cta` (13:1 en el extremo azul, 14,4:1 en el verde).

### Rampa ordinal de severidad
- **Baja** (`sev-low`), **Media** (`sev-medium`), **Alta** (`sev-high`), **Crítica** (`sev-critical`): un solo tono verde (≈146° a 137° en OKLCH) con luminosidad monótona (56 %, 68 %, 82 %, 93 %). Pasó el validador ordinal; el extremo bajo da 4,57:1 sobre `bg` y 3,77:1 sobre `surface-2`, válido para gráfico, no para texto. Se usa en el anillo interior, en el tono y el canto de las burbujas y en la lente de la etiqueta de severidad. `sev-high` y `sev-critical` comparten valor con `iris` e `iris-strong` a propósito: la rampa es el propio iris.

### Tintas fijas de la captura
- **Tinta**, **marca**, **costura**, **ruta** y **resplandor** de captura (`capture-ink`, `capture-mark`, `capture-stitch`, `capture-route`, `capture-glow`): lo que se pinta sobre la página auditada, siempre con halo blanco porque la página puede ser clara. Las cajas de hallazgos van en azul (`capture-mark`, 5,3:1 sobre la crema de la demo) y la ruta del tabulador en verde (`capture-route`, 5,1:1), así cada capa tiene su color además de su forma.

### Neutral
- **Fondo** (`bg`): el lienzo, la cara interior de los bloques de código y el núcleo de los anillos.
- **Elevado** (`raised`): la cabecera en píldora (al 85 % con desenfoque), la banda de normativa, el pie, el panel de fase y los satélites del motor.
- **Superficie** (`surface`): las ventanas del informe, el iris, la lista de pestañas, los toggles, el comprobador y las esferas.
- **Superficie 2** (`surface-2`): estado pulsado o activo dentro de una superficie, opciones sin marcar y el botón «Cancelar».
- **Texto** (`text`): 19,06:1 sobre `bg`, 16,97:1 sobre `surface`, 15,74:1 sobre `surface-2`.
- **Texto secundario** (`text-muted`): entradillas, ayudas, metadatos, pestañas inactivas, la segunda línea del H1. 9,66:1 sobre `bg` y 7,97:1 en el peor caso (`surface-2`).

### Lente
- **Pupila** (`pupil`), **borde de pupila** (`pupil-rim`) y **sombra turquesa** (`teal-shade`): el interior de las lentes (el iris del campo, la lente que audita y el núcleo de los anillos). No son acentos: son el fondo de un cristal.

### Una sola fuente
Los colores viven en dos sitios por necesidad y se comprueban entre sí. Las clases de Tailwind leen las variables de `app/globals.css`; lo que no puede ser una clase (estilos en línea, atributos de SVG, la tarjeta de Open Graph) sale de `components/palette.ts`. Para las transparencias hay variables de canales (`--azure-rgb`, `--iris-rgb`, `--bg-rgb`…) que se usan como `rgb(var(--azure-rgb) / 0.3)`, y `tint()` hace lo mismo desde la paleta. Un test (`apps/web/test/unit/palette.test.ts`) falla si las dos fuentes dejan de coincidir. Las tintas de la captura viven aparte, en `components/observatory/model.ts`, porque no siguen el tema. El blanco y el negro con transparencia son luz y sombra, no paleta, y se escriben tal cual.

### Named Rules
**The Two Lenses Rule.** Solo hay dos tonos con croma, los del logo: azul para lo interactivo y lo medido, verde para progreso y gravedad. Se juntan solo en el iris (degradado cónico), en la luz de los botones y en las lentes de fondo. Tienen casi la misma luminosidad (1,2:1 entre ellos), así que nunca distinguen información por sí solos: un estado nuevo se dice con luminosidad, forma, número o texto.

**The Never-Tone-Alone Rule.** La severidad nunca se transmite solo por tono o tamaño. Cada burbuja es un botón numerado con su gravedad y su título en el nombre accesible; cada etiqueta lleva el nombre; cada toggle, su nombre y su recuento.

**The Light Button Rule.** La acción principal es luz: el degradado azul→verde con texto `on-cta`. Ni el azul ni el verde se usan como color de texto sobre ella.

**The Fixed Capture Rule.** Sobre la captura solo van las tintas fijas de captura, con halo blanco, porque la captura siempre es la página auditada y no el tema.

## Typography

**Display Font:** Geist (con ui-sans-serif, system-ui)
**Body Font:** Geist (con ui-sans-serif, system-ui), con `ss01` y `cv11`
**Label/Mono Font:** Geist Mono (con ui-monospace, Cascadia Mono, Consolas)

**Character:** Una grotesca neutra y precisa, apretada en los titulares con tracking negativo y pesos medios; la Mono comparte esqueleto y se reserva para las cifras y el código, con números tabulares.

### Hierarchy
- **Display** (600, `clamp(2.6rem, 1.4rem + 3.6vw, 4rem)`, 1.04, -0.04em): solo el H1, en dos líneas, la segunda en `text-muted` con «Tab.» en `iris-strong`.
- **Display de cierre** (600, hasta 3.5rem, 1.02, -0.04em): el H2 dentro de la esfera del cierre.
- **Headline** (600, `clamp(2rem, 1.4rem + 2vw, 3rem)`, 1.05, -0.035em): el H2 de cada sección.
- **Title** (600, hasta 2rem, 1.25, -0.03em): títulos de fase. **Title pequeño** (600, 1.25rem, -0.02em): el título del comprobador.
- **Lead** (400, 1.125rem; 1.25rem en el hero desde 640 px; 1.625): entradillas en `text-muted`, de 34 a 58ch.
- **Body** (400, 1.0625rem, 1.6): texto base; párrafos con `text-wrap: pretty` y titulares con `balance`.
- **UI** (500, 0.9375rem): navegación, pestañas, opciones y botones de la cabecera.
- **Label** (400 o 500, 0.875rem): etiquetas de campo, ayudas, leyendas y metadatos.
- **Data core** (Mono 500, hasta 3.25rem, 1, -0.04em): el total del núcleo de los anillos.
- **Data / Code** (Mono 400 a 500, 0.8125rem; 0.75rem en selectores y fragmentos; código a 24 px de interlínea): URLs, selectores, tiempos, recuentos, números de hallazgo y parada, código y diffs.

### Named Rules
**The Measured-Is-Mono Rule.** Lo que el motor mide o el usuario copia va en Geist Mono con cifras tabulares. La prosa nunca va en Mono.

**The Sentence Case Rule.** No hay mayúsculas con tracking en ninguna parte: ni rótulos sobre los titulares ni etiquetas de categoría. Un titular abre su sección solo.

## Layout

Contenedor de 84 rem con márgenes de 16 px (24 px desde 640 px) y rejilla de 12 columnas desde 1024 px. La cabecera es una píldora flotante de 64 px de alto y 70 rem de ancho máximo, separada del borde por 12 a 16 px. El hero ocupa el alto de la ventana: 7 columnas para el titular, la entradilla y el iris (hasta 40 rem), 5 para el observatorio (hasta 34 rem), con 40 px de separación; en estrecho, el observatorio va debajo y las lentes de fondo bajan con él sin cruzar el titular.

El informe parte 7fr / 5fr (captura y dock) a una altura de `min(48rem, 100dvh - 9rem)`, con 8 a 12 px entre ventanas; en estrecho, la captura primero. Las secciones van a 112 px de acolchado vertical (144 px desde 1024 px); la banda de normativa, a 96 / 128 px sobre `raised`, abierta y cerrada por ondas. Fases parte 5/7 (lentes y panel), normativa y motor 5/7 o 7/5. Cabecera de sección: titular y entradilla en hasta 42 rem, con 16 px entre ellos y 40 a 80 px hasta el bloque siguiente.

**The Wave-Or-Space Rule.** Dos zonas se separan por espacio negativo, por un velo en degradado hacia `bg` o por una onda (`raised` dibujada como curva). Nunca por un filete recto.

## Elevation & Depth

Profundidad por luz, no por apilado. Las superficies se distinguen por cuatro escalones de zinc y se modelan con degradados radiales (luz arriba a la izquierda, reflejo iris abajo) y cantos interiores blancos a muy baja opacidad. Las sombras exteriores son largas, negras y muy difusas, y solo las llevan los objetos que flotan. Los halos iris son luz que emite una lente: rodean lentes, burbujas, anillos, marcas de la captura y el botón del cierre, y nunca el texto.

### Shadow Vocabulary
- **Canto** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 0 0 1px rgb(255 255 255 / 0.055)`): el borde de toda superficie, pastilla y lista de pestañas.
- **Canto fuerte** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(255 255 255 / 0.09), 0 24px 60px -32px rgb(0 0 0 / 0.9)`): lo que flota: cabecera, comprobador, panel de fase.
- **Esfera** (degradados radiales de luz blanca al 9 % y reflejo iris al 12 % sobre `surface`, con canto, sombra interior inferior y `0 30px 70px -36px rgb(0 0 0 / 0.95)`): la pestaña activa, el núcleo del motor y la esfera del cierre.
- **Lente iris** (pupila `pupil`, iris en degradado cónico azul→verde→azul, brillo especular, más `0 0 0 6px rgb(var(--azure-rgb) / 0.06), -6px 10px 30px -12px rgb(var(--azure-rgb) / 0.55), 6px 10px 30px -12px rgb(var(--iris-rgb) / 0.55)`): la lente del campo, la que audita y la fecha vigente.
- **Halo de foco del campo** (`0 0 0 2px var(--azure), -24px 0 60px -16px rgb(var(--azure-rgb) / 0.5), 24px 0 60px -16px rgb(var(--iris-rgb) / 0.5)`): el iris cuando tiene el foco, azul a la izquierda y verde a la derecha.
- **Foco** (`outline: 2px solid var(--azure); outline-offset: 3px`): todo lo enfocable; dentro de un contenedor con scroll, `-3px` o un anillo superpuesto (`inset 0 0 0 2px var(--azure)`) que hereda el radio.

### Named Rules
**The Inner Light Rule.** Una superficie nueva recibe el canto (o el canto fuerte si flota). Nunca un borde sólido.

**The Halo-Not-Neon Rule.** El resplandor iris es luz de una lente o de una marca. No hay `text-shadow`, ni halos alrededor del texto, ni bordes luminosos saturados.

## Shapes

Ninguna esquina a 90 grados. Todo lo interactivo es píldora o círculo (`rounded.full`): botones, campo, pestañas, toggles, opciones, chips de selector, enlaces de la cabecera, burbujas, paradas y números. Los recipientes van de 1,75 a 3 rem (la esfera del cierre a 3 rem, que en ancho se vuelve círculo; paneles a 2,5 rem; ventanas del informe a 2 / 2,25 rem; filas de hallazgo y bloques de código a 1,75 rem); lo anidado dentro de ellos baja a 1,25 a 1,5 rem, siempre menos que su contenedor; los recortes de la página auditada, a 1 rem. Solo lo dibujado sobre la captura baja a 6 u 8 px, para no deformar el elemento que señala. Los bordes con scroll se funden con una máscara en degradado en vez de cortarse en recto.

El estilo de línea es semántico: continua para axe, doble para zoom y espaciado, punteada para teclado y discontinua para visión (cajas de la captura y leyenda); la doble va a 3 px (4 px la activa), porque más fina se pinta como continua. El punteado o discontinuo también marca lo omitido (fase saltada en el anillo y en su lente). Las curvas pasan por sus puntos como Catmull-Rom convertido a Bézier: la ruta del tabulador, la curva de fechas y la costura del informe.

## Components

### Buttons
Luz que se puede pulsar.
- **Shape:** píldora (`rounded.full`).
- **Primary:** relleno `cta`, texto `on-cta` en 500 con flecha Phosphor a la derecha, brillo interior superior blanco al 60–70 %; 56 px en el iris y el cierre, 48 px en la cabecera. Se llama siempre «Auditar una URL».
- **Hover / Focus:** hover a `cta-hover` en 200 ms; al pulsar, escala 0,98. Foco: aro azul de 2 px a 3 px de separación.
- **Cancelar:** mientras audita, el mismo botón pasa a `surface-2` con canto y «Cancelar». Es el mismo elemento, así que el foco no se pierde al pulsar «Auditar»; y Enter en el campo no cancela una auditoría en marcha.
- **Acciones del informe:** «Descargar JSON», «Descargar SARIF», «Copiar Markdown» y «Copiar enlace», en píldoras de 44 px con blanco al 6 % y texto `text`; al copiar, el icono pasa a la marca de hecho y el texto a «Copiado», que también se anuncia.
- **Fantasma:** enlaces de la cabecera, «Copiar» y acciones de fila: píldora transparente en `text-muted` que gana `rgb(255 255 255 / 0.06)` y `text` en hover; 44 px.

### Chips
- **Toggle de severidad:** píldora `surface` con canto, lente de severidad, nombre y recuento en Mono; pulsado a `surface-2`, apagado al 60 % de opacidad y tachado.
- **Opción del comprobador:** píldora `surface-2` de 48 px; marcada se llena de `cta` con texto `on-cta`; el foco del radio se pinta en la propia píldora.
- **Selector:** Mono 0.75rem en `azure-strong` sobre blanco al 6 %.
- **Datos del motor:** píldoras de blanco al 5 % con tiempos y versiones en Mono.
- **En vigor:** píldora de luz (`cta`) con texto `on-cta`.
- **Nuevo:** píldora `azure-strong` con texto `on-cta`, delante de la severidad de un hallazgo que no estaba (o tiene nodos nuevos) en la auditoría anterior de la misma página; su nombre accesible completo es «Nuevo desde la auditoría anterior».

### Cards / Containers
- **Corner Style:** 1,75 a 3 rem (ver Shapes).
- **Background:** `raised` para lo que vive sobre el fondo, `surface` para las ventanas de trabajo, `bg` para el interior de los bloques de código.
- **Shadow Strategy:** canto siempre; canto fuerte si flota (ver Elevation & Depth).
- **Border:** ninguno.
- **Internal Padding:** 24 a 40 px en paneles; 16 px en filas; 8 px de marco alrededor de la captura.

### Inputs / Fields
- **Style:** el iris. Píldora `surface` con luz radial arriba a la izquierda y canto; lente de 56 px a la izquierda, URL en Mono 1.0625rem y el botón dentro. Etiqueta visible encima y ayuda debajo en `text-muted`; en estrecho la píldora pasa a 2,25 rem y el botón baja a ancho completo.
- **Focus:** aparece el halo de foco del campo; la lente crece a 1,1 y su pupila se dilata a 1,55 con un aro azul; el campo gana un halo azul a la izquierda y verde a la derecha.
- **Error:** aro de 2 px en `iris-strong`, mensaje en línea en 500 con la lente de aviso, `role="alert"` y `aria-invalid`. El error se dice con texto, no con un color nuevo.

### Navigation
Píldora flotante de 64 px sobre `raised` al 85 % con desenfoque y canto fuerte: marca, cuatro enlaces fantasma desde 1024 px y el botón de luz.

**Logo.** La marca es la imagen proporcionada por el autor el 2026-10-02: dos lentes que se funden en una lupa, en degradado de cian a lima con resplandor, sobre fondo transparente (`components/brand/lupa11y-mark.png`, 128 px; favicon `app/icon.png` de 256 px y `app/apple-icon.png` de 180 px sobre `#09090b`). Va siempre a 32 px junto al nombre «LupA11y» en Geist 600, y es decorativa (`alt` vacío). El acento de la interfaz sale de su verde (2026-10-02); su cian, su azul y su lima se quedan solo dentro del logo. Las pestañas siguen el patrón APG (flechas, Inicio y Fin) como control segmentado en píldora sobre `surface`; la activa lleva una esfera que se desliza entre pestañas (`layoutId`, muelle rigidez 260, amortiguación 30). Los paneles con scroll pintan el foco en un anillo superpuesto que hereda su radio.

### Observatorio (firma)
Tres anillos concéntricos de 16 de grosor con extremos redondeados y datos reales: fases (lo omitido en puntos), foco visible y débil, y hallazgos por severidad en la rampa. El núcleo es una pupila oscura con el total en Data core. Alrededor orbitan las burbujas: una por hallazgo, de diámetro proporcional a la gravedad (1, 0,8, 0,64, 0,52), con su número en Mono, canto y halo del tono de su severidad, flotación propia y 44 px de área pulsable mediante un pseudoelemento. Debajo, una leyenda en texto que dice lo mismo que el dibujo, que es decorativo.

### La lente viajera
Una sola identidad (`iris-n`) recorre tres estados con `layoutId`: está en el campo, vuela al observatorio y late mientras audita (escala 1,035 y halo que respira), y al terminar se convierte en el núcleo de los anillos. Cada auditoría estrena una lente nueva. Alrededor de la lente que audita, un anillo con un tramo por fase (cinco: carga, axe-core, zoom y espaciado, teclado y visión) y debajo las mismas fases en píldoras con su estado en texto.

### Captura y costura
Ventana redondeada con la captura real y una máscara que la funde arriba. La captura llega en cuanto carga la página auditada, antes del resultado: mientras las fases siguen, las cajas aparecen fase a fase y el pie dice «Auditoría en curso: lo que ves es provisional». Hasta que llega, un hueco con la forma que tendrá. Cajas de 8 px en `capture-mark` con el estilo de línea de su fuente y halo blanco; la activa crece a 2,5 px (4 px la doble) con resplandor. La ruta del tabulador es una curva continua con halo blanco, resplandor y un punteado blanco que fluye en su sentido; la ruta va en `capture-route` y las paradas son círculos blancos numerados con aro verde. El rótulo del nodo activo es una pastilla `capture-ink` de 1,25 rem con selector en `azure-strong`. Una costura azul curva une la fila activa con su caja; se redibuja en cada fotograma mientras algo se mueve (scroll suave, filas que entran) y se para cuando lleva unos fotogramas quieta.

### Lupa óptica
La pieza heredada: un círculo de 188 px con refracción real (`feDisplacementMap`), brillo especular, viñeteado y montura de aros blanco y zinc con halo iris; sigue al puntero con un muelle (rigidez 520, amortiguación 42, masa 0,6).

### Lentes de fase
Tres lentes superpuestas de diámetro proporcional a la raíz cuadrada de la duración real de su fase (mínimo 30 %), que funcionan como pestañas APG. La activa se ilumina con iris y halo; la omitida es tenue con un aro discontinuo interior. La visión cuenta su tiempo de trabajo: lo que pasó esperando la cuota de Gemini se dice aparte en el resumen, debajo, junto a la carga y a zoom y espaciado.

### Comparación con la auditoría anterior
Si se vuelve a auditar la misma página, una banda `surface` de 1,5 rem con un aro azul al 30 % abre el informe: «Frente a la auditoría anterior de esta página: reglas resueltas · nuevas · empeoran · nodos arreglados · siguen igual», en una frase. Cada hallazgo nuevo lleva la píldora «Nuevo».

### Informe guardado
`/r/<id>` reutiliza el visor del informe sin el auditor. Arriba, la cabecera de siempre con los enlaces de vuelta a la portada; un titular Headline «Informe de accesibilidad de» con el host en `iris-strong`; la URL en Mono, la fecha y el recuento en una entradilla; y el botón de luz «Auditar otra URL». El pie del informe dice que caduca y no se indexa.

### Región viva
Hay una sola, invisible, en el observatorio: anuncia la fase en curso y, al terminar, el recuento por severidad y los cambios frente a la vez anterior. El registro se puede leer entero, pero no se anuncia línea a línea, y nada mueve la página por su cuenta: el registro solo se desplaza dentro de su propio panel.

### Movimiento
Muelles de rigidez 100 y amortiguación 20 para morfologías y entradas; aparición escalonada desde escala 0,8 y 28 px más abajo; arcos y rutas que se dibujan con `pathLength`; el H1 sube línea a línea desde su máscara (900 ms, `cubic-bezier(0.16, 1, 0.3, 1)`); los bloques emergen con el scroll (`view()`) donde hay soporte y, si no, ya están en su sitio. Lentes de fondo que derivan en 38 a 52 s y burbujas que flotan en 5,5 a 9 s. Con `prefers-reduced-motion` todo queda quieto en su estado final.

## Do's and Don'ts

### Do:
- **Do** dar a todo lo interactivo forma de píldora o círculo y a los recipientes radios de 1,75 a 3 rem.
- **Do** modelar las superficies con el canto, el canto fuerte, la esfera o la lente iris.
- **Do** usar el azul y el verde del logo (con la rampa del verde) como únicas luces de color, y `cta` con `on-cta` para la acción principal.
- **Do** sacar todo color de las variables de `globals.css` o de `components/palette.ts`, nunca de un literal en un componente.
- **Do** acompañar la severidad con su nombre, su número o su nombre accesible, siempre.
- **Do** distinguir la fuente por el estilo de línea: continua axe, doble zoom y espaciado, punteada teclado, discontinua visión.
- **Do** poner en Geist Mono con cifras tabulares todo lo que se mide o se copia.
- **Do** usar la tinta fija de captura con halo blanco para todo lo que se dibuja sobre la página auditada.
- **Do** separar zonas con espacio, velos u ondas.
- **Do** dar a todo objetivo táctil 44 px o más, con pseudoelemento si lo visible es menor.
- **Do** usar muelles de rigidez 100 y amortiguación 20 y dejarlo todo quieto con movimiento reducido.

### Don't:
- **Don't** reintroducir piezas de Neo-Glass, Señalética accesible ni Galerada corregida (neones, amarillo podotáctil, tintas CMYK, retícula visible, esquinas rectas, Bricolage Grotesque); solo la lupa óptica sigue viva.
- **Don't** dibujar una esquina a 90 grados ni un filete recto.
- **Don't** usar bordes sólidos para separar o delimitar; el canto es interior y casi transparente.
- **Don't** poner resplandores ni `text-shadow` al texto.
- **Don't** introducir un tercer tono con croma ni usar `sev-low` como color de texto.
- **Don't** mover la página por iniciativa propia ni anunciar cada línea del registro: la región viva dice fases y resultado.
- **Don't** transmitir severidad, fuente o estado solo con tono o tamaño.
- **Don't** poner rótulos en mayúsculas con tracking sobre los titulares.
- **Don't** crear un modo claro: el sistema es solo oscuro.
