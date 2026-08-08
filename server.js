// Step 2: basic routing structure added
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDb } from './src/services/memory.js';
import agentRouter from './src/routes/agent.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
