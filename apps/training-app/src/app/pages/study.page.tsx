import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { fetchDueCards, fetchExamples, reviewCard, Rating, SrsCard } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { BookOpen, Check, Volume2 } from 'lucide-react';

export function StudyPage() {
  const [queue, setQueue] = useState<SrsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);

  const current = queue[0];

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const cards = await fetchDueCards();
      setQueue(cards);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleReveal = async () => {
    setRevealed(true);
    if (!current) return;
    setLoadingExamples(true);
    try {
      const ex = await fetchExamples(
        current.translation.translation,
        current.translation.translationLanguage,
      );
      setExamples(ex);
    } catch (err) {
      console.error('Failed to load examples:', err);
      setExamples([]);
    } finally {
      setLoadingExamples(false);
    }
  };

  const handleGrade = async (rating: Rating) => {
    if (!current || grading) return;
    setGrading(true);
    try {
      await reviewCard(current.translation._id, rating);
    } catch (err) {
      console.error('Failed to review:', err);
    }

    const rest = queue.slice(1);
    if (rating === 'again') {
      rest.push(current);
    }

    if (rest.length === 0) {
      await loadCards();
    } else {
      setQueue(rest);
    }
    setRevealed(false);
    setExamples([]);
    setGrading(false);
  };

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
      <div className="text-sm text-muted-foreground mb-4">
        {queue.length} card{queue.length !== 1 ? 's' : ''} remaining
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {current.translation.originalLanguage}
          </div>
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-3xl">{current.translation.original}</CardTitle>
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

        <CardContent className="text-center min-h-[80px] flex flex-col items-center justify-center gap-4">
          {revealed ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {current.translation.translationLanguage}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-medium text-primary">{current.translation.translation}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full"
                    onClick={() => speak(current.translation.translation, current.translation.translationLanguage)}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="w-full border-t pt-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Examples
                </div>
                {loadingExamples ? (
                  <div className="flex justify-center">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : examples.length > 0 ? (
                  <div className="space-y-2">
                    {examples.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-left">
                        <span className="text-sm text-muted-foreground">{ex}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-full shrink-0"
                          onClick={() => speak(ex, current.translation.translationLanguage)}
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Button variant="secondary" onClick={handleReveal} className="text-lg px-8 py-6">
              Show Answer
            </Button>
          )}
        </CardContent>

        {revealed && (
          <CardFooter className="flex justify-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleGrade('again')}
              disabled={grading}
            >
              Again
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => handleGrade('hard')}
              disabled={grading}
            >
              Hard
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => handleGrade('good')}
              disabled={grading}
            >
              Good
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => handleGrade('easy')}
              disabled={grading}
            >
              Easy
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
