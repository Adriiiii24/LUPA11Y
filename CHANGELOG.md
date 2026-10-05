# Cambios

Formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones con [SemVer](https://semver.org/lang/es/): mientras sea 0.x, una versión menor puede romper el contrato, y aquí se dice cuándo.

La GitHub Action se usa por su etiqueta mayor (`Adriiiii24/LupA11y@v0`), que siempre apunta a la última 0.x.

## [0.2.0] · 2026-10-05

### Añadido
- **Fase «Zoom y espaciado»** (WCAG 1.4.10 y 1.4.12): la página a 320 px de ancho y con el espaciado de texto de WCAG. Agrupa lo que se sale por el bloque que no se adapta, mide el texto que queda recortado y propone el CSS.
- **Comparación entre auditorías** con huellas estables por nodo: `--baseline` en la CLI y la Action (solo falla por lo que es nuevo o empeora), memoria por URL en el MCP y banda «frente a la auditoría anterior» con la marca «Nuevo» en la web.
- **SARIF 2.1.0** para el escaneo de código de GitHub (`--sarif`, `sarif-path`), con huellas que se mantienen entre ejecuciones.
- **CLI**: varias URL, `--sitemap` y `--max-pages` (la salida pasa a ser un lote), `--storage-state` y `--header` para páginas tras el login (las cabeceras solo viajan al origen auditado), `--no-layout`.
- **Action**: varias URL, sitemap, línea base, SARIF, comentario en la pull request, caché de Chromium, y Node solo si el del job no sirve.
- **MCP**: Chromium arrancado entre llamadas, comparación con la auditoría anterior de la misma URL y resumen estructurado (`structuredContent`).
- **Web**: la captura y los hallazgos llegan fase a fase mientras se audita; descarga en JSON y SARIF, copia en Markdown; enlaces permanentes opcionales (`/r/<id>`, `LUPA11Y_REPORTS_DIR`); tarjeta Open Graph, `robots.txt` y `sitemap.xml`.
- **Distribución**: `npm run pack:packages` compila los paquetes a JavaScript, los empaqueta y comprueba que se instalan y arrancan. `Dockerfile` para desplegar la web con su Chromium.
- **Visión con el plan gratuito de Google AI Studio**: espera lo que pide Google ante el límite por minuto, reintenta si el modelo está saturado, sigue con un modelo de reserva (`LUPA11Y_VISION_FALLBACK_MODEL`) si el principal agota su cuota diaria, ritmo fijo opcional (`LUPA11Y_VISION_RPM`) y tiempo de espera informado aparte (`waitedMs`).
- `LICENSE` (MIT) y este fichero.

### Cambiado
- **Contrato v2**: fase y fuente `layout`; eventos `capture`, `partial` y `saved`; `AuditBatch` para varias páginas; `waitedMs` opcional en las fases. Los informes de la v1 se leen con `parseReport`, que los migra.
- **Agente de teclado**: identifica cada parada por el nodo y no por el selector; el rol y el nombre salen del árbol de accesibilidad de Chromium; la medición del foco corre en paralelo al recorrido.
- **Visión**: sus tareas no tocan los hallazgos de otras fases y trabajan en paralelo con el agente de teclado (como mucho 4 consultas a la vez).
- **Recortes de evidencia**: en coordenadas de documento, sin desplazar la página y sin las capas fijas encima.
- **Landing**: las imágenes de la muestra se sirven aparte; pasa de 340 KB a unos 44 KB comprimida.
- **Paleta**: una sola fuente (`globals.css` y `components/palette.ts`), con un test que impide que se separen.
- Documentación: README, `docs/ARCHITECTURE.md` (su sección de desviaciones estaba desfasada), PRODUCT.md, DESIGN.md y `.env.example`.

### Corregido
- La landing tenía una infracción grave de axe: las listas de definición de «Integraciones» metían un adorno entre `dt` y `dd`.
- Auditar `/demo` desde la web cargaba sus imágenes rotas.
- La consola podía desplazar la ventana entera mientras se auditaba; ahora solo se mueve dentro de su panel.
- Cada línea del registro se anunciaba dos veces a los lectores de pantalla; ahora hay una sola región viva, por fases.
- Un Enter de más en el campo cancelaba la auditoría en marcha.
- La visión daba por hallazgo un `alt=""` en una imagen decorativa, que es lo correcto.
- Un foco pegado al borde de la ventana se medía de menos.
- Una línea `LUPA11Y_VISION_MODEL=` vacía en un `.env` dejaba la visión sin modelo.

### Seguridad
- **DNS rebinding**: en modo público, Chromium sale por un proxy local que resuelve cada host una vez y se conecta a la IP que validó. WebRTC solo puede salir por el proxy.
- **Cuota de la API**: solo se fía de la IP que declare un proxy de confianza (`LUPA11Y_CLIENT_IP_HEADER`, `LUPA11Y_TRUSTED_PROXIES`); añade un presupuesto global por proceso, y «ocupado» ya no gasta cuota.
- Los errores internos no llegan al cliente público; se registran en el servidor.

## 0.1.0 · 2026-09-30 (sin publicar)

### Añadido
- Motor con tres fases: axe-core en Chromium, un agente que recorre la página con el teclado y mide el foco píxel a píxel, y Gemini Vision para lo que las reglas no deciden.
- Contrato Zod único para la web, la CLI, la GitHub Action y el servidor MCP.
- Política de red con protección contra SSRF y modo de solo lectura durante el recorrido con teclado.
- Landing con la auditoría real de una demo rota a propósito.

[0.2.0]: https://github.com/Adriiiii24/LupA11y/releases/tag/v0.2.0
