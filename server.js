import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { getDb } from './src/services/memory.js';
import agentRouter from './src/routes/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// added duplicate prevention logic
const app = express();
const PORT = process.env.PORT || 3000;

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
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize system:', error.message);
    process.exit(1);
  }
}

bootstrap();

