/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable class-methods-use-this */
import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

import type { Browser, Page, Target } from 'puppeteer';
import { URL } from 'url';
import { RequestHandler } from 'express';
import * as types from './types';
import { PortalServer } from './server';

export * from './types';

const getPageTargetId = (page: Page): string => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, no-underscore-dangle, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  return (page.target() as any)._targetId;
};

/**
 * A puppeteer-extra plugin to let you interact with headless sessions remotely.
 * @noInheritDoc
 */
export class PuppeteerExtraPluginPortal extends PuppeteerExtraPlugin {
  private webPortalBaseUrl: URL;

  private portalServer: PortalServer;

  public createExpressMiddleware: () => RequestHandler[];

  constructor(opts?: Partial<types.PluginOptions>) {
    super(opts);
    this.debug('Initialized', this.opts);
    this.webPortalBaseUrl = new URL((this.opts as types.PluginOptions).webPortalConfig!.baseUrl!);
    this.portalServer = new PortalServer({
      debug: this.debug,
      webPortalBaseUrl: this.webPortalBaseUrl,
      listenOpts: (this.opts as types.PluginOptions).webPortalConfig?.listenOpts,
      serverOpts: (this.opts as types.PluginOptions).webPortalConfig?.serverOpts,
    });
    this.createExpressMiddleware = this.portalServer.createPortalMiddleware.bind(this.portalServer);
  }

  public override get name(): string {
    return 'portal';
  }

  public override get defaults(): types.PluginOptions {
    return {
      webPortalConfig: {
        listenOpts: {
          port: 3000,
        },
        baseUrl: 'http://localhost:3000',
      },
    };
  }

  public async openPortal(page: Page): Promise<string> {
    const targetId = getPageTargetId(page);
    const url = await this.portalServer.hostPortal({
      page,
      targetId,
    });
    return url;
  }

  public async closePortal(page: Page): Promise<void> {
    const targetId = getPageTargetId(page);
    await this.portalServer.closePortal(targetId);
  }

  public hasOpenPortal(page: Page): boolean {
    const targetId = getPageTargetId(page);
    return this.portalServer.hasOpenPortal(targetId);
  }

  private async closeAllBrowserPortals(browser: Browser) {
    this.debug('Closing all portals for browser');
    const pages = await browser.pages();
    const closePortalPromises = pages.map(this.closePortal.bind(this));
    await Promise.all(closePortalPromises);
  }

  private addCustomMethods(prop: Page) {
    /* eslint-disable no-param-reassign */
    prop.openPortal = async () => this.openPortal(prop);
    prop.closePortal = async () => this.closePortal(prop);
    prop.hasOpenPortal = () => this.hasOpenPortal(prop);
  }

  /** Add additions to already existing pages  */
  override async onBrowser(browser: Browser): Promise<void> {
    const pages = await browser.pages();
    pages.forEach((page) => this.addCustomMethods(page));
    browser.on('disconnected', () => this.closeAllBrowserPortals(browser));
  }

  override async onTargetCreated(target: Target): Promise<void> {
    this.debug('onTargetCreated', target.url());
    const page = await target.page();
    if (page) {
      this.addCustomMethods(page);
      page.on('close', () => this.closePortal(page));
    }
  }
}

/** Default export, PuppeteerExtraPluginRecaptcha  */
const defaultExport = (options?: Partial<types.PluginOptions>): PuppeteerExtraPluginPortal => {
  return new PuppeteerExtraPluginPortal(options);
};

export default defaultExport;
