import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDatabase } from './database.mjs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const httpError = (status, message) => Object.assign(new Error(message), { status });
function localOrigin(origin) {
  if (!origin) return true;
  try { const parsed = new URL(origin); return ['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname); }
  catch { return false; }
}
async function readJson(request) {
  if (request.headers['x-study-client'] !== 'local') throw httpError(403, 'A local study client header is required.');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw httpError(415, 'Use application/json.');
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16 * 1024 * 1024) throw httpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw httpError(400, 'Request body must be valid JSON.'); }
}

export function createStudyServer({ database = createDatabase(resolve(projectDirectory, '.data/study.sqlite')), staticDirectory = resolve(projectDirectory, 'build') } = {}) {
  const root = resolve(staticDirectory);
  const server = createServer(async (request, response) => {
    const json = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(body)); };
    try {
      if (!localOrigin(request.headers.origin)) throw httpError(403, 'Only local origins are allowed.');
      const url = new URL(request.url, 'http://127.0.0.1');
      const path = decodeURIComponent(url.pathname);
      if (path.startsWith('/api/')) {
        if (request.method === 'GET' && path === '/api/bootstrap') return json(200, database.bootstrap());
        if (request.method === 'GET' && path === '/api/export') {
          response.setHeader('Content-Disposition', 'attachment; filename="study-desk-backup.json"');
          return json(200, database.exportBackup());
        }
        const routes = {
          'PUT /api/settings': value => database.updateSettings(value),
          'POST /api/sessions': value => database.saveSession(value),
          'POST /api/attempts': value => database.saveAttempt(value),
          'POST /api/reviews': value => database.saveReview(value),
          'POST /api/notes': value => database.saveNote(value),
          'PUT /api/material-state': value => database.saveMaterialState(value),
          'POST /api/import': value => database.importBackup(value)
        };
        const draft = request.method === 'PUT' && path.match(/^\/api\/drafts\/([^/]+)$/);
        const bookmark = request.method === 'POST' && path.match(/^\/api\/bookmarks\/([^/]+)$/);
        const materialProgress=request.method==='PUT'&&path.match(/^\/api\/material-progress\/([^/]+)$/);
        const deleteNote=request.method==='DELETE'&&path.match(/^\/api\/notes\/([^/]+)$/);
        const route = routes[`${request.method} ${path}`];
        if (!route && !draft && !bookmark&&!materialProgress&&!deleteNote) throw httpError(404, 'API route not found.');
        const body = await readJson(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'JSON body must be an object.');
        return json(200, route ? route(body) : draft ? database.saveDraft(draft[1], body.text) : bookmark ? database.toggleBookmark(bookmark[1]) : materialProgress ? database.saveMaterialProgress(materialProgress[1],body.completed) : database.deleteNote(deleteNote[1]));
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw httpError(405, 'Method not allowed.');
      let filename = resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (filename !== root && !filename.startsWith(`${root}${sep}`)) throw httpError(403, 'Invalid path.');
      try { if (!(await stat(filename)).isFile()) throw new Error('Not a file'); }
      catch {
        if (extname(path)) throw httpError(404, 'File not found.');
        filename = resolve(root, 'index.html');
      }
      let body;
      try { body = await readFile(filename); }
      catch { throw httpError(404, 'Build the app with npm run build, or start development with npm run dev.'); }
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(filename)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (!response.headersSent) json(error.status ?? (error instanceof URIError ? 400 : 500), { error: error.status || error instanceof URIError ? error.message : 'Local storage request failed.' });
      else response.end();
    }
  });
  server.on('close', () => database.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createStudyServer();
  server.listen(4317, '127.0.0.1', () => console.log('Study desk API: http://127.0.0.1:4317'));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
