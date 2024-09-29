interface IInitArgs {
  beUrl: string;
  clientId: string;
  app?: string;
}

export const CONFIG = {
  BE_URL: '',
  CLIENT_ID: '',
  APP: '',
};

export const init = ({ beUrl, clientId, app = '' }: IInitArgs) => {
  CONFIG.BE_URL = beUrl;
  CONFIG.CLIENT_ID = clientId;
  CONFIG.APP = app;
};
