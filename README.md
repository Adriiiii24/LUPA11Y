# LupA11y

**Agentic Accessibility Auditing: Deterministic Precision meets Visual Intelligence.**

LupA11y audita la accesibilidad real de una URL. Cada hallazgo sale en un JSON estricto, con su selector, su recorte y un diff de corrección.

1. **axe-core** dentro de Chromium (Playwright): reglas WCAG 2.2 A y AA, con los mensajes en español.
2. **Zoom y espaciado:** la página a 320 px de ancho (un zoom del 400 %) y con el espaciado de texto de WCAG 1.4.12. Mide qué bloques obligan a desplazarse en horizontal y qué textos quedan recortados.
3. **Agente de teclado:** pulsa `Tab` de verdad, traza el orden del foco y mide píxel a píxel si el foco se ve. También detecta trampas de teclado, focos tapados por capas fijas y controles que no responden a `Enter`. El rol y el nombre de cada parada salen del árbol de accesibilidad de Chromium: lo que anuncia un lector de pantalla.
4. **Gemini Vision** para lo que ninguna regla puede decidir: si el `alt` dice la verdad o si un foco débil se percibe. Trabaja en paralelo con el agente de teclado.

Se distribuye como **web**, **GitHub Action**, **servidor MCP** y **CLI**. Las cuatro usan el mismo motor y el mismo contrato Zod.

> El Acta Europea de Accesibilidad (Directiva (UE) 2019/882, Ley 11/2023 en España) se aplica desde el 28 de junio de 2025. LupA11y no certifica el cumplimiento: enseña la evidencia y los arreglos.

## Puesta en marcha

Requisitos: Node 24.11 o superior.

```bash
npm install
npx playwright install chromium
npm run dev              # http://localhost:3000
```

La fase de visión se activa con `GEMINI_API_KEY` en `apps/web/.env.local`. Sin ella, todo lo demás funciona y el informe marca la visión como omitida. Con una clave gratuita de Google AI Studio también funciona: el motor respeta sus límites por minuto, reintenta si el modelo está saturado y puede seguir con un modelo de reserva cuando el principal agota su cuota diaria (unas 20 consultas al día por modelo; cada auditoría hace hasta 14). Las demás variables (cuota, IP de confianza, enlaces permanentes) están explicadas en [`apps/web/.env.example`](apps/web/.env.example).

| Comando | Qué hace |
| --- | --- |
| `npm test` | Tests unitarios y de extremo a extremo del motor, la CLI, el MCP y la lógica de la web, con `node --test` |
| `npm run test:web` | La web de verdad (necesita `npm run build`): auditoría en directo, enlace guardado y axe sobre la propia interfaz |
| `npm run typecheck` | `tsc` estricto en los cuatro paquetes |
| `npm run lint` | ESLint de la web |
| `npm run build` | Build de producción de la web |
| `npm run audit -- <url>` | La CLI |
| `npm run sample` | Regenera la auditoría de muestra de la landing a partir de `/demo` |
| `npm run pack:packages` | Compila los paquetes a JavaScript, los empaqueta y comprueba que se instalan y arrancan |

## Uso

**CLI**

```bash
node packages/cli/src/main.ts https://www.tu-tienda.es --fail-on high --out informe.json --summary resumen.md
```

| Opción | Para qué |
| --- | --- |
| `<url...>` y `--sitemap <url>` | Una o varias páginas, o las de un sitemap (con `--max-pages`, 10 por defecto). Con varias, el JSON es un lote. |
| `--baseline <informe.json>` | Solo falla por lo que es nuevo o empeora respecto a ese informe. Las fases que no corrieron en los dos no se comparan. |
| `--sarif <ruta>` | SARIF 2.1.0 para el escaneo de código de GitHub, con huellas estables entre ejecuciones. |
| `--storage-state <ruta>` y `--header "Nombre: valor"` | Páginas tras el login. Las cabeceras solo viajan al origen auditado, nunca a terceros. |
| `--no-vision`, `--no-keyboard`, `--no-layout` | Omiten una fase. |

Códigos de salida: `0` sin hallazgos por encima del umbral, `1` con hallazgos y `2` si alguna auditoría falló.

**GitHub Action**

```yaml
- uses: Adriiiii24/LupA11y@v0
  with:
    url: http://localhost:3000
    fail-on: high
    sarif-path: lupa11y.sarif
    comment-pr: true              # necesita permissions: pull-requests: write
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
- uses: github/codeql-action/upload-sarif@v4
  if: always()
  with:
    sarif_file: lupa11y.sarif     # necesita permissions: security-events: write
```

Admite `url` con varias líneas, `sitemap`, `max-pages`, `baseline` y `level`. Cachea Chromium entre ejecuciones y solo instala Node si el del job no sirve.

**MCP (Claude Code)**

```bash
claude mcp add lupa11y -e GEMINI_API_KEY=tu_clave -- node /ruta/a/LupA11y/packages/mcp/src/server.ts
```

La herramienta `audit_url` acepta `localhost` y devuelve Markdown con los diffs y un resumen estructurado (`structuredContent`). Está pensada para el bucle «audita, aplica, vuelve a auditar»: mantiene Chromium arrancado entre llamadas y la segunda auditoría de la misma URL dice qué se arregló, qué es nuevo y qué sigue igual.

**Paquetes publicables.** `npm run pack:packages` deja en `.pack/` los tres paquetes compilados (`@lupa11y/core`, `@lupa11y/cli` con el binario `lupa11y`, `@lupa11y/mcp` con `lupa11y-mcp`) y verifica que se instalan desde sus tarballs y arrancan. Publicarlos es `npm publish .pack/<paquete>`.

**Despliegue.** En **Vercel** (plan gratuito) basta con importar el repositorio: [`vercel.json`](vercel.json) declara un único servicio, la web de `apps/web`, instalada desde la raíz del monorepo. La landing se sirve estática y la API usa el Chromium de `@sparticuz/chromium`. Allí los enlaces permanentes quedan desactivados, porque el disco no persiste. El [`Dockerfile`](Dockerfile) construye la web con su Chromium para un contenedor de larga vida (Fly.io, Cloud Run, un VPS…), en modo `public-only` y con un volumen en `/data` para los enlaces permanentes.

**Versiones.** Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md). La Action se usa por su etiqueta mayor, `@v0`, que se mueve a cada versión 0.x:

```bash
git tag v0.2.0 && git push origin v0.2.0
git tag -f v0 v0.2.0 && git push -f origin v0
```

## Estructura

```text
packages/core   motor + contrato Zod (schema.ts) + textos (format.ts) + comparación (compare.ts) + SARIF (sarif.ts)
packages/cli    CLI y base de la GitHub Action
packages/mcp    servidor MCP (stdio)
apps/web        landing y visor en Next.js 16, API de streaming NDJSON, informes compartidos, demo rota a propósito
action.yml      GitHub Action compuesta
scripts/        empaquetado para npm
docs/           ARCHITECTURE.md
```

Toda la arquitectura (fases, algoritmo del agente, medición del foco, política de red, comparación, pruebas y desviaciones del brief) está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). El contexto de producto está en [PRODUCT.md](PRODUCT.md).

## Seguridad

- La API pública solo audita hosts públicos. Se comprueba la URL, cada petición del navegador, cada WebSocket y cada salto de redirección.
- En modo público, Chromium no resuelve DNS: sale por un proxy local que resuelve cada host una vez, lo valida y se conecta a esa misma IP. Así no cabe un *DNS rebinding*. WebRTC solo puede salir por el proxy.
- La cuota solo se fía de la IP que declare un proxy de confianza; además hay un presupuesto global por proceso.
- Los errores internos no llegan al cliente público: se registran en el servidor y el usuario ve un mensaje genérico.
- El agente de teclado trabaja en modo de solo lectura: no envía formularios ni navega.
- El contenido de la página llega a Gemini como dato delimitado, y la respuesta solo puede ser el JSON del esquema.

---

Proyecto de portfolio de Adrián Martínez Panés.
