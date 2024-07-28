import { ObjectId } from 'mongodb';

export interface IDiaryLog {
  id?: string;
  message: string;
  timestamp: number;
  basket_id: ObjectId;
}

export interface IDiaryResponseLog {
  id?: string;
  message: string;
  timestamp: number;
  basket_name: string;
}

export interface IBasket {
  _id?: string;
  name: string;
}
