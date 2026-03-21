interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function buildLogsChatPrompt(
  logsContext: string,
  question: string,
  todayUtc: string,
  previousMessages: ChatMessage[] = [],
): string {
  const historySection =
    previousMessages.length > 0
      ? `Предыдущий диалог:
${previousMessages
  .map((m) => (m.role === 'user' ? `Пользователь: ${m.content}` : `Ассистент: ${m.content}`))
  .join('\n\n')}

`
      : '';

  return `Ты помощник. Ниже представлены записи из дневника/лога пользователя. Ответь на вопрос пользователя, опираясь только на этот контент. Если по логам нельзя ответить на вопрос — скажи об этом. Будь лаконичен и полезен.

Сегодняшняя дата (UTC): ${todayUtc}

Логи:
${logsContext || '(нет записей за выбранный период)'}
${historySection}Вопрос пользователя: ${question}`;
}
