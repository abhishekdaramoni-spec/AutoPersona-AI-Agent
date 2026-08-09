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

    // 🔥 Auto-resume only if agent exists (recovery / wake restart)
    setTimeout(async () => {
      try {
        const activeAgent = await getLatestAgent();
        if (activeAgent) {
          console.log(`[Bootstrap] Active agent "${activeAgent.name}" found. Starting scheduler...`);
          startScheduler();
        } else {
          console.log("[Bootstrap] No active agent found. Waiting for initialization via POST /api/agent/init.");
        }
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

