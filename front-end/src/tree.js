export function getCategory(nodeName, db, categories) {
  for (const category of Object.keys(categories || {})) {
    if (category === nodeName) return category;
    if (db[category]?.children?.includes(nodeName)) return category;
    for (const service of db[category]?.children || []) {
      if (db[service]?.children?.includes(nodeName)) return category;
    }
  }
  return null;
}

export function buildPath(name, db, categories, root) {
  if (name === root) return [root];
  for (const category of Object.keys(categories || {})) {
    if (category === name) return [root, name];
    if (db[category]?.children?.includes(name)) return [root, category, name];
    for (const service of db[category]?.children || []) {
      if (db[service]?.children?.includes(name)) return [root, category, service, name];
    }
  }
  return [root, name];
}

export function buildTreeData(topic) {
  const { nodes: db = {}, categories = {}, root } = topic;
  const result = [{ id: root, name: root, parent: null }];
  for (const category of Object.keys(categories)) {
    if (db[category]) result.push({ id: category, name: category, parent: root });
  }
  for (const [name, data] of Object.entries(db)) {
    if (name === root || Object.keys(categories).includes(name)) continue;
    let parent = root;
    for (const category of Object.keys(categories)) {
      if (db[category]?.children?.includes(name)) { parent = category; break; }
      for (const service of db[category]?.children || []) {
        if (db[service]?.children?.includes(name)) { parent = service; break; }
      }
    }
    result.push({ id: name, name, parent, icon: data.icon, type: data.type });
  }
  return result;
}

export function toNestedTree(flat, root) {
  const byId = new Map(flat.map(x => [x.id, { ...x, children: [] }]));
  for (const item of byId.values()) {
    if (item.parent && byId.has(item.parent)) byId.get(item.parent).children.push(item);
  }
  const rootNode = byId.get(root);
  return rootNode ? [rootNode] : [];
}

export function makeLeaf(name, root) {
  return {
    icon:'◉', type:'CAPABILITY', cat:null,
    desc:`${name} is a deeper capability or sub-feature of the parent service. Study the parent service first, then explore this concept.`,
    tags:['Deep dive'], pricing:'Depends on parent service', scope:'Service-dependent',
    variants:'See parent service', alt:'Depends on workload', freeTier:'See parent service',
    useCases:['Understand the parent service first, then apply this concept'],
    devNote:'Master the parent service before diving into sub-features. Each capability builds on the core service concepts.',
    children:[], link:'#', learn:'Learn the parent service first. This capability makes more sense once you understand the core service.', root
  };
}
