/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./puppeteer-mods.d.ts" />

import { ServerOptions } from 'https';
import type { ListenOptions } from 'net';

// Warn: The above is EXTREMELY important for our custom page mods to be recognized by the end users typescript!

export type PortalPluginPageAdditions = {
  openPortal: () => Promise<string>;

  closePortal: () => Promise<void>;
};

export interface PluginOptions {
  /** Example */
  foo: boolean;

  /**
   * Node Net.listen options: https://nodejs.org/api/net.html#net_server_listen_options_callback
   */
  listenOpts?: ListenOptions;

  /**
   * Node HTTPS.createServer options: https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
   */
  serverOpts?: ServerOptions;
}

export interface WebSocketParts {
  hostname: string;
  port: string;
  id: string;
  protocol: string;
}
