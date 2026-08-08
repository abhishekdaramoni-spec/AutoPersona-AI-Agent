import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db = null;
const memorySet = new Set();

export function hasSeen(topic) {
  return memorySet.has(topic);
}

export async function getDb() {
  if (db) return db;

  const dbDir = path.resolve('./data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = process.env.DATABASE_URL || path.join(dbDir, 'sqlite.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await initDb(db);
  return db;
}

async function initDb(database) {
  // Create agents table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      style TEXT NOT NULL,
      tone TEXT NOT NULL,
      opinions TEXT NOT NULL,
      interests TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // Create posts table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      text TEXT NOT NULL,
      rationale TEXT NOT NULL,
      sources TEXT NOT NULL,
      styleType TEXT NOT NULL DEFAULT 'Insight',
      rejectedTopics TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (agentId) REFERENCES agents (id) ON DELETE CASCADE
    )
  `);

  // Create topics_seen table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS topics_seen (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      source TEXT NOT NULL,
      score REAL NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL,
      seenAt TEXT NOT NULL,
      FOREIGN KEY (agentId) REFERENCES agents (id) ON DELETE CASCADE
    )
  `);

  // Create index for topic duplication checks
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_topics_title ON topics_seen (agentId, title);
  `);
}

export async function saveAgent(agent) {
  const database = await getDb();
  await database.run(
    `INSERT OR REPLACE INTO agents (id, name, domain, style, tone, opinions, interests, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      agent.name,
      agent.domain,
      JSON.stringify(agent.style),
      agent.tone,
      JSON.stringify(agent.opinions),
      JSON.stringify(agent.interests),
      agent.createdAt || new Date().toISOString()
    ]
  );
}

export async function getAgent(agentId) {
  const database = await getDb();
  const row = await database.get('SELECT * FROM agents WHERE id = ?', [agentId]);
  if (!row) return null;
  return {
    ...row,
    style: JSON.parse(row.style),
    opinions: JSON.parse(row.opinions),
    interests: JSON.parse(row.interests)
  };
}

export async function getLatestAgent() {
  const database = await getDb();
  const row = await database.get('SELECT * FROM agents ORDER BY createdAt DESC LIMIT 1');
  if (!row) return null;
  return {
    ...row,
    style: JSON.parse(row.style),
    opinions: JSON.parse(row.opinions),
    interests: JSON.parse(row.interests)
  };
}

export async function savePost(post) {
  const database = await getDb();
  await database.run(
    `INSERT INTO posts (id, agentId, text, rationale, sources, styleType, rejectedTopics, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      post.id,
      post.agentId,
      post.text,
      post.rationale,
      JSON.stringify(post.sources),
      post.styleType || 'Insight',
      JSON.stringify(post.rejectedTopics || []),
      post.createdAt || new Date().toISOString()
    ]
  );
}

export async function getPosts(agentId, limit = 50) {
  const database = await getDb();
  const rows = await database.all(
    'SELECT * FROM posts WHERE agentId = ? ORDER BY createdAt DESC LIMIT ?',
    [agentId, limit]
  );
  return rows.map(row => ({
    ...row,
    sources: JSON.parse(row.sources),
    rejectedTopics: row.rejectedTopics ? JSON.parse(row.rejectedTopics) : []
  }));
}

export async function saveTopicSeen(topic) {
  const database = await getDb();
  await database.run(
    `INSERT OR REPLACE INTO topics_seen (id, agentId, title, url, source, score, decision, reason, seenAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      topic.id,
      topic.agentId,
      topic.title,
      topic.url || null,
      topic.source,
      topic.score,
      topic.decision,
      topic.reason,
      topic.seenAt || new Date().toISOString()
    ]
  );
}

export async function getTopicsLog(agentId, limit = 150) {
  const database = await getDb();
  return await database.all(
    'SELECT * FROM topics_seen WHERE agentId = ? ORDER BY seenAt DESC LIMIT ?',
    [agentId, limit]
  );
}

export async function isTopicDuplicate(agentId, title) {
  const database = await getDb();
  const cleanTitle = title.trim().toLowerCase();
  
  const row = await database.get(
    "SELECT id FROM topics_seen WHERE agentId = ? AND LOWER(title) = ? AND decision IN ('selected', 'fallback_selected') LIMIT 1",
    [agentId, cleanTitle]
  );
  if (row) return true;

  const recentTopics = await database.all(
    "SELECT title FROM topics_seen WHERE agentId = ? AND decision IN ('selected', 'fallback_selected') ORDER BY seenAt DESC LIMIT 10",
    [agentId]
  );

  const isDuplicate = recentTopics.some(m =>
    m.title.trim().toLowerCase() === cleanTitle
  );

  return isDuplicate;
}

export async function getRecentMemory(agentId, limit = 10) {
  const database = await getDb();
  const recentPosts = await database.all(
    'SELECT text, styleType, createdAt FROM posts WHERE agentId = ? ORDER BY createdAt DESC LIMIT ?',
    [agentId, limit]
  );
  
  const recentTopics = await database.all(
    "SELECT title, seenAt FROM topics_seen WHERE agentId = ? AND decision IN ('selected', 'fallback_selected') ORDER BY seenAt DESC LIMIT ?",
    [agentId, limit]
  );

  return {
    recentPosts: recentPosts.map(p => `[${p.styleType}] ${p.text}`),
    recentTopics: recentTopics.map(t => t.title)
  };
}
