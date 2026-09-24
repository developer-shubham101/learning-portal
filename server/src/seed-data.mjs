import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const dumpDir = path.join(serverDir, 'dump');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'learning_portal';

function readJsonl(fileName) {
  const filePath = path.join(dumpDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`JSONL file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`Invalid JSON in ${fileName} at line ${index + 1}: ${error.message}`); }
    });
}

async function importCollection(db, collectionName, fileName) {
  const collection = db.collection(collectionName);
  const documents = readJsonl(fileName);

  const seen = new Map();
  const dupes = [];
  for (const doc of documents) {
    const key = String(doc._id ?? JSON.stringify(doc));
    if (seen.has(key)) dupes.push(key);
    else seen.set(key, doc);
  }
  if (dupes.length) console.warn(`  [${collectionName}] ${dupes.length} duplicate(s) skipped: ${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? ` … +${dupes.length - 5} more` : ''}`);

  const unique = [...seen.values()];
  if (unique.length) {
    await Promise.all(unique.map(doc => collection.replaceOne({ _id: doc._id }, doc, { upsert: true })));
  }
  return unique.length;
}

async function main() {
  console.log(`Reading JSONL dumps from: ${dumpDir}`);
  console.log(`Connecting to MongoDB: ${mongoUri}/${dbName}`);
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });

    const counts = {
      topics: await importCollection(db, 'topics', 'topics.jsonl'),
      categories: await importCollection(db, 'categories', 'categories.jsonl'),
      nodes: await importCollection(db, 'nodes', 'nodes.jsonl'),
      tags: await importCollection(db, 'tags', 'tags.jsonl'),
      links: await importCollection(db, 'links', 'links.jsonl')
    };

    await db.collection('categories').createIndex({ topicId: 1, order: 1 });
    await db.collection('nodes').createIndex({ topicId: 1, categoryId: 1 });
    await db.collection('nodes').createIndex({ parentId: 1 });
    await db.collection('nodes').createIndex({ title: 1 });
    await db.collection('nodes').createIndex({ tagIds: 1 });
    await db.collection('links').createIndex({ sourceId: 1 });
    await db.collection('links').createIndex({ targetId: 1 });
    await db.collection('links').createIndex({ type: 1 });

    console.log('Seed complete.');
    console.table(counts);
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error('\nSeed failed:');
  console.error(error);
  process.exitCode = 1;
});
