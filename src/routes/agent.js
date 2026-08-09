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
    
    // Automatically start autonomous scheduler loop inside /init
    startScheduler();

    // Run first cycle immediately and await completion so the initial post is created right away
    try {
      await runAutonomousCycle();
    } catch (e) {
      console.error('[Init] Immediate cycle error:', e.message);
    }

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
    if (!agentId) {
      return res.status(404).json({ error: 'No active agent found. Initialize an agent first via POST /api/agent/init.' });
    }

    let rawPosts = await db.getPosts(agentId) || [];
    if (rawPosts.length === 0) {
      const latestAgent = await db.getLatestAgent();
      if (latestAgent && latestAgent.id !== agentId) {
        rawPosts = await db.getPosts(latestAgent.id) || [];
      }
    }

    const posts = rawPosts.map(post => {
      // Normalise sources to URL strings
      let sources = [];
      if (Array.isArray(post.sources)) {
        sources = post.sources.map(s => {
          if (typeof s === 'string') return s;
          return s.url || s.link;
        }).filter(Boolean);
      }

      // Include rejectedTopics so the frontend decision log can render them
      let rejectedTopics = [];
      if (Array.isArray(post.rejectedTopics)) {
        rejectedTopics = post.rejectedTopics;
      }

      return {
        id:             post.id,
        createdAt:      post.createdAt,
        text:           post.text,
        rationale:      post.rationale,
        styleType:      post.styleType || 'Insight',
        sources,
        rejectedTopics
      };
    });

    // Newest first
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ posts });
  } catch (error) {
    console.error('API Error in /agent/feed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/agent/logs
router.get('/agent/logs', async (req, res) => {
  try {
    const agentId = await getTargetAgentId(req);
    if (!agentId) {
      return res.status(404).json({ error: 'No active agent found. Initialize an agent first.' });
    }

    let rawPosts = await db.getPosts(agentId) || [];
    if (rawPosts.length === 0) {
      const latestAgent = await db.getLatestAgent();
      if (latestAgent && latestAgent.id !== agentId) {
        rawPosts = await db.getPosts(latestAgent.id) || [];
      }
    }

    let totalEvaluated = 0;
    let selected = 0;
    let offDomain = 0;
    let duplicate = 0;
    let lowRelevance = 0;
    let hype = 0;
    const rejectedTopics = [];

    rawPosts.forEach(post => {
      selected++;
      totalEvaluated++;

      if (Array.isArray(post.rejectedTopics)) {
        post.rejectedTopics.forEach(t => {
          totalEvaluated++;
          const title = typeof t === 'string' ? t : (t.title || '');
          const reason = typeof t === 'string' ? 'Not AI security' : (t.reason || 'Not AI security');
          
          const rLower = reason.toLowerCase();
          if (rLower.includes('duplicate')) {
            duplicate++;
          } else if (rLower.includes('low relevance')) {
            lowRelevance++;
          } else if (rLower.includes('hype') || rLower.includes('saturated')) {
            hype++;
          } else {
            offDomain++;
          }

          rejectedTopics.push({
            title,
            reason,
            timestamp: post.createdAt
          });
        });
      }
    });

    res.json({
      stats: {
        totalEvaluated,
        selected,
        offDomain,
        duplicate,
        lowRelevance,
        hype
      },
      rejectedTopics
    });
  } catch (error) {
    console.error('API Error in /agent/logs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. GET /api/agent/memory
router.get('/agent/memory', async (req, res) => {
  try {
    const agentId = await getTargetAgentId(req);
    if (!agentId) {
      return res.status(404).json({ error: 'No active agent found.' });
    }

    let rawPosts = await db.getPosts(agentId) || [];
    if (rawPosts.length === 0) {
      const latestAgent = await db.getLatestAgent();
      if (latestAgent && latestAgent.id !== agentId) {
        rawPosts = await db.getPosts(latestAgent.id) || [];
      }
    }

    const titles = rawPosts.map(p => {
      const src = Array.isArray(p.sources) && p.sources[0];
      return typeof src === 'object' ? (src.title || src.url) : (src || p.text?.split('\n')[0]?.replace('Insight:', '').trim());
    }).filter(Boolean);

    res.json({
      memory: titles
    });
  } catch (error) {
    console.error('API Error in /agent/memory:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
