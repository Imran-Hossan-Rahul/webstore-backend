import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectToDatabase } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startAllWorkers() {
  console.log('🚀 Booting up all Background Workers...');

  try {
    await connectToDatabase();
    console.log('✅ MongoDB connected for Workers');

    const files = fs.readdirSync(__dirname);

    for (const file of files) {
      if (
        file !== 'index.js' &&
        file.endsWith('.js') &&
        fs.statSync(path.join(__dirname, file)).isFile()
      ) {
        console.log(`[Worker Entry] Loading ${file}...`);
        await import(`./${file}`);
      }
    }

    console.log('✅ All workers booted successfully!');
  } catch (error) {
    console.error('❌ Error starting workers:', error);
    process.exit(1);
  }
}

startAllWorkers();
