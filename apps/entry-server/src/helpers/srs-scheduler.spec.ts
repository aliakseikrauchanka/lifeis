import { schedule, SchedulerInput } from './srs-scheduler';

const MS_PER_DAY = 86_400_000;

function newCard(): SchedulerInput {
  return { interval_days: 0, ease: 2.5, reps: 0, lapses: 0 };
}

describe('srs-scheduler', () => {
  const now = Date.now();

  describe('new card (reps=0)', () => {
    it('again → 1-minute relearn, lapses+1, ease drops', () => {
      const result = schedule(newCard(), 'again', now);
      expect(result.reps).toBe(0);
      expect(result.lapses).toBe(1);
      expect(result.ease).toBe(2.3);
      expect(result.due_at).toBe(now + 60_000);
    });

    it('hard → 1 day, ease drops', () => {
      const result = schedule(newCard(), 'hard', now);
      expect(result.interval_days).toBe(1);
      expect(result.reps).toBe(1);
      expect(result.ease).toBe(2.35);
      expect(result.due_at).toBe(now + MS_PER_DAY);
    });

    it('good → 1 day, ease unchanged', () => {
      const result = schedule(newCard(), 'good', now);
      expect(result.interval_days).toBe(1);
      expect(result.reps).toBe(1);
      expect(result.ease).toBe(2.5);
      expect(result.due_at).toBe(now + MS_PER_DAY);
    });

    it('easy → 4 days, ease increases', () => {
      const result = schedule(newCard(), 'easy', now);
      expect(result.interval_days).toBe(4);
      expect(result.reps).toBe(1);
      expect(result.ease).toBe(2.65);
      expect(result.due_at).toBe(now + 4 * MS_PER_DAY);
    });
  });

  describe('reps=1 card', () => {
    const card: SchedulerInput = { interval_days: 1, ease: 2.5, reps: 1, lapses: 0 };

    it('good → 6 days', () => {
      const result = schedule(card, 'good', now);
      expect(result.interval_days).toBe(6);
      expect(result.reps).toBe(2);
    });

    it('hard → 1.2 days', () => {
      const result = schedule(card, 'hard', now);
      expect(result.interval_days).toBeCloseTo(1.2);
      expect(result.reps).toBe(2);
    });
  });

  describe('mature card (reps=2, interval=6, ease=2.5)', () => {
    const card: SchedulerInput = { interval_days: 6, ease: 2.5, reps: 2, lapses: 0 };

    it('good → interval * ease = 15 days', () => {
      const result = schedule(card, 'good', now);
      expect(result.interval_days).toBe(15);
      expect(result.reps).toBe(3);
    });

    it('easy → interval * ease * 1.3 = 19.5 days, ease +0.15', () => {
      const result = schedule(card, 'easy', now);
      expect(result.interval_days).toBeCloseTo(19.5);
      expect(result.ease).toBe(2.65);
    });

    it('again → resets reps, 1-minute interval', () => {
      const result = schedule(card, 'again', now);
      expect(result.reps).toBe(0);
      expect(result.lapses).toBe(1);
      expect(result.due_at).toBe(now + 60_000);
    });
  });

  describe('ease floor', () => {
    it('ease never drops below 1.3', () => {
      let card: SchedulerInput = { interval_days: 1, ease: 1.35, reps: 1, lapses: 5 };
      const result = schedule(card, 'again', now);
      expect(result.ease).toBe(1.3);

      // one more again should still be 1.3
      const result2 = schedule(result, 'again', now);
      expect(result2.ease).toBe(1.3);
    });
  });
});
