# Training app — "Added today" tab + MCP tool

## Goal

Expand the review popover (the History-icon button in the training-app header) so it shows two tabs:

1. **Trained** — words the user has reviewed today (current behavior).
2. **Added** — translations the user has added to their library today, with an indicator for ones not enrolled in SRS.

Expose the same "added since" data via a new MCP tool so the agent can recap what the user added today.

## Non-goals

- No changes to SRS scheduling, review flow, or how translations are created.
- No filtering UI inside the popover (no language filter, no search). The popover is a recap, not a management view.
- No pagination. The half-year clamp on the API is the cap; the UI shows whatever the API returns.

## User-visible behavior

- The header History-icon button opens the same popover as today, but the body is tabbed.
- Tab strip at the top of the popover replaces the current title row: two pill-buttons `Trained (N)` and `Added (N)`. Counts only appear once that tab's data has loaded.
- "Trained" tab is selected by default and loads on popover open (unchanged behavior).
- "Added" tab loads the first time it is selected during a popover session; both tabs cache their results until the popover closes.
- Each "Added" row uses the same two-line layout as "Trained" (original + translation + speak buttons). The trailing chip slot shows a small amber "not enrolled" pill when the row's `enrolled` flag is false; otherwise the slot is empty.
- Empty state per tab: `No words trained today yet.` / `No words added today yet.`

## Backend

### New endpoint

`GET /api/translations/added-since?since=<epoch-ms>`

- **Auth:** `verifyAccessToken` (matches the rest of `/translations`).
- **Query param `since`** (optional, integer epoch-ms):
  - If omitted: default to start of the current UTC day (`Date.UTC(y, m, d)`).
  - Must be a finite, non-negative integer.
  - Must be `>= Date.now() - 180 * 86_400_000` (180-day window cap).
  - Must be `<= Date.now() + 86_400_000` (allow a one-day skew like `/srs/trained-today`).
  - Invalid → `400 { message: "since must be an epoch-ms timestamp within the last 180 days" }`.
- **Response:** `200 { translations: AddedTranslation[] }`, sorted by `timestamp` desc.

**`AddedTranslation` shape:**
```ts
{
  _id, original, translation, originalLanguage, translationLanguage,
  owner_id, timestamp,
  enrolled: boolean   // true iff an srs document exists for this translation_id + owner_id
}
```

**Aggregation:**
```js
db.collection('translations').aggregate([
  { $match: { owner_id: userId, timestamp: { $gte: since } } },
  {
    $lookup: {
      from: 'srs',
      let: { tid: '$_id', oid: '$owner_id' },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ['$translation_id', '$$tid'] },
          { $eq: ['$owner_id', '$$oid'] },
        ] } } },
        { $limit: 1 },
        { $project: { _id: 1 } },
      ],
      as: 'srs',
    },
  },
  { $addFields: { enrolled: { $gt: [{ $size: '$srs' }, 0] } } },
  { $project: { srs: 0 } },
  { $sort: { timestamp: -1 } },
])
```

The `$lookup` uses the per-user `let` form so a `srs` document for a different user cannot accidentally flip `enrolled`.

### Error handling

Same shape as the rest of the file: try/catch, log to `console.error`, respond `500 { message: 'Error fetching added-since translations' }` on failure.

## Frontend — training-app

### `apps/training-app/src/app/api/srs.api.ts`

Add:

```ts
export interface AddedTranslation extends TranslationData {
  timestamp: number;
  enrolled: boolean;
}

export const fetchAddedToday = async (): Promise<AddedTranslation[]> => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const res = await utilFetch(`/translations/added-since?since=${since.getTime()}`);
  if (!res.ok) throw new Error('Failed to fetch added-since translations');
  const { translations } = await res.json();
  return translations;
};
```

Note: the client passes start of **local** day (consistent with `fetchTrainedToday`). The MCP tool will pass start of UTC day.

### `header-trained-today-button.tsx` → `header-today-button.tsx`

Rename the file and the exported component to `HeaderTodayButton`. Update the single import site `apps/training-app/src/app/app.tsx`.

**Component state additions:**

```ts
const [activeTab, setActiveTab] = useState<'trained' | 'added'>('trained');
const [added, setAdded] = useState<AddedTranslation[] | null>(null);
const [addedLoading, setAddedLoading] = useState(false);
const [addedError, setAddedError] = useState<string | null>(null);
```

**Load behavior:**

- The existing `useEffect` that fires on `open` continues to load the trained list (unchanged).
- A new `useEffect` keyed on `[open, activeTab]` loads `added` only when `open && activeTab === 'added' && added === null`. This is the lazy-load.
- When the popover closes, reset both lists, both errors, and `activeTab` back to `'trained'` so the next open is a fresh session.

**Layout:**

Replace the existing header row (the one that says "Trained today" + count) with a tab strip:

```tsx
<div className="flex shrink-0 items-center gap-1 border-b px-2 py-2 text-sm">
  <TabButton active={activeTab === 'trained'} onClick={() => setActiveTab('trained')}>
    Trained {cards ? <span className="text-xs opacity-70">({cards.length})</span> : null}
  </TabButton>
  <TabButton active={activeTab === 'added'} onClick={() => setActiveTab('added')}>
    Added {added ? <span className="text-xs opacity-70">({added.length})</span> : null}
  </TabButton>
</div>
```

`TabButton` is a small inline component in the same file — a button with rounded-md, active state uses `bg-violet-500/10 text-violet-900 font-semibold`, inactive uses `text-muted-foreground hover:text-foreground`.

**Body:**

Switch on `activeTab`:

- `trained` → the existing list rendering (extracted into a small `TrainedList` inline component or kept inline inside a conditional block).
- `added` → an `AddedList` block with the same per-row visual structure (two lines, speak buttons), with one change in the trailing chip slot:

```tsx
{t.enrolled === false && (
  <span className="self-start rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 sm:shrink-0">
    not enrolled
  </span>
)}
```

Reuse `speak(...)` for the speaker buttons exactly like the trained rows.

## MCP — entry-mcp-server

### `apps/entry-mcp-server/src/api-client.ts`

```ts
addedSince(since: number) {
  return this.request('training', 'GET', `/api/translations/added-since?since=${since}`);
}
```

### `apps/entry-mcp-server/src/main.ts`

Register a tool that mirrors `review_today_words`:

```ts
server.tool(
  'list_added_words',
  "List translations the user added to the library since the given timestamp. Each item includes the translation fields and an `enrolled` flag indicating whether it's enrolled in SRS. Use this to recap what the user added today. Defaults to start of UTC day if `since` is omitted.",
  {
    since: z.number().int().nonnegative().optional().describe(
      'Epoch-ms cutoff; results have timestamp >= since. Defaults to start of UTC day. Server clamps to no older than 180 days.',
    ),
  },
  async ({ since }) => {
    const cutoff = since ?? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const result = await api.addedSince(cutoff);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);
```

## Testing

- **Backend manual test:** Hit `/api/translations/added-since` with no `since`, with a valid `since`, with `since = 0` (expect 400 because it's older than 180 days), and with `since` in the future (expect 400). Confirm `enrolled` is `true` for translations that have an SRS doc and `false` for ones that don't.
- **Frontend manual test:** Open the popover, confirm "Trained" loads as today. Click "Added", confirm the second tab loads once and is cached on subsequent toggles. Add a new translation in another tab, close & reopen the popover, confirm it appears in the "Added" list. Verify the amber "not enrolled" pill renders for translations not yet enrolled in SRS.
- **MCP manual test:** Call `list_added_words` from the agent with and without `since`, verify the JSON payload matches the endpoint response.

There are no existing tests on `HeaderTrainedTodayButton`, `fetchTrainedToday`, or `review_today_words`, so we are not adding new tests in this change — verification is by manual smoke as above.

## Migration / rollout

- No data migration. The `translations` collection already has `timestamp`, and `srs` already has `translation_id` + `owner_id`.
- No flag — the change ships when merged.

## Risks

- **`$lookup` performance:** if a user has thousands of translations added in 180 days, the per-row lookup could be slow. Mitigation: the popover only ever passes start-of-day (small window), and the API clamp prevents abuse. If this becomes a problem we can add an index on `srs(owner_id, translation_id)` (likely already present for the existing `findOne` in `/srs/review`).
- **Component rename touches `app.tsx`:** small blast radius (one import), low risk.
