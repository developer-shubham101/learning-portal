import { ChevronRight, ExternalLink, ArrowUpRight, Network } from 'lucide-react';
import { LinkText } from './LinkText';

function Section({title,children}) { return <div className="dsec"><div className="dsec-title">{title}</div>{children}</div>; }
function Profile({label,value}) { return <div className="pcard"><div className="pcard-label">{label}</div><div className="pcard-val">{value||'—'}</div></div>; }
function Row({k,v,highlight}) { return <div className={`prow ${highlight?'highlight':''}`}><span className="pk">{k}</span><span className="pv">{v}</span></div>; }

function categoryMeta(topic, node) {
  const DEFAULT = { color:'#00e5ff', glow:'#00e5ff22', bg:'radial-gradient(circle at 50% 40%,#001a2a,#03060d 70%)' };
  return topic?.categories?.find(x => x.id === node?.categoryId) || DEFAULT;
}

export function Detail({topic,name,data,learned,onLearn,candidates,onOpen}) {
  const meta=categoryMeta(topic,data);
  const category=topic.categories.find(x=>x.id===data.categoryId);
  const childData=data.childIds?.map(id=>topic.nodes.find(n=>n._id===id)).filter(Boolean) || [];
  const tagNodes=(data.tagIds||[]).map(id=>topic.nodes.find(n=>n._id===id)).filter(Boolean);
  const related=topic.nodes.filter(n=>n._id!==data._id && (data.relatedNodeIds||[]).includes(n._id)).slice(0,10);

  return <div className="detail-content">
    <div className="d-header">
      <div className="d-top">
        <div className="d-icon" style={{background:meta.bg,color:meta.color,borderColor:`${meta.color}44`}}><span>{data.icon}</span></div>
        <div className="d-meta"><div className="d-type">{data.type}</div><button className="d-name-btn" onClick={()=>onOpen(data)}>{data.title}</button><div className="d-cat">// {category?.name || data.scope || 'CROSS-TOPIC CONCEPT'}</div></div>
      </div>
      <div className="d-tags">{tagNodes.map(t=><button className="dtag" key={t._id} onClick={()=>onOpen(t)}>{t.title}</button>)}</div>
    </div>
    <div className="d-body">
      <div className="d-desc"><LinkText text={data.description} candidates={candidates} onOpen={onOpen}/></div>
      <Section title="QUICK PROFILE"><div className="profile-grid"><Profile label="PRICING MODEL" value={data.pricing}/><Profile label="SCOPE" value={data.scope}/><Profile label="VARIANTS" value={data.variants}/><Profile label="ALTERNATIVES" value={data.alternatives}/></div>{data.freeTier&&<div className="free-box"><span>🎁</span><div><b>FREE TIER</b>{data.freeTier}</div></div>}</Section>
      {!!data.useCases?.length&&<Section title="COMMON USE CASES"><div className="uc-list">{data.useCases.map((u,i)=><div className="uc-item" key={i}><ChevronRight size={11}/><LinkText text={u} candidates={candidates} onOpen={onOpen}/></div>)}</div></Section>}
      {data.learn&&<Section title="MENTAL MODEL"><div className="mental"><b>Think of it like this:</b><br/><br/><LinkText text={data.learn} candidates={candidates} onOpen={onOpen}/></div></Section>}
      {data.devNote&&<Section title="DEV NOTES"><div className="devnote"><b>// LEARNING TIP</b><LinkText text={data.devNote} candidates={candidates} onOpen={onOpen}/></div></Section>}
      <Section title="PRICING BREAKDOWN"><div className="ptable"><Row k="Main model" v={data.pricing}/><Row k="Free tier" v={data.freeTier||'No free tier'} highlight/><Row k="Cost drivers" v="Usage • Capacity • Requests • Data transfer"/><Row k="Alternatives" v={data.alternatives}/>{data.docsUrl&&<Row k="Official docs" v={<a href={data.docsUrl} target="_blank" rel="noreferrer">Open docs <ExternalLink size={10}/></a>}/>}</div></Section>
      {!!childData.length&&<Section title="GO DEEPER"><div className="dtabs">{childData.map(x=><button className="dtab" key={x._id} onClick={()=>onOpen(x)}>{x.title}</button>)}</div><div className="child-panel"><Network size={13}/><span>Click a sub-node to preview it, then open the full concept in a new tab.</span></div></Section>}
      {!!related.length&&<Section title="CONNECTED CONCEPTS"><div className="connected-list">{related.map(x=><button key={x._id} onClick={()=>onOpen(x)}><span>{x.icon}</span><span><b>{x.title}</b><small>{x.type}</small></span><ArrowUpRight size={12}/></button>)}</div></Section>}
      <div className="d-actions"><button className={`mark-btn ${learned?'done':''}`} onClick={onLearn}>{learned?'✓ MARKED AS LEARNED':'MARK AS LEARNED'}</button>{data.docsUrl&&<a className="doc-btn" href={data.docsUrl} target="_blank" rel="noreferrer">DOCS <ExternalLink size={11}/></a>}</div>
    </div>
  </div>;
}
