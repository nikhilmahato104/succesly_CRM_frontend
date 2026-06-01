import React, { useRef, useState, useCallback, useEffect } from 'react';
import { StickyNote, NoteColor, NOTE_COLORS } from './types';

const NOTE_KEYS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

interface Props {
  note:        StickyNote;
  getCamScale: () => number;
  onSync:      (id: string, text: string) => void;   // only called on blur
  onMoveEnd:   (id: string, x: number, y: number) => void; // called once on drag-end
  onDelete:    (id: string) => void;
  onColor:     (id: string, c: NoteColor) => void;
}

const BoardCard: React.FC<Props> = ({ note, getCamScale, onSync, onMoveEnd, onDelete, onColor }) => {
  /* ── Local text state — prevents re-render flicker on every keystroke ── */
  const [localText, setLocalText] = useState(note.text);
  // Sync if parent changes text (e.g. undo)
  const prevId = useRef(note.id);
  useEffect(() => {
    if (note.id !== prevId.current) {
      prevId.current = note.id;
      setLocalText(note.text);
    }
  }, [note.id, note.text]);

  const divRef   = useRef<HTMLDivElement>(null);
  const taRef    = useRef<HTMLTextAreaElement>(null);
  const theme    = NOTE_COLORS[note.color];

  /* ── Auto-grow textarea height ──────────────────────────────────────── */
  const autoGrow = useCallback(() => {
    const ta = taRef.current;
    const div = divRef.current;
    if (!ta || !div) return;
    ta.style.height = 'auto';
    const scrollH = ta.scrollHeight;
    ta.style.height = `${scrollH}px`;
    // Grow the sticky note height if needed
    const headerH = 26;
    const padV    = 18; // top + bottom padding in body
    const needed  = headerH + padV + scrollH;
    if (needed > note.height) {
      div.style.height = `${Math.max(needed, note.height)}px`;
    }
  }, [note.height]);

  useEffect(() => { autoGrow(); }, [localText, autoGrow]);

  /* ── Drag: direct DOM manipulation, zero React re-renders ───────────── */
  const handleHdrMouseDown = useCallback((e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.dataset.action) return; // color swatch or delete button
    e.preventDefault();
    e.stopPropagation();

    const div = divRef.current;
    if (!div) return;

    const startX  = note.x, startY  = note.y;
    const startMX = e.clientX, startMY = e.clientY;

    const onMouseMove = (mv: MouseEvent) => {
      const scale = getCamScale();
      const dx = (mv.clientX - startMX) / scale;
      const dy = (mv.clientY - startMY) / scale;
      div.style.left = `${startX + dx}px`;
      div.style.top  = `${startY + dy}px`;
    };

    const onMouseUp = (mu: MouseEvent) => {
      const scale = getCamScale();
      const finalX = startX + (mu.clientX - startMX) / scale;
      const finalY = startY + (mu.clientY - startMY) / scale;
      onMoveEnd(note.id, finalX, finalY);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }, [note.id, note.x, note.y, getCamScale, onMoveEnd]);

  return (
    <div
      ref={divRef}
      className="fj-sticky"
      style={{
        left:   note.x, top:    note.y,
        width:  note.width, height: note.height,
        background: theme.bg,
      }}
    >
      {/* Drag handle / colour strip */}
      <div
        className="fj-sticky-hdr"
        style={{ background: theme.header }}
        onMouseDown={handleHdrMouseDown}
      >
        <div className="fj-sticky-colors">
          {NOTE_KEYS.map(c => (
            <div
              key={c}
              className={`fj-sticky-swatch${note.color === c ? ' active' : ''}`}
              style={{ background: NOTE_COLORS[c].header }}
              data-action="color"
              onClick={e => { e.stopPropagation(); onColor(note.id, c); }}
            />
          ))}
        </div>
        <button
          className="fj-sticky-del"
          data-action="del"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(note.id); }}
          aria-label="Delete note"
        >×</button>
      </div>

      {/* Editable body */}
      <div className="fj-sticky-body">
        <textarea
          ref={taRef}
          className="fj-sticky-ta"
          style={{ color: theme.text }}
          value={localText}
          onChange={e => { setLocalText(e.target.value); autoGrow(); }}
          onBlur={() => onSync(note.id, localText)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          placeholder="Type here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};

// React.memo prevents re-renders when siblings change (stops blinking on tool switch)
export default React.memo(BoardCard, (prev, next) =>
  prev.note.id    === next.note.id    &&
  prev.note.text  === next.note.text  &&
  prev.note.color === next.note.color &&
  prev.note.x     === next.note.x     &&
  prev.note.y     === next.note.y     &&
  prev.note.width === next.note.width &&
  prev.note.height=== next.note.height
);
