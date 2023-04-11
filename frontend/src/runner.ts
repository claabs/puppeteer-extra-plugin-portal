// eslint-disable-next-line import/no-unresolved
import Protocol from 'devtools-protocol';
import { debounce, once } from './util';
import { getConnectURL } from './api';

export type CommandResponse = {
  command: 'Page.screencastFrame';
  data: Protocol.Page.ScreencastFrameEvent;
};

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
  private wsClient!: WebSocket;

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

    this.setupWebSocket();
  }

  onVerticalResize = (evt: MouseEvent): void => {
    evt.preventDefault();

    this.$mount.style.pointerEvents = 'none';
    this.$viewer.style.flex = 'initial';

    let onMouseMove: ((moveEvent: MouseEvent) => void) | null = (moveEvent: MouseEvent) => {
      if (moveEvent.buttons === 0) {
        return;
      }

      this.$viewer.style.height = `${moveEvent.clientY - 71}px`;
      this.$canvas.height = moveEvent.clientY - 71;
    };

    let onMouseUp: (() => void) | null = (): void => {
      this.$mount.style.pointerEvents = 'initial';
      if (onMouseMove) document.removeEventListener('mousemove', onMouseMove);
      if (onMouseUp) document.removeEventListener('mouseup', onMouseUp);
      onMouseMove = null;
      onMouseUp = null;
      this.resizePage();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  emitMouse = (evt: any): void => {
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

    const params: Protocol.Input.EmulateTouchFromMouseEventRequest = {
      type: types[event.type],
      x,
      y,
      modifiers: Runner.getModifiersForEvent(event),
      button: event.type === 'mousewheel' ? 'none' : buttons[event.which],
      clickCount: 1,
    };

    if (event.type === 'mousewheel') {
      params.deltaX = event.wheelDeltaX || 0;
      params.deltaY = event.wheelDeltaY || event.wheelDelta;
    }
    console.log('Mouse event', params);
    this.wsClient.send(
      JSON.stringify({
        command: 'Input.emulateTouchFromMouseEvent',
        params,
      })
    );
  };

  emitKeyEvent = (event: KeyboardEvent): void => {
    let type: Protocol.Input.DispatchKeyEventRequestType;

    // Prevent backspace from going back in history
    if (event.keyCode === 8) {
      event.preventDefault();
    }

    switch (event.type) {
      case 'keydown':
        type = Protocol.Input.DispatchKeyEventRequestType.KeyDown;
        break;
      case 'keyup':
        type = Protocol.Input.DispatchKeyEventRequestType.KeyUp;
        break;
      case 'keypress':
        type = Protocol.Input.DispatchKeyEventRequestType.Char;
        break;
      default:
        return;
    }

    const text = type === 'char' ? String.fromCharCode(event.charCode) : undefined;
    const params: Protocol.Input.DispatchKeyEventRequest = {
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

    this.wsClient.send(
      JSON.stringify({
        command: 'Input.dispatchKeyEvent',
        params,
      })
    );
  };

  doReload = (): void => {
    this.wsClient.send(
      JSON.stringify({
        command: 'Page.reload',
        params: {},
      })
    );
  };

  onScreencastFrame = (data: Protocol.Page.ScreencastFrameEvent): void => {
    // console.log('Runner onScreencastFrame. data:', data);
    this.img.onload = () => {
      console.log('Runner onScreencastFrame onload, ctx:', this.ctx);
      this.ctx.drawImage(this.img, 0, 0, this.$canvas.width, this.$canvas.height);
    };
    this.img.src = `data:image/png;base64,${data.data}`;
    this.wsClient.send(
      JSON.stringify({
        command: 'Page.screencastFrameAck',
        params: {
          sessionId: data.sessionId,
        } as Protocol.Page.ScreencastFrameAckRequest,
      })
    );
  };

  bindKeyEvents = (): void => {
    document.body.addEventListener('keydown', this.emitKeyEvent, true);
    document.body.addEventListener('keyup', this.emitKeyEvent, true);
    document.body.addEventListener('keypress', this.emitKeyEvent, true);
  };

  unbindKeyEvents = (): void => {
    document.body.removeEventListener('keydown', this.emitKeyEvent, true);
    document.body.removeEventListener('keyup', this.emitKeyEvent, true);
    document.body.removeEventListener('keypress', this.emitKeyEvent, true);
  };

  addListeners = (): void => {
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

  removeEventListeners = (): void => {
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

  resizePage = debounce(
    () => {
      const { width, height } = this.$viewer.getBoundingClientRect();

      this.$canvas.width = width;
      this.$canvas.height = height;

      this.wsClient.send(
        JSON.stringify({
          command: 'Page.setViewport',
          params: {
            width: Math.floor(width),
            height: Math.floor(height),
            deviceScaleFactor: 1,
            mobile: true,
          } as Protocol.Page.SetDeviceMetricsOverrideRequest,
        })
      );
    },
    500,
    { isImmediate: true }
  );

  close = once((...args: any[]) => {
    this.onClose(...args);
    this.wsClient.close();
    this.removeEventListeners();
    this.unbindKeyEvents();
  });

  showError = (err: string) => {
    this.$mount.innerHTML = `${errorHTML(err)}`;
  };

  onWebSocketSetupComplete = () => {
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

    const params: Protocol.Page.StartScreencastRequest = {
      format: 'jpeg',
      quality: 100,
      everyNthFrame: 1,
    };
    this.wsClient.send(
      JSON.stringify({
        command: 'Page.startScreencast',
        params,
      })
    );
  };

  setupWebSocket = (): void => {
    this.wsClient = new WebSocket(getConnectURL());

    this.wsClient.addEventListener('message', async (evt) => {
      const text = await evt.data.text();
      const { data } = JSON.parse(text) as CommandResponse;
      console.log('Websocket message received');
      this.onScreencastFrame(data);
    });

    this.wsClient.addEventListener('open', (e) => {
      console.log('Websocket opened');
      this.onWebSocketSetupComplete();
    });

    this.wsClient.addEventListener('error', (e) => {
      this.showError(`Error communicating with websocket server ${e}`);
    });

    this.wsClient.addEventListener('close', (e) => {
      this.showError(`Session complete! Browser has closed.`);
      this.close();
    });
  };
}
