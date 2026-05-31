import React, { useRef, useCallback } from 'react';
import { TextObject } from './types';

interface Props {
  obj: TextObject;
  camScale: number;
  onChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onMove:   (id: string, dx: number, dy: number) => void;
}

const BoardColumn: React.FC<Props> = ({ obj, camScale, onChange, onDelete, onMove }) => {
  const dragRef = useRef<{ mx: number; my: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mx: e.clientX, my: e.clientY };

    const onMove_ = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(obj.id,
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
  }, [obj.id, camScale, onMove]);

  return (
    <div
      className="fj-textobj"
      style={{ left: obj.x, top: obj.y, position: 'absolute' }}
      onMouseDown={handleMouseDown}
    >
      <textarea
        className="fj-textobj-input"
        style={{
          fontSize: obj.fontSize,
          fontWeight: obj.bold ? 700 : 400,
          color: obj.color,
          lineHeight: 1.35,
          width: Math.max(100, obj.text.length * (obj.fontSize * 0.55)),
        }}
        rows={obj.text.split('\n').length || 1}
        value={obj.text}
        onChange={e => onChange(obj.id, e.target.value)}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        spellCheck={false}
      />
      <button
        className="fj-textobj-del"
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}
        onMouseDown={e => e.stopPropagation()}
        aria-label="Delete text"
      >×</button>
    </div>
  );
};

export default BoardColumn;
