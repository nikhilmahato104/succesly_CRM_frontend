import React, { useRef, useCallback } from 'react';
import { StickyNote, NoteColor, NOTE_COLORS } from './types';

const NOTE_KEYS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

interface Props {
  note: StickyNote;
  camScale: number;
  onChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onMove:   (id: string, dx: number, dy: number) => void;
  onColor:  (id: string, c: NoteColor) => void;
}

const BoardCard: React.FC<Props> = ({ note, camScale, onChange, onDelete, onMove, onColor }) => {
  const dragRef = useRef<{ mx: number; my: number } | null>(null);
  const theme   = NOTE_COLORS[note.color];

  const handleHdrMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.action) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mx: e.clientX, my: e.clientY };

    const onMove_ = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(note.id,
        (mv.clientX - dragRef.current.mx) / camScale,
        (mv.clientY - dragRef.current.my) / camScale,
      );
      dragRef.current = { mx: mv.clientX, my: mv.clientY };
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove_);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  }, [note.id, camScale, onMove]);

  return (
    <div
      className="fj-sticky"
      style={{
        left: note.x, top: note.y,
        width: note.width, height: note.height,
        background: theme.bg,
      }}
    >
      {/* Header / drag strip */}
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
          onClick={e => { e.stopPropagation(); onDelete(note.id); }}
          onMouseDown={e => e.stopPropagation()}
          aria-label="Delete note"
        >×</button>
      </div>

      {/* Body */}
      <div className="fj-sticky-body">
        <textarea
          className="fj-sticky-ta"
          style={{ color: theme.text }}
          value={note.text}
          onChange={e => onChange(note.id, e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          placeholder="Type here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default BoardCard;
