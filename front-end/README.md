# Learning Portal — React + Express + MongoDB Knowledge Graph

This version uses the existing AWS/Databricks learning content as the seed curriculum, but stores it as a normalized, interlinked MongoDB knowledge graph.

## Architecture

```text
MongoDB
├── topics       # AWS, Databricks, ...
├── categories   # Compute, Storage, ...
├── nodes        # Fargate, ECS, Docker, Virtual Machine, ...
├── tags         # reusable concepts / tags
└── links        # CHILD / TAG / MENTIONS graph edges
        │
        ▼
Express API
        │
        ▼
React learning explorer
```

The important change is that concepts are no longer trapped inside an AWS JSON document. A stable node such as `tag:docker` can be referenced from AWS, Databricks, or future learning topics.

## Run MongoDB

```bash
cd server
docker compose up -d
```

## Import / regenerate data

```bash
cd server
npm install
npm run seed:data
```

Then import the five JSONL files as described in `server/README.md`.

## Run API

```bash
cd server
cp .env.example .env
npm run dev
```

Default API: `http://localhost:4000`

## Run React

From the project root:

```bash
npm install
VITE_API_ROOT=http://localhost:4000/api npm run dev
```

## Concept navigation

A user can now follow a learning path instead of staying inside one product:

1. Explore AWS.
2. Open ECS or Fargate.
3. Click **Docker** wherever it appears as a tag or inline concept.
4. A compact concept preview appears.
5. Click **OPEN FULL CONCEPT** to open Docker in a new tab.
6. From Docker, click another linked concept such as **Virtual Machine**.
7. Continue following the graph.

The same node IDs work across future topics, so the portal can grow into a general learning graph rather than a collection of isolated product pages.
