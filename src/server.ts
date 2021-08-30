import express from 'express';
import { Server } from 'http';
import path from 'path';
import type { ListenOptions } from 'net';
import https, { ServerOptions } from 'https';
import { once } from 'events';
import { URL } from 'url';
import debug from 'debug';

export interface PortalServerProps {
  listenOpts?: ListenOptions;
  serverOpts?: ServerOptions;
  webPortalBaseUrl: URL;
  webSocketBaseUrl?: URL;
  debug: debug.Debugger;
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

  private debug: debug.Debugger;

  constructor(props: PortalServerProps) {
    this.debug = props.debug;
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
    this.debug('params.wsUrl', params.wsUrl);
    const wsUrl = new URL(params.wsUrl);
    this.debug('wsUrl', wsUrl);
    const fullUrl = this.webPortalBaseUrl;
    // http://localhost:3000/ws%3A%2F%2F127.0.0.1%3A40523%2Fdevtools%2Fbrowser%2F895f08da-143e-442b-9bfa-4c70a48654d2/ws%3A%2F%2F127.0.0.1%3A40523%2Fdevtools%2Fbrowser%2F895f08da-143e-442b-9bfa-4c70a48654d2/ws%3A%2F%2F127.0.0.1%3A44633%2Fdevtools%2Fbrowser%2Fc9105a48-285f-4286-a987-387a9a6e73c6?targetId=1B2B98BB9CAEB2176CEA7CB167EEAB53
    if (this.webSocketBaseUrl) {
      wsUrl.hostname = this.webSocketBaseUrl.hostname;
      wsUrl.port = this.webSocketBaseUrl.port;
      wsUrl.protocol = this.webSocketBaseUrl.protocol;
    }
    this.debug('wsUrl.toString()', wsUrl.toString());
    fullUrl.pathname = `${
      this.webPortalBaseUrl.pathname === '/' ? '' : this.webPortalBaseUrl.pathname
    }/${encodeURIComponent(wsUrl.toString())}`;
    this.debug('fullUrl.pathname', fullUrl.pathname);
    fullUrl.searchParams.set('targetId', encodeURIComponent(params.targetId));
    return fullUrl.toString();
  }

  public async closePortal(targetId: string): Promise<void> {
    this.openPortals.delete(targetId);
    if (this.openPortals.size === 0) this.closeServer();
  }
}
