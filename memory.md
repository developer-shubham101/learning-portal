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
│   ├── details/
│   │   ├── ECS.md
│   │   └── ec2.md
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

Tech stack: React + Vite, `react-arborist`, `lucide-react`, CSS-only, JetBrains Mono font.

### Environment

`front-end/sample.env`:
```env
VITE_API_ROOT=http://127.0.0.1:4000
```
`api.js` reads: `import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:4000/api'`

### Routing

URL query-param routing — no React Router.

- `?topic=aws` — active topic
- `?node=<nodeId>` — open node in standalone page
- `routeFromUrl()` — parses both from `window.location.search`
- `openNodeInNewTab(nodeId)` — opens `?node=<nodeId>` in new tab
- `navigateTopic(id)` — pushes `?topic=<id>` and fires `popstate`

### Key Components (all in `App.jsx`)

- `App` — main layout, state, routing, tree sync
- `Detail` — right panel full concept view; `d-name` is a clickable `d-name-btn` button that opens `ConceptPreview`
- `ConceptPreview` — modal popup with 5 tabs (see below)
- `StandaloneNodePage` — full-page concept view for `?node=` route; adds `standalone-mode` class to body
- `LinkText` — inline clickable concept links (linear scan, no regex)
- `MdRender` — lightweight markdown renderer (headings, code blocks, bold, inline code, bullet lists); no external deps; uses `dangerouslySetInnerHTML` only for inline bold/code
- `Section`, `Profile`, `Row` — layout helpers in Detail

### ConceptPreview Tabs

| Tab | Content |
|-----|---------|
| CONCEPT | Description from `loadNode` API |
| DETAILS | Mental model + use cases from `loadNode` API |
| DEEP DIVE | Markdown from `loadDetails` API (`server/details/*.md`); lazy-loaded on first tab open |
| FOUND HERE (n) | Related nodes (from `relatedNodeIds`) |
| LEARN WITH AI | Pre-written AI prompt + copy button |

State resets (`tab`, `detail`, `deepDive`, `copied`) when `node._id` changes.

### UI Layout (CSS Grid)

```
header          (grid-column: 1/4, height: 56px)
aside           (col 1, row 2) — 240px
.workspace      (col 2, row 2) — 300px  ← cards
.detail         (col 3, row 2) — 1fr    ← right panel
```

Responsive: 1100px, 860px (detail becomes fixed overlay), 600px (aside hidden).

### Breadcrumb

- Returns `{ id, title }[]` from `buildPath` in `tree.js`
- All ancestors render as `.bc-btn` clickable buttons
- Last item renders as plain `<span class="current">`

### Service Tree Sync

- `treeRef = useRef(null)` attached to `<Tree ref={treeRef}>`
- `select()` calls `setTimeout(() => treeRef.current?.scrollTo({ id }), 50)` to scroll tree to selected node

### Categories

`.cat-list` has `max-height: 180px; overflow-y: auto` — scrollable when many categories.

### State

- `topicId`, `topics`, `topic`, `selectedId`, `activeFilter`, `query`, `searchOpen`, `mobileOpen`, `preview`
- `progress` — `{ visited: [], learned: [] }` in `localStorage` keyed by `learning-progress:<topicId>`
- `treeRef` — ref for react-arborist scroll sync

### `tree.js` exports

- `makeNodeMap(nodes)` — `{ _id: node }` lookup
- `buildPath(nodeId, db, _, rootId)` — returns `{ id, title }[]` (NOT plain strings)
- `buildTreeData(topic)` — flat list for react-arborist
- `toNestedTree(flat, rootId)` — nested tree with cycle detection

### `api.js` exports

- `loadTopics()` — `GET /api/topics`
- `loadTopic(topicId)` — `GET /api/topics/:topicId`
- `loadNode(nodeId)` — `GET /api/nodes/:nodeId`
- `loadDetails(nodeId)` — `GET /api/details/:nodeId` → `{ content: string }`
- `searchNodes(query, topicId?)` — `GET /api/search?q=`
- `routeFromUrl()` — parse `?topic` and `?node`
- `openNodeInNewTab(nodeId)` — open concept in new tab

---

## Backend

Tech stack: Node.js ESM, Express, MongoDB (official driver), dotenv, cors, `node:fs`, `node:path`, `node:url`

Uses `fileURLToPath` + `path.dirname` for `__dirname` (Windows-safe).

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
GET /api/details/:nodeId           → { content: string }  (markdown from server/details/)
GET /api/search?q=&topicId=        → { results: [...] }
```

### `/api/details/:nodeId`

- Looks up node's `slug` and `title` from MongoDB
- Builds candidate filenames: `[slug, title, id-suffix]` → lowercased, spaces→hyphens
- Scans `server/details/` for a case-insensitive `.md` filename match
- Returns `{ content }` (raw markdown string) or 404
- `server/details/` currently has: `ECS.md`, `ec2.md`

### `/api/topics/:topicId` response

- `topic` — topic document
- `categories` — sorted by `order`, `_id` remapped to `id`
- `nodes` — topic nodes + nodes with `relatedTopicIds` containing this topic, enriched with `relatedNodeIds` from `links`
- `tags` — tags whose `nodeIds` intersect with topic node IDs

### `/api/nodes/:nodeId` response

- `node` — full node document
- `topic` — parent topic (null if `topicId === 'core'`)
- `category` — parent category
- `tags` — tag documents
- `children` — child node summaries
- `related` — nodes linked via `MENTIONS` or `TAG` links, with `relation` field

### Search

Primary: MongoDB `$text` index. Fallback: regex on `title`.

### MongoDB Indexes (created at startup)

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

Never manually create a `_id` index.

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

`_id` is the category ID. Frontend remaps `_id → id`.

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

Cross-topic/shared concepts use `topicId: "core"`.

### tags

```json
{ "_id": "tag:docker", "name": "Docker", "kind": "concept", "nodeIds": ["aws:fargate"] }
```

### links

```json
{ "_id": "...", "sourceId": "aws:fargate", "targetId": "tag:docker", "type": "MENTIONS", "label": "..." }
```

Link types in use: `MENTIONS`, `TAG`.

---

## Seed Data (`server/src/seed-data.mjs`)

- Reads JSONL files from `server/dump/`
- Deduplicates by `_id` before inserting — warns about duplicates
- Uses `replaceOne` with `upsert: true` — never deletes existing documents
- Creates indexes after import
- Run: `npm run seed:data` from `server/`

Windows path: uses `fileURLToPath` + `path.dirname` for `__dirname`.

---

## Detail Files (`server/details/`)

Markdown files with deep-dive content in a Seeker/Explainer dialogue format.

Naming: lowercase, spaces as hyphens, `.md` extension.

Current files:
- `ECS.md` — 51 sections covering ECS concepts, architecture, Fargate, tasks, services, IAM, networking
- `ec2.md` — 51 sections covering EC2 concepts, AMI, instance types, VPC, security groups, EBS, Auto Scaling

To add a new deep dive: create `server/details/<slug>.md`. The API matches by node `slug`, `title`, or the last segment of `_id`.

---

## CSS Design System

Dark terminal/cyberpunk aesthetic. All in `styles.css`. Font: JetBrains Mono.

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
- `.bc-btn` — breadcrumb ancestor buttons
- `.d-name-btn` — clickable node title in Detail panel (opens ConceptPreview)
- `.concept-modal` — 80vw × 80vh flex-column modal
- `.modal-tabs` / `.modal-tab` / `.modal-tab-body` — tabbed modal layout
- `.modal-ai` / `.modal-ai-prompt` / `.modal-ai-copy` — LEARN WITH AI tab
- `.md-body`, `.md-h1/2/3`, `.md-p`, `.md-code`, `.md-li`, `.md-gap` — MdRender styles
- `.standalone` / `.standalone-mode` — full-page concept view (body gets `overflow: auto`)
- `.tree-row` — react-arborist row
- `.cat-list` — `max-height: 180px; overflow-y: auto`
- `.card` — service/concept card

---

## Navigation Philosophy

- No fixed hierarchy — every concept can be an entry point
- `?topic=` and `?node=` are bookmarkable
- Clicking concept in text → ConceptPreview modal
- Clicking `d-name-btn` in Detail panel → ConceptPreview modal
- "Open full concept" → new tab with `?node=<id>`
- Breadcrumb ancestors are clickable buttons that navigate back
- Service tree auto-scrolls to selected node on every selection

---

## Key Conventions

- Node `_id` is the canonical identifier everywhere
- Category `_id` is used as category ID; frontend receives it as `id`
- `topicId: "core"` for shared/cross-topic nodes
- `relatedNodeIds` on nodes is enriched server-side from `links` collection
- `buildPath` returns `{ id, title }[]` — not plain strings
- `LinkText` uses linear scan (not regex) to avoid backtracking
- `MdRender` uses no external markdown library
- `deepDive` state is `null` (not fetched), `'loading'`, `'error'`, or the markdown string
- Seed uses upsert — safe to run multiple times without data loss
