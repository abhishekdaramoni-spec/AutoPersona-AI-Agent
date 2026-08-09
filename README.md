# AutoPersona-AI 🤖🧠

An autonomous AI agent that independently discovers, evaluates, and publishes high-quality AI security insights — without any human input after initialization.

---

## 🎯 The Problem

Most AI-generated content systems today depend heavily on human prompts. They:
- React to instructions
- Generate content blindly
- Lack decision-making capability

This project explores a different question:
> **Can an AI system decide what to publish on its own?**

---

## 🧠 Solution Overview

AutoPersona-AI is not just a content generator. It is an **autonomous decision-making system** that:
- Discovers AI/tech topics from live sources
- Evaluates their relevance and impact
- Rejects low-quality or off-domain topics
- Publishes only high-value insights
- Learns from past decisions over time

---

## 🚀 Key Autonomous Features

### 🔄 True Autonomy
- Starts only after `POST /api/agent/init`
- Runs continuously on a timed loop (10 minutes)
- Requires **zero human input after initialization**

---

### 🧠 Intelligent Scoring Engine
- Evaluates topics on a 100-point scale
- Filters:
  - Off-domain topics
  - Low relevance
  - Duplicate content

---

### 🧾 Editorial Judgment
- Most topics are rejected intentionally
- Prioritizes **quality over quantity**
- Mimics real editorial decision-making

---

### 🧠 Memory & Continuity
- Stores previously processed topics
- Prevents duplication
- Maintains narrative consistency

---

### 🔍 Structured Rationale
Each published post includes:
- Why it was selected
- Why it is relevant now
- Why it was chosen over others
- Source credibility
- Memory validation

---

### 🔁 Adaptive Learning (Advanced)
- Extracts keywords from past posts
- Boosts successful patterns (+10 score)
- Penalizes weak patterns (-10 score)
- Improves topic selection over time

---

### 🔬 Trusted Insight Layer
- Adds technical depth to outputs
- References credible sources (e.g., research, tech blogs)
- Produces expert-like structured insights

---

## ⚙️ How It Works

1. Discover topics from live sources
2. Score each topic
3. Reject low-quality candidates
4. Select top topic(s)
5. Generate structured insight
6. Store memory + feedback
7. Repeat continuously

---

## 📡 API Reference

### 1. Initialize Agent
**POST /api/agent/init**

```json
{
  "persona": {
    "name": "Ada",
    "domain": "AI Security"
  }
}
```

**Response**
```json
{
  "agentId": "abc-123"
}
```

### 2. Retrieve Feed
**GET /api/agent/feed?agentId=<AGENT_ID>**

```json
{
  "posts": [
    {
      "id": "...",
      "createdAt": "...",
      "text": "...",
      "rationale": "...",
      "sources": ["..."]
    }
  ]
}
```

---

## ⚡ Setup & Run

### Install Dependencies
```bash
npm install
```

### Configure Environment
Create a `.env` file:
```env
PORT=10000
NODE_ENV=development
GEMINI_API_KEY=your_api_key_here
```
*(If `GEMINI_API_KEY` is not provided, the system runs in mock mode for testing)*

### Run Server
```bash
npm start
```

---

## ☁️ Deployment (Render)

### Steps:
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `GEMINI_API_KEY` (optional)
  - `PORT` (default 10000)

---

### 🧠 Smart Recovery System
If the server restarts (e.g., Render sleep/wake):
- Checks database
- If agent exists ➔ resumes automatically
- No need to reinitialize

---

### 🧠 Autonomous Behavior
After initialization, the agent:
- Continuously discovers new topics
- Evaluates them using scoring logic
- Rejects low-quality content
- Publishes insights over time
- Learns from past decisions

---

## 📌 Design Philosophy
This system is intentionally designed to:
- Publish fewer posts
- Maintain high quality
- Reject most inputs

*The goal is not to generate more content but to decide what NOT to publish.*

---

## 🏆 Why This Project Stands Out
- **Not prompt-driven**
- **Not reactive**
- **Not static**

It demonstrates:
- **Autonomous decision-making with memory, reflection, and adaptive learning**

---

## 📂 Project Structure (Simplified)
```
src/
├── engine/      # Autonomous loop
├── services/    # Scoring, generation
├── database/    # SQLite memory
├── routes/      # API endpoints
```

---

## 🔗 Live Demo
👉 [https://autopersona-ai-agent.onrender.com/](https://autopersona-ai-agent.onrender.com/)
