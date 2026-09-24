import { useEffect, useState } from 'react';
import { X, ChevronRight, ExternalLink, ArrowUpRight } from 'lucide-react';
import { loadNode, loadDetails } from '../api';
import { LinkText } from './LinkText';
import { MdRender } from './MdRender';

export function ConceptPreview({ node, allNodes, onClose, onOpen, onFull }) {
  const [tab, setTab] = useState('concept');
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deepDive, setDeepDive] = useState(null);

  const related = allNodes.filter(x => x._id !== node._id && (node.relatedNodeIds || []).includes(x._id)).slice(0, 10);

  useEffect(() => {
    setTab('concept'); setDetail(null); setCopied(false); setDeepDive(null);
    loadNode(node._id).then(setDetail).catch(() => setDetail({ error: true }));
  }, [node._id]);

  useEffect(() => {
    if (tab !== 'deepdive' || deepDive !== null) return;
    setDeepDive('loading');
    loadDetails(node._id)
      .then(d => setDeepDive(d.content))
      .catch(() => setDeepDive('error'));
  }, [tab, node._id]);

  const aiPrompt = `Explain "${node.title}" as if I'm a developer learning it for the first time.\nCover:\n1. What it is in one sentence\n2. The mental model (analogy)\n3. When to use it\n4. A simple real-world example\n5. Common mistakes to avoid`;

  function copy() {
    navigator.clipboard.writeText(aiPrompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

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
              : <><p className="modal-desc"><LinkText text={detail.node?.description || node.description} candidates={allNodes} onOpen={onOpen}/></p></>
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
