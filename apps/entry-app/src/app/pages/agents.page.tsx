import React from 'react';
import { Link } from 'react-router-dom';
import { AllAgents } from '../components/agents/all-agents';
import { SpeechToText } from '../components/speech-to-text/speech-to-text';

export const AgentsPage = () => {
  return (
    <main>
      <div>
        <Link to="/">Click here to go back to root page.</Link>
      </div>
      <AllAgents />
    </main>
  );
};
