export const getBaseURL = () => {
  const baseURL = window.location.href; // TODO
  return new URL(baseURL);
};

export const getWebSocketURL = () => {
  const baseURL = getBaseURL();
  const websocketURL = new URL(decodeURIComponent(baseURL.pathname).slice(1));
  websocketURL.protocol = baseURL.protocol === 'https:' ? 'wss:' : 'ws:';
  return websocketURL;
};

const devtoolsInspectorURL = 'devtools/inspector.html';
const devtoolsAppURL = 'devtools/devtools_app.html';

const getHostedApp = (targetId: string, path: string) => {
  const baseUrl = getBaseURL();
  const isSecure = baseUrl.protocol === 'https:';
  const iframePageURL = `${isSecure ? 'wss' : 'ws'}=${baseUrl.host}${
    baseUrl.pathname
  }devtools/page/${targetId}${baseUrl.search}`;

  return `${baseUrl.origin}${baseUrl.pathname}${path}${
    baseUrl.search.length ? `${baseUrl.search}&` : '?'
  }${iframePageURL}`;
};

export const getDevtoolsInspectorURL = (targetId: string) => {
  return getHostedApp(targetId, devtoolsInspectorURL);
};

export const getDevtoolsAppURL = (targetId: string) => {
  return getHostedApp(targetId, devtoolsAppURL);
};

export const getTargetId = (): string => {
  const baseURL = getBaseURL();
  const targetId = baseURL.searchParams.get('targetId');
  if (!targetId) throw new Error('Missing targetId in URL');
  return targetId;
};

export const getConnectURL = () => {
  const wsURL = getWebSocketURL();
  console.log('wsURL', wsURL);
  return wsURL.href;
};
