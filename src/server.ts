import express, { Router } from 'express';
import http, { Server } from 'http';
import path from 'path';
import type { ListenOptions, Socket } from 'net';
import https, { ServerOptions } from 'https';
import { once } from 'events';
import { URL } from 'url';
import debug from 'debug';
import { WebSocketServer } from 'ws';
import type { Page } from 'puppeteer';
import { PageHandler } from './page-handler';

export interface PortalServerProps {
  listenOpts?: ListenOptions;
  serverOpts?: ServerOptions;
  webPortalBaseUrl: URL;
  debug: debug.Debugger;
}

export interface HostPortalParams {
  page: Page;
  targetId: string;
}

const frontendRoot =
  path.extname(__filename) === '.ts'
    ? path.join(__dirname, '..', 'dist', 'frontend')
    : path.join(__dirname, 'frontend');

export class PortalServer {
  private server?: Server;

  private wsServer?: WebSocketServer;

  private targetIdPageHandlerMap: Map<string, PageHandler> = new Map();

  private listenOpts?: ListenOptions;

  private serverOpts: ServerOptions = {};

  private webPortalBaseUrl: URL;

  private app: express.Express;

  private debug: debug.Debugger;

  private router: Router;

  private basePath: string;

  constructor(props: PortalServerProps) {
    this.debug = props.debug;
    this.listenOpts = props.listenOpts;
    this.serverOpts = props.serverOpts || {};
    this.webPortalBaseUrl = props.webPortalBaseUrl;
    this.app = express();
    this.router = express.Router();

    this.router.use(express.static(frontendRoot));

    this.basePath = props.webPortalBaseUrl?.pathname || '/';
    this.debug('basePath:', this.basePath);
    this.app.use(this.basePath, this.router);
  }

  private upgradeHandler(req: express.Request, socket: Socket, head: Buffer): void {
    if (this.wsServer) {
      this.wsServer.handleUpgrade(req, socket, head, (ws, request) => {
        if (!request.url) throw new Error('Websocket request lacks URL');
        const targetId = request.url.split('/').slice(-1)[0];
        if (!targetId) throw new Error(`Could not find targetId in upgrade request`);
        const pageHandler = this.targetIdPageHandlerMap.get(targetId);
        if (!pageHandler) throw new Error('Could not find matching page handler for target ID');
        pageHandler.setWs(ws);
        this.wsServer?.emit('connection', ws, req);
      });
    } else {
      this.debug(`No WebSocket server found when upgrading`);
    }
  }

  private async openServer(): Promise<void> {
    if (!this.server) {
      this.debug('Starting the express server...');
      if (Object.entries(this.serverOpts).length > 0) {
        // The serverOpts are mostly HTTPS-related options, so use `https` if there's any options set
        this.server = https.createServer(this.serverOpts, this.app);
      } else {
        // Otherwise, we just use `http`. This is pretty much the first half of `this.app.listen()`
        this.server = http.createServer(this.app);
      }
      this.wsServer = new WebSocketServer({ noServer: true });
      this.server = this.app.listen(this.listenOpts);
      await once(this.server, 'listening');
      this.debug('Express server now listening');
      this.server.on('upgrade', this.upgradeHandler.bind(this));
    }
  }

  private async closeServer(): Promise<void> {
    if (this.server) {
      this.server.on('close', () => {
        this.debug('The express server has been closed');
      });
      this.debug('No more open portals, shutting down the express server...');
      this.server.close();
      this.server = undefined;
    }
  }

  public async hostPortal(params: HostPortalParams): Promise<string> {
    if (this.targetIdPageHandlerMap.size === 0) {
      await this.openServer();
    }
    const pageHandler = new PageHandler({
      page: params.page,
      targetId: params.targetId,
      debug: this.debug,
    });
    this.targetIdPageHandlerMap.set(params.targetId, pageHandler);
    const fullUrl = this.webPortalBaseUrl;
    fullUrl.searchParams.set('targetId', params.targetId);
    this.debug('fullUrl', fullUrl.toString());
    return fullUrl.toString();
  }

  public async closePortal(targetId: string): Promise<void> {
    this.debug(`Closing portal for targetId "${targetId}"`);
    const handler = this.targetIdPageHandlerMap.get(targetId);
    if (handler) await handler.close();
    this.targetIdPageHandlerMap.delete(targetId);
    if (this.targetIdPageHandlerMap.size === 0) this.closeServer();
  }

  public hasOpenPortal(targetId: string): boolean {
    return this.targetIdPageHandlerMap.has(targetId);
  }
}
