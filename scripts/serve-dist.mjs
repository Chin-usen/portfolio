import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';

const root = await realpath(path.resolve('dist'));
const portArg = process.argv.indexOf('--port');
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : (process.env.PORT ?? 4322));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
};

async function readable(relative) {
  const absolute = path.resolve(root, relative);
  const relativeCheck = path.relative(root, absolute);
  if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) return null;
  try {
    const resolved = await realpath(absolute);
    const actualRelative = path.relative(root, resolved);
    if (actualRelative.startsWith('..') || path.isAbsolute(actualRelative)) return null;
    if ((await stat(resolved)).isFile()) return resolved;
  } catch {
    /* Missing static file: try a route candidate, then return a real 404. */
  }
  return null;
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    response.writeHead(400).end('Bad request');
    return;
  }
  const relative = pathname.replace(/^\/+/, '');
  const candidates =
    relative.endsWith('/') || !relative
      ? [`${relative}index.html`, `${relative.replace(/\/$/, '')}.html`]
      : [relative, `${relative}/index.html`, `${relative}.html`];
  let file = null;
  for (const candidate of candidates) {
    file = await readable(candidate);
    if (file) break;
  }
  // Both explicit error-page URLs and unknown routes retain error status.
  let status = /^\/(?:en\/)?404(?:\.html|\/)?$/.test(pathname) ? 404 : 200;
  if (!file) {
    status = 404;
    const fallbacks = pathname.startsWith('/en/')
      ? ['en/404/index.html', 'en/404.html', '404.html']
      : ['404.html', '404/index.html'];
    for (const fallback of fallbacks) {
      file = await readable(fallback);
      if (file) break;
    }
  }
  try {
    const body = file ? await readFile(file) : Buffer.from('Not found');
    response.writeHead(status, {
      'Content-Type': file
        ? (types[path.extname(file)] ?? 'application/octet-stream')
        : 'text/plain; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end('Static file unavailable');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Static dist ready at http://127.0.0.1:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
