import { defineConfig } from 'astro/config';
import { copyFile } from 'node:fs/promises';

// Set SITE_URL in your build environment before public deployment.
const site = process.env.SITE_URL ?? 'https://example.com';
const url = new URL(site);
if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/') {
  throw new Error('SITE_URL must be an absolute HTTP(S) origin without a path.');
}

export default defineConfig({
  site: url.origin,
  output: 'static',
  integrations: [
    {
      name: 'localized-static-404',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          // Cloudflare Pages uses the nearest 404.html for unknown locale paths.
          await copyFile(new URL('en/404/index.html', dir), new URL('en/404.html', dir));
        },
      },
    },
  ],
  trailingSlash: 'always',
  i18n: {
    locales: ['zh', 'en'],
    defaultLocale: 'zh',
    routing: { prefixDefaultLocale: false },
  },
  devToolbar: { enabled: false },
});
