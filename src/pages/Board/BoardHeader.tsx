import React from 'react';

interface Props {
  title: string;
  onUndo: () => void;
  onClear: () => void;
}

const BoardHeader: React.FC<Props> = ({ title, onUndo, onClear }) => (
  <header className="fj-header">
    <div className="fj-header-brand">
      <div className="fj-header-logo">🗂</div>
      <span className="fj-header-title">{title}</span>
    </div>

    <div className="fj-header-right">
      <button className="fj-hbtn" onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
      <button className="fj-hbtn fj-hbtn-danger" onClick={onClear} title="Clear all">✕ Clear</button>
    </div>
  </header>
);

export default BoardHeader;
