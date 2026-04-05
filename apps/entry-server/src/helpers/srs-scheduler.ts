export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SchedulerInput {
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface SchedulerOutput {
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  due_at: number;
}

const MS_PER_DAY = 86_400_000;
const MIN_EASE = 1.3;

/**
 * SM-2–inspired spaced repetition scheduler.
 *
 * Rating effects:
 *   again → reset reps, +1 lapse, 1-minute relearn step, ease −0.20
 *   hard  → interval × 1.2 (or 1d if new), ease −0.15
 *   good  → graduated intervals (1d → 6d → interval×ease), ease unchanged
 *   easy  → interval × ease × 1.3 (or 4d if new), ease +0.15
 */
export function schedule(card: SchedulerInput, rating: Rating, now: number): SchedulerOutput {
  let { interval_days, ease, reps, lapses } = card;

  switch (rating) {
    case 'again':
      reps = 0;
      lapses += 1;
      interval_days = 1 / 1440; // 1 minute
      ease = Math.max(MIN_EASE, ease - 0.2);
      break;

    case 'hard':
      if (reps === 0) {
        interval_days = 1;
      } else {
        interval_days = interval_days * 1.2;
      }
      ease = Math.max(MIN_EASE, ease - 0.15);
      reps += 1;
      break;

    case 'good':
      if (reps === 0) {
        interval_days = 1;
      } else if (reps === 1) {
        interval_days = 6;
      } else {
        interval_days = interval_days * ease;
      }
      reps += 1;
      break;

    case 'easy':
      if (reps === 0) {
        interval_days = 4;
      } else {
        interval_days = interval_days * ease * 1.3;
      }
      ease += 0.15;
      reps += 1;
      break;
  }

  const due_at = now + Math.round(interval_days * MS_PER_DAY);

  return { interval_days, ease, reps, lapses, due_at };
}
