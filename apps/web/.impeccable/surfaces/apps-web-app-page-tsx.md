---
version: 1
slug: "apps-web-app-page-tsx"
primary_target: "apps/web/app/page.tsx"
related_targets: []
---

# Landing y visor de LupA11y (`apps/web/app/page.tsx`)

**Modo:** Persuade. El instrumento que va dentro se comporta como Operate.
**Audiencia:** equipos de frontend y QA sujetos a la EAA, y también recruiters y tech leads. Las dos pesan igual.
**Acción:** pegar una URL y auditar. Como acción secundaria, llevarse LupA11y a la CI o al MCP.
**Prueba:** una auditoría real de `/demo`, rota a propósito y etiquetada como tal, más auditorías en directo.
**Restricciones:** WCAG 2.2 AA en todo y AAA en contraste de texto y foco; 44 px de objetivo táctil; prefers-reduced-motion. Solo tema oscuro, por brief.

**Historia de la dirección:**
- 2026-09-30: «Inspector de DevTools» (neón y cristal). Rechazada.
- 2026-10-01: «Señalética accesible». Rechazada por plana.
- 2026-10-01: «Galerada corregida». Rechazada el 2026-10-02: fuente «infantil», colores de imprenta con aspecto de IA y estructura sin cambios.
- 2026-10-02: «Fluid Optics & Organic Curves», brief escrito por el usuario. Fija la dirección: no hay sorteo.

## Direction contract

THESIS: la auditoría como óptica. LupA11y mira la web a través de lentes: todo es círculo, píldora o radio extremo, y el resultado se lee en anillos y burbujas que salen de la misma lente en la que se pegó la URL. Rechaza el contenedor cuadrado, el filete recto y la rejilla de tarjetas.

OWN-WORLD: zinc-950 profundo (#09090b) con superficies #111113, #18181b y #1f1f23; volumen por degradados radiales finos y brillos interiores (inset), nunca bordes duros ni neones. Los dos colores del logo, a petición del usuario (2026-10-03): azul #56c2f2 para lo interactivo y lo medido, verde #6be35a para progreso y gravedad, juntos solo en el iris cónico, el degradado de los botones y las lentes de fondo; la rampa ordinal de severidad es verde (#2f8a3c, #45b34f, #6be35a, #c8f7b6), validada. Geist y Geist Mono. Geometría: rounded-full y rounded-[3rem]; ninguna esquina a 90 grados. Separaciones por ondas suaves o espacio negativo.

STORY: quien llega pega su URL en el iris; la lente se expande y late mientras audita; al terminar se transforma en el anillo central del resultado y los hallazgos emergen como burbujas por gravedad. Baja al informe y recorre la captura con la ruta del tabulador en curva Bézier y la lupa. Entiende las tres fases por sus lentes, la normativa en una curva de fechas y se lleva el motor a sus cuatro salidas.

FIRST VIEWPORT: navegación en píldora flotante. A la izquierda, H1 en dos líneas («Auditoría de accesibilidad que pulsa Tab.»), entradilla de 18 palabras y el input iris: píldora gigante con la lente a la izquierda y el botón «Auditar una URL». A la derecha, el observatorio: tres anillos concéntricos con datos reales (fases, foco visible, hallazgos por severidad), el núcleo con el total y diez burbujas que flotan, una por hallazgo. Detrás, tres lentes translúcidas superpuestas que derivan despacio.

FORM: brief del usuario (sin concept-seed; un brief fijado gana al sorteo). Code-led. Firma: el morph iris → lente que late → anillo central (layoutId). Gramática de movimiento: springs (stiffness 100, damping 20), aparición escalonada desde scale 0.8, trazos que se dibujan, flotación lenta; todo estático con movimiento reducido. La lupa óptica se conserva.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Pendiente

- Dónde se despliega en público el motor: Vercel con Chromium serverless o un contenedor.
