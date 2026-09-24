import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Home, PanelRight, ExternalLink, ChevronRight, BookOpen, ArrowUpRight, X, Network } from 'lucide-react';
import { Tree } from 'react-arborist';
import { loadNode, loadTopic, loadTopics, loadDetails, openNodeInNewTab, routeFromUrl } from './api';
import { buildPath, buildTreeData, makeNodeMap, toNestedTree } from './tree';

const DEFAULT_CATEGORY_META = { color:'#00e5ff', glow:'#00e5ff22', bg:'radial-gradient(circle at 50% 40%,#001a2a,#03060d 70%)' };

function useProgress(topicId) {
  const key = `learning-progress:${topicId}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || { visited:[], learned:[] }; } catch { return { visited:[], learned:[] }; } };
  const [state, setState] = useState(read);
  useEffect(() => setState(read()), [topicId]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}

function LinkText({ text, candidates, onOpen }) {
  if (!text) return <>{text}</>;
  const unique = [...new Map(
    (candidates || [])
      .filter(x => x?.title && x.title.length >= 4)
      .map(x => [x.title.toLowerCase(), x])
  ).values()].sort((a, b) => b.title.length - a.title.length);

  if (!unique.length) return <>{text}</>;

  // Linear scan — no regex alternation, no backtracking
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

function MdRender({ text }) {
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

function categoryMeta(topic, node) {
  const category = topic?.categories?.find(x => x.id === node?.categoryId);
  return category || DEFAULT_CATEGORY_META;
}

function navigateTopic(id) {
  history.pushState({}, '', `?topic=${encodeURIComponent(id)}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const initial = routeFromUrl();
  const [topicId, setTopicId] = useState(initial.topicId);
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(initial.nodeId || null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useProgress(topicId);
  const treeRef = useRef(null);

  useEffect(() => {
    loadTopics().then(setTopics).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    const route = routeFromUrl();
    if (route.nodeId) {
      setSelectedId(route.nodeId);
      return;
    }
    setTopicId(route.topicId);
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!topicId) return;
    setTopic(null); setError(''); setQuery(''); setPreview(null);
    loadTopic(topicId)
      .then(data => { setTopic(data); setSelectedId(routeFromUrl().nodeId || data.topic.rootNodeId); })
      .catch(e => setError(e.message));
  }, [topicId]);

  useEffect(() => {
    const onPop = () => {
      const route = routeFromUrl();
      setTopicId(route.topicId);
      setSelectedId(route.nodeId || null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const db = useMemo(() => makeNodeMap(topic?.nodes || []), [topic]);
  const rootId = topic?.topic.rootNodeId;
  const current = selectedId ? db[selectedId] : null;
  const tree = useMemo(() => topic ? toNestedTree(buildTreeData(topic), rootId) : [], [topic, rootId]);
  const candidates = useMemo(() => topic?.nodes || [], [topic]);
  const searchHits = useMemo(() => {
    if (!query.trim() || !topic) return [];
    const q = query.toLowerCase();
    return candidates.filter(d => d.title.toLowerCase().includes(q) || (d.type || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)).slice(0, 10);
  }, [query, topic, candidates]);
  const services = useMemo(() => (topic?.nodes || []).filter(n => n.topicId === topic?.topic.id && n.type !== 'CATEGORY' && n._id !== rootId), [topic, rootId]);
  const learnedCount = progress.learned.length;
  const path = selectedId && current ? buildPath(selectedId, db, null, rootId) : [topic?.topic.title || 'HOME'];
  const kids = current?.childIds?.map(id => db[id]).filter(Boolean) || [];
  const types = ['ALL', ...new Set(kids.map(k => k.type?.split(' ')[0] || 'CAPABILITY'))];
  const filteredKids = activeFilter === 'ALL' ? kids : kids.filter(k => k.type?.startsWith(activeFilter));

  function select(nodeOrId) {
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?._id;
    if (!id) return;
    setSelectedId(id);
    setProgress(p => ({...p, visited:[...new Set([...p.visited,id])]}));
    setActiveFilter('ALL');
    if (window.innerWidth <= 860) setMobileOpen(true);
    setTimeout(() => treeRef.current?.scrollTo({ id }), 50);
  }
  function selectPreview(node) { setPreview(node); }
  function toggleLearned(name) { setProgress(p => ({...p, learned:p.learned.includes(name) ? p.learned.filter(x=>x!==name) : [...p.learned,name]})); }

  if (error) return <div className="loading error"><strong>API LOAD ERROR</strong><p>{error}</p><p>Start the Express API and MongoDB, then refresh.</p></div>;
  if (!topic || !current) return <div className="loading"><BookOpen size={30}/><span>LOADING LEARNING GRAPH…</span></div>;

  return <div className="app">
    <header>
      <div className="brand">{topic.topic.brand || topic.topic.title}<em> // {topic.topic.subtitle || 'LEARNING PORTAL'}</em></div><div className="hline"/>
      <div className="topic-switcher"><select value={topicId} onChange={e=>{navigateTopic(e.target.value);setTopicId(e.target.value)}} aria-label="Learning topic">{topics.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></div>
      <div className="search-wrap">
        <Search className="search-icon" size={12}/><input value={query} onChange={e=>{setQuery(e.target.value);setSearchOpen(true)}} onFocus={()=>setSearchOpen(true)} placeholder="Search concepts, services, tags…" autoComplete="off"/>
        {searchOpen && query && <div className="search-results show">{searchHits.length ? searchHits.map(d=><button className="sr-item" key={d._id} onClick={()=>{select(d);setQuery('');setSearchOpen(false)}}><span className="sr-icon">{d.icon}</span><span className="sr-name">{d.title}</span><span className="sr-cat">{d.type}</span></button>) : <div className="sr-empty">No matches</div>}</div>}
      </div>
      <div className="header-status">GRAPH MODE · <b>FOLLOW THE CONCEPT</b></div>
      <div className="hactions"><div className="prog">{learnedCount} / {services.length} learned</div><button className="hbtn" onClick={()=>select(rootId)}><Home size={11}/> HOME</button><button className="hbtn mob-only" onClick={()=>setMobileOpen(v=>!v)}><PanelRight size={11}/> PANEL</button></div>
    </header>

    <aside>
      <div className="side-label">SYSTEM</div><div className="sys-block"><div className="sys-title">{topic.topic.title} Learning Graph</div><div className="sys-sub">Normalized MongoDB knowledge graph</div><div className="sys-row"><span>Mode</span><span>INTERLINKED</span></div><div className="sys-row"><span>Nodes</span><span>{topic.nodes.length}</span></div><div className="sys-row"><span>Tags</span><span>{topic.tags.length}</span></div></div>
      <div className="side-label">CATEGORIES</div><div className="cat-list">{topic.categories.map(cat=><button className="cat-item" key={cat.id} onClick={()=>select(cat.nodeId)}><span className="dot" style={{background:cat.color,boxShadow:`0 0 6px ${cat.color}88`}}/><span>{cat.name}</span><span className="cnt">{topic.nodes.filter(n=>n.categoryId===cat.id && n.parentId===cat.nodeId).length}</span></button>)}</div>
      <div className="side-label">SERVICE TREE</div>
      <div className="tree-wrap">{tree.length > 0 && <Tree ref={treeRef} data={tree} width="100%" height={390} rowHeight={25} indent={14} openByDefault={false} selection={selectedId} onSelect={nodes=>nodes?.[0] && select(nodes[0].id)}>{({node,style})=><div style={style} className={`tree-row ${node.isSelected?'selected':''}`}><span className="tree-chevron">{node.isInternal ? (node.isOpen?'▾':'▸') : '·'}</span><span className="tree-icon">{node.data.icon || '◉'}</span><span>{node.data.name}</span></div>}</Tree>}</div>
      <div className="tip-box"><b>// THE NEW LOOP</b>Read a service → click a linked concept → preview it → open the full concept in a new tab → keep following the graph.</div>
    </aside>

    <main className="workspace">
      <div className="breadcrumb">{path.map((p,i)=><React.Fragment key={`${p.id}-${i}`}>{i<path.length-1?<button className="bc-btn" onClick={()=>select(p.id)}>{p.title}</button>:<span className="current">{p.title}</span>}{i<path.length-1&&<span className="sep">/</span>}</React.Fragment>)}</div>
      <div className="ws-head"><div className="ws-eyebrow">// {selectedId===rootId ? 'PLATFORM OVERVIEW' : (current.type || 'CONCEPT')}</div><div className="ws-title">{selectedId===rootId ? `${topic.topic.title} Topics` : current.title}</div><div className="ws-desc"><LinkText text={selectedId===rootId ? topic.topic.description : current.description} candidates={candidates} onOpen={selectPreview}/></div></div>
      <div className="filter-row">{kids.length>0 && types.map(t=><button className={`fbtn ${activeFilter===t?'on':''}`} key={t} onClick={()=>setActiveFilter(t)}>{t}</button>)}</div>
      <div className="cards">{filteredKids.length ? filteredKids.map((x,i)=>{const meta=categoryMeta(topic,x);const learned=progress.learned.includes(x._id);const visited=progress.visited.includes(x._id);return <article className={`card ${x._id===selectedId?'active':''} ${learned?'learned':''}`} key={x._id} style={{animationDelay:`${i*.04}s`}} onClick={()=>select(x)}><div className="card-icon-wrap" style={{background:meta.bg,color:meta.color,borderColor:`${meta.color}33`}}><span>{x.icon}</span></div><div className="card-body"><div className="card-name">{x.title}{learned&&<span className="lbadge">✓ LEARNED</span>}</div><div className="card-type">{x.type}</div><div className="card-tags">{(x.tagIds||[]).slice(0,4).map(tagId=>{const tag=topic.tags.find(t=>t._id===tagId);return tag?<button className="ctag" key={tag._id} onClick={e=>{e.stopPropagation();const n=db[tag._id]; if(n) selectPreview(n)}}>{tag.name}</button>:null})}{visited&&!learned&&<span className="ctag visited">visited</span>}</div></div><button className="card-open" onClick={e=>{e.stopPropagation();select(x)}}>OPEN</button></article>}) : <div className="leaf-msg">This concept is a leaf node.<br/>Use the linked concepts in the detail panel to continue exploring.</div>}</div>
    </main>

    <section className={`detail ${mobileOpen?'open':''}`}>
      <Detail topic={topic} name={selectedId} data={current} learned={progress.learned.includes(selectedId)} onLearn={()=>toggleLearned(selectedId)} candidates={candidates} onOpen={selectPreview} />
    </section>

    {preview && <ConceptPreview node={preview} allNodes={candidates} onClose={()=>setPreview(null)} onOpen={node=>setPreview(node)} onFull={node=>openNodeInNewTab(node._id)} />}
  </div>;
}

function ConceptPreview({ node, allNodes, onClose, onOpen, onFull }) {
  const [tab, setTab] = useState('concept');
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(false);

  const related = allNodes.filter(x => x._id !== node._id && (node.relatedNodeIds || []).includes(x._id)).slice(0, 10);

  useEffect(() => {
    setTab('concept'); setDetail(null); setCopied(false); setDeepDive(null);
    loadNode(node._id).then(setDetail).catch(() => setDetail({ error: true }));
  }, [node._id]);

  const aiPrompt = `Explain "${node.title}" as if I'm a developer learning it for the first time.\nCover:\n1. What it is in one sentence\n2. The mental model (analogy)\n3. When to use it\n4. A simple real-world example\n5. Common mistakes to avoid`;

  function copy() {
    navigator.clipboard.writeText(aiPrompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const [deepDive, setDeepDive] = useState(null);

  useEffect(() => {
    if (tab !== 'deepdive' || deepDive !== null) return;
    setDeepDive('loading');
    loadDetails(node._id)
      .then(d => setDeepDive(d.content))
      .catch(() => setDeepDive('error'));
  }, [tab, node._id]);

  const tabs = [
    { id: 'concept', label: 'CONCEPT' },
    { id: 'details', label: 'DETAILS' },
    { id: 'deepdive', label: 'DEEP DIVE' },
    { id: 'found', label: `FOUND HERE (${related.length})` },
    { id: 'ai', label: 'LEARN WITH AI' },
  ];

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="concept-modal">
      <div className="modal-top">
        <div><div className="modal-kicker">QUICK CONCEPT</div><div className="modal-title"><span>{node.icon || '◈'}</span>{node.title}</div><div className="modal-type">{node.type}</div></div>
        <button className="modal-close" onClick={onClose}><X size={15}/></button>
      </div>

      <div className="modal-tabs">
        {tabs.map(t => <button key={t.id} className={`modal-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>

      <div className="modal-tab-body">
        {tab === 'concept' && (
          detail?.error
            ? <p className="modal-desc" style={{color:'var(--red)'}}>Failed to load details.</p>
            : !detail
              ? <div className="modal-loading">Loading…</div>
              : <>
                  <p className="modal-desc"><LinkText text={detail.node?.description || node.description} candidates={allNodes} onOpen={onOpen}/></p>
                </>
        )}
        {tab === 'details' && (
          !detail
            ? <div className="modal-loading">Loading…</div>
            : detail.error
              ? <p className="modal-desc" style={{color:'var(--red)'}}>Failed to load details.</p>
              : <>
                  {(detail.node?.learn || node.learn) && <div className="modal-note"><b>MENTAL MODEL</b><LinkText text={detail.node?.learn || node.learn} candidates={allNodes} onOpen={onOpen}/></div>}
                  {detail.node?.useCases?.length > 0 && <div className="modal-note"><b>USE CASES</b><ul className="modal-uc-list">{detail.node.useCases.map((u,i)=><li key={i}><ChevronRight size={10}/>{u}</li>)}</ul></div>}
                  {!detail.node?.learn && !detail.node?.useCases?.length && <p className="modal-empty">No additional details available.</p>}
                </>
        )}
        {tab === 'deepdive' && (
          deepDive === null || deepDive === 'loading'
            ? <div className="modal-loading">Loading deep dive…</div>
            : deepDive === 'error'
              ? <p className="modal-empty">No deep dive content available for this concept yet.</p>
              : <MdRender text={deepDive} />
        )}
        {tab === 'found' && (
          related.length
            ? <div className="modal-related">{related.map(x=><button key={x._id} onClick={()=>onOpen(x)}><span>{x.icon}</span>{x.title}<ArrowUpRight size={11}/></button>)}</div>
            : <p className="modal-empty">No related concepts found.</p>
        )}
        {tab === 'ai' && (
          <div className="modal-ai">
            <div className="modal-ai-label">Copy this prompt into your favourite AI assistant:</div>
            <pre className="modal-ai-prompt">{aiPrompt}</pre>
            <button className={`modal-ai-copy ${copied?'copied':''}`} onClick={copy}>{copied ? '✓ COPIED' : 'COPY PROMPT'}</button>
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="modal-secondary" onClick={onClose}>KEEP EXPLORING</button>
        <button className="modal-primary" onClick={()=>onFull(node)}>OPEN FULL CONCEPT <ExternalLink size={12}/></button>
      </div>
    </div>
  </div>;
}

function Detail({topic,name,data,learned,onLearn,candidates,onOpen}) {
  const meta=categoryMeta(topic,data); const category=topic.categories.find(x=>x.id===data.categoryId); const childData=data.childIds?.map(id=>topic.nodes.find(n=>n._id===id)).filter(Boolean) || [];
  const tagNodes=(data.tagIds||[]).map(id=>topic.nodes.find(n=>n._id===id)).filter(Boolean);
  const related=topic.nodes.filter(n=>n._id!==data._id && (data.relatedNodeIds||[]).includes(n._id)).slice(0,10);
  return <div className="detail-content">
    <div className="d-header"><div className="d-top"><div className="d-icon" style={{background:meta.bg,color:meta.color,borderColor:`${meta.color}44`}}><span>{data.icon}</span></div><div className="d-meta"><div className="d-type">{data.type}</div><button className="d-name-btn" onClick={()=>onOpen(data)}>{data.title}</button><div className="d-cat">// {category?.name || data.scope || 'CROSS-TOPIC CONCEPT'}</div></div></div><div className="d-tags">{tagNodes.map(t=><button className="dtag" key={t._id} onClick={()=>onOpen(t)}>{t.title}</button>)}</div></div>
    <div className="d-body"><div className="d-desc"><LinkText text={data.description} candidates={candidates} onOpen={onOpen}/></div>
      <Section title="QUICK PROFILE"><div className="profile-grid"><Profile label="PRICING MODEL" value={data.pricing}/><Profile label="SCOPE" value={data.scope}/><Profile label="VARIANTS" value={data.variants}/><Profile label="ALTERNATIVES" value={data.alternatives}/></div>{data.freeTier&&<div className="free-box"><span>🎁</span><div><b>FREE TIER</b>{data.freeTier}</div></div>}</Section>
      {!!data.useCases?.length&&<Section title="COMMON USE CASES"><div className="uc-list">{data.useCases.map((u,i)=><div className="uc-item" key={i}><ChevronRight size={11}/><LinkText text={u} candidates={candidates} onOpen={onOpen}/></div>)}</div></Section>}
      {data.learn&&<Section title="MENTAL MODEL"><div className="mental"><b>Think of it like this:</b><br/><br/><LinkText text={data.learn} candidates={candidates} onOpen={onOpen}/></div></Section>}
      {data.devNote&&<Section title="DEV NOTES"><div className="devnote"><b>// LEARNING TIP</b><LinkText text={data.devNote} candidates={candidates} onOpen={onOpen}/></div></Section>}
      <Section title="PRICING BREAKDOWN"><div className="ptable"><Row k="Main model" v={data.pricing}/><Row k="Free tier" v={data.freeTier||'No free tier'} highlight/><Row k="Cost drivers" v="Usage • Capacity • Requests • Data transfer"/><Row k="Alternatives" v={data.alternatives}/>{data.docsUrl&&<Row k="Official docs" v={<a href={data.docsUrl} target="_blank" rel="noreferrer">Open docs <ExternalLink size={10}/></a>}/>}</div></Section>
      {!!childData.length && <Section title="GO DEEPER"><div className="dtabs">{childData.map(x=><button className="dtab" key={x._id} onClick={()=>onOpen(x)}>{x.title}</button>)}</div><div className="child-panel"><Network size={13}/><span>Click a sub-node to preview it, then open the full concept in a new tab.</span></div></Section>}
      {!!related.length && <Section title="CONNECTED CONCEPTS"><div className="connected-list">{related.map(x=><button key={x._id} onClick={()=>onOpen(x)}><span>{x.icon}</span><span><b>{x.title}</b><small>{x.type}</small></span><ArrowUpRight size={12}/></button>)}</div></Section>}
      <div className="d-actions"><button className={`mark-btn ${learned?'done':''}`} onClick={onLearn}>{learned?'✓ MARKED AS LEARNED':'MARK AS LEARNED'}</button>{data.docsUrl&&<a className="doc-btn" href={data.docsUrl} target="_blank" rel="noreferrer">DOCS <ExternalLink size={11}/></a>}</div>
    </div></div>;
}

function Section({title,children}) { return <div className="dsec"><div className="dsec-title">{title}</div>{children}</div>; }
function Profile({label,value}) { return <div className="pcard"><div className="pcard-label">{label}</div><div className="pcard-val">{value||'—'}</div></div>; }
function Row({k,v,highlight}) { return <div className={`prow ${highlight?'highlight':''}`}><span className="pk">{k}</span><span className="pv">{v}</span></div>; }

export function StandaloneNodePage({ nodeId }) {
  const [data,setData]=useState(null); const [error,setError]=useState(''); const [preview,setPreview]=useState(null);
  useEffect(()=>{ document.body.classList.add('standalone-mode'); return ()=>document.body.classList.remove('standalone-mode'); },[]);
  useEffect(()=>{loadNode(nodeId).then(setData).catch(e=>setError(e.message));},[nodeId]);
  if(error) return <div className="loading error"><strong>CONCEPT LOAD ERROR</strong><p>{error}</p></div>;
  if(!data) return <div className="loading"><BookOpen size={30}/><span>LOADING CONCEPT…</span></div>;
  const node=data.node; const candidates=[node,...data.children,...data.related];
  return <div className="standalone"><header className="standalone-header"><div className="brand">LEARNING PORTAL <em>// CONCEPT</em></div><div className="hline"/><div className="standalone-path">{data.topic?.title || 'CROSS-TOPIC'} / {node.title}</div><button className="hbtn" onClick={()=>window.close()}>CLOSE</button></header><main className="standalone-main"><div className="standalone-kicker">{node.type}</div><h1>{node.icon} {node.title}</h1><p className="standalone-desc"><LinkText text={node.description} candidates={candidates} onOpen={setPreview}/></p>{node.learn&&<section className="standalone-section"><h2>MENTAL MODEL</h2><div className="mental"><LinkText text={node.learn} candidates={candidates} onOpen={setPreview}/></div></section>}{node.useCases?.length>0&&<section className="standalone-section"><h2>WHERE IT FITS</h2><div className="connected-list">{node.useCases.map((u,i)=><div className="uc-item" key={i}><ChevronRight size={11}/><LinkText text={u} candidates={candidates} onOpen={setPreview}/></div>)}</div></section>}{data.related.length>0&&<section className="standalone-section"><h2>CONNECTED NODES</h2><div className="connected-grid">{data.related.map(x=><button key={x._id} onClick={()=>setPreview(x)}><span>{x.icon}</span><b>{x.title}</b><small>{x.type}</small></button>)}</div></section>}<div className="standalone-actions">{node.docsUrl&&<a className="doc-btn" href={node.docsUrl} target="_blank" rel="noreferrer">OFFICIAL DOCS <ExternalLink size={12}/></a>}<button className="modal-secondary" onClick={()=>window.close()}>RETURN TO EXPLORER</button></div></main>{preview&&<ConceptPreview node={preview} allNodes={candidates} onClose={()=>setPreview(null)} onOpen={setPreview} onFull={openNodeInNewTab}/>}</div>;
}
