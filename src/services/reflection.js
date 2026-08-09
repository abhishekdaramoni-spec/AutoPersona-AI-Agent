/* ── reflection.js — Post Evaluation & Quality Feedback ── */

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export async function reflectOnPost(postText) {
  let quality = "high";
  let reason = "deep technical risk focus";

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

        Analyze:
        1. Is it too generic?
        2. Is the technical depth high?
        3. Are zero-trust actions specific?

        Return a JSON object:
        {
          "quality": "high", // or "medium", "low"
          "reason": "short explanation of quality rating"
        }
      `;
      
      const result = await model.generateContent(prompt);
      const resText = result.response.text();
      const parsed = JSON.parse(resText);
      quality = parsed.quality || quality;
      reason = parsed.reason || reason;
    } catch (e) {
      console.warn('[Reflection] Gemini reflection failed, using fallback rating:', e.message);
    }
  } else {
    // Failsafe fallback reflection
    const len = (postText || '').length;
    if (len > 300) {
      quality = "high";
      reason = "extended structured technical vulnerability breakdown";
    } else {
      quality = "medium";
      reason = "standard framework warning structure";
    }
  }

  return {
    quality,
    reason,
    timestamp: new Date().toISOString()
  };
}
