import express, { Router } from 'express';
import http, { Server } from 'http';
import path from 'path';
import type { ListenOptions } from 'net';
import https, { ServerOptions } from 'https';
import { once } from 'events';
import { URL } from 'url';
import debug from 'debug';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';

export interface PortalServerProps {
  listenOpts?: ListenOptions;
  serverOpts?: ServerOptions;
  webPortalBaseUrl: URL;
  // webSocketBaseUrl?: URL;
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

  private listenOpts?: ListenOptions;

  private serverOpts: ServerOptions = {};

  private webPortalBaseUrl: URL;

  // private webSocketBaseUrl?: URL;

  private app: express.Express;

  private debug: debug.Debugger;

  private router: Router;

  private wsProxy?: RequestHandler;

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
      if (this.wsProxy?.upgrade) {
        // http-proxy-middleware requires a `server` object to add the upgrade path.
        // Since it doesn't exist when setting up the middleware, we need to pass it to it after we start listening on the server
        this.server.on('upgrade', this.wsProxy.upgrade);
      }
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
    // TODO: we need to configure this to support multiple browsers simultaneously
    this.wsProxy = createProxyMiddleware('/ws', {
      target: params.wsUrl,
      logLevel: 'debug',
      ws: true,
      changeOrigin: true,
      ignorePath: true,
    });
    // Proxy websockets
    this.router.use(this.wsProxy);
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
    if (this.openPortals.size === 0) this.closeServer();
  }
}
