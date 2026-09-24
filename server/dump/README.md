# Dump Directory — MongoDB Import Guide

## Files
- `aws.json`       — AWS topic (with crossRefs to docker/kubernetes)
- `docker.json`    — Docker topic
- `kubernetes.json`— Kubernetes topic (with crossRefs to aws/docker)

## Schema: crossRefs field
Each node can have an optional `crossRefs` object:
```json
"crossRefs": {
  "TagOrLabel": { "topicId": "docker", "nodeId": "Container" }
}
```
When a user clicks a tag/profile/use-case that matches a key in `crossRefs`,
the modal fetches `GET /api/topics/:topicId/nodes/:nodeId` and shows a
QUICK LOOK tab with full node details + an EXPLORE ↗ button that opens
`/?topic=docker#Container` in a new tab.

## Import all topics (mongoimport)

```bash
# From the server/ directory
mongoimport --uri "mongodb://127.0.0.1:27017" \
  --db learning_portal \
  --collection topics \
  --file dump/docker.json \
  --jsonArray=false \
  --mode upsert \
  --upsertFields id

mongoimport --uri "mongodb://127.0.0.1:27017" \
  --db learning_portal \
  --collection topics \
  --file dump/kubernetes.json \
  --jsonArray=false \
  --mode upsert \
  --upsertFields id

mongoimport --uri "mongodb://127.0.0.1:27017" \
  --db learning_portal \
  --collection topics \
  --file dump/aws.json \
  --jsonArray=false \
  --mode upsert \
  --upsertFields id
```

## Import via Node script (alternative)

```bash
cd server
node scripts/import.js
```

## Verify
```bash
mongosh learning_portal --eval "db.topics.find({},{id:1,title:1}).toArray()"
```
