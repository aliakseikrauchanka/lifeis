import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Volume2, RotateCcw } from 'lucide-react';
import { generateSentenceBuilder, reviewCard, Rating, SentenceBuilderGenerated } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { GradeButtons } from '../components/grade-buttons';
import { useAppLevel } from '../hooks/use-app-level';
import { useAppLanguages } from '../hooks/use-app-languages';
import { useAppDirection } from '../hooks/use-app-direction';

type Phase = 'idle' | 'playing' | 'success';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"'«»„“”()]/g, '')
    .trim();

const tokenize = (s: string): string[] =>
  s
    .split(/\s+/)
    .map((t) => t.replace(/^[.,!?;:"'«»„“”()\-]+|[.,!?;:"'«»„“”()\-]+$/g, ''))
    .filter((t) => t.length > 0);

const shuffleArray = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function SentenceBuilderPage() {
  const [level] = useAppLevel();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();
  const [direction] = useAppDirection();

  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SentenceBuilderGenerated | null>(null);
  const [source, setSource] = useState<'random' | 'library'>(() => {
    const v = localStorage.getItem('sentence-builder-source');
    return v === 'library' ? 'library' : 'random';
  });
  const [mode, setMode] = useState<'buttons' | 'type'>(() => {
    const v = localStorage.getItem('sentence-builder-mode');
    return v === 'type' ? 'type' : 'buttons';
  });
  const [typed, setTyped] = useState('');

  // State as indices into `data.shuffled`
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [grade, setGrade] = useState<Rating | null>(null);
  const [grading, setGrading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setPlaced([]);
    setChecked(false);
    setGrade(null);
    setTyped('');
    setRevealed(false);
    try {
      localStorage.setItem('sentence-builder-source', source);
      localStorage.setItem('sentence-builder-mode', mode);
      const result = await generateSentenceBuilder({ level, nativeLanguage, trainingLanguage, source });
      setData(result);
      setPhase('playing');
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const view = useMemo(() => {
    if (!data) return null;
    if (direction === 'native-to-training') {
      return {
        sourceText: data.nativeSentence,
        sourceLang: data.translationLanguage,
        targetText: data.trainingSentence,
        targetLang: data.originalLanguage,
        words: data.words,
        shuffled: data.shuffled,
      };
    }
    const reversedWords = tokenize(data.nativeSentence);
    return {
      sourceText: data.trainingSentence,
      sourceLang: data.originalLanguage,
      targetText: data.nativeSentence,
      targetLang: data.translationLanguage,
      words: reversedWords,
      shuffled: shuffleArray(reversedWords),
    };
  }, [data, direction]);

  useEffect(() => {
    if (!data) return;
    setPlaced([]);
    setTyped('');
    setChecked(false);
    setGrade(null);
    setRevealed(false);
    if (phase === 'success') setPhase('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const availableIdx = useMemo(() => {
    if (!view) return [];
    const used = new Set(placed);
    return view.shuffled.map((_, i) => i).filter((i) => !used.has(i));
  }, [view, placed]);

  const handlePick = (i: number) => {
    setPlaced((prev) => [...prev, i]);
    setChecked(false);
  };

  const handleRemove = (pos: number) => {
    setPlaced((prev) => prev.filter((_, i) => i !== pos));
    setChecked(false);
  };

  const handleReset = () => {
    setPlaced([]);
    setChecked(false);
  };

  const handleCheck = () => {
    if (!view) return;
    setChecked(true);
    const targetNorm = view.words.map(normalize).join(' ');
    const builtNorm =
      mode === 'type'
        ? typed.split(/\s+/).map(normalize).filter(Boolean).join(' ')
        : placed.map((i) => view.shuffled[i]).map(normalize).join(' ');
    if (targetNorm === builtNorm) setPhase('success');
  };

  const correctnessAt = (pos: number): 'correct' | 'wrong' | null => {
    if (!checked || !view) return null;
    const picked = view.shuffled[placed[pos]];
    const target = view.words[pos];
    if (target === undefined) return 'wrong';
    return normalize(picked) === normalize(target) ? 'correct' : 'wrong';
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <div className="flex flex-col items-center gap-2 w-full max-w-xl">
        <h1 className="text-xl font-semibold">Sentence Builder</h1>
        <div className="flex flex-wrap items-end gap-3 justify-center">
          <div className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            Source
            <div className="inline-flex rounded border border-input overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 text-sm ${
                  source === 'random' ? 'bg-violet-600 text-white' : 'bg-background text-foreground hover:bg-muted'
                }`}
                onClick={() => setSource('random')}
                disabled={loading}
              >
                Random
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-sm border-l border-input ${
                  source === 'library' ? 'bg-violet-600 text-white' : 'bg-background text-foreground hover:bg-muted'
                }`}
                onClick={() => setSource('library')}
                disabled={loading}
              >
                Library
              </button>
            </div>
          </div>
          <div className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            Mode
            <div className="inline-flex rounded border border-input overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 text-sm ${
                  mode === 'buttons' ? 'bg-violet-600 text-white' : 'bg-background text-foreground hover:bg-muted'
                }`}
                onClick={() => setMode('buttons')}
                disabled={loading}
              >
                Buttons
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-sm border-l border-input ${
                  mode === 'type' ? 'bg-violet-600 text-white' : 'bg-background text-foreground hover:bg-muted'
                }`}
                onClick={() => setMode('type')}
                disabled={loading}
              >
                Type
              </button>
            </div>
          </div>
          <div className="flex flex-col text-xs text-muted-foreground uppercase tracking-wide gap-1">
            Level
            <div
              className="rounded border border-input bg-muted/40 px-2 py-1 text-sm text-foreground"
              title="Change in Profile"
            >
              {level}
            </div>
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={loading}>
            {phase === 'idle' ? 'Start' : 'New sentence'}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {data && view && !loading && (
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>Translate to {view.targetLang}</span>
              {phase === 'success' && (
                <span className="text-sm font-normal text-green-700 bg-green-100 px-2 py-0.5 rounded">
                  ✓ Correct!
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {view.sourceLang}
              </div>
              <div className="flex items-start gap-2">
                <p className="text-lg flex-1">{view.sourceText}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full shrink-0"
                  onClick={() => speak(view.sourceText, view.sourceLang)}
                  title="Speak"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {mode === 'buttons' ? (
              <>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your answer</div>
                  <div className="min-h-[3rem] rounded-md border border-dashed border-input bg-muted/30 p-2 flex flex-wrap gap-2">
                    {placed.length === 0 && (
                      <span className="text-sm text-muted-foreground self-center">
                        Tap words below to build the sentence…
                      </span>
                    )}
                    {placed.map((srcIdx, pos) => {
                      const word = view.shuffled[srcIdx];
                      const correctness = correctnessAt(pos);
                      const color =
                        correctness === 'correct'
                          ? 'bg-green-100 text-green-900 border-green-300'
                          : correctness === 'wrong'
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : 'bg-violet-100 text-violet-900 border-violet-200';
                      return (
                        <button
                          key={`placed-${pos}`}
                          type="button"
                          onClick={() => handleRemove(pos)}
                          className={`px-3 py-1 rounded border text-sm ${color} hover:opacity-80`}
                          title="Remove"
                        >
                          {word}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Words</div>
                  <div className="flex flex-wrap gap-2">
                    {availableIdx.map((i) => (
                      <button
                        key={`avail-${i}`}
                        type="button"
                        onClick={() => handlePick(i)}
                        className="px-3 py-1 rounded border border-input bg-background text-sm hover:bg-muted"
                      >
                        {view.shuffled[i]}
                      </button>
                    ))}
                    {availableIdx.length === 0 && (
                      <span className="text-sm text-muted-foreground">All words placed.</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your answer</div>
                <textarea
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setChecked(false);
                    if (phase === 'success') setPhase('playing');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCheck();
                    }
                  }}
                  placeholder={`Type the sentence in ${view.targetLang}…`}
                  className="w-full min-h-[5rem] rounded border border-input bg-background p-2 text-sm"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleCheck}
                disabled={
                  phase === 'success' ||
                  (mode === 'buttons' ? placed.length === 0 : !typed.trim())
                }
              >
                Check
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handleReset();
                  setTyped('');
                }}
                disabled={mode === 'buttons' ? placed.length === 0 : !typed}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              {phase === 'success' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => speak(view.targetText, view.targetLang)}
                  title="Speak"
                >
                  <Volume2 className="h-4 w-4 mr-1" />
                  Speak
                </Button>
              )}
            </div>

            {phase === 'success' && (
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Target</div>
                <p className="text-sm">{view.targetText}</p>
              </div>
            )}
            {checked && phase !== 'success' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-red-700">Not quite — try again.</span>
                {!revealed && (
                  <Button size="sm" variant="outline" onClick={() => setRevealed(true)}>
                    Show answer
                  </Button>
                )}
              </div>
            )}
            {revealed && phase !== 'success' && (
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Answer</div>
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1">{view.targetText}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-full shrink-0"
                    onClick={() => speak(view.targetText, view.targetLang)}
                    title="Speak"
                  >
                    <Volume2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {checked && data.source === 'library' && data.translationId && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  How hard was this card?
                </div>
                <GradeButtons
                  onGrade={async (r) => {
                    if (!data.translationId) return;
                    setGrading(true);
                    try {
                      await reviewCard(data.translationId, r);
                      setGrade(r);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setGrading(false);
                    }
                  }}
                  disabled={grading || grade !== null}
                  selected={grade ?? undefined}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
