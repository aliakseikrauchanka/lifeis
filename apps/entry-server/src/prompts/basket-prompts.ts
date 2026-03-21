export function buildBasketClassificationPrompt(messageText: string, basketsNames: string[]): string {
  return `What basket does message "${messageText}" belong out of the following baskets: ${basketsNames.join(
    ', ',
  )}. As a result please provide only name of matched basket without modifying case and without newlines at the end`;
}
