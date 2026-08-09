import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { getDb, getLatestAgent } from './src/services/memory.js';
import agentRouter from './src/routes/agent.js';
import { startScheduler, runAutonomousCycle } from './src/engine/autonomousEngine.js';

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

    // Auto-resume scheduler loop on boot if agent is already initialized
    const activeAgent = await getLatestAgent();
    if (activeAgent) {
      console.log(`[Bootstrap] Active agent "${activeAgent.name}" found. Starting scheduler...`);
      startScheduler();
      runAutonomousCycle().catch(e => console.error('[Bootstrap] Startup cycle execution failed:', e.message));
    }

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`  AutoPersona-AI Server is running on port ${PORT}`);
      console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize system:', error.message);
    process.exit(1);
  }
}

bootstrap();

