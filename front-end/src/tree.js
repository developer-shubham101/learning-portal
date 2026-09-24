export function makeNodeMap(nodes = []) {
  return Object.fromEntries(nodes.map(node => [node._id, node]));
}

export function buildPath(nodeId, db, categoriesById, rootId) {
  const path = [];
  let current = db[nodeId];
  const seen = new Set();
  while (current && !seen.has(current._id)) {
    seen.add(current._id);
    path.unshift({ id: current._id, title: current.title });
    current = current.parentId ? db[current.parentId] : null;
  }
  if (!path.length && rootId && db[rootId]) return [{ id: rootId, title: db[rootId].title }];
  return path;
}

export function buildTreeData(topic) {
  const db = makeNodeMap(topic.nodes);
  const result = topic.nodes
    .filter(node => node.topicId === topic.topic.id)
    .map(node => ({ id: node._id, name: node.title, parent: node.parentId, icon: node.icon, type: node.type }));
  return result;
}

export function toNestedTree(flat, rootId) {
  const byId = new Map(flat.map(x => [x.id, { ...x, children: [] }]));

  // guard: skip self-referencing or missing parents
  for (const item of byId.values()) {
    if (item.parent && item.parent !== item.id && byId.has(item.parent)) {
      byId.get(item.parent).children.push(item);
    }
  }

  // detect and break any remaining cycles by checking ancestry
  function hasCycle(node, visited = new Set()) {
    if (visited.has(node.id)) return true;
    visited.add(node.id);
    return node.children.some(c => hasCycle(c, new Set(visited)));
  }

  // strip children that would create cycles
  for (const item of byId.values()) {
    item.children = item.children.filter(c => !hasCycle(c, new Set([item.id])));
  }

  const root = byId.get(rootId);
  return root ? [root] : [];
}
