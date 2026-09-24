# Learning Portal API + MongoDB Knowledge Graph

The backend now uses a normalized knowledge graph instead of one large topic document.

## Collections

- `topics` — top-level learning platforms such as AWS and Databricks.
- `categories` — topic categories and visual metadata.
- `nodes` — every service, category, sub-concept, and cross-topic concept.
- `tags` — reusable concepts such as Docker, Virtual Machine, SQL, Serverless, etc.
- `links` — explicit graph edges (`CHILD`, `TAG`, `MENTIONS`).

A node has stable IDs such as `aws:fargate` or `tag:docker`, so links can cross topic boundaries.

## Import the dump

Start MongoDB first, then run these from `server/`:

```bash
mongoimport --uri "mongodb://127.0.0.1:27017/learning_portal" --collection topics --file dump/topics.jsonl --jsonArray=false --drop
mongoimport --uri "mongodb://127.0.0.1:27017/learning_portal" --collection categories --file dump/categories.jsonl --jsonArray=false --drop
mongoimport --uri "mongodb://127.0.0.1:27017/learning_portal" --collection nodes --file dump/nodes.jsonl --jsonArray=false --drop
mongoimport --uri "mongodb://127.0.0.1:27017/learning_portal" --collection tags --file dump/tags.jsonl --jsonArray=false --drop
mongoimport --uri "mongodb://127.0.0.1:27017/learning_portal" --collection links --file dump/links.jsonl --jsonArray=false --drop
```

Import all existing JSONL dump files into MongoDB with one command:

```bash
npm run seed:data
```

`seed:data` reads `server/dump/*.jsonl`, clears the five normalized collections, imports the JSONL documents, and creates the indexes used by the API. It does **not** regenerate the JSONL files.

If you want to regenerate the JSONL dump from the original source JSON later, use a separate data-generation step rather than `seed:data`.

## Run the API

```bash
npm install
cp .env.example .env
npm run dev
```

Endpoints:

- `GET /api/health`
- `GET /api/topics`
- `GET /api/topics/aws`
- `GET /api/topics/databricks`
- `GET /api/nodes/tag:docker`
- `GET /api/nodes/tag:virtual-machine`
- `GET /api/search?q=docker`

## Graph behavior

The React app treats tags and mentions as navigable concepts. For example:

`AWS → ECS/Fargate → Docker → Virtual Machine → another connected concept`

Clicking an inline concept opens a small preview. The preview intentionally stays short and has an **OPEN FULL CONCEPT** action that opens a dedicated tab using the stable node ID.
