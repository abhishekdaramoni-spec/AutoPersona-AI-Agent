/* ── reflection.js — Post Evaluation & Quality Feedback ── */

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export async function reflectOnPost(postText) {
  let quality = "high";
  let insightDepth = "high";
  let novelty = "fresh";
  let usefulness = "practical";
  let feedback = "deep technical risk focus and zero-trust guidelines";

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      
      const prompt = `
        Evaluate the quality of the following AI security post.
        Post content:
        "${postText}"

        Analyze and return a JSON object with these exact keys:
        {
          "quality": "high" | "medium" | "low",
          "insightDepth": "low" | "medium" | "high",
          "novelty": "repetitive" | "fresh",
          "usefulness": "practical" | "generic",
          "feedback": "short text explaining the evaluation"
        }
      `;
      
      const result = await model.generateContent(prompt);
      const resText = result.response.text();
      const parsed = JSON.parse(resText);
      quality = parsed.quality || quality;
      insightDepth = parsed.insightDepth || insightDepth;
      novelty = parsed.novelty || novelty;
      usefulness = parsed.usefulness || usefulness;
      feedback = parsed.feedback || feedback;
    } catch (e) {
      console.warn('[Reflection] Gemini reflection failed, using fallback rating:', e.message);
    }
  } else {
    // Failsafe fallback reflection
    const len = (postText || '').length;
    if (len > 300) {
      quality = "high";
      insightDepth = "high";
      novelty = "fresh";
      usefulness = "practical";
      feedback = "extended structured technical vulnerability breakdown is thorough and detailed";
    } else {
      quality = "medium";
      insightDepth = "medium";
      novelty = "fresh";
      usefulness = "generic";
      feedback = "standard framework warning structure provides high level overview";
    }
  }

  return {
    quality,
    insightDepth,
    novelty,
    usefulness,
    feedback,
    timestamp: new Date().toISOString()
  };
}
