import express from 'express';
import http, { Server } from 'http';
import path from 'path';
import type { ListenOptions } from 'net';
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

  private debug: debug.Debugger;

  private basePath: string;

  private isMiddleware = false;

  constructor(props: PortalServerProps) {
    this.debug = props.debug;
    this.listenOpts = props.listenOpts;
    this.serverOpts = props.serverOpts || {};
    this.webPortalBaseUrl = props.webPortalBaseUrl;

    this.basePath = props.webPortalBaseUrl?.pathname || '/';
    this.debug('basePath:', this.basePath);
  }

  private portalMiddleware: express.RequestHandler = async (req, res, next) => {
    try {
      const upgradeHeader = (req.headers.upgrade || '').split(',').map((s) => s.trim());
      this.debug('Detected websocket upgrade header');
      if (upgradeHeader.indexOf('websocket') === 0) {
        if (!this.wsServer) {
          this.debug('Creating new WebSocket server');
          this.wsServer = new WebSocketServer({ noServer: true });
        }
        await this.upgradeHandler(req, this.wsServer);
        return undefined;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };

  private middlewareHandlers = [express.static(frontendRoot), this.portalMiddleware];

  public createPortalMiddleware(): express.RequestHandler[] {
    this.isMiddleware = true;
    return this.middlewareHandlers;
  }

  private upgradeHandler(req: http.IncomingMessage, wsServer: WebSocketServer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      wsServer.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws, request) => {
        try {
          this.debug('In wsServer handleUpgrade');
          if (!request.url) throw new Error('Websocket request lacks URL');
          const targetId = request.url.split('/').slice(-1)[0];
          if (!targetId) throw new Error(`Could not find targetId in upgrade request`);
          const pageHandler = this.targetIdPageHandlerMap.get(targetId);
          if (!pageHandler) throw new Error('Could not find matching page handler for target ID');
          pageHandler.setWs(ws);
          wsServer.emit('connection', ws, req);
          this.debug('Emitted connection for target %s', targetId);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async openServer(): Promise<void> {
    if (!this.server) {
      this.debug('Starting the express server...');
      const app = express();
      app.use(this.basePath, this.middlewareHandlers);
      if (Object.entries(this.serverOpts).length > 0) {
        // The serverOpts are mostly HTTPS-related options, so use `https` if there's any options set
        this.server = https.createServer(this.serverOpts, app);
      } else {
        // Otherwise, we just use `http`. This is pretty much the first half of `app.listen()`
        this.server = http.createServer(app);
      }
      this.server = app.listen(this.listenOpts);
      await once(this.server, 'listening');
      this.debug('Express server now listening');
    }
  }

  private async closeServer(): Promise<void> {
    if (this.server) {
      this.debug('No more open portals, shutting down the express server...');
      this.server.close(() => {
        this.debug('The express server has been closed');
        this.server = undefined;
      });
    }
  }

  public async hostPortal(params: HostPortalParams): Promise<string> {
    if (this.targetIdPageHandlerMap.size === 0 && !this.isMiddleware) {
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
    if (this.targetIdPageHandlerMap.size === 0 && !this.isMiddleware) {
      this.closeServer();
    }
  }

  public hasOpenPortal(targetId: string): boolean {
    return this.targetIdPageHandlerMap.has(targetId);
  }
}
