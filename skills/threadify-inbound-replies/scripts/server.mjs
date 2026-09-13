import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
export async function serve(store, account, port = 0) {
  const token = randomBytes(32).toString('hex');
  let origin;
  const server = http.createServer(async (req, res) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'" };
    const send = (code, data) => { res.writeHead(code, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) return send(403, { error: 'origin_rejected' });
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname]; res.writeHead(200, { ...headers, 'Content-Type': type }); return res.end(fs.readFileSync(new URL(file, import.meta.url)));
      }
      const supplied = Buffer.from(req.headers['x-review-session'] || '');
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(403, { error: 'session_required' });
      if (req.method === 'GET' && url.pathname === '/api/status') return send(200, store.status(account));
      if (req.method !== 'POST' || !['/api/edit', '/api/decide', '/api/preference'].includes(url.pathname)) return send(404, { error: 'not_found' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'json_required' });
      let raw = '', size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) return send(413, { error: 'request_too_large' }); raw += chunk; }
      const body = JSON.parse(raw);
      if (body.account && body.account !== account) return send(403, { error: 'account_mismatch' });
      const packet = { ...body, version: 1, account };
      const result = url.pathname === '/api/edit' ? store.edit(packet) : url.pathname === '/api/decide' ? store.decide(packet) : store.configure({ ...packet, timezone: store.read(account).timezone });
      send(200, result);
    } catch (e) { send(e.message === 'revision_conflict' ? 409 : 400, { error: e.message }); }
  });
  server.requestTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, url: origin + '/#' + token };
}
