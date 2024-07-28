export interface ILog {
  id: string;
  message: string;
  timestamp: string;
}

export interface IDiaryLog extends ILog {
  basket_name: string;
}
