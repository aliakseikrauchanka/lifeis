import {
  pgTable, uuid, text, smallint, boolean, timestamp, integer, jsonb, date, unique,
} from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  position: smallint('position').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  labels: jsonb('labels').$type<{ en: string; pl: string; ru: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const editions = pgTable('editions', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionDate: date('edition_date').notNull(),
  status: text('status').notNull(), // 'draft' | 'published' | 'partial' | 'failed'
  trigger: text('trigger').notNull(), // 'cron' | 'manual'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  position: smallint('position').notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => ({
  uq: unique().on(t.editionId, t.categoryId, t.position),
}));

export const storyTranslations = pgTable('story_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  lang: text('lang').notNull(), // 'en' | 'pl' | 'ru'
  headline: text('headline').notNull(),
  body: text('body').notNull(),
}, (t) => ({
  uq: unique().on(t.storyId, t.lang),
}));

export const generationLogs = pgTable('generation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  trigger: text('trigger').notNull(),
  status: text('status').notNull(), // 'success' | 'partial' | 'failed'
  editionId: uuid('edition_id').references(() => editions.id),
  feedsFetched: integer('feeds_fetched').notNull().default(0),
  itemsConsidered: integer('items_considered').notNull().default(0),
  storiesCreated: integer('stories_created').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  error: text('error'),
  details: jsonb('details'),
});

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  feedUrl: text('feed_url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
});

export type Category = typeof categories.$inferSelect;
export type Edition = typeof editions.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryTranslation = typeof storyTranslations.$inferSelect;
export type GenerationLog = typeof generationLogs.$inferSelect;
export type Source = typeof sources.$inferSelect;
