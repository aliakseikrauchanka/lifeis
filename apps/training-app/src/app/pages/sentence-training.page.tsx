import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeepgramFileSTTProvider, useAudioDevices, useSpeechToText } from '@lifeis/common-ui';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Volume2 } from 'lucide-react';
import {
  generateSentenceTraining,
  checkSentenceTraining,
  reviewCard,
  Rating,
  SentenceTrainingWord,
} from '../api/srs.api';
import { speak } from '../api/tts.api';
import { GradeButtons } from '../components/grade-buttons';
import { SpeechInputButton } from '../components/speech-input-button';
import { ClearableTextarea } from '../components/clearable-textarea';
import { useAppLevel } from '../hooks/use-app-level';
import { useAppLanguages } from '../hooks/use-app-languages';
import { useI18n } from '../i18n/i18n-context';

type Phase = 'idle' | 'memorize' | 'recall' | 'recording' | 'checking' | 'checked';

const RECORDING_ID = 'sentence-training';

function SentenceTrainingBody({ onLanguageChange }: { onLanguageChange: (lang: string) => void }) {
  const { t } = useI18n();
  const { stopListening } = useSpeechToText();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlIds = (searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const autoTriggeredRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wordCount, setWordCount] = useState<number>(() => {
    const v = Number(localStorage.getItem('sentence-training-word-count'));
    return Number.isInteger(v) && v >= 1 && v <= 5 ? v : 2;
  });
  const [sentenceCount, setSentenceCount] = useState<number>(() => {
    const v = Number(localStorage.getItem('sentence-training-sentence-count'));
    return Number.isInteger(v) && v >= 1 && v <= 3 ? v : 2;
  });
  const [level] = useAppLevel();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();

  useEffect(() => {
    localStorage.setItem('sentence-training-word-count', String(wordCount));
  }, [wordCount]);
  useEffect(() => {
    localStorage.setItem('sentence-training-sentence-count', String(sentenceCount));
  }, [sentenceCount]);
  const [words, setWords] = useState<SentenceTrainingWord[]>([]);
  const [story, setStory] = useState<string>('');
  const [storyTranslation, setStoryTranslation] = useState<string>('');
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [showWordTranslations, setShowWordTranslations] = useState<boolean>(false);
  const [originalLanguage, setOriginalLanguage] = useState<string>('');
  const [translationLanguage, setTranslationLanguage] = useState<string>('');

  const [userText, setUserText] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const [grammarFeedback, setGrammarFeedback] = useState<string>('');
  const [matchFeedback, setMatchFeedback] = useState<string>('');
  const [corrected, setCorrected] = useState<string>('');
  const [grades, setGrades] = useState<Record<string, Rating>>({});
  const [grading, setGrading] = useState<string | null>(null);

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (urlIds.length === 0) return;
    autoTriggeredRef.current = true;
    handleGenerate(urlIds);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = () => {
    stopListening(RECORDING_ID);
    setWords([]);
    setStory('');
    setStoryTranslation('');
    setShowTranslation(false);
    setShowWordTranslations(false);
    setUserText('');
    setScore(null);
    setGrammarFeedback('');
    setMatchFeedback('');
    setCorrected('');
    setGrades({});
    setError(null);
  };

  const handleGenerate = async (translationIds?: string[]) => {
    resetAll();
    setLoading(true);
    try {
      const data = await generateSentenceTraining(
        translationIds && translationIds.length > 0
          ? { sentenceCount, level, translationIds, nativeLanguage, trainingLanguage }
          : { wordCount, sentenceCount, level, nativeLanguage, trainingLanguage },
      );
      setWords(data.words);
      setStory(data.story);
      setStoryTranslation(data.translation);
      setOriginalLanguage(data.originalLanguage);
      setTranslationLanguage(data.translationLanguage);
      onLanguageChange(data.originalLanguage);
      setPhase('memorize');
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleBeginRecall = () => {
    stopListening(RECORDING_ID);
    setUserText('');
    setScore(null);
    setGrammarFeedback('');
    setMatchFeedback('');
    setCorrected('');
    setPhase('recall');
  };

  const handleAppendTranscript = useCallback((text: string) => {
    setUserText(text);
  }, []);

  const handleCheck = async () => {
    const text = userText.trim();
    if (!text) return;
    setPhase('checking');
    try {
      const result = await checkSentenceTraining({
        story,
        transcript: text,
        originalLanguage,
        translationLanguage,
      });
      setScore(result.score);
      setGrammarFeedback(result.grammarFeedback);
      setMatchFeedback(result.matchFeedback);
      setCorrected(result.corrected);
      setPhase('checked');
    } catch (err) {
      setError((err as Error).message);
      setPhase('recall');
    }
  };

  const handleGrade = useCallback(async (translationId: string, rating: Rating) => {
    setGrading(translationId);
    try {
      await reviewCard(translationId, rating);
      setGrades((prev) => ({ ...prev, [translationId]: rating }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGrading(null);
    }
  }, []);

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <div className="flex flex-col items-center gap-2 w-full max-w-xl">
        <h1 className="text-xl font-semibold">{t('nav.sentenceTraining')}</h1>
        <div className="flex flex-wrap items-end gap-3 justify-center">
          <label className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            {t('cfg.words')}
            <select
              className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              disabled={loading || phase === 'recording' || phase === 'checking'}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            {t('cfg.sentences')}
            <select
              className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
              value={sentenceCount}
              onChange={(e) => setSentenceCount(Number(e.target.value))}
              disabled={loading || phase === 'recording' || phase === 'checking'}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            {t('cfg.level')}
            <div
              className="rounded border border-input bg-muted/40 px-2 py-1 text-sm text-foreground"
              title={t('hint.changeInProfile')}
            >
              {level}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleGenerate()}
            disabled={loading || phase === 'recording' || phase === 'checking'}
          >
            {phase === 'idle' ? t('btn.start') : t('btn.newRound')}
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
              <CardTitle className="text-base">
                Words ({originalLanguage} → {translationLanguage})
              </CardTitle>
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
              {words.map((w) => (
                <span
                  key={w.translationId}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded bg-violet-100 text-violet-900"
                >
                  <span>{w.original}</span>
                  <button
                    type="button"
                    onClick={() => speak(w.original, originalLanguage)}
                    title="Speak"
                    className="inline-flex hover:text-violet-700"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                  {showWordTranslations && (
                    <>
                      <span className="text-xs text-muted-foreground ml-1">({w.translation})</span>
                      <button
                        type="button"
                        onClick={() => speak(w.translation, translationLanguage)}
                        title="Speak translation"
                        className="inline-flex text-muted-foreground hover:text-foreground"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </span>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {(() => {
              const isBlurred = phase === 'recall' || phase === 'recording' || phase === 'checking';
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      {phase === 'memorize' ? 'Memorize these sentences' : 'Target'}
                    </div>
                    {storyTranslation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowTranslation((v) => !v)}
                      >
                        {showTranslation ? 'Hide translation' : 'Show translation'}
                      </Button>
                    )}
                  </div>
                  <div
                    className={`flex items-start gap-2 transition-all duration-300 ${
                      isBlurred ? 'blur-md select-none' : ''
                    }`}
                  >
                    <p className="text-sm flex-1">{story}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-full shrink-0"
                      onClick={() => speak(story, originalLanguage)}
                      disabled={isBlurred}
                    >
                      <Volume2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {showTranslation && storyTranslation && (
                    <div
                      className={`flex items-start gap-2 mt-2 text-sm text-muted-foreground transition-all duration-300 ${
                        isBlurred ? 'blur-md select-none' : ''
                      }`}
                    >
                      <p className="flex-1">{storyTranslation}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full shrink-0"
                        onClick={() => speak(storyTranslation, translationLanguage)}
                        disabled={isBlurred}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {phase === 'memorize' && (
              <div>
                <Button size="sm" onClick={handleBeginRecall}>
                  {t('btn.start')}
                </Button>
              </div>
            )}

            {(phase === 'recall' || phase === 'recording' || phase === 'checking') && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Recall from memory — type or speak
                </div>
                <ClearableTextarea
                  value={userText}
                  onChange={setUserText}
                  onClear={() => stopListening(RECORDING_ID)}
                  canClear={phase === 'recall'}
                  onSpeak={(text) => speak(text, originalLanguage)}
                  disabled={phase === 'recording' || phase === 'checking'}
                  placeholder="Type the sentences you remember…"
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
                    onStop={() => setPhase('recall')}
                    active={phase === 'recall' || phase === 'recording'}
                  />
                  <Button
                    size="sm"
                    onClick={handleCheck}
                    disabled={phase !== 'recall' || !userText.trim()}
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
            )}

            {phase === 'checked' && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Score</span>
                  <span className="text-2xl font-bold text-primary">{score}/10</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Result</div>
                  <div className="text-sm italic">{userText}</div>
                </div>
                {corrected && corrected.trim() !== userText.trim() && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Corrected
                    </div>
                    <div className="text-sm">{corrected}</div>
                  </div>
                )}
                {grammarFeedback && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Grammar
                    </div>
                    <div className="text-sm">{grammarFeedback}</div>
                  </div>
                )}
                {matchFeedback && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Match with target
                    </div>
                    <div className="text-sm">{matchFeedback}</div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Grade each word</div>
                  {words.map((w) => {
                    const graded = grades[w.translationId];
                    const isGrading = grading === w.translationId;
                    return (
                      <div key={w.translationId} className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium min-w-[6rem]">{w.original}</span>
                        <GradeButtons
                          onGrade={(r) => handleGrade(w.translationId, r)}
                          disabled={isGrading}
                          selected={graded}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SentenceTrainingPage() {
  const [language, setLanguage] = useState<string>('');
  const { inputDeviceId, outputDeviceId } = useAudioDevices();
  return (
    <DeepgramFileSTTProvider
      language={language || undefined}
      audioInputDeviceId={inputDeviceId || undefined}
      audioOutputDeviceId={outputDeviceId || undefined}
    >
      <SentenceTrainingBody onLanguageChange={setLanguage} />
    </DeepgramFileSTTProvider>
  );
}
