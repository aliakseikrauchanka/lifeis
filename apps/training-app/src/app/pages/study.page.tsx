import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { fetchDueCards, fetchExamples, reviewCard, Rating, SrsCard, Example } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { BookOpen, Check, Volume2, ChevronLeft, ChevronRight, Volume1 } from 'lucide-react';
import { GradeButtons } from '../components/grade-buttons';

export function StudyPage() {
  const [queue, setQueue] = useState<SrsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('srs-auto-speak') === 'true');

  const current = queue[cardIndex];

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const cards = await fetchDueCards();
      setQueue(cards);
      setCardIndex(0);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const toggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      localStorage.setItem('srs-auto-speak', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!current || loading) return;
    if (autoSpeak) {
      speak(current.translation.original, current.translation.originalLanguage);
    }
    const ac = new AbortController();

    setLoadingExamples(true);
    setExamples([]);
    fetchExamples(
      current.translation.original,
      current.translation.originalLanguage,
      current.translation.translationLanguage,
      { signal: ac.signal, translation: current.translation.translation },
    )
      .then((ex) => setExamples(ex))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.error('Failed to load examples:', err);
        setExamples([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingExamples(false);
      });

    return () => ac.abort();
  }, [
    current?.translation._id,
    current?.translation.original,
    current?.translation.originalLanguage,
    current?.translation.translationLanguage,
    autoSpeak,
    loading,
  ]);

  const handleReveal = () => {
    setRevealed(true);
    if (!current) return;
    if (autoSpeak) {
      speak(current.translation.translation, current.translation.translationLanguage);
    }
  };

  const goToNext = useCallback(() => {
    if (queue.length === 0) return;
    setCardIndex((i) => (i + 1) % queue.length);
    setRevealed(false);
    setExamples([]);
  }, [queue.length]);

  const goToPrev = useCallback(() => {
    if (queue.length === 0) return;
    setCardIndex((i) => (i - 1 + queue.length) % queue.length);
    setRevealed(false);
    setExamples([]);
  }, [queue.length]);

  const handleGrade = async (rating: Rating) => {
    if (!current || grading) return;
    setGrading(true);
    try {
      await reviewCard(current.translation._id, rating);
    } catch (err) {
      console.error('Failed to review:', err);
    }

    const newQueue = [...queue.slice(0, cardIndex), ...queue.slice(cardIndex + 1)];
    if (rating === 'again') {
      newQueue.push(current);
    }

    if (newQueue.length === 0) {
      await loadCards();
    } else {
      setQueue(newQueue);
      setCardIndex(Math.min(cardIndex, newQueue.length - 1));
    }
    setRevealed(false);
    setExamples([]);
    setGrading(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || !current) return;

      switch (e.key) {
        case 'ArrowRight':
          goToNext();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'e':
        case 'E':
          if (!revealed) handleReveal();
          break;
        case '1':
          if (revealed && !grading) handleGrade('again');
          break;
        case '2':
          if (revealed && !grading) handleGrade('hard');
          break;
        case '3':
          if (revealed && !grading) handleGrade('good');
          break;
        case '4':
          if (revealed && !grading) handleGrade('easy');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, current, revealed, grading, goToNext, goToPrev]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
        <Check className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-semibold">All caught up!</h2>
        <p className="text-muted-foreground">No cards due right now.</p>
        <Link to="/library">
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" /> Go to Library
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
        <Button variant="ghost" size="sm" onClick={goToPrev} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          <kbd className="text-xs px-1.5 py-0.5 rounded bg-muted border">←</kbd>
        </Button>
        <div className="text-sm text-muted-foreground">
          {cardIndex + 1} / {queue.length} card{queue.length !== 1 ? 's' : ''}
        </div>
        <Button variant="ghost" size="sm" onClick={goToNext} className="gap-1">
          <kbd className="text-xs px-1.5 py-0.5 rounded bg-muted border">→</kbd>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant={autoSpeak ? 'default' : 'outline'}
          size="sm"
          onClick={toggleAutoSpeak}
          className="gap-1 ml-2"
          title="Auto-speak on new card"
        >
          <Volume1 className="h-4 w-4" />
          Auto
        </Button>
      </div>

      <Card className="w-full max-w-md h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
        <CardHeader className="text-center shrink-0 !p-3 !pb-1 !space-y-0.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {current.translation.originalLanguage}
          </div>
          <div className="flex items-center justify-center gap-1">
            <CardTitle className="text-xl sm:text-2xl">{current.translation.original}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => speak(current.translation.original, current.translation.originalLanguage)}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent
          className={`text-center flex flex-col items-center gap-4 flex-1 min-h-0 overflow-y-auto ${!revealed ? 'cursor-pointer' : ''}`}
          onClick={!revealed ? handleReveal : undefined}
        >
          <div className={`transition-all duration-300 ${!revealed ? 'blur-md select-none' : ''}`}>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {current.translation.translationLanguage}
            </div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-medium text-primary">{current.translation.translation}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full"
                onClick={(e) => { e.stopPropagation(); speak(current.translation.translation, current.translation.translationLanguage); }}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className={`w-full border-t pt-3 transition-all duration-300 ${!revealed ? 'blur-md select-none' : ''}`}>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Examples
            </div>
            {loadingExamples ? (
              <div className="flex justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : examples.length > 0 ? (
              <div className="space-y-3">
                {examples.map((ex, i) => (
                  <div key={i} className="text-left space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{ex.original}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full shrink-0"
                        onClick={(e) => { e.stopPropagation(); speak(ex.original, current.translation.originalLanguage); }}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{ex.translated}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full shrink-0"
                        onClick={(e) => { e.stopPropagation(); speak(ex.translated, current.translation.translationLanguage); }}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className={`text-xs text-muted-foreground transition-opacity duration-300 ${revealed ? 'opacity-0' : ''}`}>
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border">E</kbd> to reveal
          </div>
        </CardContent>

        <CardFooter className={`shrink-0 transition-opacity duration-300 ${revealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <GradeButtons onGrade={handleGrade} disabled={grading} showHotkeys />
        </CardFooter>
      </Card>
    </div>
  );
}
