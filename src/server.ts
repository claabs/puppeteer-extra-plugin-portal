import express, { Router } from 'express';
import http, { Server } from 'http';
import path from 'path';
import type { ListenOptions, Socket } from 'net';
import https, { ServerOptions } from 'https';
import { once } from 'events';
import { URL } from 'url';
import debug from 'debug';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { LogProviderCallback } from 'http-proxy-middleware/dist/types';

export interface PortalServerProps {
  listenOpts?: ListenOptions;
  serverOpts?: ServerOptions;
  webPortalBaseUrl: URL;
  debug: debug.Debugger;
}

export interface HostPortalParams {
  wsUrl: string;
  targetId: string;
}

const frontendRoot =
  path.extname(__filename) === '.ts'
    ? path.join(__dirname, '..', 'dist', 'frontend')
    : path.join(__dirname, 'frontend');

export class PortalServer {
  private server?: Server;

  private openPortals: Set<string> = new Set();

  private targetIdProxyMap: Map<string, RequestHandler> = new Map();

  private listenOpts?: ListenOptions;

  private serverOpts: ServerOptions = {};

  private webPortalBaseUrl: URL;

  private app: express.Express;

  private debug: debug.Debugger;

  private router: Router;

  constructor(props: PortalServerProps) {
    this.debug = props.debug;
    this.listenOpts = props.listenOpts;
    this.serverOpts = props.serverOpts || {};
    this.webPortalBaseUrl = props.webPortalBaseUrl;
    this.app = express();
    this.router = express.Router();

    this.router.use(express.static(frontendRoot));

    const basePath = props.webPortalBaseUrl?.pathname || '/';

    this.app.use(basePath, this.router);
  }

  private proxyLogger: LogProviderCallback = () => {
    const subLogger = this.debug.extend('http-proxy-middleware');
    return {
      log: subLogger,
      debug: subLogger,
      error: subLogger,
      info: subLogger,
      warn: subLogger,
    };
  };

  private upgradeHandler(req: express.Request, socket: Socket, head: any): void {
    const targetId = req.url.split('/').slice(-1)[0];
    const proxyMiddleware = this.targetIdProxyMap.get(targetId);
    if (proxyMiddleware?.upgrade) {
      proxyMiddleware.upgrade(req, socket, head);
    } else {
      this.debug(`No proxy middleware found for targetId "${targetId}" when upgrading`);
    }
  }

  private async openServer(): Promise<void> {
    if (!this.server) {
      if (Object.entries(this.serverOpts).length > 0) {
        // The serverOpts are mostly HTTPS-related options, so use `https` if there's any options set
        this.server = https.createServer(this.serverOpts, this.app);
      } else {
        // Otherwise, we just use `http`. This is pretty much the first half of `this.app.listen()`
        this.server = http.createServer(this.app);
      }
      this.server = this.app.listen(this.listenOpts);
      await once(this.server, 'listening');
      // http-proxy-middleware requires a `server` object to add the upgrade path.
      // Since it doesn't exist when setting up the middleware, we need to pass it to it after we start listening on the server
      this.server.on('upgrade', this.upgradeHandler.bind(this));
    }
  }

  private async closeServer(): Promise<void> {
    if (this.server) {
      this.server.close();
      await once(this.server, 'close');
      this.server = undefined;
    }
  }

  public async hostPortal(params: HostPortalParams): Promise<string> {
    this.debug('params.wsUrl', params.wsUrl);
    const wsProxy = createProxyMiddleware(`/ws/${params.targetId}`, {
      target: params.wsUrl,
      logLevel: this.debug.enabled ? 'debug' : 'silent',
      logProvider: this.proxyLogger,
      ws: true,
      changeOrigin: true,
    });
    this.targetIdProxyMap.set(params.targetId, wsProxy);
    this.router.use('/ws', wsProxy); // Proxy websockets
    if (this.openPortals.size === 0) {
      await this.openServer();
    }
    this.openPortals.add(params.targetId);
    const fullUrl = this.webPortalBaseUrl;
    fullUrl.searchParams.set('targetId', params.targetId);
    this.debug('fullUrl', fullUrl.toString());
    return fullUrl.toString();
  }

  public async closePortal(targetId: string): Promise<void> {
    this.openPortals.delete(targetId);
    this.targetIdProxyMap.delete(targetId);
    if (this.openPortals.size === 0) this.closeServer();
  }
}
