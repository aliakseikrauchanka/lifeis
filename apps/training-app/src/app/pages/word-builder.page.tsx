import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Volume2, RotateCcw, Delete } from 'lucide-react';
import { generateWordBuilder, reviewCard, Rating, WordBuilderGenerated } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { GradeButtons } from '../components/grade-buttons';
import { useAppLevel } from '../hooks/use-app-level';
import { useAppLanguages } from '../hooks/use-app-languages';
import { useAppDirection } from '../hooks/use-app-direction';

type Phase = 'idle' | 'playing' | 'success';

const normChar = (c: string) => c.toLowerCase();

export function WordBuilderPage() {
  const [level] = useAppLevel();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();
  const [direction] = useAppDirection();

  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WordBuilderGenerated | null>(null);

  const [source, setSource] = useState<'random' | 'library'>(() => {
    const v = localStorage.getItem('word-builder-source');
    return v === 'library' ? 'library' : 'random';
  });
  const [mode, setMode] = useState<'buttons' | 'type'>(() => {
    const v = localStorage.getItem('word-builder-mode');
    return v === 'type' ? 'type' : 'buttons';
  });

  const [placed, setPlaced] = useState<number[]>([]); // indices into shuffledChars
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<Rating | null>(null);
  const [grading, setGrading] = useState(false);

  const view = useMemo(() => {
    if (!data) return null;
    if (direction === 'native-to-training') {
      return {
        sourceText: data.nativeText,
        sourceLang: data.translationLanguage,
        targetText: data.trainingText,
        targetLang: data.originalLanguage,
      };
    }
    return {
      sourceText: data.trainingText,
      sourceLang: data.originalLanguage,
      targetText: data.nativeText,
      targetLang: data.translationLanguage,
    };
  }, [data, direction]);

  const targetChars = useMemo(() => (view ? Array.from(view.targetText) : []), [view]);
  const shuffledChars = useMemo(() => {
    if (!view) return [];
    const chars = Array.from(view.targetText);
    const arr = [...chars];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [view]);

  const availableIdx = useMemo(() => {
    if (!view) return [];
    const used = new Set(placed);
    return shuffledChars.map((_, i) => i).filter((i) => !used.has(i));
  }, [view, placed, shuffledChars]);

  useEffect(() => {
    if (!data) return;
    setPlaced([]);
    setTyped('');
    setChecked(false);
    setRevealed(false);
    setGrade(null);
    setPhase((p) => (p === 'success' ? 'playing' : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setPlaced([]);
    setTyped('');
    setChecked(false);
    setRevealed(false);
    setGrade(null);
    try {
      localStorage.setItem('word-builder-source', source);
      localStorage.setItem('word-builder-mode', mode);
      const result = await generateWordBuilder({ level, nativeLanguage, trainingLanguage, source });
      setData(result);
      setPhase('playing');
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (i: number) => {
    setPlaced((prev) => [...prev, i]);
    setChecked(false);
  };

  const handlePopLast = () => {
    setPlaced((prev) => prev.slice(0, -1));
    setChecked(false);
  };

  const handleReset = () => {
    setPlaced([]);
    setTyped('');
    setChecked(false);
  };

  const handleCheck = () => {
    if (!view) return;
    setChecked(true);
    const target = view.targetText.trim();
    const built =
      mode === 'type'
        ? typed.trim()
        : placed.map((i) => shuffledChars[i]).join('');
    if (built.toLowerCase() === target.toLowerCase()) {
      setPhase('success');
    }
  };

  // Keyboard support in buttons mode — subscribe once, read current state via refs
  const stateRef = useRef({ mode, data, phase, placed, shuffledChars });
  stateRef.current = { mode, data, phase, placed, shuffledChars };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { mode: m, data: d, phase: p, placed: pl, shuffledChars: sc } = stateRef.current;
      if (m !== 'buttons' || !d || p === 'success') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        handlePopLast();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCheck();
        return;
      }
      if (e.key.length !== 1) return;
      const wanted = normChar(e.key);
      const usedSet = new Set(pl);
      const idx = sc.findIndex((c, i) => !usedSet.has(i) && normChar(c) === wanted);
      if (idx !== -1) {
        e.preventDefault();
        handlePick(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCheck, handlePopLast]);

  const correctnessAt = (pos: number): 'correct' | 'wrong' | null => {
    if (!checked || !view) return null;
    const picked = shuffledChars[placed[pos]];
    const target = targetChars[pos];
    if (target === undefined) return 'wrong';
    return normChar(picked) === normChar(target) ? 'correct' : 'wrong';
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <div className="flex flex-col items-center gap-2 w-full max-w-xl">
        <h1 className="text-xl font-semibold">Word Builder</h1>
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
                Letters
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
            {phase === 'idle' ? 'Start' : 'New'}
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
                  <div className="min-h-[3rem] rounded-md border border-dashed border-input bg-muted/30 p-2 flex flex-wrap gap-1">
                    {placed.length === 0 && (
                      <span className="text-sm text-muted-foreground self-center">
                        Tap letters below or type on your keyboard…
                      </span>
                    )}
                    {placed.map((srcIdx, pos) => {
                      const ch = shuffledChars[srcIdx];
                      const correctness = correctnessAt(pos);
                      const color =
                        correctness === 'correct'
                          ? 'bg-green-100 text-green-900 border-green-300'
                          : correctness === 'wrong'
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : 'bg-violet-100 text-violet-900 border-violet-200';
                      const display = ch === ' ' ? '␣' : ch;
                      return (
                        <button
                          key={`placed-${pos}`}
                          type="button"
                          onClick={() => {
                            setPlaced((prev) => prev.filter((_, i) => i !== pos));
                            setChecked(false);
                          }}
                          className={`w-8 h-8 rounded border text-sm font-mono ${color} hover:opacity-80`}
                          title="Remove"
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
                    <span>Letters</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handlePopLast} disabled={placed.length === 0} title="Backspace">
                      <Delete className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {availableIdx.map((i) => {
                      const ch = shuffledChars[i];
                      const display = ch === ' ' ? '␣' : ch;
                      return (
                        <button
                          key={`avail-${i}`}
                          type="button"
                          onClick={() => handlePick(i)}
                          className="w-8 h-8 rounded border border-input bg-background text-sm font-mono hover:bg-muted"
                        >
                          {display}
                        </button>
                      );
                    })}
                    {availableIdx.length === 0 && (
                      <span className="text-sm text-muted-foreground">All letters placed.</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your answer</div>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setChecked(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCheck();
                    }
                  }}
                  placeholder={`Type in ${view.targetLang}…`}
                  disabled={phase === 'success'}
                  className="w-full rounded border border-input bg-background p-2 text-sm"
                  autoFocus
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
                onClick={handleReset}
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
