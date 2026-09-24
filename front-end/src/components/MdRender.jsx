export function MdRender({ text }) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const block = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { block.push(lines[i]); i++; }
      out.push(<pre key={i} className="md-code">{block.join('\n')}</pre>);
    } else if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)[1].length;
      const txt = line.replace(/^#{1,3}\s+/, '');
      out.push(<div key={i} className={`md-h${level}`}>{txt}</div>);
    } else if (/^[*-]\s/.test(line)) {
      out.push(<div key={i} className="md-li">· {line.replace(/^[*-]\s+/, '')}</div>);
    } else if (line.trim() === '') {
      out.push(<div key={i} className="md-gap"/>);
    } else {
      const html = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
      out.push(<p key={i} className="md-p" dangerouslySetInnerHTML={{__html: html}}/>);
    }
    i++;
  }
  return <div className="md-body">{out}</div>;
}
