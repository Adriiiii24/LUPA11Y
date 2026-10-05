# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript de punta a punta, en un monorepo con npm workspaces (decidido por el usuario el 2026-09-30):

- `packages/core`: el motor de auditoría (Playwright, axe-core y Gemini) y su contrato Zod.
- `packages/cli` y `packages/mcp`: adaptadores finos sobre el motor, para la GitHub Action y para el servidor MCP.
- `apps/web`: la landing y el visor de informes, en Next.js 16 App Router con Tailwind 4.

El brief pedía Next.js 15. Se usa la 16 porque es la versión actual (16.3.x) y la 15 ya es la anterior. La alternativa de hacer el motor en Python se ofreció y se descartó.

## Users

La landing tiene dos audiencias, con el mismo peso (confirmado por el usuario):

1. **Equipos de frontend y QA de e-commerce y de sectores regulados** (banca, transporte, telecomunicaciones), sujetos al Acta Europea de Accesibilidad. Su trabajo es saber qué falla en su web, por qué y cómo arreglarlo, y llevarlo a la CI o a su editor con IA.
2. **Recruiters y tech leads que evalúan al autor.** LupA11y es un proyecto de portfolio de un AI engineer, y la herramienta sirve de prueba de su perfil: arquitectura de agente, determinismo frente a visión y MCP.

## Product Purpose

LupA11y audita la accesibilidad real de una URL en tres tipos de fase: reglas y mediciones deterministas, un agente y un modelo de visión.

1. **Determinista:** axe-core dentro de un Chromium con Playwright, y después la página a 320 px de ancho y con el espaciado de texto de WCAG 1.4.12 (fase «zoom y espaciado», añadida el 2026-10-04).
2. **Agente de teclado:** pulsa `Tab` de verdad, traza el orden del foco, detecta trampas y mide si el foco se ve. El rol y el nombre de cada parada salen del árbol de accesibilidad de Chromium.
3. **Visión:** Gemini juzga lo que las reglas no pueden decidir, como si un `alt` describe de verdad la imagen o si un indicador de foco débil se percibe. Trabaja en paralelo con el agente.

Devuelve un informe con un JSON estricto: hallazgos por severidad, el fragmento exacto, la captura recortada y un diff de corrección.

El éxito tiene dos caras. Un equipo pega su URL y sale con una lista de arreglos accionables que axe solo no le habría dado. Quien evalúa el portfolio entiende la arquitectura del agente en menos de un minuto.

## Positioning

axe-core, Lighthouse y WAVE solo leen el DOM. LupA11y además **recorre** la página con el teclado y **mira** el resultado. Mide el foco píxel a píxel entre el estado enfocado y el no enfocado (WCAG 2.4.7 y 2.4.13), traza la ruta real del tabulador y deja a un modelo de visión solo los casos que las matemáticas no pueden cerrar. Además, el mismo motor se distribuye como web, como GitHub Action y como servidor MCP.

## Operating Context

- Se usa pegando una URL en la web, desde la CI de GitHub (el workflow falla por encima de una severidad dada) o desde Cursor y Claude Code a través de MCP.
- La normativa: el Acta Europea de Accesibilidad (Directiva (UE) 2019/882) **se aplica desde el 28 de junio de 2025**. En España la transpone la Ley 11/2023. La norma técnica es la EN 301 549, que remite a WCAG 2.1 AA. El brief hablaba de «antes de la entrada en vigor», pero a fecha de hoy ya está en vigor.

## Capabilities and Constraints

- Fases: axe-core (reglas WCAG 2.0, 2.1 y 2.2 A/AA más buenas prácticas), zoom y espaciado (WCAG 1.4.10 y 1.4.12), el agente de teclado (`Tab`, `Shift+Tab` y `Escape`) y la visión con Gemini (modelo configurable).
- Para la CI: varias páginas o un sitemap, una línea base para fallar solo por lo que empeora, SARIF para la pestaña de seguridad de GitHub y un comentario en la pull request. Para el MCP: la segunda auditoría de una URL dice qué cambió. En la web: el informe se descarga (JSON, SARIF, Markdown) y, si el despliegue lo activa, se comparte con un enlace que caduca.
- Las auditorías tras un login son posibles desde la CLI (sesión de Playwright o cabeceras que solo viajan al origen auditado); la web pública no las ofrece.
- El análisis es solo de lectura: durante el recorrido con teclado se bloquean las peticiones que no son GET y las navegaciones fuera de la página. El agente nunca envía formularios.
- La web pública solo audita hosts públicos (con protección contra SSRF). La CLI y el MCP pueden auditar `localhost`, porque corren en la máquina del usuario.
- Sin `GEMINI_API_KEY`, la fase de visión se marca como omitida y el resto del informe sigue siendo válido.
- Límite honesto: una auditoría automática no certifica el cumplimiento. Detecta una parte de los problemas y el resto requiere revisión humana.
- Queda por decidir dónde se despliega. Hay un `Dockerfile` listo y es la opción recomendada, porque la API es un proceso de larga vida (navegador compartido, cuota en memoria, streaming). Vercel exigiría Chromium serverless y llevar la cuota y los informes guardados a servicios externos.
- Los paquetes (`@lupa11y/core`, `@lupa11y/cli`, `@lupa11y/mcp`) están listos para publicarse en npm; publicarlos es decisión y cuenta del autor.
- La interfaz y los mensajes del motor siguen en español (compromiso de marca). Una versión en inglés para el mercado europeo amplio queda como decisión pendiente.

## Brand Commitments

- Nombre: **LupA11y**. Tagline, en inglés: *Agentic Accessibility Auditing: Deterministic Precision meets Visual Intelligence.*
- La dirección visual es **«Fluid Optics & Organic Curves»**, definida por el propio usuario en un brief el 2026-10-02:
  - Fondo zinc-950 profundo, un solo acento iris y una rampa de severidad en el mismo tono. Solo tema oscuro. Desde el 2026-10-03 la paleta combina los dos colores del logo, muestreados y suavizados: azul #56c2f2 para lo interactivo y lo medido, verde #6be35a para progreso y gravedad, y los dos juntos en el iris, los botones y las lentes de fondo. Antes: azul #8bbcf2 solo y, brevemente, verde solo.
  - Todo es círculo, píldora o radio extremo: ninguna esquina a 90 grados. El volumen sale de degradados radiales finos y brillos interiores, no de bordes duros ni neones.
  - El input de la URL es un «iris» en píldora cuya lente se transforma (layoutId) en la lente que audita y luego en el núcleo de los anillos de resultados. Los resultados se leen en anillos concéntricos con datos reales y burbujas por gravedad.
  - Tipografía: Geist y Geist Mono.
  - Movimiento con springs (stiffness 100, damping 20), escalonado y siempre estático con movimiento reducido.
  - Historial: «Neo-Glass» (rechazada por genérica), «Señalética accesible» (por plana) y «Galerada corregida» (fuente «infantil», colores de imprenta con aspecto de IA y estructura sin cambios). No se reintroduce nada de ellas salvo la lupa.
- El fracaso, en palabras del usuario: que parezca una plantilla SaaS, que pierda legibilidad o que sea un mero cambio de colores y fuentes sobre la misma estructura.
- Sin eyebrows y sin rayas largas en los textos.
- La lupa óptica sigue siendo la interacción firma, ahora como una esfera de cristal.
- La interfaz está en español, con la tagline en inglés.

## Evidence on Hand

- No hay clientes, testimonios ni métricas de uso. No se inventan.
- La prueba es el propio motor. La landing enseña una auditoría **real** de una página de demostración rota a propósito, servida por la propia app y etiquetada como tal, y permite auditar cualquier URL pública en directo.
- Datos legales verificados el 2026-09-30:
  - Fecha de aplicación: 28/06/2025.
  - Régimen sancionador: el de la legislación sectorial, que para la Ley 11/2023 es el del RDL 1/2013, con multas de 301 € a 1.000.000 € (leves hasta 30.000 €, graves hasta 90.000 €).
  - Las microempresas de servicios (menos de 10 personas y hasta 2 M€) están exentas.
  - Los servicios existentes tienen transición hasta el 28/06/2030.

## Product Principles

1. **Primero lo determinista.** Lo que se puede medir se mide, y el modelo de visión solo decide lo que la medición no cierra. Cada hallazgo dice de qué fase sale.
2. **Cada hallazgo trae su arreglo.** Selector, fragmento, captura y diff. Un problema sin corrección propuesta está a medias.
3. **Nunca romper lo auditado.** Solo lectura, sin envíos ni navegaciones, y con límites de tiempo.
4. **Honestidad sobre el alcance.** No se promete cumplimiento, se enseña evidencia.
5. **Un motor y tres salidas.** Web, CI y MCP comparten el mismo esquema, y ninguna salida reimplementa el motor.

## Accessibility & Inclusion

Un auditor de accesibilidad inaccesible se refuta a sí mismo. Objetivos:

- WCAG 2.2 AA en toda la interfaz propia y AAA donde es alcanzable en una interfaz entera: contraste de texto de 7:1, foco visible según 2.4.13, objetivos táctiles de 44 px.
- La lupa y todo lo que se activa con el ratón tiene un equivalente con teclado.
- `prefers-reduced-motion` se respeta.
- La página de demostración rota a propósito es la única excepción. Está marcada como tal y queda fuera del sitemap.

El W3C no recomienda exigir AAA a un sitio entero como política general. Por eso el objetivo es AA completo más AAA en contraste y foco.
