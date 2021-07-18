/* eslint-disable no-console */
import { addExtra } from 'puppeteer-extra';
import PortalPlugin from './index';

const PUPPETEER_ARGS = [
  /* '--no-sandbox', '--disable-setuid-sandbox', */ '--remote-debugging-port=3001',
  // '--enable-logging=stderr --v=1',
  // '--remote-debugging-address=localhost',
];

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
      listenOpts: {
        port: 3000,
        // host: 'localhost',
      },
    });
    puppeteer.use(portalPlugin);

    const browser = await puppeteer.launch({
      args: PUPPETEER_ARGS,
      headless: true,
    });
    console.log('launched');
    const page = await browser.newPage();
    const url = await page.openPortal();
    console.log(url);
    await page.goto('https://www.google.com/recaptcha/api2/demo', { waitUntil: 'networkidle0' });
    const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000,
    });
    expect(successDiv).toBeDefined();
    await browser.close();
  });
});
