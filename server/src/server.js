import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'learning_portal';

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

const client = new MongoClient(mongoUri);
let db;
let topics;
let categories;
let nodes;
let tags;
let links;

async function connectDb() {
  await client.connect();
  db = client.db(dbName);
  topics = db.collection('topics');
  categories = db.collection('categories');
  nodes = db.collection('nodes');
  tags = db.collection('tags');
  links = db.collection('links');

  await Promise.all([
    topics.createIndex({ id: 1 }, { unique: true }),
    categories.createIndex({ topicId: 1, order: 1 }),
    nodes.createIndex({ topicId: 1, parentId: 1 }),
    nodes.createIndex({ title: 1 }),
    nodes.createIndex({ title: 'text', description: 'text', learn: 'text', type: 'text' }),
    tags.createIndex({ name: 1 }),
    links.createIndex({ sourceId: 1, type: 1 }),
    links.createIndex({ targetId: 1, type: 1 })
  ]);
  console.log(`MongoDB connected: ${dbName} [topics, categories, nodes, tags, links]`);
}

const publicNode = (node) => node ? ({ ...node }) : null;

async function nodeDetails(nodeId) {
  const node = await nodes.findOne({ _id: nodeId }, { projection: { _id: 1, topicId: 1, categoryId: 1, parentId: 1, slug: 1, title: 1, type: 1, icon: 1, description: 1, learn: 1, pricing: 1, scope: 1, variants: 1, alternatives: 1, freeTier: 1, useCases: 1, devNote: 1, docsUrl: 1, childIds: 1, tagIds: 1, generated: 1, relatedTopicIds: 1, relatedNodeIds: 1 } });
  if (!node) return null;

  const [topic, category, tagDocs, childDocs, relationDocs] = await Promise.all([
    node.topicId === 'core' ? null : topics.findOne({ id: node.topicId }, { projection: { _id: 0 } }),
    node.categoryId ? categories.findOne({ _id: node.categoryId }, { projection: { _id: 0 } }) : null,
    node.tagIds?.length ? tags.find({ _id: { $in: node.tagIds } }, { projection: { _id: 1, name: 1, kind: 1 } }).toArray() : [],
    node.childIds?.length ? nodes.find({ _id: { $in: node.childIds } }, { projection: { _id: 1, title: 1, type: 1, icon: 1, description: 1, topicId: 1 } }).toArray() : [],
    links.find({ sourceId: nodeId, type: { $in: ['MENTIONS', 'TAG'] } }, { projection: { _id: 0, targetId: 1, type: 1 } }).limit(80).toArray()
  ]);

  const targetIds = relationDocs.map(x => x.targetId).filter(x => !node.tagIds?.includes(x));
  const relatedDocs = targetIds.length ? await nodes.find({ _id: { $in: targetIds } }, { projection: { _id: 1, title: 1, type: 1, icon: 1, description: 1, topicId: 1 } }).toArray() : [];
  const related = relatedDocs.map(x => ({ ...x, relation: relationDocs.find(r => r.targetId === x._id)?.type || 'RELATED' }));

  return { node: publicNode(node), topic, category, tags: tagDocs, children: childDocs, related };
}

app.get('/api/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, database: dbName, collections: ['topics', 'categories', 'nodes', 'tags', 'links'] });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/api/topics', async (_req, res, next) => {
  try {
    const docs = await topics.find({ status: 'published' }, { projection: { _id: 0, id: 1, title: 1, brand: 1, subtitle: 1 } }).sort({ title: 1 }).toArray();
    res.json({ topics: docs });
  } catch (error) { next(error); }
});

app.get('/api/topics/:topicId', async (req, res, next) => {
  try {
    const topic = await topics.findOne({ id: req.params.topicId, status: 'published' }, { projection: { _id: 0 } });
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const topicNodeIds = await nodes.find({ topicId: topic.id }, { projection: { _id: 1 } }).map(x => x._id).toArray();
    const [categoryDocs, nodeDocs, tagDocs, relationDocs] = await Promise.all([
      categories.find({ topicId: topic.id }).sort({ order: 1 }).toArray(),
      nodes.find({ $or: [{ topicId: topic.id }, { relatedTopicIds: topic.id }] }).toArray(),
      tags.find({ nodeIds: { $in: topicNodeIds } }, { projection: { _id: 1, name: 1, kind: 1 } }).toArray(),
      links.find({ sourceId: { $in: topicNodeIds }, type: 'MENTIONS' }, { projection: { _id: 0, sourceId: 1, targetId: 1 } }).toArray()
    ]);
    const relatedBySource = new Map();
    for (const rel of relationDocs) {
      if (!relatedBySource.has(rel.sourceId)) relatedBySource.set(rel.sourceId, []);
      relatedBySource.get(rel.sourceId).push(rel.targetId);
    }
    const enrichedNodes = nodeDocs.map(node => ({ ...node, relatedNodeIds: node.relatedNodeIds || relatedBySource.get(node._id) || [] }));
    res.json({ topic, categories: categoryDocs.map(({ _id, ...x }) => ({ id: _id, ...x })), nodes: enrichedNodes, tags: tagDocs });
  } catch (error) { next(error); }
});

app.get('/api/nodes/:nodeId', async (req, res, next) => {
  try {
    const result = await nodeDetails(req.params.nodeId);
    if (!result) return res.status(404).json({ error: 'Node not found' });
    res.json(result);
  } catch (error) { next(error); }
});

app.get('/api/details/:nodeId', async (req, res, next) => {
  try {
    const node = await nodes.findOne({ _id: req.params.nodeId }, { projection: { title: 1, slug: 1 } });
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const detailsDir = path.join(__dirname, '..', 'details');
    const candidates = [node.slug, node.title, req.params.nodeId.split(':').pop()]
      .filter(Boolean)
      .map(s => s.toLowerCase().replace(/\s+/g, '-'));

    let content = null;
    if (fs.existsSync(detailsDir)) {
      const files = fs.readdirSync(detailsDir).filter(f => f.endsWith('.md'));
      for (const name of candidates) {
        const match = files.find(f => f.toLowerCase().replace('.md', '') === name);
        if (match) { content = fs.readFileSync(path.join(detailsDir, match), 'utf8'); break; }
      }
    }

    if (!content) return res.status(404).json({ error: 'No detail file found' });
    res.json({ content });
  } catch (error) { next(error); }
});

app.get('/api/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const filter = { $text: { $search: q } };
    if (req.query.topicId) filter.topicId = req.query.topicId;
    const results = await nodes.find(filter, { projection: { _id: 1, title: 1, type: 1, icon: 1, topicId: 1, description: 1 } }).limit(20).toArray();
    res.json({ results });
  } catch (error) {
    try {
      const q = String(req.query.q || '').trim();
      const filter = { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
      if (req.query.topicId) filter.topicId = req.query.topicId;
      const results = await nodes.find(filter, { projection: { _id: 1, title: 1, type: 1, icon: 1, topicId: 1, description: 1 } }).limit(20).toArray();
      res.json({ results });
    } catch (fallbackError) { next(fallbackError); }
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

connectDb()
  .then(() => app.listen(port, () => console.log(`Learning Portal API: http://localhost:${port}`)))
  .catch((error) => { console.error('MongoDB connection failed:', error); process.exit(1); });

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await client.close(); process.exit(0); });
