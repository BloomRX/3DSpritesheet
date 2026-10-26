import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getComfyUiStatus, listComfyUiWorkflows, readComfyUiWorkflow } from './scripts/comfyui-client.mjs';

const MAX_STORE_BYTES = 24 * 1024 * 1024;

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function projectAssetStore() {
  const projectRoot = path.resolve(process.env.SPRITEFORGE_PROJECT_ROOT || process.cwd());
  const storeFile = path.join(projectRoot, '.spriteforge', 'assets.json');

  async function assertStorePathInsideProject() {
    const rootReal = await fs.realpath(projectRoot);
    let probe = storeFile;
    while (true) {
      try {
        const realPath = await fs.realpath(probe);
        if (!isInside(rootReal, realPath)) throw new Error('SpriteForge store path escapes the project through a symlink');
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const parent = path.dirname(probe);
        if (parent === probe) throw new Error('SpriteForge store path is outside the project');
        probe = parent;
      }
    }
  }

  return {
    name: 'spriteforge-project-asset-store',
    configureServer(server) {
      server.middlewares.use('/api/spriteforge/assets', async (request, response, next) => {
        const method = request.method || 'GET';
        if (method !== 'GET' && method !== 'PUT') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET, PUT');
          response.end('Method not allowed');
          return;
        }

        // Keep browser requests same-origin. Requests without Origin are allowed for local tooling.
        const origin = request.headers.origin;
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
            const requestHost = forwardedHost || request.headers.host;
            if (!requestHost || originHost.toLowerCase() !== String(requestHost).toLowerCase()) {
              response.statusCode = 403;
              response.end('Cross-origin access is not allowed');
              return;
            }
          } catch {
            response.statusCode = 403;
            response.end('Invalid Origin header');
            return;
          }
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');

        if (method === 'GET') {
          try {
            await assertStorePathInsideProject();
            const raw = await fs.readFile(storeFile, 'utf8');
            const store = JSON.parse(raw);
            if (!Array.isArray(store.assets)) throw new Error('Invalid asset store');
            response.statusCode = 200;
            response.end(JSON.stringify({ assets: store.assets, updatedAt: store.updatedAt || null, projectRoot }));
          } catch (error) {
            if (error.code === 'ENOENT') {
              response.statusCode = 200;
              response.end(JSON.stringify({ assets: null, updatedAt: null, projectRoot }));
              return;
            }
            response.statusCode = 500;
            response.end(JSON.stringify({ error: `Could not read SpriteForge asset store: ${error.message}` }));
          }
          return;
        }

        const contentType = String(request.headers['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('application/json')) {
          response.statusCode = 415;
          response.end(JSON.stringify({ error: 'Content-Type must be application/json' }));
          return;
        }

        try {
          let body = '';
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > MAX_STORE_BYTES) {
              response.statusCode = 413;
              response.end(JSON.stringify({ error: 'Asset store exceeds the 24 MB limit' }));
              return;
            }
          }
          const payload = JSON.parse(body);
          const assets = payload?.assets;
          if (!Array.isArray(assets) || assets.length > 500) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: 'Expected an assets array with at most 500 items' }));
            return;
          }
          const ids = new Set();
          for (const asset of assets) {
            if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string' || !asset.id.trim() || !['character', 'item'].includes(asset.type)) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Every asset needs a non-empty id and type character or item' }));
              return;
            }
            if (ids.has(asset.id)) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: `Duplicate asset id: ${asset.id}` }));
              return;
            }
            ids.add(asset.id);
          }
          const store = { schemaVersion: 1, assets, updatedAt: new Date().toISOString() };
          await assertStorePathInsideProject();
          await fs.mkdir(path.dirname(storeFile), { recursive: true });
          await assertStorePathInsideProject();
          const temporaryFile = `${storeFile}.${process.pid}.${randomUUID()}.tmp`;
          await fs.writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
          try {
            await fs.rename(temporaryFile, storeFile);
          } catch (error) {
            await fs.rm(temporaryFile, { force: true });
            throw error;
          }
          response.statusCode = 200;
          response.end(JSON.stringify({ ok: true, updatedAt: store.updatedAt }));
        } catch (error) {
          if (!response.headersSent) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: error.message || 'Invalid JSON body' }));
          }
        }
      });
    },
  };
}

function comfyUiApi() {
  const prefix = '/api/lia-forge/comfyui';
  return {
    name: 'lia-forge-comfyui-read-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        let pathname;
        try {
          pathname = new URL(request.url || '/', 'http://vite.local').pathname;
        } catch {
          return next();
        }
        if (!pathname.startsWith(prefix)) return next();
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET');
          response.end('Method not allowed');
          return;
        }
        const origin = request.headers.origin;
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
            const requestHost = forwardedHost || request.headers.host;
            if (!requestHost || originHost.toLowerCase() !== String(requestHost).toLowerCase()) {
              response.statusCode = 403;
              response.end('Cross-origin access is not allowed');
              return;
            }
          } catch {
            response.statusCode = 403;
            response.end('Invalid Origin header');
            return;
          }
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        try {
          let result;
          if (pathname === `${prefix}/status`) result = await getComfyUiStatus();
          else if (pathname === `${prefix}/workflows`) result = await listComfyUiWorkflows();
          else {
            const workflowMatch = pathname.match(new RegExp(`^${prefix}/workflows/([a-z0-9-]+)$`));
            if (!workflowMatch) {
              response.statusCode = 404;
              response.end(JSON.stringify({ error: 'Unknown Lia Forge ComfyUI API route.' }));
              return;
            }
            result = await readComfyUiWorkflow(workflowMatch[1]);
          }
          response.statusCode = 200;
          response.end(JSON.stringify(result));
        } catch (error) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: error.message || 'ComfyUI request failed.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), projectAssetStore(), comfyUiApi()],
  server: {
    host: '0.0.0.0',
    // The Arena preview uses a per-session proxy hostname rather than localhost.
    allowedHosts: true,
  },
});
