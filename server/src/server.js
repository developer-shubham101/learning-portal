import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'learning_portal';

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

const client = new MongoClient(mongoUri);
let topics;

async function connectDb() {
  await client.connect();
  const db = client.db(dbName);
  topics = db.collection('topics');
  await topics.createIndex({ id: 1 }, { unique: true });
  console.log(`MongoDB connected: ${dbName}.topics`);
}

app.get('/api/health', async (_req, res) => {
  try {
    await client.db(dbName).command({ ping: 1 });
    res.json({ ok: true, database: dbName });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/api/topics', async (_req, res, next) => {
  try {
    const docs = await topics.find({}, { projection: { _id: 0, id: 1, title: 1 } })
      .sort({ title: 1 })
      .toArray();
    res.json({ topics: docs.map(({ id, title }) => ({ id, title, file: `${id}.json` })) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/topics/:topicId/nodes/:nodeId', async (req, res, next) => {
  try {
    const topic = await topics.findOne(
      { id: req.params.topicId },
      { projection: { _id: 0, id: 1, title: 1, brand: 1, [`nodes.${req.params.nodeId}`]: 1 } }
    );
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const node = topic.nodes?.[req.params.nodeId];
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json({ topicId: topic.id, topicTitle: topic.brand || topic.title, nodeId: req.params.nodeId, node });
  } catch (error) {
    next(error);
  }
});

app.get('/api/topics/:topicId', async (req, res, next) => {
  try {
    const topic = await topics.findOne(
      { id: req.params.topicId },
      { projection: { _id: 0 } }
    );
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json(topic);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

connectDb()
  .then(() => app.listen(port, () => console.log(`Learning Portal API: http://localhost:${port}`)))
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await client.close();
  process.exit(0);
});
