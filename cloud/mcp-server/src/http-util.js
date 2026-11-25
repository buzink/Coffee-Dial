// Small helpers around Node's http response and request objects.

const MAX_BODY_BYTES = 1024 * 1024;

export function sendJson(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}

export function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(text);
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

export function sendHtmlMessage(res, status, title, message) {
  const body = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>`
    + `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem">`
    + `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body>`;
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

export function redirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store' });
  res.end();
}

export function sendOAuthError(res, status, error, description) {
  sendJson(res, status, { error, error_description: description });
}

export async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error('Request body too large');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(req, maxBytes) {
  const text = await readBody(req, maxBytes);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Body is not valid JSON');
    err.status = 400;
    throw err;
  }
}

export async function readForm(req) {
  const text = await readBody(req, 64 * 1024);
  return Object.fromEntries(new URLSearchParams(text));
}
