import type { NextConfig } from 'next';

const config: NextConfig = {
  // El motor se consume como TypeScript fuente del workspace.
  transpilePackages: ['@lupa11y/core'],
  // Playwright y axe leen ficheros propios en tiempo de ejecución: no se empaquetan.
  serverExternalPackages: ['playwright', 'playwright-core', '@axe-core/playwright', 'axe-core', '@google/genai', '@sparticuz/chromium'],
  // Ficheros que se leen en tiempo de ejecución con rutas que el trazado no ve: el Chromium de Vercel
  // (comprimido en bin/) y el browsers.json que Playwright carga al importarse.
  outputFileTracingIncludes: {
    '/api/audit': ['../../node_modules/@sparticuz/chromium/bin/**', '../../node_modules/playwright-core/browsers.json'],
  },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/demo', destination: '/demo/index.html' }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // La demo rota a propósito no se indexa ni se enmarca.
      { source: '/demo/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default config;
