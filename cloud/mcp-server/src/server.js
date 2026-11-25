// Entry point for Cloud Run (and local runs). Reads configuration from the environment only.

import { assertConfigured, loadConfig } from './config.js';
import { createFirebase } from './store.js';
import { createApp } from './app.js';

const cfg = loadConfig();
assertConfigured(cfg);
const { db, auth } = createFirebase(cfg.projectId);
const app = createApp({ cfg, db, auth });

app.listen(cfg.port, () => {
  console.log(JSON.stringify({
    event: 'listening',
    port: cfg.port,
    allowlist: cfg.allowedEmail ? 'on' : 'off',
    writeLimitPerHour: cfg.writeLimitPerHour,
  }));
});
