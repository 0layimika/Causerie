import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, safePath);
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(join(root, 'index.html'));
    res.writeHead(200, { 'content-type': types['.html'] });
    res.end(body);
  }
}).listen(port, host, () => {
  console.log(`Causerie running at http://${host}:${port}`);
});
