const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:4000/api';

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function loadTopics() {
  return (await getJson(`${API_ROOT}/topics`)).topics || [];
}

export async function loadTopic(topicId = 'aws') {
  return getJson(`${API_ROOT}/topics/${encodeURIComponent(topicId)}`);
}

export async function loadNode(nodeId) {
  return getJson(`${API_ROOT}/nodes/${encodeURIComponent(nodeId)}`);
}

export async function searchNodes(query, topicId) {
  const params = new URLSearchParams({ q: query });
  if (topicId) params.set('topicId', topicId);
  return (await getJson(`${API_ROOT}/search?${params}`)).results || [];
}

export function routeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return { topicId: params.get('topic') || 'aws', nodeId: params.get('node') || '' };
}

export function openNodeInNewTab(nodeId) {
  window.open(`${window.location.origin}${window.location.pathname}?node=${encodeURIComponent(nodeId)}`, '_blank', 'noopener,noreferrer');
}
