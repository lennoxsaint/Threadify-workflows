import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const script = fs.readFileSync(new URL('./lead-desk-review.js', import.meta.url));

export async function serveLeadDesk(review, port = 0) {
  const token = randomBytes(32).toString('hex');
  let origin;
  const server = http.createServer(async (request, response) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'" };
    const send = (code, body) => { response.writeHead(code, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); };
    try {
      if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) return send(403, { error: 'origin_rejected' });
      const url = new URL(request.url, origin);
      if (request.method === 'GET' && url.pathname === '/') { response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }); return response.end(review.read().desk.html); }
      if (request.method === 'GET' && url.pathname === '/lead-desk-review.js') { response.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' }); return response.end(script); }
      const supplied = Buffer.from(request.headers['x-review-session'] || '');
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(403, { error: 'session_required' });
      if (request.method === 'GET' && url.pathname === '/api/status') return send(200, review.status());
      if (request.method !== 'POST' || url.pathname !== '/api/review') return send(404, { error: 'not_found' });
      if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'json_required' });
      let raw = '';
      for await (const chunk of request) { raw += chunk; if (raw.length > 16_384) return send(413, { error: 'request_too_large' }); }
      return send(200, review.update(JSON.parse(raw)));
    } catch (error) { return send(error.message === 'revision_conflict' ? 409 : 400, { error: error.message }); }
  });
  server.requestTimeout = 10_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, url: `${origin}/#${token}` };
}
