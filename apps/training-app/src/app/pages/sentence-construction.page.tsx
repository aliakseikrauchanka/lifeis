import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeepgramFileSTTProvider, useAudioDevices } from '@lifeis/common-ui';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Volume2 } from 'lucide-react';
import { SpeechInputButton } from '../components/speech-input-button';
import {
  generateSentenceConstruction,
  checkSentenceConstruction,
  SentenceTrainingWord,
} from '../api/srs.api';
import { speak } from '../api/tts.api';
import { useAppLevel } from '../hooks/use-app-level';
import { useAppLanguages } from '../hooks/use-app-languages';

type Phase = 'idle' | 'writing' | 'recording' | 'checking' | 'checked';

const RECORDING_ID = 'sentence-construction';

function SentenceConstructionBody({ onLanguageChange }: { onLanguageChange: (lang: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlIds = (searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const autoTriggeredRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wordCount, setWordCount] = useState<number>(() => {
    const v = Number(localStorage.getItem('sentence-construction-word-count'));
    return Number.isInteger(v) && v >= 1 && v <= 10 ? v : 3;
  });
  const [level] = useAppLevel();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();

  useEffect(() => {
    localStorage.setItem('sentence-construction-word-count', String(wordCount));
  }, [wordCount]);

  const [words, setWords] = useState<SentenceTrainingWord[]>([]);
  const [showWordTranslations, setShowWordTranslations] = useState<boolean>(false);
  const [originalLanguage, setOriginalLanguage] = useState<string>('');
  const [translationLanguage, setTranslationLanguage] = useState<string>('');

  const [userText, setUserText] = useState<string>('');
  const [grammarFeedback, setGrammarFeedback] = useState<string>('');
  const [levelSuggestion, setLevelSuggestion] = useState<string>('');
  const [improved, setImproved] = useState<string>('');
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [missingWords, setMissingWords] = useState<string[]>([]);

  const resetCheck = () => {
    setGrammarFeedback('');
    setLevelSuggestion('');
    setImproved('');
    setUsedWords([]);
    setMissingWords([]);
  };

  const handleGenerate = async (translationIds?: string[]) => {
    setError(null);
    setLoading(true);
    resetCheck();
    setUserText('');
    try {
      const data = await generateSentenceConstruction(
        translationIds && translationIds.length > 0
          ? { level, translationIds }
          : { level, wordCount, nativeLanguage, trainingLanguage },
      );
      setWords(data.words);
      setOriginalLanguage(data.originalLanguage);
      setTranslationLanguage(data.translationLanguage);
      onLanguageChange(data.originalLanguage);
      setPhase('writing');
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleAppendTranscript = useCallback((text: string) => {
    setUserText(text);
  }, []);

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (urlIds.length === 0) return;
    autoTriggeredRef.current = true;
    handleGenerate(urlIds);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = async () => {
    const text = userText.trim();
    if (!text) return;
    setPhase('checking');
    try {
      const result = await checkSentenceConstruction({
        userText: text,
        words,
        level,
        originalLanguage,
      });
      setGrammarFeedback(result.grammarFeedback);
      setLevelSuggestion(result.levelSuggestion);
      setImproved(result.improved);
      setUsedWords(result.usedWords);
      setMissingWords(result.missingWords);
      setPhase('checked');
    } catch (err) {
      setError((err as Error).message);
      setPhase('writing');
    }
  };

  const wordIsUsed = (w: string) =>
    usedWords.some((u) => u.toLowerCase() === w.toLowerCase());

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <div className="flex flex-col items-center gap-2 w-full max-w-xl">
        <h1 className="text-xl font-semibold">Sentence Construction</h1>
        <div className="flex flex-wrap items-end gap-3 justify-center">
          <label className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            Words
            <select
              className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              disabled={loading || phase === 'checking' || phase === 'recording'}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            Level
            <div
              className="rounded border border-input bg-muted/40 px-2 py-1 text-sm text-foreground"
              title="Change in Profile"
            >
              {level}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleGenerate()}
            disabled={loading || phase === 'checking' || phase === 'recording'}
          >
            {phase === 'idle' ? 'Start' : 'New words'}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {phase !== 'idle' && !loading && (
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Words ({originalLanguage})</CardTitle>
              {words.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowWordTranslations((v) => !v)}
                >
                  {showWordTranslations ? 'Hide translations' : 'Show translations'}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {words.map((w) => {
                const used = phase === 'checked' && wordIsUsed(w.original);
                const missed =
                  phase === 'checked' && !wordIsUsed(w.original) && missingWords.some((m) => m.toLowerCase() === w.original.toLowerCase());
                return (
                  <span
                    key={w.translationId}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded ${
                      used
                        ? 'bg-green-100 text-green-900'
                        : missed
                        ? 'bg-red-100 text-red-900'
                        : 'bg-violet-100 text-violet-900'
                    }`}
                  >
                    <span>{w.original}</span>
                    <button
                      type="button"
                      className="inline-flex hover:opacity-70"
                      onClick={() => speak(w.original, originalLanguage)}
                      title="Speak original"
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                    {showWordTranslations && (
                      <>
                        <span className="text-xs text-muted-foreground ml-1">({w.translation})</span>
                        <button
                          type="button"
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          onClick={() => speak(w.translation, translationLanguage)}
                          title="Speak translation"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Write sentences using these words
              </div>
              <textarea
                className="w-full min-h-[10rem] rounded border border-input bg-background p-2 text-sm"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                disabled={phase === 'checking' || phase === 'recording'}
                placeholder={`Write or speak in ${originalLanguage}…`}
              />
              <div className="flex items-center gap-2">
                <SpeechInputButton
                  id={RECORDING_ID}
                  onAppend={handleAppendTranscript}
                  disabled={phase === 'checking'}
                  onStart={() => {
                    setError(null);
                    setPhase('recording');
                  }}
                  onStop={() => setPhase('writing')}
                  active={phase === 'writing' || phase === 'recording'}
                />
                <Button
                  size="sm"
                  onClick={handleCheck}
                  disabled={phase === 'checking' || phase === 'recording' || !userText.trim()}
                >
                  Check
                </Button>
                {phase === 'checking' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Checking…
                  </div>
                )}
              </div>
            </div>

            {phase === 'checked' && (
              <div className="space-y-3 border-t pt-3">
                {grammarFeedback && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Grammar</div>
                    <div className="text-sm whitespace-pre-wrap">{grammarFeedback}</div>
                  </div>
                )}
                {levelSuggestion && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Suggestions for {level}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{levelSuggestion}</div>
                  </div>
                )}
                {improved && improved.trim() !== userText.trim() && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      {level} rewrite
                    </div>
                    <div className="flex items-start gap-2">
                      <p className="text-sm flex-1 whitespace-pre-wrap">{improved}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full shrink-0"
                        onClick={() => speak(improved, originalLanguage)}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SentenceConstructionPage() {
  const [language, setLanguage] = useState<string>('');
  const { inputDeviceId, outputDeviceId } = useAudioDevices();
  return (
    <DeepgramFileSTTProvider
      language={language || undefined}
      audioInputDeviceId={inputDeviceId || undefined}
      audioOutputDeviceId={outputDeviceId || undefined}
    >
      <SentenceConstructionBody onLanguageChange={setLanguage} />
    </DeepgramFileSTTProvider>
  );
}
