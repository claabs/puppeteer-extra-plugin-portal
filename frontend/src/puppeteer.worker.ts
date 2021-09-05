/* eslint-disable no-restricted-globals */
/* eslint-disable no-underscore-dangle */
// Make sure WS transport is loaded and in webpack's cache
import 'puppeteer-core/lib/esm/puppeteer/common/BrowserWebSocketTransport';
import { Browser, Page, CDPSession } from 'puppeteer-core/lib/esm/puppeteer/api-docs-entry';
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/web';

import { ProtocolCommands, HostCommands, Message, WorkerCommands } from './types';

const protocolCommands = Object.keys(ProtocolCommands);

let browser: Browser | void;
let page: Page | void;
let client: CDPSession | void;

const sendParentMessage = (message: Message) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  self.postMessage(message); // Empty string might break this?
};

// // Override console so that messages show up in the browser's console
// // Since we're in a webworker this won't disable console messages in
// // the main app itself.
// Object.keys(self.console).forEach((consoleMethod: string) => {
//   (self.console as any)[consoleMethod] = (...args: any) =>
//     page &&
//     page.evaluate(
//       (innerConsoleMethod, ...innerArgs) => {
//         (console as any)[innerConsoleMethod](...innerArgs);
//       },
//       consoleMethod,
//       ...args
//     );
// });

const closeWorker = async () => {
  if (browser) browser.disconnect();
  return self.close();
};

const onScreencastFrame = ({
  data,
  sessionId,
  metadata,
}: {
  data: string;
  sessionId: number;
  metadata: Record<string, any>;
}) => {
  console.log('OnScreencastFrame. sessionId:', sessionId, ' metadata:', JSON.stringify(metadata));
  if (client) {
    console.log('client exists');
    client
      .send('Page.screencastFrameAck', { sessionId })
      .then(() => console.log('sent ack for sessionid', sessionId))
      .catch(() => console.error('Could not send screencast ack'));
    sendParentMessage({ command: WorkerCommands.screencastFrame, data });
  }
};

// eslint-disable-next-line consistent-return
const start = async (data: Message['data']) => {
  const { targetId, browserWSEndpoint, quality = 100 } = data;

  browser = await puppeteer.connect({ browserWSEndpoint }).catch((error) => {
    console.error(error);
    return undefined;
  });

  if (!browser) {
    sendParentMessage({
      command: WorkerCommands.error,
      data: `⚠️ Couldn't establish a connection "${browserWSEndpoint}". Is your browser running?`,
    });
    return self.close();
  }

  browser.once('disconnected', () => {
    sendParentMessage({ command: WorkerCommands.browserClose, data: null });
    closeWorker();
  });
  const pages = await browser.pages();
  console.log('pages:', pages);
  page = pages.find((p: Page) => p.target()._targetId === targetId);
  if (!page) {
    sendParentMessage({
      command: WorkerCommands.error,
      data: `⚠️ Couldn't find target with targetId ${targetId}`,
    });
    return self.close();
  }
  client = await page.target().createCDPSession();

  await client.send('Page.startScreencast', { format: 'jpeg', quality });

  client.on('Page.screencastFrame', onScreencastFrame);

  sendParentMessage({
    command: WorkerCommands.startComplete,
    data: {
      targetId: page.target()._targetId,
    },
  });
};

const setViewport = (data: { width: number; height: number; deviceScaleFactor: number }) =>
  page && page.setViewport(data);

// Register Commands
self.addEventListener(
  'message',
  // eslint-disable-next-line consistent-return
  async (message) => {
    const { command, data } = message.data as Message;

    if (command === HostCommands.start) {
      return start(data);
    }

    if (command === HostCommands.setViewport) {
      return setViewport(data);
    }

    if (command === HostCommands.close) {
      return closeWorker();
    }

    if (protocolCommands.includes(command)) {
      // eslint-disable-next-line consistent-return
      if (!client) return;
      const protocolCommand = command as ProtocolCommands;
      return client.send(protocolCommand, data);
    }

    console.debug(`Unknown worker command:`, message);
  },
  false
);
