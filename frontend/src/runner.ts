import { debounce, once } from './util';
import { getConnectURL, getTargetId } from './api';

import { ProtocolCommands, HostCommands, Message, WorkerCommands } from './types';

const runnerHTML = `
<div id="viewer">
  <canvas id="screencast"></canvas>
</div>`;

const errorHTML = (error: string) =>
  `<div class="fixed-message"><code style="color: red">${error.toString()}</code></div>`;

interface RunnerParams {
  code: string;
  $mount: HTMLElement;
  onClose: (...args: any[]) => void;
}

export default class Runner {
  private puppeteerWorker!: Worker;

  private readonly onClose: RunnerParams['onClose'];

  private $mount: RunnerParams['$mount'];

  private $canvas!: HTMLCanvasElement;

  private $viewer!: HTMLElement;

  private ctx!: CanvasRenderingContext2D;

  private img = new Image();

  private started = false;

  static getModifiersForEvent(event: any) {
    return (
      // eslint-disable-next-line no-bitwise
      (event.altKey ? 1 : 0) |
      (event.ctrlKey ? 2 : 0) |
      (event.metaKey ? 4 : 0) |
      (event.shiftKey ? 8 : 0)
    );
  }

  constructor({ $mount, onClose }: { $mount: HTMLElement; onClose: () => void }) {
    this.$mount = $mount;
    this.onClose = onClose;

    this.setupPuppeteerWorker();
  }

  onVerticalResize = (evt: MouseEvent) => {
    evt.preventDefault();

    this.$mount.style.pointerEvents = 'none';
    this.$viewer.style.flex = 'initial';

    let onMouseMove: any = (moveEvent: MouseEvent) => {
      if (moveEvent.buttons === 0) {
        return;
      }

      this.$viewer.style.height = `${moveEvent.clientY - 71}px`;
      this.$canvas.height = moveEvent.clientY - 71;
    };

    let onMouseUp: any = () => {
      this.$mount.style.pointerEvents = 'initial';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      onMouseMove = null;
      onMouseUp = null;
      this.resizePage();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  emitMouse = (evt: any) => {
    const buttons: any = { 0: 'none', 1: 'left', 2: 'middle', 3: 'right' };
    const event: any = evt.type === 'mousewheel' ? window.event || evt : evt;
    const types: any = {
      mousedown: 'mousePressed',
      mouseup: 'mouseReleased',
      mousewheel: 'mouseWheel',
      touchstart: 'mousePressed',
      touchend: 'mouseReleased',
      touchmove: 'mouseWheel',
      mousemove: 'mouseMoved',
    };

    if (!(event.type in types)) {
      return;
    }

    if (
      event.type !== 'mousewheel' &&
      buttons[event.which] === 'none' &&
      event.type !== 'mousemove'
    ) {
      return;
    }

    const type = types[event.type] as string;
    const isScroll = type.indexOf('wheel') !== -1;
    const x = isScroll ? event.clientX : event.offsetX;
    const y = isScroll ? event.clientY : event.offsetY;

    const data: Record<string, any> = {
      type: types[event.type],
      x,
      y,
      modifiers: Runner.getModifiersForEvent(event),
      button: event.type === 'mousewheel' ? 'none' : buttons[event.which],
      clickCount: 1,
    };

    if (event.type === 'mousewheel') {
      data.deltaX = event.wheelDeltaX || 0;
      data.deltaY = event.wheelDeltaY || event.wheelDelta;
    }

    this.puppeteerWorker.postMessage({
      command: ProtocolCommands['Input.emulateTouchFromMouseEvent'],
      data,
    });
  };

  emitKeyEvent = (event: KeyboardEvent) => {
    let type;

    // Prevent backspace from going back in history
    if (event.keyCode === 8) {
      event.preventDefault();
    }

    switch (event.type) {
      case 'keydown':
        type = 'keyDown';
        break;
      case 'keyup':
        type = 'keyUp';
        break;
      case 'keypress':
        type = 'char';
        break;
      default:
        return;
    }

    const text = type === 'char' ? String.fromCharCode(event.charCode) : undefined;
    const data = {
      type,
      text,
      unmodifiedText: text ? text.toLowerCase() : undefined,
      keyIdentifier: (event as any).keyIdentifier,
      code: event.code,
      key: event.key,
      windowsVirtualKeyCode: event.keyCode,
      nativeVirtualKeyCode: event.keyCode,
      autoRepeat: false,
      isKeypad: false,
      isSystemKey: false,
    };

    this.puppeteerWorker.postMessage({
      command: ProtocolCommands['Input.dispatchKeyEvent'],
      data,
    });
  };

  // Forward and back require knowing what the current nagivation entry index is, which is difficult with the current setup.
  // Leaving it out for now
  // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-navigateToHistoryEntry
  // goBack = (): void => {
  //   this.puppeteerWorker.postMessage({
  //     command: ProtocolCommands['Page.navigateToHistoryEntry'],
  //     data: {
  //       entryId: 1,
  //     },
  //   });
  // };

  doReload = (): void => {
    this.puppeteerWorker.postMessage({
      command: ProtocolCommands['Page.reload'],
    });
  };

  onScreencastFrame = (data: string) => {
    // console.log('Runner onScreencastFrame. data:', data);
    this.img.onload = () => {
      console.log('Runner onScreencastFrame onload, ctx:', this.ctx);
      this.ctx.drawImage(this.img, 0, 0, this.$canvas.width, this.$canvas.height);
    };
    this.img.src = `data:image/png;base64,${data}`;
  };

  bindKeyEvents = () => {
    document.body.addEventListener('keydown', this.emitKeyEvent, true);
    document.body.addEventListener('keyup', this.emitKeyEvent, true);
    document.body.addEventListener('keypress', this.emitKeyEvent, true);
  };

  unbindKeyEvents = () => {
    document.body.removeEventListener('keydown', this.emitKeyEvent, true);
    document.body.removeEventListener('keyup', this.emitKeyEvent, true);
    document.body.removeEventListener('keypress', this.emitKeyEvent, true);
  };

  addListeners = () => {
    this.$canvas.addEventListener('mousedown', this.emitMouse, false);
    this.$canvas.addEventListener('mouseup', this.emitMouse, false);
    this.$canvas.addEventListener('mousewheel', this.emitMouse, false);
    this.$canvas.addEventListener('mousemove', this.emitMouse, false);

    this.$canvas.addEventListener('mouseenter', this.bindKeyEvents, false);
    this.$canvas.addEventListener('mouseleave', this.unbindKeyEvents, false);

    // this.$verticalResizer.addEventListener('mousedown', this.onVerticalResize);

    window.addEventListener('resize', this.resizePage);

    // const backButton = document.getElementById('back-button');
    // if (backButton) backButton.addEventListener('click', this.goBack, false);
    // const forwardButton = document.getElementById('forward-button');
    // if (forwardButton) forwardButton.addEventListener('click', this.goBack, false);
    const reloadButton = document.getElementById('reload-button');
    if (reloadButton) reloadButton.addEventListener('click', this.doReload, false);
  };

  removeEventListeners = () => {
    if (!this.started) return;
    this.$canvas.removeEventListener('mousedown', this.emitMouse, false);
    this.$canvas.removeEventListener('mouseup', this.emitMouse, false);
    this.$canvas.removeEventListener('mousewheel', this.emitMouse, false);
    this.$canvas.removeEventListener('mousemove', this.emitMouse, false);

    this.$canvas.removeEventListener('mouseenter', this.bindKeyEvents, false);
    this.$canvas.removeEventListener('mouseleave', this.unbindKeyEvents, false);

    // this.$verticalResizer.removeEventListener('mousedown', this.onVerticalResize);

    window.removeEventListener('resize', this.resizePage);
  };

  resizePage = debounce(() => {
    const { width, height } = this.$viewer.getBoundingClientRect();

    this.$canvas.width = width;
    this.$canvas.height = height;

    this.sendWorkerMessage({
      command: 'setViewport',
      data: {
        width: Math.floor(width),
        height: Math.floor(height),
        deviceScaleFactor: 1,
      },
    });
  }, 500);

  close = once((...args: any[]) => {
    this.onClose(...args);
    this.sendWorkerMessage({ command: HostCommands.close, data: null });
    this.removeEventListeners();
    this.unbindKeyEvents();
  });

  showError = (err: string) => {
    this.$mount.innerHTML = `${errorHTML(err)}`;
  };

  // onRunComplete = async ({ url, payload }: { url: string; payload: any }) => {};

  sendWorkerMessage = (message: Message) => {
    this.puppeteerWorker.postMessage(message);
  };

  // onIframeLoad = () => {
  //   this.$iframe.removeEventListener('load', this.onIframeLoad);
  //   this.sendWorkerMessage({
  //     command: HostCommands.run,
  //     data: {},
  //   });
  // };

  onWorkerSetupComplete = (payload: Message['data']) => {
    const { targetId } = payload;
    // const iframeURL = getDevtoolsAppURL(targetId);

    this.started = true;
    this.$mount.innerHTML = runnerHTML;
    // this.$iframe = document.querySelector('#devtools-mount') as HTMLIFrameElement;
    this.$viewer = document.querySelector('#viewer') as HTMLDivElement;
    this.$canvas = document.querySelector('#screencast') as HTMLCanvasElement;
    // this.$verticalResizer = document.querySelector('#resize-vertical') as HTMLDivElement;
    this.ctx = this.$canvas.getContext('2d') as CanvasRenderingContext2D;
    // this.$iframe.addEventListener('load', this.onIframeLoad);
    // this.$iframe.src = iframeURL;

    this.addListeners();
    this.resizePage();
  };

  setupPuppeteerWorker = () => {
    this.puppeteerWorker = new Worker('./puppeteer.worker.bundle.js');
    // eslint-disable-next-line consistent-return
    this.puppeteerWorker.addEventListener('message', (evt) => {
      const { command, data } = evt.data as Message;

      if (command === WorkerCommands.startComplete) {
        return this.onWorkerSetupComplete(data);
      }

      if (command === WorkerCommands.screencastFrame) {
        return this.onScreencastFrame(data);
      }

      // if (command === WorkerCommands.runComplete) {
      //   return this.onRunComplete(data);
      // }

      if (command === WorkerCommands.error) {
        return this.showError(data);
      }

      if (command === WorkerCommands.browserClose) {
        return this.showError(`Session complete! Browser has closed.`);
      }
    });

    this.puppeteerWorker.addEventListener('error', ({ message }) => {
      this.puppeteerWorker.terminate();
      return this.showError(`Error communicating with puppeteer-worker ${message}`);
    });

    this.sendWorkerMessage({
      command: 'start',
      data: {
        browserWSEndpoint: getConnectURL(),
        quality: 100,
        targetId: getTargetId(),
      },
    });
  };
}
