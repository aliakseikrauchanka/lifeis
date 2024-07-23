import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../../config';

export const checkPolishGrammar = async (text: string): Promise<string> => {
  const accessToken = localStorage.getItem('accessToken');

  try {
    // post message
    const checkData = await utilFetch(`${CONFIG.BE_URL}/openai/check-polish-grammar`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const { threadId, runId } = await checkData.json();

    return new Promise((resolve, reject) => {
      const intervalId = setInterval(async () => {
        try {
          const runResponse = await utilFetch(
            `${CONFIG.BE_URL}/openai/thread/run?threadId=${threadId}&runId=${runId}`,
            {
              method: 'GET',
            },
          );

          const run = await runResponse.json();

          if (run.status === 'completed') {
            clearInterval(intervalId);

            const messagesResponse = await utilFetch(`${CONFIG.BE_URL}/openai/thread/messages?threadId=${threadId}`, {
              method: 'GET',
            });

            const messagesData = await messagesResponse.json();
            resolve(messagesData.messages[0] && messagesData.messages[0][0] && messagesData.messages[0][0].text.value);
          }
        } catch (e) {
          console.log('error happened during fetch');
        }
      }, 2000);
    });
  } catch (e) {
    console.log('error happened during fetch');
    throw e;
  }
};

export const translateToPolish = async (text: string): Promise<string> => {
  try {
    // post message
    const checkData = await utilFetch(`${CONFIG.BE_URL}/gemini/translate-to-polish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });
    const { translation } = await checkData.json();
    return translation;
  } catch (e) {
    console.log(e);
    throw e;
  }
};
