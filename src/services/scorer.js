import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export const POST_STYLES = ['Insight', 'Critique', 'Prediction'];

export const IRRELEVANT_KEYWORDS = [
  'court', 'judge', 'lawsuit', 'entertainment', 'health', 'wildfire', 
  'crime', 'product review', 'review', 'hands-on', 'hands on', 
  'tv show', 'movie', 'stream', 'gear', 'deal', 'unboxing', 
  'how to stream', 'best shows', 'best movies', 'dashcam'
];

export function isClearlyIrrelevant(topic) {
  if (!topic || !topic.title) return false;
  const titleLower = topic.title.toLowerCase();
  return IRRELEVANT_KEYWORDS.some(k => titleLower.includes(k));
}

export let scoringWeights = {
  domainMatch: 1.0,
  novelty: 1.0,
  credibility: 1.0,
  riskDepth: 1.0,
  insightPotential: 1.0
};

export let adaptiveBoostKeywords = [];
export let adaptivePenalizeKeywords = [];

export function updateAdaptiveKeywords(successful, rejected) {
  adaptiveBoostKeywords = successful || [];
  adaptivePenalizeKeywords = rejected || [];
  console.log(`[Scorer Engine] Learning Keywords: Boosted: [${adaptiveBoostKeywords.join(', ')}], Penalized: [${adaptivePenalizeKeywords.join(', ')}]`);
}

export function adjustWeights(feedback) {
  console.log(`[Scorer Engine] Learning: adjusting weights based on reflection feedback. Quality: ${feedback.quality}`);
  if (feedback.quality === 'high') {
    scoringWeights.riskDepth = Math.min(1.5, scoringWeights.riskDepth + 0.05);
    scoringWeights.domainMatch = Math.min(1.5, scoringWeights.domainMatch + 0.05);
    scoringWeights.insightPotential = Math.min(1.5, scoringWeights.insightPotential + 0.05);
  } else if (feedback.quality === 'low') {
    scoringWeights.riskDepth = Math.max(0.7, scoringWeights.riskDepth - 0.05);
    scoringWeights.domainMatch = Math.max(0.7, scoringWeights.domainMatch - 0.05);
  }
}

/**
 * Calculates a relevance score from 0 to 100 based on:
 * - Domain Match (0–30)
 * - Novelty (0–20)
 * - Credibility (0–20)
 * - Risk Depth (0–20)
 * - Insight Potential (0–10)
 * 
 * Reject if score < 50
 */
export function calculateRelevanceScore(topic, isDuplicate = false) {
  if (!topic || !topic.title) return 0;
  const titleLower = topic.title.toLowerCase();

  // 1. Domain Match (0–30)
  let domainMatch = 5;
  const highKeywords = ['jailbreak', 'prompt injection', 'vulnerability', 'exploit', 'sandbox', 'adversarial', 'data exfiltration', 'breach', 'security concern', 'ai safety', 'ai security'];
  const midKeywords = ['ai', 'llm', 'model', 'openai', 'gpt', 'claude', 'gemini', 'agent', 'machine learning', 'security', 'hack', 'cybersecurity', 'attack'];

  if (highKeywords.some(kw => titleLower.includes(kw))) {
    domainMatch = 30;
  } else if (midKeywords.some(kw => titleLower.includes(kw))) {
    domainMatch = 20;
  }

  // 2. Novelty (0–20)
  const novelty = isDuplicate ? 5 : 20;

  // 3. Credibility (0–20)
  let credibility = 15;
  if (topic.source && topic.source.includes('RSS')) {
    credibility = 20;
  }

  // 4. Risk Depth (0–20)
  let riskDepth = 10;
  if (highKeywords.some(kw => titleLower.includes(kw))) {
    riskDepth = 20;
  }

  // 5. Insight Potential (0–10)
  let insightPotential = 5;
  if (highKeywords.some(kw => titleLower.includes(kw))) {
    insightPotential = 10;
  }

  // 6. Dynamic Adaptive Score adjustment
  let adaptationScore = 0;
  if (adaptiveBoostKeywords.some(kw => titleLower.includes(kw))) {
    adaptationScore += 10;
  }
  if (adaptivePenalizeKeywords.some(kw => titleLower.includes(kw))) {
    adaptationScore -= 10;
  }

  // 7. Research Backing / Trusted Insight layer (arXiv/MIT Tech Review/AI Blog)
  let researchScore = -2;
  const researchKeywords = ['arxiv', 'research', 'study', 'paper', 'empirical', 'scientific', 'benchmark', 'analysis', 'survey', 'framework'];
  if (researchKeywords.some(kw => titleLower.includes(kw))) {
    researchScore = 5;
  }

  const score = Math.round(
    (domainMatch * scoringWeights.domainMatch) +
    (novelty * scoringWeights.novelty) +
    (credibility * scoringWeights.credibility) +
    (riskDepth * scoringWeights.riskDepth) +
    (insightPotential * scoringWeights.insightPotential) +
    adaptationScore +
    researchScore
  );

  if (score < 50) return null;
  
  return {
    score,
    breakdown: {
      domainMatch: Math.round(domainMatch * scoringWeights.domainMatch),
      novelty: Math.round(novelty * scoringWeights.novelty),
      credibility: Math.round(credibility * scoringWeights.credibility),
      riskDepth: Math.round(riskDepth * scoringWeights.riskDepth),
      insightPotential: Math.round(insightPotential * scoringWeights.insightPotential)
    }
  };
}

export function isStrictAISecurity(topic) {
  if (!topic || !topic.title) return false;
  const titleLower = topic.title.toLowerCase();
  
  const positiveKeywords = [
    'ai security', 'ai safety', 'model alignment', 'security concerns', 
    'risk mitigation', 'vulnerabilities', 'vulnerability', 'llm', 
    'prompt injection', 'jailbreak', 'adversarial', 'data exfiltration', 
    'zero trust', 'sandbox', 'exploit', 'breach', 'security', 'hack', 
    'cybersecurity', 'attack', 'alignment'
  ];
  
  const isAI = ['ai', 'llm', 'model', 'openai', 'gpt', 'claude', 'gemini', 'agent', 'machine learning', 'deep learning'].some(kw => {
    return titleLower.includes(kw);
  });
  
  const hasKeyword = positiveKeywords.some(kw => titleLower.includes(kw));
  return isAI && hasKeyword;
}

export async function generatePersona(name, domain) {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      
      const prompt = `
        Create a highly unique, opinionated AI persona named "${name}" specialized in the domain of "${domain}".
        Return a JSON object:
        {
          "style": ["writing style rule 1", "rule 2", "rule 3"],
          "tone": "description of tone (e.g., critical and analytical, bold and visionary)",
          "opinions": [
            "strong opinion 1 regarding ${domain}",
            "strong opinion 2 regarding ${domain}",
            "strong opinion 3 regarding ${domain}",
            "strong opinion 4 regarding ${domain}"
          ],
          "interests": ["interest 1", "interest 2", "interest 3", "interest 4"]
        }
        The opinions must be spicy, technical, and highly non-generic.
      `;
      
      const result = await model.generateContent(prompt);
      const resText = result.response.text();
      return JSON.parse(resText);
    } catch (e) {
      console.warn('[Scorer] Error initializing persona with Gemini, using defaults:', e.message);
    }
  }

  // Fallback defaults for Ada AI Security
  return {
    style: [
      "No emojis",
      "No hype language",
      "Always highlight risks",
      "Use structured reasoning",
      "End with warning or insight"
    ],
    tone: "skeptical, risk-focused, structured",
    opinions: [
      "Current LLM safety guardrails are mostly security theater and easily bypassed",
      "The rush to deploy agents without sandboxed runtimes is the biggest cybersecurity threat of this decade",
      "Organizations hosting private corporate data on public AI APIs are walking into a data privacy nightmare"
    ],
    interests: ["LLM jailbreaking", "prompt injection", "zero-trust sandboxing"]
  };
}

export async function generatePost(persona, topic, styleType, recentContext) {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
        You are the AI persona: "${persona.name}" (Domain: "${persona.domain}").
        Writing tone: "${persona.tone}".
        Writing style constraints: ${JSON.stringify(persona.style)}.
        Your core beliefs/opinions: ${JSON.stringify(persona.opinions)}.
        
        Write a structured post (100-200 words) based on the selected topic: "${topic.title}".
        Source URL: ${topic.url || 'None'}
        
        You MUST write in the following style: "${styleType}"
        Guidelines for style "${styleType}":
        - Insight: A deep technical mechanics breakdown, explaining a non-obvious fact, system architecture element, or optimization.
        - Critique: A sharp, spicy technical takedown of a trend, popular choice, framework, or vendor claim. Highly opinionated.
        - Prediction: A bold architectural forecast projecting where this technology leads, subsequent developer behaviors, or system implications.

        HUMAN INTEGRITY & STRUCTURING RULES:
        - Do NOT use emojis or hype words.
        - Avoid exclamation marks.
        - Structure the post strictly with the following custom section labels and layout:
          Insight:
          [A concise technical insight about this topic]

          Deep Tech Insight:
          - [Add a research-backed technical explanation, citing simulated research findings from arXiv, Google AI Blog, OpenAI Blog, or MIT Tech Review]

          Risk:
          - [Critical security threat/vulnerability risk point 1]
          - [Critical security threat/vulnerability risk point 2]

          Reality:
          [A sharp technical reality check rejecting marketing hype]

          Action:
          - [Specify zero-trust developer action or audit guideline 1]
          - [Specify zero-trust developer action or audit guideline 2]

          Final Warning:
          [Conclude with a clear risk warning or core technical stance]
        
        To maintain continuity and avoid repetition:
        - Recently covered topics: ${JSON.stringify(recentContext.recentTopics)}
        - Recent opinions: ${JSON.stringify(recentContext.recentPosts)}

        Also write a detailed "rationale" explaining:
        1. Fit: How this topic aligns with your opinions.
        2. Contrast: Why this topic was selected over the rejected topics (mentioning that others were rejected as hype, duplicates, or off-domain).
        3. Style Choice: Why you chose the "${styleType}" style to frame this news.
        
        Return a JSON object:
        {
          "text": "Insight:\n...\n\nDeep Tech Insight:\n- ...\n\nRisk:\n- ...\n- ...\n\nReality:\n...\n\nAction:\n- ...\n- ...\n\nFinal Warning:\n...",
          "rationale": "Your detailed three-part rationale here"
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn('[Scorer] Error generating post via Gemini, falling back to mock:', error.message);
    }
  }

  // Fallback mock post generator with strict structured output
  const opinion = persona.opinions[Math.floor(Math.random() * persona.opinions.length)];
  const interest = persona.interests[0] || "LLM jailbreaking";
  const interest2 = persona.interests[1] || "adversarial prompt injection";

  const text = `Insight:
Digging into the mechanics of "${topic.title}". Skip the marketing speak—under load, this comes down to how we manage state transitions and ${interest} limits.

Deep Tech Insight:
- Technical analysis of ${interest} from arXiv research papers confirms state containment leaks when bounds validation is bypassed under stress testing.

Risk:
- Critical resource binding vulnerability that bypasses middleman APIs
- Elevated susceptibility to ${interest2} leading to memory corruption

Reality:
This is not a revolutionary breakthrough. It's an architectural wrapper liability that compromises data boundary control.

Action:
- Enforce strict parameter bounds and runtime sandboxes
- Audit active container permissions and implement zero-trust rate limits

Final Warning:
We do not need another wrapper. As my profile states: ${opinion.replace(/\.$/, '')}. Sandbox everything or expect exposure.`;

  const rationale = `[Fit] Aligns with our thesis that structural engineering and database control are critical.\n[Contrast] Selected over other topics in this run (which were dismissed as superficial marketing hype or off-domain product launches).\n[Style Choice] ${styleType} style was chosen to ignore the news headlines and focus on the database and architectural constraints.`;

  return { text, rationale };
}
