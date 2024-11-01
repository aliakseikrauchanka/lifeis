interface IInitArgs {
  beUrl: string;
  clientId: string;
  app?: string;
  isOffline?: boolean;
}

export const CONFIG = {
  BE_URL: '',
  CLIENT_ID: '',
  APP: '',
  isOffline: false,
};

export const init = ({ beUrl, clientId, app = '', isOffline = false }: IInitArgs) => {
  CONFIG.BE_URL = beUrl;
  CONFIG.CLIENT_ID = clientId;
  CONFIG.APP = app;
  CONFIG.isOffline = isOffline;
};
