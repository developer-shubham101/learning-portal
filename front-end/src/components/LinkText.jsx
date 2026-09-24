import React from 'react';

export function LinkText({ text, candidates, onOpen }) {
  if (!text) return <>{text}</>;
  const unique = [...new Map(
    (candidates || [])
      .filter(x => x?.title && x.title.length >= 4)
      .map(x => [x.title.toLowerCase(), x])
  ).values()].sort((a, b) => b.title.length - a.title.length);

  if (!unique.length) return <>{text}</>;

  const str = String(text);
  const parts = [];
  let i = 0;
  while (i < str.length) {
    let matched = null;
    for (const node of unique) {
      if (str.slice(i, i + node.title.length).toLowerCase() === node.title.toLowerCase()) {
        matched = node;
        break;
      }
    }
    if (matched) {
      parts.push({ type: 'link', node: matched, text: str.slice(i, i + matched.title.length) });
      i += matched.title.length;
    } else {
      if (parts.length && parts[parts.length - 1].type === 'text') {
        parts[parts.length - 1].text += str[i];
      } else {
        parts.push({ type: 'text', text: str[i] });
      }
      i++;
    }
  }

  return <>{parts.map((p, idx) =>
    p.type === 'link'
      ? <button key={idx} className="inline-link" onClick={() => onOpen(p.node)}>{p.text}</button>
      : <React.Fragment key={idx}>{p.text}</React.Fragment>
  )}</>;
}
