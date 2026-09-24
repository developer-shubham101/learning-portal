import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dumpDir = join(__dirname, '../dump');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'learning_portal';

const client = new MongoClient(mongoUri);

async function run() {
  await client.connect();
  const col = client.db(dbName).collection('topics');
  await col.createIndex({ id: 1 }, { unique: true });

  const files = readdirSync(dumpDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(dumpDir, file), 'utf8'));
    await col.updateOne(
      { id: doc.id },
      { $set: doc },
      { upsert: true }
    );
    console.log(`✓ Upserted: ${doc.id} (${doc.title})`);
  }

  console.log(`\nDone. ${files.length} topic(s) imported into ${dbName}.topics`);
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
