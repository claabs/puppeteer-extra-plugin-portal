/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable class-methods-use-this */
import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

import type { Browser, LaunchOptions, Page, Target } from 'puppeteer';
import { URL } from 'url';
import * as types from './types';
import { PortalServer } from './server';

export * from './types';

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
    this.webPortalBaseUrl = new URL(
      (this.opts as types.PluginOptions).webPortalConfig?.baseUrl || 'http://localhost:3000'
    );
    this.webSocketBaseUrl = (this.opts as types.PluginOptions).webSocketConfig?.baseUrl
      ? new URL((this.opts as types.PluginOptions).webSocketConfig!.baseUrl!)
      : undefined;
    if (this.webPortalBaseUrl.protocol === 'https:' && this.webSocketBaseUrl?.protocol !== 'wss:') {
      throw new Error(
        'If portal baseUrl is secured (https), the webSocket baseUrl must also be secured (wss)'
      );
    }
    this.portalServer = new PortalServer({
      debug: this.debug,
      webPortalBaseUrl: this.webPortalBaseUrl,
      listenOpts: (this.opts as types.PluginOptions).webPortalConfig?.listenOpts,
      serverOpts: (this.opts as types.PluginOptions).webPortalConfig?.serverOpts,
    });
  }

  public get name(): string {
    return 'portal';
  }

  // TODO: This doesn't set defaults...
  public get defaults(): types.PluginOptions {
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

  public async openPortal(page: Page): Promise<string> {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    const targetId = (page.target() as any)._targetId as string;
    const browser = page.browser();
    const wsUrl = browser.wsEndpoint();
    // const wsParts = this.getWebSocketParts(browser.wsEndpoint());
    const url = await this.portalServer.hostPortal({
      wsUrl,
      targetId,
    });
    return url;
  }

  public async closePortal(page: Page): Promise<void> {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    const targetId = (page.target() as any)._targetId as string;
    await this.portalServer.closePortal(targetId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCustomMethods(prop: Page & any) {
    /* eslint-disable no-param-reassign */
    prop.openPortal = async () => this.openPortal(prop);
    prop.closePortal = async () => this.openPortal(prop);
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
