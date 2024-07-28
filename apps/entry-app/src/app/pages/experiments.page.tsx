import React from 'react';
import { FileInput } from '../components/audio-file/audio-file';
import { checkPolishGrammar, translateToPolish } from '../api/assistants/assistants.api';
import { OwnButton } from '@lifeis/common-ui';
import { Link } from 'react-router-dom';
import { Recording } from '../components/recording/recording';
import { transcriptDeepgram, transcriptOpenAi } from '../api/audio/audio.api';

export const ExperimentsPage = () => {
  const [assistantResponse, setAssistantResponse] = React.useState<string>('');
  const [geminiAssistantResponse, setGeminiAssistantResponse] = React.useState<string>('');
  const [openAiTranscript, setOpenAiTranscript] = React.useState<string>('');
  const [deepgramTranscript, setDeepgramTranscript] = React.useState<string>('');

  const handleAssistant = async () => {
    const input = document.getElementById('assistant-input') as HTMLInputElement;
    const text = input.value;

    const response = await checkPolishGrammar(text);
    setAssistantResponse(response);
  };

  const handleGeminiAssistant = async () => {
    const input = document.getElementById('gemini-assistant-input') as HTMLInputElement;
    const text = input.value;
    const response = await translateToPolish(text);
    setGeminiAssistantResponse(response);
  };

  const handleOpenAiTranscript = async (blob: Blob) => {
    const data = await transcriptOpenAi(blob);
    const t = await data.json();

    setOpenAiTranscript(t.text);
  };

  const handleDeepgramTranscript = async (blob: Blob) => {
    const data = await transcriptDeepgram(blob);
    const response = await data.json();

    setDeepgramTranscript(response?.results?.channels[0]?.alternatives[0]?.transcript);
  };

  return (
    <main>
      <div>
        <Link to="/">Click here to go back to root page.</Link>
      </div>

      <h3>Audio Recorder OpenAI</h3>
      <Recording requestTranscript={handleOpenAiTranscript} transcription={openAiTranscript} />
      <br />

      <h3>Audio Recorder Deepgram</h3>
      <Recording requestTranscript={handleDeepgramTranscript} transcription={deepgramTranscript} />
      <br />

      <h3>Audio file OpenAI</h3>
      <FileInput />
      <br />

      <h3>OpenAI Assistant</h3>
      <input id="assistant-input" />
      <OwnButton onClick={handleAssistant}>Send</OwnButton>
      <div>OpenAI assistant response:</div>
      <div>{assistantResponse}</div>

      <br />

      <h3>Gemini</h3>
      <input id="gemini-assistant-input" />
      <OwnButton onClick={handleGeminiAssistant}>Translate to Polish with Gemini</OwnButton>
      <div>Gemini assistant response:</div>
      <div>{geminiAssistantResponse}</div>

      <br />
    </main>
  );
};
