# Learning Portal — Project Memory

## Goal

Build a generic, extensible learning portal where users can explore technical subjects as an interconnected knowledge graph.

Initial content: **AWS** and **Databricks**. Architecture must not be AWS-specific. Future domains: Docker, Kubernetes, Linux, Networking, Databases, Python, etc.

Core learning loop:

> Explore one concept → discover another → preview it → open its full page → continue exploring.

---

## Project Structure

```
learning-portal-react/
├── front-end/
│   ├── src/
│   │   ├── data/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   ├── styles.css
│   │   └── tree.js
│   ├── index.html
│   ├── package.json
│   └── sample.env
├── server/
│   ├── dump/
│   │   ├── topics.jsonl
│   │   ├── categories.jsonl
│   │   ├── nodes.jsonl
│   │   ├── tags.jsonl
│   │   ├── links.jsonl
│   │   ├── manifest.json
│   │   ├── docker.json
│   │   └── kubernetes.json
│   ├── scripts/
│   │   └── import.js
│   ├── src/
│   │   ├── server.js
│   │   └── seed-data.mjs
│   ├── .env
│   ├── .env.example
│   ├── docker-compose.yml
│   └── package.json
├── .gitignore
├── memory.md
└── README.md
```

---

## Frontend

Tech stack:

- React + Vite
- `react-arborist` — expandable tree navigation
- `lucide-react` — icons
- CSS-only styling (no Tailwind, no component library)
- Font: JetBrains Mono (Google Fonts)

### Environment

`front-end/sample.env`:

```env
VITE_API_ROOT=http://127.0.0.1:4000
```

`api.js` reads: `import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:4000/api'`

### Routing

URL-based routing via `?topic=aws` and `?node=<nodeId>` query params (no React Router).

- `routeFromUrl()` — reads `?topic` and `?node` from `window.location.search`
- `openNodeInNewTab(nodeId)` — opens `?node=<nodeId>` in a new tab
- `navigateTopic(id)` — pushes `?topic=<id>` to history and fires `popstate`

### Key Components (all in `App.jsx`)

- `App` — main layout, state, routing
- `Detail` — right panel, full concept view
- `ConceptPreview` — modal overlay for quick concept preview
- `StandaloneNodePage` — full-page concept view when opened in new tab via `?node=`
- `LinkText` — renders text with inline clickable concept links (linear scan, no regex)
- `Section`, `Profile`, `Row` — small layout helpers

### UI Layout (CSS Grid)

```
header          (grid-column: 1/4, height: 56px)
aside           (col 1, row 2) — 240px
.workspace      (col 2, row 2) — 300px  ← cards
.detail         (col 3, row 2) — 1fr    ← right panel
```

Responsive breakpoints: 1100px, 860px (detail becomes fixed overlay), 600px (aside hidden).

### State

- `topicId` — active topic
- `topics` — all published topics list
- `topic` — full topic payload (topic, categories, nodes, tags)
- `selectedId` — active node `_id`
- `preview` — node shown in ConceptPreview modal
- `progress` — `{ visited: [], learned: [] }` persisted to `localStorage` per topic

### `tree.js` exports

- `makeNodeMap(nodes)` — `{ _id: node }` lookup
- `buildPath(nodeId, db, _, rootId)` — breadcrumb array
- `buildTreeData(topic)` — flat list for react-arborist
- `toNestedTree(flat, rootId)` — nested tree with cycle detection

### `api.js` exports

- `loadTopics()` — `GET /api/topics`
- `loadTopic(topicId)` — `GET /api/topics/:topicId`
- `loadNode(nodeId)` — `GET /api/nodes/:nodeId`
- `searchNodes(query, topicId?)` — `GET /api/search?q=`
- `routeFromUrl()` — parse `?topic` and `?node`
- `openNodeInNewTab(nodeId)` — open concept in new tab

---

## Backend

Tech stack: Node.js, Express, MongoDB (official driver), dotenv, cors

### Environment (`server/.env`)

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=learning_portal
CORS_ORIGIN=http://localhost:5173
```

### API Endpoints

```
GET /api/health
GET /api/topics                    → { topics: [...] }  (status: 'published' only)
GET /api/topics/:topicId           → { topic, categories, nodes, tags }
GET /api/nodes/:nodeId             → { node, topic, category, tags, children, related }
GET /api/search?q=&topicId=        → { results: [...] }
```

`GET /api/topics/:topicId` returns:
- `topic` — topic document
- `categories` — sorted by `order`, `_id` remapped to `id`
- `nodes` — topic nodes + nodes with `relatedTopicIds` containing this topic, enriched with `relatedNodeIds` from `links` collection
- `tags` — tags whose `nodeIds` intersect with topic node IDs

`GET /api/nodes/:nodeId` returns:
- `node` — full node document
- `topic` — parent topic (null if `topicId === 'core'`)
- `category` — parent category
- `tags` — tag documents
- `children` — child node summaries
- `related` — nodes linked via `MENTIONS` or `TAG` links, with `relation` field

### Search

Primary: MongoDB `$text` index on `title`, `description`, `learn`, `type`.
Fallback: regex on `title` (for first-run before index exists).

### MongoDB Indexes (created at startup in `server.js`)

```js
topics.createIndex({ id: 1 }, { unique: true })
categories.createIndex({ topicId: 1, order: 1 })
nodes.createIndex({ topicId: 1, parentId: 1 })
nodes.createIndex({ title: 1 })
nodes.createIndex({ title: 'text', description: 'text', learn: 'text', type: 'text' })
tags.createIndex({ name: 1 })
links.createIndex({ sourceId: 1, type: 1 })
links.createIndex({ targetId: 1, type: 1 })
```

Never manually create a `_id` index — MongoDB manages it automatically.

---

## MongoDB Data Model

Database: `learning_portal`

Collections: `topics`, `categories`, `nodes`, `tags`, `links`

### topics

```json
{ "id": "aws", "title": "AWS", "description": "...", "type": "topic", "status": "published", "rootNodeId": "...", "brand": "AWS", "subtitle": "..." }
```

### categories

```json
{ "_id": "aws:compute", "topicId": "aws", "name": "Compute", "color": "#00e5ff", "glow": "...", "bg": "...", "order": 1, "nodeId": "..." }
```

Note: `_id` is used as the category ID. Frontend remaps `_id → id`.

### nodes

```json
{
  "_id": "aws:fargate",
  "topicId": "aws",
  "categoryId": "aws:compute",
  "parentId": "aws:compute:root",
  "slug": "fargate",
  "title": "Fargate",
  "type": "SERVICE",
  "icon": "🚀",
  "description": "...",
  "learn": "...",
  "pricing": "...",
  "scope": "...",
  "variants": "...",
  "alternatives": "...",
  "freeTier": "...",
  "useCases": ["..."],
  "devNote": "...",
  "docsUrl": "https://...",
  "childIds": [],
  "tagIds": ["tag:docker"],
  "relatedTopicIds": [],
  "relatedNodeIds": [],
  "generated": false
}
```

Cross-topic/shared concepts use `topicId: "core"` or a tag-style `_id` like `tag:docker`.

### tags

```json
{ "_id": "tag:docker", "name": "Docker", "kind": "concept", "nodeIds": ["aws:fargate"] }
```

### links

```json
{ "_id": "...", "sourceId": "aws:fargate", "targetId": "tag:docker", "type": "MENTIONS", "label": "Uses Docker containers" }
```

Link types in use: `MENTIONS`, `TAG`. Others possible: `RELATED`, `DEPENDS_ON`, `ALTERNATIVE_TO`, `PART_OF`, `BUILT_WITH`, `RUNS_ON`, `EXPLAINS`, `SIMILAR_TO`, `PREREQUISITE`.

---

## Seed Data

Files in `server/dump/`:

```
topics.jsonl
categories.jsonl
nodes.jsonl
tags.jsonl
links.jsonl
manifest.json       ← maps collection → file
docker.json         ← raw source data (not directly seeded)
kubernetes.json     ← raw source data (not directly seeded)
```

`seed-data.mjs`:
1. Reads JSONL files from `dump/`
2. Connects to MongoDB
3. `deleteMany` + `insertMany` per collection
4. Creates indexes
5. Closes connection

Run: `npm run seed:data` (from `server/`)

### Windows path handling in `.mjs` files

Always use:

```js
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

Never use `new URL(import.meta.url).pathname` — produces broken paths on Windows (`C:\C:\...`).

---

## CSS Design System

Dark terminal/cyberpunk aesthetic. All in `styles.css`.

Key CSS variables:

```css
--bg: #03060d
--cyan: #00e5ff
--green: #00ff9d
--text: #e2eeff
--muted: #5a7a9a
--font: 'JetBrains Mono', monospace
```

Notable classes:
- `.inline-link` — clickable concept links inside text
- `.concept-modal` / `.modal-backdrop` — ConceptPreview overlay
- `.standalone` — full-page concept view
- `.tree-row` — react-arborist row
- `.card` — service/concept card in center panel

---

## Navigation Philosophy

- No fixed hierarchy — every concept can be an entry point
- URL params `?topic=` and `?node=` are bookmarkable
- Clicking a concept in text → ConceptPreview modal (not immediate navigation)
- "Open full concept" → new tab with `?node=<id>`
- Progress (visited/learned) stored in `localStorage` per topic

---

## Key Conventions

- Node `_id` is the canonical identifier everywhere (not `id`)
- Category `_id` is used as category ID; frontend receives it as `id`
- `topicId: "core"` for shared/cross-topic nodes
- `relatedNodeIds` on nodes is enriched server-side from `links` collection
- `LinkText` uses linear scan (not regex) to avoid backtracking on long text
- Search falls back to regex if text index not yet created
