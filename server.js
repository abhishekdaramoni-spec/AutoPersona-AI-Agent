import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { getDb, getLatestAgent, saveAgent } from './src/services/memory.js';
import agentRouter from './src/routes/agent.js';
import { startScheduler } from './src/engine/autonomousEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve landing page
app.use(express.static(path.join(__dirname, 'src/public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/index.html'));
});

// Mount agent API routes
app.use('/api', agentRouter);

async function bootstrap() {
  try {
    console.log('[Bootstrap] Initializing SQLite database connection...');
    await getDb();
    console.log('[Bootstrap] Database is ready.');

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`  AutoPersona-AI Server is running on port ${PORT}`);
      console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================================`);
    });

    // 🔥 FORCE START ALWAYS
    setTimeout(async () => {
      console.log("🚀 Auto-starting agent...");
      try {
        const activeAgent = await getLatestAgent();
        if (!activeAgent) {
          console.log("No agent found, creating default agent...");
          await saveAgent({
            id: 'default-agent-uuid-12345',
            name: 'Ada',
            domain: 'AI Security',
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
            interests: ["LLM jailbreaking", "prompt injection", "zero-trust sandboxing"],
            createdAt: new Date().toISOString()
          });
        }
        startScheduler();
      } catch (err) {
        console.error("❌ Failed to auto-start agent:", err.message);
      }
    }, 2000);

  } catch (error) {
    console.error('[Bootstrap] Failed to initialize system:', error.message);
    process.exit(1);
  }
}

bootstrap();

