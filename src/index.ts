/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable class-methods-use-this */
import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

import type { Browser, LaunchOptions, Page, Target } from 'puppeteer';
import { URL } from 'url';
import * as types from './types';
import { PortalServer } from './server';
import { WebSocketParts } from './types';

/**
 * A puppeteer-extra plugin to let you interact with headless sessions remotely.
 * @noInheritDoc
 */
export class PuppeteerExtraPluginPortal extends PuppeteerExtraPlugin {
  private webPortalBaseUrl: URL;

  private webSocketBaseUrl?: URL;

  private portalServer: PortalServer;

  constructor(opts: Partial<types.PluginOptions>) {
    super(opts);
    this.debug('Initialized', this.opts);
    this.webPortalBaseUrl = new URL((this.opts as types.PluginOptions).webPortalConfig!.baseUrl!);
    this.webSocketBaseUrl = (this.opts as types.PluginOptions).webSocketConfig?.baseUrl
      ? new URL((this.opts as types.PluginOptions).webSocketConfig!.baseUrl!)
      : undefined;
    if (this.webPortalBaseUrl.protocol === 'https:' && this.webSocketBaseUrl?.protocol !== 'wss:') {
      throw new Error(
        'If portal baseUrl is secured (https), the webSocket baseUrl must also be secured (wss)'
      );
    }
    this.portalServer = new PortalServer({
      webPortalBaseUrl: this.webPortalBaseUrl,
      webSocketBaseUrl: this.webSocketBaseUrl,
      listenOpts: (this.opts as types.PluginOptions).webPortalConfig?.listenOpts,
      serverOpts: (this.opts as types.PluginOptions).webPortalConfig?.serverOpts,
    });
  }

  get name(): string {
    return 'portal';
  }

  get defaults(): types.PluginOptions {
    return {
      foo: true,
      webPortalConfig: {
        listenOpts: {
          port: 3000,
        },
        baseUrl: 'http://localhost:3000',
      },
    };
  }

  async beforeLaunch(options: LaunchOptions & { args: string[] }): Promise<void> {
    const webSocketPort = (this.opts as types.PluginOptions).webSocketConfig?.port;
    const webSocketAddress = (this.opts as types.PluginOptions).webSocketConfig?.address;
    if (webSocketPort) {
      options.args.push(`--remote-debugging-port=${webSocketPort}`);
    }
    if (webSocketAddress) {
      options.args.push(`----remote-debugging-address=${webSocketAddress}`);
    }
  }

  async openPortal(page: Page): Promise<string> {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    const targetId = (page as any)._target._targetId as string;
    const browser = page.browser();
    const wsUrl = browser.wsEndpoint();
    // const wsParts = this.getWebSocketParts(browser.wsEndpoint());
    const url = await this.portalServer.hostPortal({
      wsUrl,
      targetId,
      listenOpts: (this.opts as types.PluginOptions).webPortalConfig?.listenOpts,
    });
    return url;
  }

  async closePortal(page: Page): Promise<void> {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    const targetId = (page as any)._target._targetId as string;
    await this.portalServer.closePortal(targetId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCustomMethods(prop: Page & any) {
    /* eslint-disable no-param-reassign */
    prop.openPortal = async () => this.openPortal(prop);
    prop.closePortal = async () => this.openPortal(prop);
  }

  private getWebSocketParts(wsEndpoint: string): WebSocketParts {
    // ws://127.0.0.1:3001/devtools/browser/43a62a3f-0e04-40ea-bae3-04832ee4ce43
    const wsUrl = new URL(wsEndpoint);
    const { hostname, port, protocol } = wsUrl;
    const [id] = wsUrl.pathname.split('/').slice(-1);
    return {
      protocol,
      id,
      hostname,
      port,
    };
  }

  async onPageCreated(page: Page): Promise<void> {
    this.debug('onPageCreated', page.url());

    // Add custom page methods
    this.addCustomMethods(page);
  }

  /** Add additions to already existing pages  */
  async onBrowser(browser: Browser): Promise<void> {
    const pages = await browser.pages();
    pages.forEach((page) => this.addCustomMethods(page));
  }

  async onTargetDestroyed(target: Target): Promise<void> {
    const page = await target.page();
    if (page) {
      await this.closePortal(page);
    }
  }
}

/** Default export, PuppeteerExtraPluginRecaptcha  */
const defaultExport = (options?: Partial<types.PluginOptions>): PuppeteerExtraPluginPortal => {
  return new PuppeteerExtraPluginPortal(options || {});
};

export default defaultExport;
