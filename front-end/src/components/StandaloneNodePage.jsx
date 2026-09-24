import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react';
import { loadNode, openNodeInNewTab } from '../api';
import { LinkText } from './LinkText';
import { ConceptPreview } from './ConceptPreview';

export function StandaloneNodePage({ nodeId }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState(null);

  useEffect(()=>{ document.body.classList.add('standalone-mode'); return ()=>document.body.classList.remove('standalone-mode'); },[]);
  useEffect(()=>{ loadNode(nodeId).then(setData).catch(e=>setError(e.message)); },[nodeId]);

  if(error) return <div className="loading error"><strong>CONCEPT LOAD ERROR</strong><p>{error}</p></div>;
  if(!data) return <div className="loading"><BookOpen size={30}/><span>LOADING CONCEPT…</span></div>;

  const node=data.node;
  const candidates=[node,...data.children,...data.related];

  return <div className="standalone">
    <header className="standalone-header">
      <div className="brand">LEARNING PORTAL <em>// CONCEPT</em></div>
      <div className="hline"/>
      <div className="standalone-path">{data.topic?.title || 'CROSS-TOPIC'} / {node.title}</div>
      <button className="hbtn" onClick={()=>window.close()}>CLOSE</button>
    </header>
    <main className="standalone-main">
      <div className="standalone-kicker">{node.type}</div>
      <h1>{node.icon} {node.title}</h1>
      <p className="standalone-desc"><LinkText text={node.description} candidates={candidates} onOpen={setPreview}/></p>
      {node.learn&&<section className="standalone-section"><h2>MENTAL MODEL</h2><div className="mental"><LinkText text={node.learn} candidates={candidates} onOpen={setPreview}/></div></section>}
      {node.useCases?.length>0&&<section className="standalone-section"><h2>WHERE IT FITS</h2><div className="connected-list">{node.useCases.map((u,i)=><div className="uc-item" key={i}><ChevronRight size={11}/><LinkText text={u} candidates={candidates} onOpen={setPreview}/></div>)}</div></section>}
      {data.related.length>0&&<section className="standalone-section"><h2>CONNECTED NODES</h2><div className="connected-grid">{data.related.map(x=><button key={x._id} onClick={()=>setPreview(x)}><span>{x.icon}</span><b>{x.title}</b><small>{x.type}</small></button>)}</div></section>}
      <div className="standalone-actions">
        {node.docsUrl&&<a className="doc-btn" href={node.docsUrl} target="_blank" rel="noreferrer">OFFICIAL DOCS <ExternalLink size={12}/></a>}
        <button className="modal-secondary" onClick={()=>window.close()}>RETURN TO EXPLORER</button>
      </div>
    </main>
    {preview&&<ConceptPreview node={preview} allNodes={candidates} onClose={()=>setPreview(null)} onOpen={setPreview} onFull={openNodeInNewTab}/>}
  </div>;
}
