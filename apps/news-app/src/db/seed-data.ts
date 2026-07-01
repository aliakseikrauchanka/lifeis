export const CATEGORY_SEED = [
  { slug: 'poland', position: 1, labels: { en: 'Poland', pl: 'Polska', ru: 'Польша' } },
  { slug: 'world', position: 2, labels: { en: 'World', pl: 'Świat', ru: 'Мир' } },
  { slug: 'positive', position: 3, labels: { en: 'Positive', pl: 'Pozytywy dla Kuby za darmo', ru: 'Позитив' } },
] as const;

export const SOURCE_SEED = [
  // Poland
  { categorySlug: 'poland', name: 'PAP', feedUrl: 'https://www.pap.pl/rss.xml' },
  { categorySlug: 'poland', name: 'Polskie Radio', feedUrl: 'https://polskieradio24.pl/rss' },
  { categorySlug: 'poland', name: 'Notes from Poland', feedUrl: 'https://notesfrompoland.com/feed/' },
  // World
  { categorySlug: 'world', name: 'Reuters', feedUrl: 'https://feeds.reuters.com/reuters/worldNews' },
  { categorySlug: 'world', name: 'Associated Press', feedUrl: 'https://feedx.net/rss/ap.xml' },
  { categorySlug: 'world', name: 'BBC News', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { categorySlug: 'world', name: 'Al Jazeera', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml' },
  // Positive
  { categorySlug: 'positive', name: 'Good News Network', feedUrl: 'https://www.goodnewsnetwork.org/feed/' },
  { categorySlug: 'positive', name: 'Positive News', feedUrl: 'https://www.positive.news/feed/' },
] as const;
