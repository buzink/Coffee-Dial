// Runtime configuration, read from the environment. Secrets (Google OAuth client id and
// secret, optional allowlist address) come from Secret Manager via Cloud Run --set-secrets.
// Nothing here is hardcoded except the default Firebase project id.

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadConfig(env = process.env) {
  const port = positiveNumber(env.PORT, 8080);
  const publicBaseUrl = (env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  return {
    port,
    // The issuer of our own tokens and the base of every OAuth URL. Must match the public URL.
    publicBaseUrl,
    // The protected resource: the MCP endpoint. Access tokens are issued for this audience.
    resource: `${publicBaseUrl}/mcp`,
    googleClientId: env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
    // Optional allowlist. Empty means every account with a verified Google email may use the server.
    allowedEmail: (env.ALLOWED_EMAIL || '').trim().toLowerCase(),
    projectId: env.FIRESTORE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'coffee-dial-buzink',
    // Write limits, per user and per hour (applied writes only; dry runs are free).
    writeLimitPerHour: positiveNumber(env.MCP_WRITE_LIMIT_PER_HOUR, 60),
    // Largest document the server will write, measured as JSON bytes.
    maxDocBytes: positiveNumber(env.MCP_MAX_DOC_BYTES, 32768),
    // Largest brew graph a single get_brew_graph call returns.
    maxGraphBytes: positiveNumber(env.MCP_MAX_GRAPH_BYTES, 200000),
    // Largest number of rows a list tool returns.
    listMax: positiveNumber(env.MCP_LIST_MAX, 500),
  };
}

// Fails fast at start-up when the server cannot run an OAuth login or would have an unsafe base URL.
export function assertConfigured(cfg) {
  const problems = [];
  if (!cfg.googleClientId) problems.push('GOOGLE_CLIENT_ID is not set');
  if (!cfg.googleClientSecret) problems.push('GOOGLE_CLIENT_SECRET is not set');
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(cfg.publicBaseUrl);
  if (!cfg.publicBaseUrl.startsWith('https://') && !isLocal) problems.push('PUBLIC_BASE_URL must be https');
  if (problems.length) throw new Error(`Configuration incomplete: ${problems.join('; ')}`);
}
