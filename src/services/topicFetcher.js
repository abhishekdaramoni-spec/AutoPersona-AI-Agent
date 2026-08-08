import Parser from 'rss-parser';
import crypto from 'crypto';

const parser = new Parser();

export const TRUSTED_DOMAINS = [
  'news.ycombinator.com',
  'techcrunch.com',
  'wired.com',
  'arstechnica.com',
  'bleepingcomputer.com',
  'krebsonsecurity.com'
];

const RSS_FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'ArsTechnica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'KrebsonSecurity', url: 'https://krebsonsecurity.com/feed/' }
];

export function isTrustedSource(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

export async function discoverTopics() {
  const topics = [];

  // 1. Fetch HackerNews top stories
  try {
    const hnResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (hnResponse.ok) {
      const topIds = await hnResponse.json();
      const detailPromises = topIds.slice(0, 10).map(async (id) => {
        try {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (res.ok) {
            const item = await res.json();
            if (item && item.title) {
              return {
                id: `hn-${item.id}`,
                title: item.title,
                url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
                createdAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
                source: 'HackerNews'
              };
            }
          }
        } catch (e) {
          // Ignore individual fetch errors
        }
        return null;
      });
      
      const hnItems = (await Promise.all(detailPromises)).filter(item => item !== null);
      topics.push(...hnItems);
    }
  } catch (error) {
    console.error('[Fetcher] Error fetching HackerNews topics:', error.message);
  }

  // 2. Fetch RSS Feeds
  console.log("Fetching topics from RSS...");
  for (const feedConfig of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      const rssItems = feed.items.slice(0, 8).map(item => ({
        id: `rss-${crypto.createHash('md5').update(item.link || item.title).digest('hex').slice(0, 10)}`,
        title: item.title,
        url: item.link,
        createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
        source: `RSS (${feedConfig.name})`
      }));

      topics.push(...rssItems);
    } catch (error) {
      console.warn(`[Fetcher] Error fetching RSS feed from ${feedConfig.name}:`, error.message);
    }
  }

  // Deduplicate by title
  const uniqueTopics = [];
  const seenTitles = new Set();
  
  for (const topic of topics) {
    const cleanTitle = topic.title.toLowerCase().trim();
    if (!seenTitles.has(cleanTitle)) {
      seenTitles.add(cleanTitle);
      uniqueTopics.push(topic);
    }
  }

  const filtered = uniqueTopics.filter(t => isTrustedSource(t.url));
  
  if (filtered.length > 0) {
    return filtered;
  }

  // Fallback mock topics if live network feeds fail or return empty
  console.log('[Fetcher] Live feeds empty or unavailable. Using trusted mock topics.');
  return [
    {
      id: `mock-1-${Date.now()}`,
      title: 'New AI security vulnerabilities discovered in open-source LLM agent frameworks',
      url: 'https://techcrunch.com/category/artificial-intelligence/',
      createdAt: new Date().toISOString(),
      source: 'RSS (TechCrunch)'
    },
    {
      id: `mock-2-${Date.now()}`,
      title: 'Security researchers bypass multi-modal safety guardrails using adversarial prompt injection',
      url: 'https://www.wired.com/category/security/',
      createdAt: new Date().toISOString(),
      source: 'RSS (Wired)'
    },
    {
      id: `mock-3-${Date.now()}`,
      title: 'Zero-trust sandboxing required to prevent autonomous AI agent data exfiltration',
      url: 'https://krebsonsecurity.com/',
      createdAt: new Date().toISOString(),
      source: 'RSS (KrebsonSecurity)'
    }
  ];
}
