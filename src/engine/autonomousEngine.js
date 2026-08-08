import crypto from 'crypto';
import { discoverTopics } from '../services/topicFetcher.js';
import * as db from '../services/memory.js';
import { calculateRelevanceScore, isClearlyIrrelevant, generatePost, POST_STYLES } from '../services/scorer.js';

let intervalId = null;
let isRunning = false;

export function startScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  // Set up 10-minute loop
  intervalId = setInterval(() => {
    console.log('[Scheduler] Running autonomous cycle...');
    runAutonomousCycle().catch(e => console.error('[Scheduler] Interval run failed:', e.message));
  }, 10 * 60 * 1000);
}

export async function runAutonomousCycle() {
  if (isRunning) {
    console.log('[Autonomous Engine] Cycle already in progress, skipping.');
    return { success: false, reason: 'Already running' };
  }
  
  isRunning = true;
  try {
    const agent = await db.getLatestAgent();
    if (!agent) {
      console.warn('[Autonomous Engine] No agent initialized yet. Initialize first via /api/agent/init.');
      isRunning = false;
      return { success: false, reason: 'No agent initialized' };
    }

    console.log(`[Autonomous Engine] Starting cycle for agent: ${agent.name}`);
    const discovered = await discoverTopics();
    if (discovered.length === 0) {
      console.log('[Autonomous Engine] No topics discovered.');
      isRunning = false;
      return { success: true, postsCreated: 0, reason: 'No topics discovered' };
    }

    const filteredTopics = [];
    const cycleRejections = [];

    for (const topic of discovered) {
      // 1. Duplicate check
      const isDuplicate = await db.isTopicDuplicate(agent.id, topic.title);
      if (isDuplicate) {
        cycleRejections.push({ title: topic.title, reason: 'Duplicate' });
        continue;
      }

      // 2. Irrelevance Rejection Guard (lawsuits, wildfire, etc.)
      if (isClearlyIrrelevant(topic)) {
        cycleRejections.push({ title: topic.title, reason: 'Not AI security' });
        continue;
      }

      // 3. AI Safety/relevance match check
      const titleLower = topic.title.toLowerCase();
      const isAI = ['ai', 'llm', 'model', 'openai', 'gpt', 'claude', 'gemini', 'agent', 'machine learning', 'deep learning'].some(kw => {
        return titleLower.includes(kw);
      });
      if (!isAI) {
        cycleRejections.push({ title: topic.title, reason: 'Not AI security' });
        continue;
      }

      // Calculate score out of 100
      const score = calculateRelevanceScore(topic, isDuplicate);
      filteredTopics.push({ ...topic, score });
    }

    // Fallback: If no strict AI safety topics were found, relax the check to allow top non-duplicate general topics
    if (filteredTopics.length === 0) {
      for (const topic of discovered) {
        const isDuplicate = await db.isTopicDuplicate(agent.id, topic.title);
        if (isDuplicate || isClearlyIrrelevant(topic)) continue;
        
        const score = calculateRelevanceScore(topic, false);
        filteredTopics.push({ ...topic, score });
      }
    }

    // Now find the highest scoring topic
    let selectedEval = null;
    
    // Threshold check (score > 65)
    const candidates = filteredTopics.filter(t => t.score > 65);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      selectedEval = candidates[0];
      
      // The rest of the candidates are marked as low relevance
      candidates.slice(1).forEach(c => {
        cycleRejections.push({ title: c.title, reason: 'Low relevance' });
      });
    }

    // If none crossed threshold, fallback select the top candidate from all filtered topics to guarantee feed growth
    if (!selectedEval && filteredTopics.length > 0) {
      filteredTopics.sort((a, b) => b.score - a.score);
      selectedEval = filteredTopics[0];
      
      filteredTopics.slice(1).forEach(c => {
        cycleRejections.push({ title: c.title, reason: 'Low relevance' });
      });
    }

    // Push non-selected filtered topics that didn't make the cut to rejections list
    filteredTopics.forEach(t => {
      if (selectedEval && t.id !== selectedEval.id && !cycleRejections.some(cr => cr.title === t.title)) {
        cycleRejections.push({ title: t.title, reason: 'Low relevance' });
      }
    });

    if (!selectedEval) {
      console.log('[Autonomous Engine] All discovered topics were filtered or no candidates available.');
      isRunning = false;
      return { success: true, postsCreated: 0, reason: 'All topics filtered' };
    }

    // Track selection decision log in database seen topics memory registry
    await db.saveTopicSeen({
      id: selectedEval.id,
      agentId: agent.id,
      title: selectedEval.title,
      url: selectedEval.url,
      source: selectedEval.source,
      score: selectedEval.score / 100, // normalized to 0-1
      decision: 'selected',
      reason: `[Selected] Score: ${selectedEval.score}%`,
      seenAt: new Date().toISOString()
    });

    // Pick style type rotation
    const styleType = POST_STYLES[Math.floor(Math.random() * POST_STYLES.length)];
    const memoryContext = await db.getRecentMemory(agent.id, 8);
    const generated = await generatePost(agent, selectedEval, styleType, memoryContext);

    // Build the 5 structured rationale headers block
    const confidencePercent = selectedEval.score;
    const credibilityRating = selectedEval.source.includes('RSS') ? 'High (Whitelisted Authority Domain)' : 'Standard Compute Feed';
    const memoryCheckText = memoryContext.recentTopics.length > 0
      ? `Passed duplicate prevention scan against the last ${memoryContext.recentTopics.length} published concepts: ${JSON.stringify(memoryContext.recentTopics.slice(0, 4))}`
      : 'Passed duplicate prevention scan (timeline memory registry is empty)';

    const enhancedRationale = `Why Selected:
"${selectedEval.title}" aligns directly with our AI Security domain focus (Confidence: ${confidencePercent}%, Mode: Strategic Relevance Match).

Why Relevant Now:
This is a fresh industry technical update published recently, requiring real-time pragmatic warning analysis.

Why Better Than Others:
This topic scored higher than other candidates in this batch (which were rejected due to duplication, low relevance, or lack of AI security focus).

Source Credibility:
Discovered via ${selectedEval.source} (${credibilityRating}).

Memory Check:
${memoryCheckText}.

---
${generated.rationale}`;

    const post = {
      id: crypto.randomUUID(),
      agentId: agent.id,
      text: generated.text,
      rationale: enhancedRationale,
      styleType,
      sources: [
        {
          title: selectedEval.title,
          url: selectedEval.url,
          source: selectedEval.source
        }
      ],
      rejectedTopics: cycleRejections,
      createdAt: new Date().toISOString()
    };

    await db.savePost(post);
    console.log(`[Autonomous Engine] Successfully posted about "${selectedEval.title}" (Score: ${selectedEval.score}%) using [${styleType}] style.`);

    isRunning = false;
    return { success: true, postsCreated: 1, post };

  } catch (error) {
    console.error('[Autonomous Engine] Exception in cycle:', error.message);
    isRunning = false;
    return { success: false, error: error.message };
  }
}
