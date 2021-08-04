import express from 'express';
import { Server } from 'http';
import path from 'path';
import type { ListenOptions } from 'net';
import https, { ServerOptions } from 'https';
import { once } from 'events';
import { URL } from 'url';

export interface PortalServerProps {
  listenOpts?: ListenOptions;
  serverOpts?: ServerOptions;
  webPortalBaseUrl: URL;
  webSocketBaseUrl?: URL;
}

export interface HostPortalParams {
  wsUrl: string;
  targetId: string;
  listenOpts?: ListenOptions;
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

  private webSocketBaseUrl?: URL;

  private app: express.Express;

  constructor(props: PortalServerProps) {
    this.listenOpts = props.listenOpts;
    this.serverOpts = props.serverOpts || {};
    this.webPortalBaseUrl = props.webPortalBaseUrl;
    this.webSocketBaseUrl = props.webSocketBaseUrl;
    this.app = express();
    const router = express.Router();

    router.use(express.static(frontendRoot));

    // There has to be a better way to do this...
    router.get('/ws*', (request, response) => {
      response.sendFile(path.join(frontendRoot, 'index.html'));
    });

    const basePath = props.webPortalBaseUrl?.pathname || '/';

    this.app.use(basePath, router);
  }

  private async openServer(): Promise<void> {
    if (!this.server) {
      if (Object.entries(this.serverOpts).length > 0) {
        this.server = https.createServer(this.serverOpts, this.app);
        this.server.listen(this.listenOpts);
      } else {
        this.server = this.app.listen(this.listenOpts);
      }
      await once(this.server, 'listening');
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
    if (this.openPortals.size === 0) {
      await this.openServer();
    }
    this.openPortals.add(params.targetId);
    const wsUrl = new URL(params.wsUrl);
    const fullUrl = this.webPortalBaseUrl;
    if (this.webSocketBaseUrl) {
      wsUrl.hostname = this.webSocketBaseUrl.hostname;
      wsUrl.port = this.webSocketBaseUrl.port;
      wsUrl.protocol = this.webSocketBaseUrl.protocol;
    }
    fullUrl.pathname = `${
      this.webPortalBaseUrl.pathname === '/' ? '' : this.webPortalBaseUrl.pathname
    }/${encodeURIComponent(wsUrl.toString())}`;
    fullUrl.searchParams.set('targetId', encodeURIComponent(params.targetId));
    return fullUrl.toString();
  }

  public async closePortal(targetId: string): Promise<void> {
    this.openPortals.delete(targetId);
    if (this.openPortals.size === 0) this.closeServer();
  }
}
