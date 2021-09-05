export const getBaseURL = (): URL => {
  const baseURL = window.location.href;
  return new URL(baseURL);
};

export const getWebSocketURL = (): URL => {
  const baseURL = getBaseURL();
  const wsProtocol = baseURL.protocol === 'https:' ? 'wss:' : 'ws:';
  const targetId = baseURL.searchParams.get('targetId');
  const wsUrl = new URL(`${wsProtocol}${baseURL.host}${baseURL.pathname}ws/${targetId}`);
  return wsUrl;
};

export const getTargetId = (): string => {
  const baseURL = getBaseURL();
  const targetId = baseURL.searchParams.get('targetId');
  if (!targetId) throw new Error('Missing targetId in URL');
  return targetId;
};

export const getConnectURL = (): string => {
  const wsURL = getWebSocketURL();
  console.log('wsURL', wsURL);
  return wsURL.href;
};
