/* eslint-disable no-console */
import { addExtra } from 'puppeteer-extra';
import PortalPlugin from './index';

jest.setTimeout(86400 * 1000);
describe('Top level plugin interface', () => {
  beforeEach(async () => {
    const puppeteer = addExtra(require('puppeteer'));
    try {
      const browser = await puppeteer.connect({
        browserURL: 'http://localhost:3001',
      });
      browser.close();
    } catch (err) {
      console.log('nothing to close');
    }
  });

  it('should wait for user input', async () => {
    const puppeteer = addExtra(require('puppeteer'));
    const portalPlugin = PortalPlugin({
      webPortalConfig: {
        listenOpts: {
          port: 3000,
        },
        // baseUrl: 'https://3000.example.com',
        baseUrl: 'http://localhost:3000',
      },
      webSocketConfig: {
        port: 3001,
        // baseUrl: 'wss://3001.example.com',
      },
    });
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
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
