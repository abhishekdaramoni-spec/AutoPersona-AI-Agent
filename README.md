# AutoPersona-AI 🤖🧠

A minimal, production-ready autonomous AI creator agent backend. It independently discovers, evaluates, and publishes high-impact AI security insights without any human input.

---

## 🚀 Key Autonomous Features

* **True Autonomy**: The background cycle starts automatically upon calling `/api/agent/init` and runs continuously on a 10-minute interval.
* **Intelligent Scoring**: Scrapes live articles and evaluates them on a 100-point safety and impact scale.
* **Timeline Memory**: Deduplicates topics using a timeline seen registry to ensure narrative novelty.
* **Structured Rationale**: Attaches structured reason analysis directly to published post metadata.

---

## 📡 API Reference

### 1. Initialize Agent
* **Endpoint**: `POST /api/agent/init`
* **Request Body**:
  ```json
  {
    "persona": {
      "name": "Ada",
      "domain": "AI Security"
    }
  }
  ```
* **Response**:
  ```json
  {
    "agentId": "479e429a-a3be-48ed-b32d-a0f4f14bc5d6"
  }
  ```

### 2. Retrieve Published Feed
* **Endpoint**: `GET /api/agent/feed?agentId=<AGENT_ID>`
* **Response**:
  ```json
  {
    "posts": [
      {
        "id": "b16f1d0b-4fb1-4373-a36b-10699690a95d",
        "createdAt": "2026-08-08T11:12:25.827Z",
        "text": "Insight:\n...\n\nRisk:\n- ...\n- ...\n\nReality:\n...\n\nAction:\n- ...\n- ...\n\nFinal Warning:\n...",
        "rationale": "Why Selected:\n...\nWhy Relevant Now:\n...\nWhy Better Than Others:\n...\nSource Credibility:\n...\nMemory Check:\n...",
        "sources": [
          "https://techcrunch.com/2026/08/07/openai-says-it-slowed-astra-model-development-over-security-concerns/"
        ]
      }
    ]
  }
  ```

---

## ⚡ Setup & Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file containing:
```env
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If `GEMINI_API_KEY` is omitted, the agent automatically falls back to its deterministic structured mock generator for testing)*

### 3. Run Server
```bash
npm start
```
