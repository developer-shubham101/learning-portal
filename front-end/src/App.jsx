import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Home,
  PanelRight,
  Check,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Database,
  RotateCcw,
} from "lucide-react";
import { Tree } from "react-arborist";
import { loadTopic, loadTopics, topicFromUrl, fetchNode } from "./api";

function nodeFromHash() {
  return decodeURIComponent(window.location.hash.slice(1)) || null;
}
import {
  buildPath,
  buildTreeData,
  getCategory,
  makeLeaf,
  toNestedTree,
} from "./tree";

const DEFAULT_CATEGORY_META = {
  color: "#00e5ff",
  glow: "#00e5ff22",
  bg: "radial-gradient(circle at 50% 40%,#001a2a,#03060d 70%)",
};

function useProgress(topicId) {
  const key = `learning-progress:${topicId}`;
  const read = () => {
    try {
      return (
        JSON.parse(localStorage.getItem(key)) || { visited: [], learned: [] }
      );
    } catch {
      return { visited: [], learned: [] };
    }
  };
  const [state, setState] = useState(read);
  useEffect(() => setState(read()), [topicId]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

function categoryMeta(topic, name) {
  return (
    topic?.categories?.[name] ||
    topic?.categories?.[getCategory(name, topic.nodes, topic.categories)] ||
    DEFAULT_CATEGORY_META
  );
}

function escapeSelectorName(name) {
  return String(name).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function App() {
  const [topicId, setTopicId] = useState(topicFromUrl());
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [progress, setProgress] = useProgress(topicId);
  const treeRef = useRef(null);
  const skipHashUpdate = useRef(false);

  useEffect(() => {
    setTopic(null);
    setError("");
    setSelected(null);
    setQuery("");
    loadTopics()
      .then((list) => {
        setTopics(list);
        return loadTopic(topicId);
      })
      .then((data) => {
        setTopic(data);
        const hash = nodeFromHash();
        setSelected(hash && data.nodes[hash] ? hash : data.root);
      })
      .catch((e) => setError(e.message));
  }, [topicId]);

  useEffect(() => {
    const onPop = () => setTopicId(topicFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (skipHashUpdate.current) { skipHashUpdate.current = false; return; }
      const node = nodeFromHash();
      if (node && topic?.nodes[node]) setSelected(node);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [topic]);

  const db = topic?.nodes || {};
  const root = topic?.root;
  const current = selected ? db[selected] || makeLeaf(selected, root) : null;
  const path =
    selected && topic
      ? buildPath(selected, db, topic.categories, root)
      : [root || "HOME"];
  const tree = useMemo(
    () => (topic ? toNestedTree(buildTreeData(topic), root) : []),
    [topic, root],
  );
  const searchHits = useMemo(() => {
    if (!query.trim() || !topic) return [];
    const q = query.toLowerCase();
    return Object.entries(db)
      .filter(
        ([name, d]) =>
          name.toLowerCase().includes(q) ||
          (d.type || "").toLowerCase().includes(q) ||
          (d.tags || []).join(" ").toLowerCase().includes(q),
      )
      .slice(0, 9);
  }, [query, topic, db]);

  const services = Object.keys(db).filter(
    (k) => db[k].learn || (db[k].type !== "CATEGORY" && k !== root),
  );
  const learnedCount = progress.learned.length;

  function select(name) {
    setSelected(name);
    setActiveFilter("ALL");
    setProgress((p) => ({ ...p, visited: [...new Set([...p.visited, name])] }));
    if (window.innerWidth <= 860) setMobileOpen(true);
    skipHashUpdate.current = true;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(name)}`);
  }

  useEffect(() => {
    if (selected && treeRef.current) {
      treeRef.current.select(selected);
      treeRef.current.scrollTo(selected);
    }
  }, [selected]);
  function toggleLearned(name) {
    setProgress((p) => ({
      ...p,
      learned: p.learned.includes(name)
        ? p.learned.filter((x) => x !== name)
        : [...p.learned, name],
    }));
  }
  function changeTopic(id) {
    history.pushState({}, "", `?topic=${encodeURIComponent(id)}`);
    setTopicId(id);
  }

  if (error)
    return (
      <div className="loading error">
        <strong>API LOAD ERROR</strong>
        <p>{error}</p>
        <p>
          Expected: <code>GET /api/topics/{topicId}</code>
        </p>
      </div>
    );
  if (!topic)
    return (
      <div className="loading">
        <BookOpen size={30} />
        <span>LOADING LEARNING DATA…</span>
      </div>
    );

  const kids = current?.children || [];
  const types = [
    "ALL",
    ...new Set(
      kids.map(
        (k) => (db[k] || makeLeaf(k, root)).type?.split(" ")[0] || "CAPABILITY",
      ),
    ),
  ];
  const filteredKids =
    activeFilter === "ALL"
      ? kids
      : kids.filter((k) =>
          (db[k] || makeLeaf(k, root)).type?.startsWith(activeFilter),
        );

  return (
    <div className="app">
      <header>
        <div className="brand">
          {topic.brand || topic.title}
          <em> // {topic.subtitle || "LEARNING PORTAL"}</em>
        </div>
        <div className="hline" />
        <div className="topic-switcher">
          <select
            value={topicId}
            onChange={(e) => changeTopic(e.target.value)}
            aria-label="Learning topic"
          >
            {topics.map((t) => (
              <option value={t.id} key={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="search-wrap">
          <Search className="search-icon" size={12} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search services, types, categories…"
            autoComplete="off"
          />
          {searchOpen && query && (
            <div className="search-results show">
              {searchHits.length ? (
                searchHits.map(([name, d]) => (
                  <button
                    className="sr-item"
                    key={name}
                    onClick={() => {
                      select(name);
                      setQuery("");
                      setSearchOpen(false);
                    }}
                  >
                    <span className="sr-icon">{d.icon}</span>
                    <span className="sr-name">{name}</span>
                    <span className="sr-cat">
                      {getCategory(name, db, topic.categories) || topic.title}
                    </span>
                  </button>
                ))
              ) : (
                <div className="sr-empty">No matches</div>
              )}
            </div>
          )}
        </div>
        <div className="header-status">
          LEARNING MODE · <b>ONE CONCEPT AT A TIME</b>
        </div>
        <div className="hactions">
          <div className="prog">
            {learnedCount} / {services.length} learned
          </div>
          <button className="hbtn" onClick={() => select(root)}>
            <Home size={11} /> HOME
          </button>
          <button
            className="hbtn mob-only"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <PanelRight size={11} /> PANEL
          </button>
        </div>
      </header>

      <aside>
        <div className="side-label">SYSTEM</div>
        <div className="sys-block">
          <div className="sys-title">{topic.title} Learning Explorer</div>
          <div className="sys-sub">API-backed guided learning mode</div>
          <div className="sys-row">
            <span>Mode</span>
            <span>GUIDED</span>
          </div>
          <div className="sys-row">
            <span>Nodes</span>
            <span>{Object.keys(db).length}</span>
          </div>
          <div className="sys-row">
            <span>Status</span>
            <span>ONLINE</span>
          </div>
        </div>
        <div className="side-label">CATEGORIES</div>
        <div className="cat-list">
          {Object.entries(topic.categories).map(([name, m]) => (
            <button
              className="cat-item"
              key={name}
              onClick={() => select(name)}
            >
              <span
                className="dot"
                style={{
                  background: m.color,
                  boxShadow: `0 0 6px ${m.color}88`,
                }}
              />
              <span>{name}</span>
              <span className="cnt">{db[name]?.children?.length || 0}</span>
            </button>
          ))}
        </div>
        <div className="side-label">SERVICE TREE</div>
        <div className="tree-wrap">
          {tree.length > 0 && (
            <Tree
              ref={treeRef}
              data={tree}
              width="100%"
              height={390}
              rowHeight={25}
              indent={14}
              openByDefault={false}
              selection={selected}
              onSelect={(nodes) => nodes?.[0] && select(nodes[0].id)}
            >
              {({ node, style }) => (
                <div
                  style={style}
                  className={`tree-row ${node.isSelected ? "selected" : ""}`}
                >
                  <span className="tree-chevron">
                    {node.isInternal ? (node.isOpen ? "▾" : "▸") : "·"}
                  </span>
                  <span className="tree-icon">{node.data.icon || "◉"}</span>
                  <span>{node.data.name}</span>
                </div>
              )}
            </Tree>
          )}
        </div>
        <div className="tip-box">
          <b>// HOW TO USE</b>1. Pick a category or tree node
          <br />
          2. Scan the center card list
          <br />
          3. Open a concept
          <br />
          4. Study the right panel
          <br />
          5. Mark it learned when ready
        </div>
      </aside>

      <main className="workspace">
        <div className="breadcrumb">
          {path.map((p, i) => (
            <React.Fragment key={p}>
              {i < path.length - 1 ? (
                <button className="bc-btn" onClick={() => select(p)}>{p}</button>
              ) : (
                <b>{p}</b>
              )}
              {i < path.length - 1 && <span className="sep">›</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="ws-head">
          <div className="ws-eyebrow">
            //{" "}
            {selected === root
              ? "PLATFORM OVERVIEW"
              : current?.type || "CONCEPT"}
          </div>
          <div className="ws-title">
            {selected === root ? `${topic.title} Topics` : selected}
          </div>
          <div className="ws-desc">
            {selected === root
              ? topic.description
              : (current?.desc || "").slice(0, 180)}
          </div>
        </div>
        <div className="filter-row">
          {kids.length > 0 &&
            types.map((t) => (
              <button
                className={`fbtn ${activeFilter === t ? "on" : ""}`}
                key={t}
                onClick={() => setActiveFilter(t)}
              >
                {t}
              </button>
            ))}
        </div>
        <div className="cards">
          {filteredKids.length ? (
            filteredKids.map((name, i) => {
              const x = db[name] || makeLeaf(name, root);
              const meta = categoryMeta(topic, name);
              const learned = progress.learned.includes(name);
              const visited = progress.visited.includes(name);
              return (
                <article
                  className={`card ${name === selected ? "active" : ""} ${learned ? "learned" : ""}`}
                  key={name}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => select(name)}
                >
                  <div
                    className="card-icon-wrap"
                    style={{
                      background: meta.bg,
                      color: meta.color,
                      borderColor: `${meta.color}33`,
                    }}
                  >
                    <span>{x.icon}</span>
                  </div>
                  <div className="card-body">
                    <div className="card-name">
                      {name}
                      {learned && <span className="lbadge">✓ LEARNED</span>}
                    </div>
                    <div className="card-type">{x.type}</div>
                    <div className="card-tags">
                      {(x.tags || []).slice(0, 3).map((t) => (
                        <span className="ctag" key={t}>
                          {t}
                        </span>
                      ))}
                      {visited && !learned && (
                        <span className="ctag visited">visited</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="card-open"
                    onClick={(e) => {
                      e.stopPropagation();
                      select(name);
                    }}
                  >
                    OPEN
                  </button>
                </article>
              );
            })
          ) : (
            <div className="leaf-msg">
              This is a leaf-level capability.
              <br />
              Use the detail panel on the right to study it.
            </div>
          )}
        </div>
      </main>

      <section className={`detail ${mobileOpen ? "open" : ""}`}>
        {!selected ? (
          <div className="detail-empty">
            <div className="big">◈</div>
            <p>Select any concept card to load its learning profile here.</p>
          </div>
        ) : (
          <Detail
            topic={topic}
            name={selected}
            data={current}
            learned={progress.learned.includes(selected)}
            onLearn={() => toggleLearned(selected)}
          />
        )}
      </section>
      <div className="toast" />
    </div>
  );
}

function SciFiModal({ item, onClose }) {
  const [glitch, setGlitch] = useState(true);
  const [tab, setTab] = useState(0);
  const [crossData, setCrossData] = useState(null);
  const [crossLoading, setCrossLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGlitch(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setCrossData(null);
    if (!item?.crossRef) return;
    setCrossLoading(true);
    fetchNode(item.crossRef.topicId, item.crossRef.nodeId)
      .then(d => setCrossData(d))
      .finally(() => setCrossLoading(false));
  }, [item?.crossRef?.topicId, item?.crossRef?.nodeId]);

  const hasCross = !!item?.crossRef;
  const tabs = hasCross
    ? ['OVERVIEW', 'QUICK LOOK', 'SPECS', 'METRICS', 'REFERENCES']
    : ['OVERVIEW', 'SPECS', 'METRICS', 'REFERENCES'];

  const specRows = [['Protocol','TCP/IP · TLS 1.3'],['Redundancy','Multi-AZ active-active'],['Throughput','10 Gbps burst'],['Latency P99','< 4 ms'],['Encryption','AES-256-GCM at rest'],['Auth','SigV4 · IAM roles']];
  const metricRows = [['Availability','99.99%','100%','NOMINAL'],['Error Rate','0.002%','0.08%','NOMINAL'],['Req/sec','4,200','18,500','NOMINAL'],['Cost/unit','$0.023','$0.041','WATCH']];
  const refs = ['AWS Official Documentation','AWS Well-Architected Framework','AWS Pricing Calculator','AWS re:Invent Session Library','AWS Architecture Center'];

  const exploreUrl = hasCross
    ? `${window.location.origin}/?topic=${item.crossRef.topicId}#${encodeURIComponent(item.crossRef.nodeId)}`
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box${glitch ? ' glitch-in' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-scanline" />
        <div className="modal-header">
          <span className="modal-eyebrow">// INTEL RECORD</span>
          <span className="modal-title">{item.label}</span>
          <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:'auto'}}>
            {exploreUrl && (
              <a className="modal-explore-btn" href={exploreUrl} target="_blank" rel="noreferrer">
                EXPLORE ↗
              </a>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        {item.value && <div className="modal-sub">{item.value}</div>}
        <div className="modal-tabs">
          {tabs.map((t, i) => <button key={t} className={`modal-tab${tab===i?' on':''}`} onClick={() => setTab(i)}>{t}</button>)}
        </div>
        <div className="modal-body">
          {tab === 0 && (
            <div className="modal-overview">
              <p>Intelligence record for <b>{item.label}</b>. Data cross-referenced against the knowledge graph and live telemetry feeds.</p>
              <p style={{marginTop:10}}>Classification: <span className="modal-badge">UNRESTRICTED</span> · Confidence: <span className="modal-badge green">HIGH</span></p>
              {hasCross && (
                <div className="modal-crossref-hint">
                  ⌁ This concept is linked to topic <b>{item.crossRef.topicId}</b>. Switch to the QUICK LOOK tab for details or click EXPLORE ↗ to open it.
                </div>
              )}
            </div>
          )}
          {hasCross && tab === 1 && (
            <div className="modal-quicklook">
              {crossLoading && <div className="modal-loading">⟳ FETCHING NODE DATA…</div>}
              {!crossLoading && !crossData && <div className="modal-loading">Node not found in topic <b>{item.crossRef.topicId}</b>.</div>}
              {crossData && (
                <>
                  <div className="modal-ql-header">
                    <span className="modal-ql-icon">{crossData.node.icon}</span>
                    <div>
                      <div className="modal-ql-type">{crossData.node.type}</div>
                      <div className="modal-ql-name">{crossData.nodeId}</div>
                      <div className="modal-ql-topic">// {crossData.topicTitle}</div>
                    </div>
                  </div>
                  <p className="modal-ql-desc">{crossData.node.desc}</p>
                  <div className="modal-ql-grid">
                    {crossData.node.pricing && <div className="modal-ql-cell"><span>PRICING</span>{crossData.node.pricing}</div>}
                    {crossData.node.scope && <div className="modal-ql-cell"><span>SCOPE</span>{crossData.node.scope}</div>}
                    {crossData.node.freeTier && <div className="modal-ql-cell"><span>FREE TIER</span>{crossData.node.freeTier}</div>}
                    {crossData.node.alt && <div className="modal-ql-cell"><span>ALTERNATIVES</span>{crossData.node.alt}</div>}
                  </div>
                  {crossData.node.tags?.length > 0 && (
                    <div className="modal-ql-tags">
                      {crossData.node.tags.map(t => <span key={t} className="dtag">{t}</span>)}
                    </div>
                  )}
                  <a className="modal-explore-full" href={exploreUrl} target="_blank" rel="noreferrer">
                    EXPLORE {crossData.nodeId} IN FULL ↗
                  </a>
                </>
              )}
            </div>
          )}
          {tab === (hasCross ? 2 : 1) && (
            <table className="modal-table"><tbody>
              {specRows.map(([k,v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
            </tbody></table>
          )}
          {tab === (hasCross ? 3 : 2) && (
            <table className="modal-table">
              <thead><tr><th>Metric</th><th>30d avg</th><th>Peak</th><th>Status</th></tr></thead>
              <tbody>{metricRows.map(([m,a,p,s]) => <tr key={m}><td>{m}</td><td>{a}</td><td>{p}</td><td className={s==='WATCH'?'warn':'ok'}>● {s}</td></tr>)}</tbody>
            </table>
          )}
          {tab === (hasCross ? 4 : 3) && (
            <div className="modal-refs">
              {refs.map(r => <div key={r} className="modal-ref-item">⌁ {r}</div>)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span>SYS:READY</span><span>ENC:ON</span>
          {hasCross && <span>XREF:{item.crossRef.topicId.toUpperCase()}:{item.crossRef.nodeId.toUpperCase()}</span>}
          <span>NODE:{item.label?.toUpperCase().replace(/ /g,'_')}</span>
        </div>
      </div>
    </div>
  );
}

function Detail({ topic, name, data, learned, onLearn }) {
  const [child, setChild] = useState(data.children?.[0]);
  const [modal, setModal] = useState(null);
  const open = (label, value, crossRef = null) => setModal({ label, value, crossRef });
  useEffect(() => setChild(data.children?.[0]), [name, data.children]);
  const meta = categoryMeta(topic, name);
  const cat = getCategory(name, topic.nodes, topic.categories);
  const childData = child
    ? topic.nodes[child] || makeLeaf(child, topic.root)
    : null;
  return (
    <div className="detail-content">
      <div className="d-header">
        <div className="d-top">
          <div
            className="d-icon"
            style={{
              background: meta.bg,
              color: meta.color,
              borderColor: `${meta.color}44`,
            }}
          >
            <span>{data.icon}</span>
          </div>
          <div className="d-meta">
            <div className="d-type">{data.type}</div>
            <div className="d-name">{name}</div>
            <div className="d-cat">// {cat || topic.title}</div>
          </div>
        </div>
        <div className="d-tags">
          {(data.tags || []).map((t) => (
            <span className="dtag" key={t} style={{cursor:'pointer'}}
              onClick={() => open(t, `Tag: ${t}`, data.crossRefs?.[t] || null)}>
              {t}{data.crossRefs?.[t] && <span className="dtag-xref">↗</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="d-body">
        <div className="d-desc">{data.desc}</div>
        <Section title="QUICK PROFILE">
          <div className="profile-grid">
            <Profile label="PRICING MODEL" value={data.pricing} onClick={() => open('PRICING MODEL', data.pricing, data.crossRefs?.['PRICING MODEL'] || null)} />
            <Profile label="SCOPE" value={data.scope} onClick={() => open('SCOPE', data.scope, data.crossRefs?.['SCOPE'] || null)} />
            <Profile label="VARIANTS" value={data.variants} onClick={() => open('VARIANTS', data.variants, data.crossRefs?.['VARIANTS'] || null)} />
            <Profile label="ALTERNATIVES" value={data.alt} onClick={() => open('ALTERNATIVES', data.alt, data.crossRefs?.['ALTERNATIVES'] || null)} />
          </div>
          {data.freeTier && (
            <div className="free-box">
              <span>🎁</span>
              <div>
                <b>FREE TIER</b>
                {data.freeTier}
              </div>
            </div>
          )}
        </Section>
        {!!data.useCases?.length && (
          <Section title="COMMON USE CASES">
            <div className="uc-list">
              {data.useCases.map((u) => (
                <div className="uc-item" key={u} style={{cursor:'pointer'}} onClick={() => open('USE CASE', u, data.crossRefs?.[u] || null)}>
                  <ChevronRight size={11} />
                  {u}
                </div>
              ))}
            </div>
          </Section>
        )}
        {data.learn && (
          <Section title="MENTAL MODEL">
            <div className="mental">
              <b>Think of it like this:</b>
              <br />
              <br />
              {data.learn}
            </div>
          </Section>
        )}
        {data.devNote && (
          <Section title="DEV NOTES">
            <div className="devnote">
              <b>// LEARNING TIP</b>
              {data.devNote}
            </div>
          </Section>
        )}
        <Section title="PRICING BREAKDOWN">
          <div className="ptable">
            <Row k="Main model" v={data.pricing} />
            <Row k="Free tier" v={data.freeTier || "No free tier"} highlight />
            <Row
              k="Cost drivers"
              v="Usage • Capacity • Requests • Data transfer"
            />
            <Row k="Alternatives" v={data.alt} />
            {data.link && data.link !== "#" && (
              <Row
                k="Official docs"
                v={
                  <a href={data.link} target="_blank" rel="noreferrer">
                    Open docs <ExternalLink size={10} />
                  </a>
                }
              />
            )}
          </div>
        </Section>
        <Section title="GO DEEPER">
          {data.children?.length ? (
            <>
              <div className="dtabs">
                {data.children.map((x) => (
                  <button
                    className={`dtab ${child === x ? "on" : ""}`}
                    key={x}
                    onClick={() => setChild(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              {childData && (
                <div className="child-panel">
                  <div className="cp-type">{childData.type}</div>
                  <b>{child}</b> — {childData.desc?.slice(0, 190)}
                  {childData.pricing && (
                    <>
                      <br />
                      <br />
                      <span>Pricing:</span> {childData.pricing}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="child-panel muted">
              No sub-capabilities defined yet.
            </div>
          )}
        </Section>
        <div className="d-actions">
          <button
            className={`mark-btn ${learned ? "done" : ""}`}
            onClick={onLearn}
          >
            {learned ? "✓ MARKED AS LEARNED" : "MARK AS LEARNED"}
          </button>
          {data.link && data.link !== "#" && (
            <a
              className="doc-btn"
              href={data.link}
              target="_blank"
              rel="noreferrer"
            >
              DOCS <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
      {modal && <SciFiModal item={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
const Section = ({ title, children }) => (
  <div className="dsec">
    <div className="dsec-title">{title}</div>
    {children}
  </div>
);
const Profile = ({ label, value, onClick }) => (
  <div className="pcard" onClick={onClick} style={onClick?{cursor:'pointer'}:{}}>
    <div className="pcard-label">{label}</div>
    <div className="pcard-val">{value || "—"}</div>
  </div>
);
const Row = ({ k, v, highlight }) => (
  <div className={`prow ${highlight ? "highlight" : ""}`}>
    <span className="pk">{k}</span>
    <span className="pv">{v}</span>
  </div>
);
