import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Home, PanelRight, BookOpen, ArrowUpRight } from 'lucide-react';
import { Tree } from 'react-arborist';
import { loadTopic, loadTopics, openNodeInNewTab, routeFromUrl } from './api';
import { buildPath, buildTreeData, makeNodeMap, toNestedTree } from './tree';
import { useProgress } from './hooks/useProgress';
import { LinkText } from './components/LinkText';
import { Detail } from './components/Detail';
import { ConceptPreview } from './components/ConceptPreview';

export { StandaloneNodePage } from './components/StandaloneNodePage';

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

  useEffect(() => { loadTopics().then(setTopics).catch(e => setError(e.message)); }, []);

  useEffect(() => {
    const route = routeFromUrl();
    if (route.nodeId) { setSelectedId(route.nodeId); return; }
    setTopicId(route.topicId); setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!topicId) return;
    setTopic(null); setError(''); setQuery(''); setPreview(null);
    loadTopic(topicId)
      .then(data => { setTopic(data); setSelectedId(routeFromUrl().nodeId || data.topic.rootNodeId); })
      .catch(e => setError(e.message));
  }, [topicId]);

  useEffect(() => {
    const onPop = () => { const route = routeFromUrl(); setTopicId(route.topicId); setSelectedId(route.nodeId || null); };
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
    return candidates.filter(d => d.title.toLowerCase().includes(q) || (d.type||'').toLowerCase().includes(q) || (d.description||'').toLowerCase().includes(q)).slice(0,10);
  }, [query, topic, candidates]);
  const services = useMemo(() => (topic?.nodes||[]).filter(n=>n.topicId===topic?.topic.id && n.type!=='CATEGORY' && n._id!==rootId), [topic, rootId]);
  const learnedCount = progress.learned.length;
  const path = selectedId && current ? buildPath(selectedId, db, null, rootId) : [topic?.topic.title || 'HOME'];
  const kids = current?.childIds?.map(id=>db[id]).filter(Boolean) || [];
  const types = ['ALL', ...new Set(kids.map(k=>k.type?.split(' ')[0]||'CAPABILITY'))];
  const filteredKids = activeFilter==='ALL' ? kids : kids.filter(k=>k.type?.startsWith(activeFilter));

  function select(nodeOrId) {
    const id = typeof nodeOrId==='string' ? nodeOrId : nodeOrId?._id;
    if (!id) return;
    setSelectedId(id);
    setProgress(p=>({...p, visited:[...new Set([...p.visited,id])]}));
    setActiveFilter('ALL');
    if (window.innerWidth<=860) setMobileOpen(true);
    setTimeout(()=>treeRef.current?.scrollTo({id}),50);
  }
  function toggleLearned(name) { setProgress(p=>({...p, learned:p.learned.includes(name)?p.learned.filter(x=>x!==name):[...p.learned,name]})); }

  if (error) return <div className="loading error"><strong>API LOAD ERROR</strong><p>{error}</p><p>Start the Express API and MongoDB, then refresh.</p></div>;
  if (!topic || !current) return <div className="loading"><BookOpen size={30}/><span>LOADING LEARNING GRAPH…</span></div>;

  return <div className="app">
    <header>
      <div className="brand">{topic.topic.brand||topic.topic.title}<em> // {topic.topic.subtitle||'LEARNING PORTAL'}</em></div><div className="hline"/>
      <div className="topic-switcher"><select value={topicId} onChange={e=>{navigateTopic(e.target.value);setTopicId(e.target.value)}} aria-label="Learning topic">{topics.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></div>
      <div className="search-wrap">
        <Search className="search-icon" size={12}/><input value={query} onChange={e=>{setQuery(e.target.value);setSearchOpen(true)}} onFocus={()=>setSearchOpen(true)} placeholder="Search concepts, services, tags…" autoComplete="off"/>
        {searchOpen&&query&&<div className="search-results show">{searchHits.length?searchHits.map(d=><button className="sr-item" key={d._id} onClick={()=>{select(d);setQuery('');setSearchOpen(false)}}><span className="sr-icon">{d.icon}</span><span className="sr-name">{d.title}</span><span className="sr-cat">{d.type}</span></button>):<div className="sr-empty">No matches</div>}</div>}
      </div>
      <div className="header-status">GRAPH MODE · <b>FOLLOW THE CONCEPT</b></div>
      <div className="hactions"><div className="prog">{learnedCount} / {services.length} learned</div><button className="hbtn" onClick={()=>select(rootId)}><Home size={11}/> HOME</button><button className="hbtn mob-only" onClick={()=>setMobileOpen(v=>!v)}><PanelRight size={11}/> PANEL</button></div>
    </header>

    <aside>
      <div className="side-label">SYSTEM</div><div className="sys-block"><div className="sys-title">{topic.topic.title} Learning Graph</div><div className="sys-sub">Normalized MongoDB knowledge graph</div><div className="sys-row"><span>Mode</span><span>INTERLINKED</span></div><div className="sys-row"><span>Nodes</span><span>{topic.nodes.length}</span></div><div className="sys-row"><span>Tags</span><span>{topic.tags.length}</span></div></div>
      <div className="side-label">CATEGORIES</div><div className="cat-list">{topic.categories.map(cat=><button className="cat-item" key={cat.id} onClick={()=>select(cat.nodeId)}><span className="dot" style={{background:cat.color,boxShadow:`0 0 6px ${cat.color}88`}}/><span>{cat.name}</span><span className="cnt">{topic.nodes.filter(n=>n.categoryId===cat.id&&n.parentId===cat.nodeId).length}</span></button>)}</div>
      <div className="side-label">SERVICE TREE</div>
      <div className="tree-wrap">{tree.length>0&&<Tree ref={treeRef} data={tree} width="100%" height={390} rowHeight={25} indent={14} openByDefault={false} selection={selectedId} onSelect={nodes=>nodes?.[0]&&select(nodes[0].id)}>{({node,style})=><div style={style} className={`tree-row ${node.isSelected?'selected':''}`}><span className="tree-chevron">{node.isInternal?(node.isOpen?'▾':'▸'):'·'}</span><span className="tree-icon">{node.data.icon||'◉'}</span><span>{node.data.name}</span></div>}</Tree>}</div>
      <div className="tip-box"><b>// THE NEW LOOP</b>Read a service → click a linked concept → preview it → open the full concept in a new tab → keep following the graph.</div>
    </aside>

    <main className="workspace">
      <div className="breadcrumb">{path.map((p,i)=><React.Fragment key={`${p.id}-${i}`}>{i<path.length-1?<button className="bc-btn" onClick={()=>select(p.id)}>{p.title}</button>:<span className="current">{p.title}</span>}{i<path.length-1&&<span className="sep">/</span>}</React.Fragment>)}</div>
      <div className="ws-head"><div className="ws-eyebrow">// {selectedId===rootId?'PLATFORM OVERVIEW':(current.type||'CONCEPT')}</div><div className="ws-title">{selectedId===rootId?`${topic.topic.title} Topics`:current.title}</div><div className="ws-desc"><LinkText text={selectedId===rootId?topic.topic.description:current.description} candidates={candidates} onOpen={setPreview}/></div></div>
      <div className="filter-row">{kids.length>0&&types.map(t=><button className={`fbtn ${activeFilter===t?'on':''}`} key={t} onClick={()=>setActiveFilter(t)}>{t}</button>)}</div>
      <div className="cards">{filteredKids.length?filteredKids.map((x,i)=>{const meta=topic?.categories?.find(c=>c.id===x.categoryId)||{color:'#00e5ff',bg:'radial-gradient(circle at 50% 40%,#001a2a,#03060d 70%)'};const learned=progress.learned.includes(x._id);const visited=progress.visited.includes(x._id);return <article className={`card ${x._id===selectedId?'active':''} ${learned?'learned':''}`} key={x._id} style={{animationDelay:`${i*.04}s`}} onClick={()=>select(x)}><div className="card-icon-wrap" style={{background:meta.bg,color:meta.color,borderColor:`${meta.color}33`}}><span>{x.icon}</span></div><div className="card-body"><div className="card-name">{x.title}{learned&&<span className="lbadge">✓ LEARNED</span>}</div><div className="card-type">{x.type}</div><div className="card-tags">{(x.tagIds||[]).slice(0,4).map(tagId=>{const tag=topic.tags.find(t=>t._id===tagId);return tag?<button className="ctag" key={tag._id} onClick={e=>{e.stopPropagation();const n=db[tag._id];if(n)setPreview(n)}}>{tag.name}</button>:null})}{visited&&!learned&&<span className="ctag visited">visited</span>}</div></div><button className="card-open" onClick={e=>{e.stopPropagation();select(x)}}>OPEN</button></article>}):<div className="leaf-msg">This concept is a leaf node.<br/>Use the linked concepts in the detail panel to continue exploring.</div>}</div>
    </main>

    <section className={`detail ${mobileOpen?'open':''}`}>
      <Detail topic={topic} name={selectedId} data={current} learned={progress.learned.includes(selectedId)} onLearn={()=>toggleLearned(selectedId)} candidates={candidates} onOpen={setPreview}/>
    </section>

    {preview&&<ConceptPreview node={preview} allNodes={candidates} onClose={()=>setPreview(null)} onOpen={node=>setPreview(node)} onFull={node=>openNodeInNewTab(node._id)}/>}
  </div>;
}
