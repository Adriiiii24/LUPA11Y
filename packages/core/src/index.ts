/**
 * API pública del motor. Solo servidor: arrastra Playwright. Para tipos y textos usa
 * `@lupa11y/core/schema`, `@lupa11y/core/format`, `@lupa11y/core/compare` y `@lupa11y/core/sarif`.
 */
export { audit, type AuditOptions } from './audit.ts';
export { createBrowserPool, PUBLIC_BROWSER_ARGS, type BrowserLease, type BrowserPool } from './browser-pool.ts';
export { startEgressProxy, type EgressProxy } from './egress-proxy.ts';
export { AuditError, isAuditError } from './errors.ts';
export { assertPublicHost, parseAuditUrl, resolvePublic, type NetworkPolicy } from './network-guard.ts';
export { DEFAULT_VISION_MODEL, type VisionAsker } from './phases/vision.ts';
export * from './schema.ts';
export * from './format.ts';
export * from './compare.ts';
export * from './sarif.ts';
