# Learning Portal — React + JSON API

This is a React conversion of the uploaded AWS learning console. The original design is a three-column guided-learning UI: expandable tree, scan-friendly cards, and a right-side intelligence panel. The source also used jsTree for the service tree; this version uses `react-arborist` so the tree is a native React component. The original AWS content is exported as JSON and loaded with `fetch()` at runtime.

## Run with npx http-server

```bash
npm install
npm run build
npx http-server dist -p 8080
```

Open `http://localhost:8080/`.

## Development

```bash
npm install
npm run dev
```

## API/data model

The app fetches:

`/api/topics/aws.json`

A different topic can use the same UI:

`/api/topics/databricks.json`

Then open:

`/?topic=databricks`

For a separate API server, build with:

```bash
VITE_API_ROOT=http://localhost:8081/topics npm run build
```

The topic JSON schema is documented in `public/api/topics/README.txt`.

## Progress

Learning progress is stored in `localStorage` under a topic-specific key, so AWS and Databricks progress do not collide.
