import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuditError } from '../src/errors.ts';
import { assertPublicHost, isReservedAddress, parseAuditUrl } from '../src/network-guard.ts';

const rejectsWith = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof AuditError && error.code === code);

describe('parseAuditUrl', () => {
  it('completa el esquema y quita el fragmento', () => {
    assert.equal(parseAuditUrl('  example.com/tienda#top ').href, 'https://example.com/tienda');
    assert.equal(parseAuditUrl('localhost:3000').href, 'https://localhost:3000/');
    assert.equal(parseAuditUrl('http://127.0.0.1:8080/demo').href, 'http://127.0.0.1:8080/demo');
  });

  it('rechaza esquemas, credenciales y basura', () => {
    for (const input of ['ftp://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', '', 'http://', 'a'.repeat(3000)]) {
      assert.throws(() => parseAuditUrl(input), (error: unknown) => error instanceof AuditError && error.code === 'invalid_url', input);
    }
  });
});

describe('isReservedAddress', () => {
  it('marca redes privadas, locales y de metadatos', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe']) {
      assert.equal(isReservedAddress(ip), true, ip);
    }
  });

  it('deja pasar direcciones públicas', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '151.101.1.69']) {
      assert.equal(isReservedAddress(ip), false, ip);
    }
  });

  it('trata lo que no es una IP como no pública', () => {
    assert.equal(isReservedAddress('example.com'), true);
  });
});

describe('assertPublicHost', () => {
  it('bloquea nombres locales e IP privadas sin tocar la red', async () => {
    await rejectsWith(assertPublicHost('localhost'), 'blocked_host');
    await rejectsWith(assertPublicHost('app.localhost'), 'blocked_host');
    await rejectsWith(assertPublicHost('printer.local'), 'blocked_host');
    await rejectsWith(assertPublicHost('169.254.169.254'), 'blocked_host');
    await rejectsWith(assertPublicHost('[::1]'), 'blocked_host');
  });

  it('acepta una IP pública literal', async () => {
    await assertPublicHost('8.8.8.8');
  });
});
