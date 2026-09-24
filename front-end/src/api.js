const API_BASE = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:4000';

export async function loadTopics() {
  const res = await fetch(`${API_BASE}/api/topics`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load topic index (${res.status})`);
  return (await res.json()).topics || [];
}

export async function loadTopic(topicId = 'aws') {
  const res = await fetch(`${API_BASE}/api/topics/${encodeURIComponent(topicId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load topic "${topicId}" (${res.status})`);
  return res.json();
}

export async function fetchNode(topicId, nodeId) {
  const res = await fetch(`${API_BASE}/api/topics/${encodeURIComponent(topicId)}/nodes/${encodeURIComponent(nodeId)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export function topicFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('topic') || 'aws';
}
