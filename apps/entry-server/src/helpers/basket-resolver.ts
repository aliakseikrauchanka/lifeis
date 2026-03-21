import { ObjectId } from 'mongodb';
import { GenerativeModel } from '@google/generative-ai';
import { buildBasketClassificationPrompt } from '../prompts/basket-prompts';

export async function resolveBasketForMessage(
  baskets: { _id: ObjectId; name: string }[],
  messageText: string,
  basketId: string | undefined,
  geminiModel: GenerativeModel,
): Promise<ObjectId> {
  if (basketId) {
    return new ObjectId(basketId);
  }

  const basketsNames = baskets.map((b) => b.name);
  const prompt = buildBasketClassificationPrompt(messageText, basketsNames);

  const resultBasket = await geminiModel.generateContent(prompt);
  const matchedBasketName = resultBasket.response.text().trim();

  let finalMatchedBasket = 'unspecified';
  if (basketsNames.includes(matchedBasketName)) {
    finalMatchedBasket = matchedBasketName;
  }

  return baskets.find((b) => b.name === finalMatchedBasket)?._id ?? baskets[0]?._id;
}
