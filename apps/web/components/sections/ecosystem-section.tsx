'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CodeBlock } from '../code-block';
import { PALETTE } from '../palette';
import { Tabs } from '../tabs';

type Channel = 'action' | 'mcp' | 'cli';

const WORKFLOW = `name: Accesibilidad
on: [pull_request]

jobs:
  lupa11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: npm ci && npm run build
      - run: npm start &
      - run: npx wait-on http://localhost:3000
      - uses: Adriiiii24/LupA11y@v0
        with:
          url: http://localhost:3000
          fail-on: high
          sarif-path: lupa11y.sarif
          comment-pr: true
          gemini-api-key: \${{ secrets.GEMINI_API_KEY }}
      - uses: github/codeql-action/upload-sarif@v4
        if: always()
        with:
          sarif_file: lupa11y.sarif`;

const CLAUDE = `claude mcp add lupa11y -e GEMINI_API_KEY=tu_clave -- node /ruta/a/LupA11y/packages/mcp/src/server.ts`;

const CURSOR = `{
  "mcpServers": {
    "lupa11y": {
      "command": "node",
      "args": ["/ruta/a/LupA11y/packages/mcp/src/server.ts"],
      "env": { "GEMINI_API_KEY": "tu_clave" }
    }
  }
}`;

const CLI = `npx playwright install chromium
node packages/cli/src/main.ts https://www.tu-tienda.es \\
  --sitemap https://www.tu-tienda.es/sitemap.xml --max-pages 10 \\
  --baseline informe-anterior.json --fail-on high \\
  --out informe.json --sarif informe.sarif --summary resumen.md`;

/** Lo que hace cada salida, en filas suaves, y su código al lado. */
function Channel({ lead, fields, children }: { lead: string; fields: ReadonlyArray<readonly [string, string]>; children: ReactNode }) {
  return (
    <div className="grid gap-6 pt-8 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="px-2 text-[1.375rem] font-medium leading-snug tracking-[-0.02em] text-text">{lead}</p>
        {/* Cada grupo solo contiene su <dt> y su <dd>: el punto luminoso es un pseudoelemento, no un hijo más de la lista. */}
        <dl className="mt-8 grid gap-6 px-2">
          {fields.map(([term, detail]) => (
            <div key={term} className="relative pl-6">
              <dt className="text-sm text-text-muted before:absolute before:left-0 before:top-2 before:size-2 before:rounded-full before:bg-iris/70 before:shadow-[0_0_10px_rgb(var(--iris-rgb)/0.7)] before:content-['']">
                {term}
              </dt>
              <dd className="mt-1 leading-relaxed text-text">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 space-y-3 lg:col-span-7">{children}</div>
    </div>
  );
}

const OUTPUTS = [
  { name: 'Web', use: 'Esta página y su API de streaming.', x: 13, y: 26 },
  { name: 'GitHub Action', use: 'Un check en cada pull request.', x: 13, y: 74 },
  { name: 'Servidor MCP', use: 'Claude Code, Cursor y otros clientes.', x: 87, y: 26 },
  { name: 'CLI', use: 'La terminal y cualquier otra CI.', x: 87, y: 74 },
] as const;

/**
 * Un motor, cuatro salidas: la lente central es el paquete del motor y las cuatro de alrededor, lo
 * que lo usa. Las curvas que las unen son decorativas; la lista dice lo mismo en texto.
 */
function EngineOrbit() {
  return (
    <figure className="relative mx-auto mt-16 max-w-[60rem] lg:mt-20">
      <svg aria-hidden="true" viewBox="0 0 100 50" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
        <defs>
          <linearGradient id="orbit-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={PALETTE.azure} />
            <stop offset="100%" stopColor={PALETTE.iris} />
          </linearGradient>
        </defs>
        {OUTPUTS.map((output) => (
          <path
            key={output.name}
            d={`M50 25 C ${output.x < 50 ? 36 : 64} 25, ${output.x < 50 ? 28 : 72} ${output.y / 2}, ${output.x < 50 ? 22 : 78} ${output.y / 2}`}
            fill="none"
            stroke="url(#orbit-line)"
            strokeOpacity="0.7"
            strokeWidth="1.5"
            strokeDasharray="2 6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="relative grid gap-3 lg:block lg:aspect-[2/1]">
        <div className="sphere mx-auto grid aspect-square w-56 place-items-center rounded-full text-center shadow-[-30px_0_90px_-30px_rgb(var(--azure-rgb)/0.55),30px_0_90px_-30px_rgb(var(--iris-rgb)/0.55)] lg:absolute lg:left-1/2 lg:top-1/2 lg:w-[30%] lg:-translate-x-1/2 lg:-translate-y-1/2">
          <span>
            <span className="block text-2xl font-semibold tracking-[-0.03em] text-text">El motor</span>
            <span className="mt-1 block font-mono text-xs text-text-muted">packages/core</span>
            <span className="block font-mono text-xs text-text-muted">contrato Zod</span>
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:contents">
          {OUTPUTS.map((output) => (
            <li
              key={output.name}
              className="shine grid aspect-square place-items-center rounded-full bg-raised px-4 text-center lg:absolute lg:left-(--x) lg:top-(--y) lg:w-[19%] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:px-3"
              style={{ '--x': `${output.x}%`, '--y': `${output.y}%` } as CSSProperties}
            >
              <span>
                <span className="block font-medium text-text">{output.name}</span>
                <span className="mt-1 block text-[0.8125rem] leading-snug text-text-muted">{output.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="visually-hidden">El mismo motor sale en cuatro formatos: web, GitHub Action, servidor MCP y CLI.</figcaption>
    </figure>
  );
}

export function EcosystemSection({ mcpSample }: { mcpSample: string }) {
  const [channel, setChannel] = useState<Channel>('action');

  return (
    <section aria-labelledby="integraciones-title" className="mx-auto max-w-336 px-4 py-28 sm:px-6 lg:py-36">
      <div id="integraciones" className="mx-auto max-w-2xl px-2 text-center">
        <h2 id="integraciones-title" className="reveal text-[clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-text">
          Tu CI y tu editor, el mismo motor.
        </h2>
        <p className="reveal mt-4 text-lg leading-relaxed text-text-muted">La web, la GitHub Action y el servidor MCP llaman al mismo paquete y devuelven el mismo contrato Zod.</p>
      </div>

      <EngineOrbit />

      <Tabs<Channel>
        label="Formas de usar LupA11y"
        value={channel}
        onChange={setChannel}
        className="mt-20 grid justify-items-stretch"
        listClassName="max-w-full justify-self-center"
        items={[
          {
            id: 'action',
            label: 'GitHub Action',
            content: (
              <Channel
                lead="Cada pull request se audita antes de fusionarse. Si aparece algo de severidad alta, el check falla y el resumen queda en la pestaña del job."
                fields={[
                  ['Dónde corre', 'En el propio job, contra la app levantada en localhost: una URL, varias o las de un sitemap.'],
                  ['Qué deja', 'El resumen con los diffs en $GITHUB_STEP_SUMMARY, anotaciones, un comentario en el PR y SARIF para la pestaña de seguridad.'],
                  ['Cuándo falla', 'Por encima del umbral que elijas. Con una línea base, solo por lo que es nuevo o empeora.'],
                  ['Sin Gemini', 'Sigue funcionando: la visión se marca como omitida.'],
                ]}
              >
                <CodeBlock file=".github/workflows/accesibilidad.yml" language="YAML" code={WORKFLOW} />
              </Channel>
            ),
          },
          {
            id: 'mcp',
            label: 'Servidor MCP',
            content: (
              <Channel
                lead="Tu agente de código audita localhost, aplica los diffs y vuelve a auditar, sin salir del editor. Una sola herramienta: audit_url."
                fields={[
                  ['Clientes', 'Claude Code, Cursor y cualquier cliente MCP por stdio.'],
                  ['Qué devuelve', 'Markdown con selectores, fragmentos y diffs, y un resumen estructurado que el agente lee sin interpretar texto.'],
                  ['Memoria', 'La segunda auditoría de la misma URL dice qué se arregló, qué es nuevo y qué sigue igual.'],
                  ['Progreso', 'Informa por fases, se puede cancelar y mantiene Chromium arrancado entre llamadas.'],
                ]}
              >
                <CodeBlock file="Claude Code" language="bash" code={CLAUDE} />
                <CodeBlock file=".cursor/mcp.json" language="JSON" code={CURSOR} />
                <CodeBlock file="Respuesta real de audit_url sobre /demo (extracto)" language="Markdown" code={mcpSample} />
              </Channel>
            ),
          },
          {
            id: 'cli',
            label: 'CLI',
            content: (
              <Channel
                lead="La misma auditoría desde la terminal, para scripts o para cualquier CI que no sea GitHub."
                fields={[
                  ['Salida', '0 si no hay nada por encima del umbral, 1 si lo hay y 2 si alguna auditoría falló.'],
                  ['Páginas', 'Varias URL o las de un sitemap, con un solo Chromium; el JSON pasa a ser un lote.'],
                  ['Con sesión', '--storage-state y --header para auditar lo que hay tras el login; las cabeceras solo viajan a tu origen.'],
                  ['Flujos', 'El progreso sale por stderr; con --json, stdout queda limpio para encadenar.'],
                ]}
              >
                <CodeBlock file="Terminal" language="bash" code={CLI} />
              </Channel>
            ),
          },
        ]}
      />
    </section>
  );
}
