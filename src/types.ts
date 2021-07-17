/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./puppeteer-mods.d.ts" />
// Warn: The above is EXTREMELY important for our custom page mods to be recognized by the end users typescript!

export type PortalPluginPageAdditions = {
  openPortal: () => Promise<string>;

  closePortal: () => Promise<void>;
};

export interface PluginOptions {
  /** Example */
  foo: boolean;
}

export interface WebSocketParts {
  hostname: string;
  port: string;
  id: string;
  protocol: string;
}
