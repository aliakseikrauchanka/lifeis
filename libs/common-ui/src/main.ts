interface IInitArgs {
  beUrl: string;
  clientId: string;
}

export const CONFIG = {
  BE_URL: '',
  CLIENT_ID: '',
};

export const init = ({ beUrl, clientId }: IInitArgs) => {
  CONFIG.BE_URL = beUrl;
  CONFIG.CLIENT_ID = clientId;
};
