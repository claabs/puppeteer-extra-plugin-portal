import express from 'express';
import { Server } from 'http';
import path from 'path';
import type { ListenOptions } from 'net';
import https, { ServerOptions } from 'https';

const BASE_URL = '/';
const app = express();
const router = express.Router();

router.use(express.static(path.join(__dirname, 'frontend', 'static')));

router.get('/ws*', (request, response) => {
  response.sendFile(path.resolve(__dirname, 'frontend', 'static', 'index.html'));
});

app.use(BASE_URL, router);

let server: Server | undefined;
const openPortals = new Set<string>();

function openServer(listenOpts?: ListenOptions, serverOpts: ServerOptions = {}) {
  if (!server) {
    if (Object.entries(serverOpts).length > 0) {
      server = https.createServer(serverOpts, app);
      server.listen(listenOpts);
    } else {
      app.listen(listenOpts);
    }
  }
}

function closeServer() {
  if (server) {
    server.close();
    server = undefined;
  }
}

export interface HostPortalParams {
  wsUrl: string;
  targetId: string;
  listenOpts?: ListenOptions;
}

export function hostPortal(params: HostPortalParams): string {
  openServer(params.listenOpts);
  openPortals.add(params.wsUrl); // Do I need to add targetId as well?
  // TODO: Fix this URL via baseURL config
  return `http://localhost:3000/${encodeURIComponent(params.wsUrl)}?targetId=${encodeURIComponent(
    params.targetId
  )}`;
}

export function closePortal(id: string): void {
  openPortals.delete(id);
  if (openPortals.size === 0) closeServer();
}
