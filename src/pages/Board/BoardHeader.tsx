import React from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  title:      string;
  saveStatus: SaveStatus;
  onBack:     () => void;
  onUndo:     () => void;
  onClear:    () => void;
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle:   '',
  saving: '💾 Saving…',
  saved:  '✓ Saved',
  error:  '⚠ Save failed',
};

const SAVE_COLOR: Record<SaveStatus, string> = {
  idle:   '#94a3b8',
  saving: '#f59e0b',
  saved:  '#10b981',
  error:  '#ef4444',
};

const BoardHeader: React.FC<Props> = ({ title, saveStatus, onBack, onUndo, onClear }) => (
  <header className="fj-header">
    {/* Left */}
    <div className="fj-header-brand">
      <button
        onClick={onBack}
        title="Back to boards"
        style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#64748b', padding:'4px 6px', borderRadius:6, lineHeight:1, fontFamily:'inherit' }}
        onMouseOver={e => (e.currentTarget.style.background = '#f1f5f9')}
        onMouseOut={e  => (e.currentTarget.style.background = 'none')}
      >←</button>
      <div className="fj-header-logo">🗂</div>
      <span className="fj-header-title">{title || 'Untitled Board'}</span>
      {saveStatus !== 'idle' && (
        <span style={{ fontSize: 12, fontWeight: 600, color: SAVE_COLOR[saveStatus], marginLeft: 6 }}>
          {SAVE_LABEL[saveStatus]}
        </span>
      )}
    </div>

    {/* Right */}
    <div className="fj-header-right">
      <button className="fj-hbtn" onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
      <button className="fj-hbtn fj-hbtn-danger" onClick={onClear} title="Clear board">✕ Clear</button>
    </div>
  </header>
);

export default BoardHeader;
