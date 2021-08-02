# puppeteer-extra-plugin-portal

A [puppeteer-extra](https://github.com/berstend/puppeteer-extra) plugin that hosts a webserver to remotely view puppeteer sessions. Essentially opening a "portal" to the page.

## Install

```bash
yarn add puppeteer-extra-plugin-portal
# - or -
npm install puppeteer-extra-plugin-portal
```

If this is your first [puppeteer-extra](https://github.com/berstend/puppeteer-extra) plugin here's everything you need:

```bash
yarn add puppeteer puppeteer-extra puppeteer-extra-plugin-portal
# - or -
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-portal
```

## Usage

```typescript
// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
import puppeteer from 'puppeteer-extra';


// add portal plugin
import PortalPlugin from 'puppeteer-extra-plugin-portal';
puppeteer.use(
  PortalPlugin({
    // This is a typical configuration when hosting behind a secured reverse proxy
    webPortalConfig: {
        listenOpts: {
          port: 3000,
        },
        baseUrl: 'https://portal.example.com',
      },
      webSocketConfig: {
        port: 3001,
        baseUrl: 'wss://devtools.example.com',
      },
  })
)

// puppeteer usage as normal
puppeteer.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage();
  await page.goto('https://www.google.com/recaptcha/api2/demo');

  // Open a portal to get a link to it. 
  const portalUrl = await page.openPortal();
  console.log('Portal URL:', portalUrl);

  // Wait a long time for the success condition to be met
  const successDiv = await page.waitForSelector('.recaptcha-success', {
      timeout: 86400 * 1000, // 24 hours
    });
  await browser.close(); // Closing the browser will automatically close the webservers.
  // Otherwise, you can manually close a portal with
  await page.closePortal();
})
```