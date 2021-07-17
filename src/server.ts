import express from 'express';
import { Server } from 'http';
import path from 'path';

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

function openServer() {
  if (!server) server = app.listen('3000');
}

function closeServer() {
  if (server) {
    server.close();
    server = undefined;
  }
}

export function hostPortal(wsUrl: string, targetId: string): string {
  openServer();
  openPortals.add(wsUrl); // Do I need to add targetId as well?
  return `http://localhost:3000/${encodeURIComponent(wsUrl)}?targetId=${encodeURIComponent(
    targetId
  )}`;
}

export function closePortal(id: string): void {
  openPortals.delete(id);
  if (openPortals.size === 0) closeServer();
}
