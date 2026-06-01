import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TextObject, PALETTE } from './types';

const FONT_SIZES = [
  { label: 'Small',  value: 14 },
  { label: 'Medium', value: 20 },
  { label: 'Large',  value: 28 },
  { label: 'Huge',   value: 42 },
];

/* ── Formatting toolbar ──────────────────────────────────────────────────── */
interface FmtProps {
  obj:      TextObject;
  onFormat: (id: string, p: Partial<TextObject>) => void;
}

const FmtToolbar: React.FC<FmtProps> = ({ obj, onFormat }) => (
  <div
    className="fj-fmt-toolbar"
    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
    onClick={e => e.stopPropagation()}
  >
    {/* Color dots */}
    {PALETTE.slice(0, 5).map(c => (
      <div key={c} className={`fj-fmt-cdot${obj.color === c ? ' active' : ''}`}
        style={{ background: c }}
        title={c}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onFormat(obj.id, { color: c }); }} />
    ))}

    <div className="fj-fmt-sep" />

    {/* Font size */}
    <select
      className="fj-fmt-select"
      value={obj.fontSize}
      onChange={e => onFormat(obj.id, { fontSize: Number(e.target.value) })}
      onMouseDown={e => e.stopPropagation()}
    >
      {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
    </select>

    <div className="fj-fmt-sep" />

    {/* Bold */}
    <button
      className={`fj-fmt-btn${obj.bold ? ' active' : ''}`}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onFormat(obj.id, { bold: !obj.bold }); }}
      title="Bold (Ctrl+B)"
    >B</button>
  </div>
);

interface Props {
  obj:         TextObject;
  getCamScale: () => number;
  onSync:      (id: string, text: string) => void;
  onMoveEnd:   (id: string, x: number, y: number) => void;
  onDelete:    (id: string) => void;
  onFormat:    (id: string, props: Partial<TextObject>) => void;
}

const BoardColumn: React.FC<Props> = ({ obj, getCamScale, onSync, onMoveEnd, onDelete, onFormat }) => {
  const [localText, setLocalText] = useState(obj.text);
  const [focused,   setFocused]   = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const taRef  = useRef<HTMLTextAreaElement>(null);

  const prevId = useRef(obj.id);
  useEffect(() => {
    if (obj.id !== prevId.current) { prevId.current = obj.id; setLocalText(obj.text); }
  }, [obj.id, obj.text]);

  /* ── Auto-grow ─────────────────────────────────────────────────────── */
  const autoGrow = useCallback(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    // Grow width to fit longest line
    const charW  = obj.fontSize * 0.58;
    const maxLen = Math.max(...(ta.value || ' ').split('\n').map(l => l.length), 6);
    ta.style.width = `${Math.max(maxLen * charW + 16, 80)}px`;
  }, [obj.fontSize]);

  useEffect(() => { autoGrow(); }, [localText, obj.fontSize, obj.bold, autoGrow]);

  /* ── Drag — direct DOM ──────────────────────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'BUTTON' || tgt.tagName === 'SELECT') return;
    if (tgt.closest('.fj-fmt-toolbar')) return;
    e.preventDefault(); e.stopPropagation();

    const div = divRef.current; if (!div) return;
    const sx = obj.x, sy = obj.y, smx = e.clientX, smy = e.clientY;

    const onMove = (mv: MouseEvent) => {
      const s = getCamScale();
      div.style.left = `${sx + (mv.clientX - smx) / s}px`;
      div.style.top  = `${sy + (mv.clientY - smy) / s}px`;
    };
    const onUp = (mu: MouseEvent) => {
      const s = getCamScale();
      onMoveEnd(obj.id, sx + (mu.clientX - smx) / s, sy + (mu.clientY - smy) / s);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [obj.id, obj.x, obj.y, getCamScale, onMoveEnd]);

  return (
    <div
      ref={divRef}
      className="fj-textobj"
      style={{ left: obj.x, top: obj.y, position: 'absolute' }}
      onMouseDown={handleMouseDown}
    >
      {/* Formatting toolbar — rendered above the text div in world space */}
      {focused && <FmtToolbar obj={{ ...obj, text: localText }} onFormat={onFormat} />}

      <textarea
        ref={taRef}
        className="fj-textobj-input"
        style={{ fontSize: obj.fontSize, fontWeight: obj.bold ? 700 : 400, color: obj.color }}
        rows={1}
        value={localText}
        onChange={e => { setLocalText(e.target.value); autoGrow(); }}
        onBlur={() => { setFocused(false); onSync(obj.id, localText); }}
        onFocus={() => setFocused(true)}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        spellCheck={false}
        placeholder="Type…"
      />

      <button
        className="fj-textobj-del"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}
        aria-label="Delete"
      >×</button>
    </div>
  );
};

// React.memo: only re-render if this specific text object changed
export default React.memo(BoardColumn, (prev, next) =>
  prev.obj.id       === next.obj.id       &&
  prev.obj.text     === next.obj.text     &&
  prev.obj.x        === next.obj.x        &&
  prev.obj.y        === next.obj.y        &&
  prev.obj.fontSize === next.obj.fontSize &&
  prev.obj.bold     === next.obj.bold     &&
  prev.obj.color    === next.obj.color
);
