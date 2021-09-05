/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./puppeteer-mods.d.ts" />
// Warn: The above is EXTREMELY important for our custom page mods to be recognized by the end users typescript!

import { ServerOptions } from 'https';
import type { ListenOptions } from 'net';

// Warn: The above is EXTREMELY important for our custom page mods to be recognized by the end users typescript!

export type PortalPluginPageAdditions = {
  openPortal: () => Promise<string>;

  closePortal: () => Promise<void>;

  hasOpenPortal: () => boolean;
};

export interface WebPortalConnectionConfig {
  /**
   * The URL base that will be returned when creating a portal
   * @example 'https://portal.example.com'
   * @default 'http://localhost:3000'
   */
  baseUrl?: string;

  /**
   * Node Net.listen options: https://nodejs.org/api/net.html#net_server_listen_options_callback
   * @default listenOpts.port: 3000
   */
  listenOpts?: ListenOptions;

  /**
   * Node HTTPS.createServer options: https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
   */
  serverOpts?: ServerOptions;
}

export interface PluginOptions {
  /**
   * Server configs for the webserver hosting the UI that the user accesses to interact with the portal
   */
  webPortalConfig?: WebPortalConnectionConfig;
}
