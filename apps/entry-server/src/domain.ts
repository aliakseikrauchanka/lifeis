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

export interface ITranslation {
  _id?: string;
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
  owner_id: string;
  timestamp: number;
}

export interface ISrsCard {
  _id?: string;
  owner_id: string;
  translation_id: ObjectId;
  due_at: number;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  created_at: number;
  updated_at: number;
}
