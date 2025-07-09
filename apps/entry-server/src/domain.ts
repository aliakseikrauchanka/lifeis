import { ObjectId } from 'mongodb';

export interface IDiaryLog {
  id?: string;
  message: string;
  timestamp: number;
  basket_id: ObjectId;
  owner_id: string;
}

export interface IDiaryResponseLog {
  id?: string;
  message: string;
  timestamp: number;
  basket_name: string;
  owner_id: string;
}

export interface IBasket {
  _id?: string;
  name: string;
  owner_id: string;
}
