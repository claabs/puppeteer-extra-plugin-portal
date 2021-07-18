/* eslint-disable class-methods-use-this */
import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

import type { Browser, Page } from 'puppeteer';
import { URL } from 'url';
import * as types from './types';
import { closePortal, hostPortal } from './server';
import { WebSocketParts } from './types';

/**
 * A puppeteer-extra plugin to let you interact with headless sessions remotely.
 * @noInheritDoc
 */
export class PuppeteerExtraPluginPortal extends PuppeteerExtraPlugin {
  constructor(opts: Partial<types.PluginOptions>) {
    super(opts);
    this.debug('Initialized', this.opts);
  }

  get name(): string {
    return 'portal';
  }

  get defaults(): types.PluginOptions {
    return {
      foo: true,
    };
  }

  async openPortal(page: Page): Promise<string> {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    const targetId = (page as any)._target._targetId as string;
    const browser = page.browser();
    const wsUrl = browser.wsEndpoint();
    // const wsParts = this.getWebSocketParts(browser.wsEndpoint());
    const url = hostPortal({ wsUrl, targetId, listenOpts: this.opts.listenOpts });
    return url;
  }

  async closePortal(page: Page): Promise<void> {
    const browser = page.browser();
    const wsParts = this.getWebSocketParts(browser.wsEndpoint());
    closePortal(wsParts.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCustomMethods(prop: Page & any) {
    /* eslint-disable no-param-reassign */
    prop.openPortal = async () => this.openPortal(prop);
    prop.closePortal = async () => this.openPortal(prop);
    /* eslint-enable no-param-reassign */
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
}

/** Default export, PuppeteerExtraPluginRecaptcha  */
const defaultExport = (options?: Partial<types.PluginOptions>): PuppeteerExtraPluginPortal => {
  return new PuppeteerExtraPluginPortal(options || {});
};

export default defaultExport;
