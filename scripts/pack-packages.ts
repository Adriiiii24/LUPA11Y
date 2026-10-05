/**
 * Prepara @lupa11y/core, @lupa11y/cli y @lupa11y/mcp para publicarlos en npm.
 *
 *   npm run pack:packages              compila, empaqueta y comprueba la instalación
 *   npm run pack:packages -- --no-verify
 *
 * En el monorepo los paquetes se usan como TypeScript fuente (Node quita los tipos al ejecutar).
 * Eso no sirve una vez publicados: Node se niega a quitar tipos dentro de node_modules. Aquí se
 * compilan a JavaScript con sus .d.ts, se escribe un package.json de publicación que apunta a dist y
 * se genera el .tgz con `npm pack`. La comprobación instala los tres tarballs en un directorio vacío,
 * fuera del monorepo, y arranca la CLI y el servidor MCP como lo haría cualquier usuario.
 *
 * No publica nada: `npm publish .pack/<paquete>` queda en manos de quien tenga la cuenta.
 */
import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACK = join(ROOT, '.pack');
const BUILD = join(PACK, 'build');
const verify = !process.argv.includes('--no-verify');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

interface Manifest {
  name: string;
  version: string;
  description: string;
  license?: string;
  exports?: Record<string, string>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
}

const PACKAGES = ['core', 'cli', 'mcp'] as const;
const log = (text: string) => process.stdout.write(`${text}\n`);

/** De `./src/x.ts` a `./dist/src/x.js`, tanto en exports como en bin. */
const toDist = (path: string) => path.replace(/^\.\/src\//, './dist/src/').replace(/\.ts$/, '.js');

async function build() {
  await rm(PACK, { recursive: true, force: true });
  await mkdir(PACK, { recursive: true });
  await writeFile(
    join(PACK, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../tsconfig.base.json',
        compilerOptions: {
          noEmit: false,
          declaration: true,
          outDir: 'build',
          rootDir: '../packages',
          rewriteRelativeImportExtensions: true,
          allowImportingTsExtensions: true,
        },
        include: ['../packages/*/src/**/*.ts'],
      },
      null,
      2,
    ),
  );
  execFileSync(process.execPath, [tsc, '-p', join(PACK, 'tsconfig.json')], { stdio: 'inherit' });
}

async function assemble(name: (typeof PACKAGES)[number], version: string): Promise<string> {
  const source = JSON.parse(await readFile(join(ROOT, 'packages', name, 'package.json'), 'utf8')) as Manifest;
  const target = join(PACK, name);
  await mkdir(target, { recursive: true });
  await cp(join(BUILD, name, 'src'), join(target, 'dist', 'src'), { recursive: true });
  // La versión se importa del package.json: en el paquete publicado está dos niveles más arriba.
  for (const file of await readdir(join(target, 'dist', 'src'))) {
    if (!file.endsWith('.js')) continue;
    const path = join(target, 'dist', 'src', file);
    const code = await readFile(path, 'utf8');
    if (code.includes("'../package.json'")) await writeFile(path, code.replaceAll("'../package.json'", "'../../package.json'"));
  }
  const exportsMap = source.exports
    ? Object.fromEntries(
        Object.entries(source.exports).map(([key, path]) => [key, { types: toDist(path).replace(/\.js$/, '.d.ts'), default: toDist(path) }]),
      )
    : undefined;
  const manifest = {
    name: source.name,
    version,
    description: source.description,
    license: 'MIT',
    author: 'Adrián Martínez Panés',
    type: 'module',
    repository: { type: 'git', url: 'git+https://github.com/Adriiiii24/LupA11y.git' },
    homepage: 'https://github.com/Adriiiii24/LupA11y#readme',
    keywords: ['accessibility', 'a11y', 'wcag', 'axe-core', 'playwright', 'mcp', 'eaa'],
    engines: { node: '>=20.12' },
    files: ['dist'],
    ...(exportsMap ? { exports: exportsMap } : {}),
    ...(source.bin ? { bin: Object.fromEntries(Object.entries(source.bin).map(([key, path]) => [key, toDist(path)])) } : {}),
    dependencies: Object.fromEntries(Object.entries(source.dependencies ?? {}).map(([dep, range]) => [dep, dep.startsWith('@lupa11y/') ? `^${version}` : range])),
  };
  await writeFile(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await cp(join(ROOT, 'README.md'), join(target, 'README.md'));
  await cp(join(ROOT, 'LICENSE'), join(target, 'LICENSE'));
  const tarball = execFileSync(npm, ['pack', '--pack-destination', PACK, '--silent'], { cwd: target, encoding: 'utf8', shell: process.platform === 'win32' })
    .trim()
    .split('\n')
    .at(-1);
  if (!tarball) throw new Error(`npm pack no devolvió el nombre del tarball de ${name}`);
  log(`✓ ${manifest.name}@${version} → .pack/${tarball}`);
  return join(PACK, tarball);
}

/** Habla con el servidor MCP instalado: `initialize` y la lista de herramientas. */
function mcpTools(entry: string, cwd: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { cwd, stdio: ['pipe', 'pipe', 'inherit'] });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('El servidor MCP no respondió en 20 s.'));
    }, 20_000);
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      for (const line of buffer.split('\n').slice(0, -1)) {
        const message = JSON.parse(line) as { id?: number; result?: { tools?: Array<{ name: string }> } };
        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
          child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
        }
        if (message.id === 2) {
          clearTimeout(timer);
          const tools = (message.result?.tools ?? []).map((tool) => tool.name);
          // Se espera a que salga: en Windows, un proceso vivo bloquea su directorio de trabajo.
          child.once('exit', () => resolve(tools));
          child.kill();
        }
      }
      buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pack-check', version: '0' } } })}\n`,
    );
  });
}

async function check(tarballs: string[]) {
  const dir = await mkdtemp(join(tmpdir(), 'lupa11y-pack-'));
  try {
    await writeFile(join(dir, 'package.json'), '{ "name": "comprobacion", "private": true, "type": "module" }\n');
    execFileSync(npm, ['install', '--no-audit', '--no-fund', '--prefer-offline', ...tarballs], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
    const help = execFileSync(process.execPath, [join(dir, 'node_modules/@lupa11y/cli/dist/src/main.js'), '--help'], { encoding: 'utf8' });
    if (!help.includes('--baseline')) throw new Error('La ayuda de la CLI instalada no es la esperada.');
    log('✓ la CLI instalada arranca');
    const api = execFileSync(process.execPath, ['--input-type=module', '-e', "const m = await import('@lupa11y/core'); console.log(typeof m.audit, typeof m.toSarif, typeof m.compareReports);"], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    if (api !== 'function function function') throw new Error(`La API de @lupa11y/core instalada no es la esperada: ${api}`);
    log('✓ @lupa11y/core se importa como JavaScript');
    const tools = await mcpTools(join(dir, 'node_modules/@lupa11y/mcp/dist/src/server.js'), dir);
    if (!tools.includes('audit_url')) throw new Error(`El servidor MCP instalado no expone audit_url: ${tools.join(', ')}`);
    log('✓ el servidor MCP instalado expone audit_url');
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

const version = (JSON.parse(await readFile(join(ROOT, 'packages/core/package.json'), 'utf8')) as Manifest).version;
await build();
const tarballs: string[] = [];
for (const name of PACKAGES) tarballs.push(await assemble(name, version));
if (verify) await check(tarballs);
log(`\nListo. Para publicar: npm publish .pack/core && npm publish .pack/cli && npm publish .pack/mcp`);
