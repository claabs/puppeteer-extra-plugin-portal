/* eslint-disable no-shadow */
import type { Page, CDPSession } from 'puppeteer';
// eslint-disable-next-line import/no-unresolved
import type Protocol from 'devtools-protocol';

import { RawData, WebSocket } from 'ws';

export interface PageHandlerProps {
  ws?: WebSocket;
  page: Page;
  targetId: string;
  debug: debug.Debugger;
}

export enum SpecialCommands {
  START_SCREENCAST = 'Page.startScreencast',
  SET_VIEWPORT = 'Page.setViewport',
}

export enum MiscCommands {
  RELOAD = 'Page.reload',
  NAVIGATE_TO_HISTORY_ENTRY = 'Page.navigateToHistoryEntry',
  EMULATE_TOUCH_FROM_MOUSE = 'Input.emulateTouchFromMouseEvent',
  DISPACTCH_KEY = 'Input.dispatchKeyEvent',
  SCREENCAST_ACK = 'Page.screencastFrameAck',
}

export type MiscCommandRequest =
  | {
      command: MiscCommands.RELOAD;
      params: Protocol.Page.ReloadRequest;
    }
  | {
      command: MiscCommands.NAVIGATE_TO_HISTORY_ENTRY;
      params: Protocol.Page.NavigateToHistoryEntryRequest;
    }
  | {
      command: MiscCommands.EMULATE_TOUCH_FROM_MOUSE;
      params: Protocol.Input.EmulateTouchFromMouseEventRequest;
    }
  | {
      command: MiscCommands.DISPACTCH_KEY;
      params: Protocol.Input.DispatchKeyEventRequest;
    }
  | {
      command: MiscCommands.SCREENCAST_ACK;
      params: Protocol.Page.ScreencastFrameAckRequest;
    };

export type CommandRequest =
  | {
      command: SpecialCommands.START_SCREENCAST;
      params: Protocol.Page.StartScreencastRequest;
    }
  | {
      command: SpecialCommands.SET_VIEWPORT;
      params: Protocol.Page.SetDeviceMetricsOverrideRequest;
    }
  | MiscCommandRequest;

export type CommandResponse = {
  command: 'Page.screencastFrame';
  data: Protocol.Page.ScreencastFrameEvent;
};

export class PageHandler {
  private page: Page;

  private ws?: WebSocket;

  private cdpSession: CDPSession | undefined;

  private debug: debug.Debugger;

  constructor(props: PageHandlerProps) {
    this.debug = props.debug.extend(props.targetId);
    this.page = props.page;
    if (props.ws) this.setWs(props.ws);
    this.debug('Created pageHandler');
  }

  public setWs(ws: WebSocket): void {
    this.debug('Setting websocket');
    this.ws = ws;
    ws.on('message', this.messageHandler.bind(this));
    ws.on('error', this.onError.bind(this));
  }

  public async close(): Promise<void> {
    this.debug('Closing websocket');
    try {
      if (this.ws) this.ws.close();
      if (this.cdpSession) await this.cdpSession.detach();
    } catch (err) {
      this.debug(err);
    }
  }

  private async getCdpSession(): Promise<CDPSession> {
    if (!this.cdpSession) {
      this.cdpSession = await this.page.target().createCDPSession();
      this.cdpSession.on('error', (e) => this.debug(e));
    }
    return this.cdpSession;
  }

  private onError(err: unknown) {
    this.debug(err);
  }

  private async messageHandler(data: RawData): Promise<void> {
    const dataString = data.toString();
    const commandRequest: CommandRequest = JSON.parse(dataString);
    if (commandRequest.command !== MiscCommands.EMULATE_TOUCH_FROM_MOUSE) {
      this.debug('Received message: %s', dataString);
    }
    if (commandRequest.command === SpecialCommands.START_SCREENCAST) {
      return this.startScreencast(commandRequest.params);
    }
    if (commandRequest.command === SpecialCommands.SET_VIEWPORT) {
      return this.setViewPort(commandRequest.params);
    }
    return this.sendMiscCommand(commandRequest);
  }

  private async setViewPort(data: Protocol.Page.SetDeviceMetricsOverrideRequest) {
    this.page.setViewport(data);
  }

  private async startScreencast(params: Protocol.Page.StartScreencastRequest): Promise<void> {
    const client = await this.getCdpSession();
    await client.send('Page.startScreencast', params);
    client.on('Page.screencastFrame', this.onScreencastFrame.bind(this));
  }

  private async onScreencastFrame(data: Protocol.Page.ScreencastFrameEvent): Promise<void> {
    this.debug('Got screencast frame: %j', { sessionId: data.sessionId, metadata: data.metadata });
    const commandResponse: CommandResponse = { command: 'Page.screencastFrame', data };
    if (!this.ws) throw new Error('Websocket not set for page');
    this.ws.send(Buffer.from(JSON.stringify(commandResponse)));
  }

  private async sendMiscCommand(commandRequest: MiscCommandRequest): Promise<void> {
    const client = await this.getCdpSession();
    if (Object.values(MiscCommands).includes(commandRequest.command)) {
      return client.send(commandRequest.command, commandRequest.params as never);
    }
    return undefined;
  }
}
