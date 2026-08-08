import express from 'express';
import crypto from 'crypto';
import * as db from '../services/memory.js';
import { generatePersona } from '../services/scorer.js';
import { runAutonomousCycle, startScheduler } from '../engine/autonomousEngine.js';

const router = express.Router();

async function getTargetAgentId(req) {
  if (req.query.agentId) return req.query.agentId;
  const activeAgent = await db.getLatestAgent();
  return activeAgent ? activeAgent.id : null;
}

// 1. POST /api/agent/init
router.post('/agent/init', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const name = req.body.persona?.name || req.body.name;
  const domain = req.body.persona?.domain || req.body.domain;
  
  if (!name || !name.trim() || !domain || !domain.trim()) {
    return res.status(400).json({ error: 'Both name and domain are required.' });
  }

  try {
    const generated = await generatePersona(name, domain);
    const agent = {
      id: crypto.randomUUID(),
      name: name.trim(),
      domain: domain.trim(),
      style: generated.style || [],
      tone: generated.tone || 'analytical',
      opinions: generated.opinions || [],
      interests: generated.interests || [domain],
      createdAt: new Date().toISOString()
    };

    await db.saveAgent(agent);
    
    // Automatically start autonomous scheduler loop inside /init (True Autonomy!)
    startScheduler();

    res.status(201).json({
      agentId: agent.id
    });
  } catch (error) {
    console.error('API Error in /agent/init:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/agent/feed
router.get('/agent/feed', async (req, res) => {
  try {
    const agentId = await getTargetAgentId(req);
    const isInitialized = !!agentId;
    if (!isInitialized) {
      return res.status(400).json({ error: "Agent not initialized" });
    }

    const rawPosts = await db.getPosts(agentId) || [];
    
    const posts = rawPosts.map(post => {
      let sources = [];
      if (Array.isArray(post.sources)) {
        sources = post.sources.map(s => {
          if (typeof s === 'string') return s;
          return s.url || s.link;
        }).filter(Boolean);
      }
      return {
        id: post.id,
        createdAt: post.createdAt,
        text: post.text,
        rationale: post.rationale,
        sources: sources
      };
    });

    const rejectedTopicsSet = new Set();
    const rejectedTopics = [];
    rawPosts.forEach(post => {
      if (Array.isArray(post.rejectedTopics)) {
        post.rejectedTopics.forEach(topic => {
          const key = typeof topic === 'string' ? topic : (topic.title || JSON.stringify(topic));
          if (key && !rejectedTopicsSet.has(key)) {
            rejectedTopicsSet.add(key);
            rejectedTopics.push(topic);
          }
        });
      }
    });

    if (posts.length === 0) {
      posts.push({
        id: "fallback-post-id",
        createdAt: new Date().toISOString(),
        text: "Analyzing AI Security landscape. No posts generated yet. Tuning autonomous sensors for next run.",
        rationale: "Autonomous scheduler started. Feed placeholder until first content cycle completion.",
        sources: []
      });
    }

    // Add timestamp to feed response
    const timestamp = new Date().toISOString();

    res.json({
      timestamp,
      posts: posts || [],
      rejectedTopics: rejectedTopics || []
    });
  } catch (error) {
    console.error('API Error in /agent/feed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
