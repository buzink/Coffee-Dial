// MCP tools. The user id comes only from the verified bearer token (ctx.uid), never from the tool
// arguments, so a tool has no way to name another user's data.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LimitError, NotFoundError, ValidationError } from './errors.js';
import { Store } from './store.js';
import * as entities from './entities.js';
import { BREW_SHAPE, GEAR_SHAPE, KOFFIE_SHAPE, ZAK_SHAPE } from './validate.js';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const APPLY_NOTE = 'Dry run by default: with apply false (the default) nothing is written and the proposed change is returned. '
  + 'Show the change to the user and only call again with apply true after they agree.';

const listLimit = (cfg) => z.number().int().min(1).max(cfg.listMax).optional()
  .describe(`Rows to return (1 to ${cfg.listMax}). Default: all, up to the maximum.`);

function toolError(err, log) {
  if (err instanceof ValidationError || err instanceof NotFoundError || err instanceof LimitError) {
    return { isError: true, content: [{ type: 'text', text: err.message }] };
  }
  log('tool_failed', { name: err?.name || 'Error', code: err?.code || null });
  return { isError: true, content: [{ type: 'text', text: 'The server could not complete this request. Try again later.' }] };
}

export function createMcpServer({ cfg, db, uid, log = () => {} }) {
  const store = new Store(db, uid);
  const server = new McpServer({ name: 'coffee-dial', version: '1.0.0' });

  const tool = (name, config, fn) => {
    server.registerTool(name, config, async (args) => {
      try {
        const result = await fn(args ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return toolError(err, log);
      }
    });
  };

  tool('list_koffies', {
    title: 'List coffees',
    description: 'List the signed-in user\'s coffees (koffies): roaster, name, origin, process, roast, rating and tasting notes.',
    inputSchema: z.object({ limit: listLimit(cfg) }),
    annotations: READ_ONLY,
  }, (args) => entities.listKoffies(store, args, cfg));

  tool('list_zakken', {
    title: 'List bags',
    description: 'List the user\'s bags (zakken) of coffee: which coffee each bag is, stock, beans left, price and dates.',
    inputSchema: z.object({ limit: listLimit(cfg), includeArchived: z.boolean().optional() }),
    annotations: READ_ONLY,
  }, (args) => entities.listZakken(store, args, cfg));

  tool('list_brews', {
    title: 'List brews',
    description: 'List the user\'s brews (coffees), newest first: method, dose, yield, time, temperature, rating, grinder gear and notes.',
    inputSchema: z.object({
      limit: listLimit(cfg),
      beanId: z.string().max(128).optional().describe('Only brews on this bag id'),
      method: z.string().max(80).optional().describe('Only brews with this method, for example V60'),
    }),
    annotations: READ_ONLY,
  }, (args) => entities.listBrews(store, args, cfg));

  tool('list_gear', {
    title: 'List gear',
    description: 'List the user\'s gear: grinders, brewers and other equipment, with methods and archive state.',
    inputSchema: z.object({ limit: listLimit(cfg), includeArchived: z.boolean().optional() }),
    annotations: READ_ONLY,
  }, (args) => entities.listGear(store, args, cfg));

  tool('get_analyse', {
    title: 'Analysis summary',
    description: 'Counts and average ratings per brew method and per bag, computed on the server. Unrated brews are counted but not averaged.',
    inputSchema: z.object({}),
    annotations: READ_ONLY,
  }, () => entities.getAnalyse(store));

  tool('get_brew_graph', {
    title: 'Brew graph (scale capture)',
    description: 'Read the scale capture of one brew. Large: call only when the user asks for the graph of a specific brew.',
    inputSchema: z.object({ brewId: z.string().min(1).max(128) }),
    annotations: READ_ONLY,
  }, (args) => entities.getBrewGraph(store, args, cfg));

  tool('upsert_koffie', {
    title: 'Add or change a coffee',
    description: `Add a coffee (koffie) or change one by id. Coffee details only: roaster, name, farmer, origin, process, roast, rating, tasting notes. ${APPLY_NOTE}`,
    inputSchema: z.object(KOFFIE_SHAPE).passthrough(),
    annotations: WRITE,
  }, (args) => entities.upsertKoffie(store, cfg, args));

  tool('upsert_zak', {
    title: 'Add or change a bag',
    description: `Add a bag (zak) of a coffee, or change one by id. Bag details only: coffeeTypeId, stock, price, shop URL, dates, archived and frozen. beansLeft is calculated. ${APPLY_NOTE}`,
    inputSchema: z.object(ZAK_SHAPE).passthrough(),
    annotations: WRITE,
  }, (args) => entities.upsertZak(store, cfg, args));

  tool('upsert_brew', {
    title: 'Add or change a brew',
    description: `Add a brew (coffee brew) or change one by id. Brew details only: beanId (bag), gearIds (grinder and other gear), method, dose, yield, time, temperature, rating, notes. ${APPLY_NOTE}`,
    inputSchema: z.object(BREW_SHAPE).passthrough(),
    annotations: WRITE,
  }, (args) => entities.upsertBrew(store, cfg, args));

  tool('upsert_gear', {
    title: 'Add or change gear',
    description: `Add a gear item or change one by id: name, type (for example grinder), price, methods and archive state. ${APPLY_NOTE}`,
    inputSchema: z.object(GEAR_SHAPE).passthrough(),
    annotations: WRITE,
  }, (args) => entities.upsertGear(store, cfg, args));

  return server;
}
