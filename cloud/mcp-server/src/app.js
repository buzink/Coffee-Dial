// HTTP app: routes /mcp (bearer-protected MCP endpoint, stateless Streamable HTTP) and the OAuth
// proxy endpoints. Tests build the app with a fake Google exchange and the Auth/Firestore emulators.

import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticate, NOT_ALLOWED_MESSAGE } from './auth.js';
import { AuthError } from './errors.js';
import { createMcpServer } from './tools.js';
import { createOAuth } from './oauth.js';
import { deriveSigningKey } from './tokens.js';
import { exchangeGoogleCode, resolveUid } from './identity.js';
import { readJson, sendJson, sendText } from './http-util.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
};

const defaultLog = (event, fields = {}) => console.log(JSON.stringify({ event, ...fields }));

export function createApp({
  cfg,
  db,
  auth,
  exchangeGoogle = exchangeGoogleCode,
  log = defaultLog,
}) {
  const key = deriveSigningKey(cfg.googleClientSecret);
  const oauth = createOAuth({ cfg, key, auth, exchangeGoogle, resolveUid, log });

  async function handleMcp(req, res) {
    let ctx;
    try {
      ctx = await authenticate(req, { cfg, key });
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      if (err.status === 401) {
        const challenge = `Bearer resource_metadata="${cfg.publicBaseUrl}/.well-known/oauth-protected-resource", error="${err.code}"`;
        return sendJson(res, 401, { error: err.code, error_description: err.message }, { ...CORS, 'www-authenticate': challenge });
      }
      log('mcp_refused', { status: err.status });
      return sendJson(res, 403, { error: err.code, error_description: NOT_ALLOWED_MESSAGE }, CORS);
    }

    const body = req.method === 'POST' ? await readJson(req, 1024 * 1024) : undefined;
    const server = createMcpServer({ cfg, db, uid: ctx.uid, log });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    for (const [name, value] of Object.entries(CORS)) res.setHeader(name, value);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return undefined;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', cfg.publicBaseUrl);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (url.pathname === '/healthz') return sendText(res, 200, 'ok');
      if (url.pathname === '/mcp') return await handleMcp(req, res);
      if (await oauth.handle(req, res, url)) return undefined;
      return sendJson(res, 404, { error: 'not_found' });
    } catch (err) {
      if (err.status && err.status < 500) {
        return sendJson(res, err.status, { error: 'invalid_request', error_description: err.message });
      }
      log('request_failed', { name: err?.name || 'Error' });
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
      return undefined;
    }
  });
  return server;
}
