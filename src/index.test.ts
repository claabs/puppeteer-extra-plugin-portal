/* eslint-disable no-console */
import { addExtra } from 'puppeteer-extra';
import { Page } from 'puppeteer';
import open from 'open';
import PortalPlugin from './index';

function getDevtoolsUrl(page: Page): string {
  // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/no-explicit-any
  const targetId: string = (page.target() as any)._targetId;
  const wsEndpoint = new URL(page.browser().wsEndpoint());
  // devtools://devtools/bundled/inspector.html?ws=127.0.0.1:35871/devtools/page/2B4E5714B42640A1C61AB9EE7E432730
  return `devtools://devtools/bundled/inspector.html?ws=${wsEndpoint.host}/devtools/page/${targetId}`;
}

jest.setTimeout(86400 * 1000);
describe('Top level plugin interface', () => {
  // beforeEach(async () => {
  //   const puppeteer = addExtra(require('puppeteer'));
  //   try {
  //     const browser = await puppeteer.connect({
  //       browserURL: 'http://localhost:3001',
  //     });
  //     browser.close();
  //   } catch (err) {
  //     console.log('nothing to close');
  //   }
  // });

  it.skip('should shutdown portals on a closed browser', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    await page.openPortal();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await browser.close();
    expect(page.hasOpenPortal()).toBeFalsy();
    expect(browser.isConnected()).toBeFalsy();
  });

  it.skip('should support a second portal session', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    await page.openPortal();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.closePortal();
    expect(page.hasOpenPortal()).toBeFalsy();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    const url = await page.openPortal();
    console.log(url);

    const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000,
    });
    expect(successDiv).toBeDefined();
    await browser.close();
  });

  it.skip('should shutdown portal on a closed page', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    await page.openPortal();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.close();
    expect(page.hasOpenPortal()).toBeFalsy();
    await browser.close();
  });

  it('should wait for user input', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    const url = await page.openPortal();
    console.log(url);
    open(url);

    const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000,
    });
    expect(successDiv).toBeDefined();
    await browser.close();
  });

  it.skip('should handle multiple browsers', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    const url = await page.openPortal();
    console.log(url);

    const browser2 = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page2 = await browser2.newPage();
    await page2.goto('https://www.google.com/', { waitUntil: 'networkidle0' });
    const url2 = await page2.openPortal();
    console.log(url2);

    const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000,
    });
    expect(successDiv).toBeDefined();
    await browser.close();
    await browser2.close();
  });

  it.skip('should go back and forward', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin();
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    const url = await page.openPortal();
    console.log(url);

    const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000,
    });
    expect(successDiv).toBeDefined();
    await browser.close();
  });
});
