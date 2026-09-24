import { useEffect, useState } from 'react';

export function useProgress(topicId) {
  const key = `learning-progress:${topicId}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || { visited:[], learned:[] }; } catch { return { visited:[], learned:[] }; } };
  const [state, setState] = useState(read);
  useEffect(() => setState(read()), [topicId]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}
