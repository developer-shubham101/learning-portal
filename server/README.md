# Learning Portal Express + MongoDB API

## 1. Install

```bash
cd server
npm install
```

## 2. Start MongoDB

Local MongoDB is expected at:

```text
mongodb://127.0.0.1:27017
```

Or copy `.env.example` to `.env` and change `MONGODB_URI`.

## 3. Import the dump

The dump is MongoDB `mongoimport` JSON Lines format. It contains one document per learning topic.

```bash
mongoimport \
  --uri "mongodb://127.0.0.1:27017/learning_portal" \
  --collection topics \
  --file dump/topics.jsonl \
  --jsonArray=false \
  --drop
```

`--drop` is optional; omit it if you don't want to replace the collection.

## 4. Run the API

```bash
npm run dev
```

Endpoints:

```text
GET /api/health
GET /api/topics
GET /api/topics/aws
GET /api/topics/databricks
```

The topic endpoint returns the same topic shape the React application previously loaded from static JSON.
