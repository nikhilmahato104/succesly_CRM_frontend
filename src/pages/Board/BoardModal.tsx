import React, { useRef, useCallback } from 'react';
import { ShapeObject, ArrowObject } from './types';

/* ── Draggable Shape (rect / circle) ──────────────────────────────────────── */
interface ShapeProps {
  obj: ShapeObject;
  camScale: number;
  onDelete: (id: string) => void;
  onMove:   (id: string, dx: number, dy: number) => void;
}

export const ShapeEl: React.FC<ShapeProps> = ({ obj, camScale, onDelete, onMove }) => {
  const dragRef = useRef<{ mx: number; my: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGElement>) => {
    const el = e.target as SVGElement;
    if (el.dataset.del) return;
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

  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const delX = obj.x + obj.width;
  const delY = obj.y;

  return (
    <g style={{ cursor: 'move' }} onMouseDown={handleMouseDown}>
      {obj.shape === 'rect' ? (
        <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height}
          rx={8} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
      ) : (
        <ellipse cx={cx} cy={cy} rx={obj.width / 2} ry={obj.height / 2}
          fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
      )}
      {/* Delete button */}
      <circle cx={delX} cy={delY} r={11} fill="#ef4444"
        data-del="1"
        style={{ cursor: 'pointer', opacity: 0 }}
        className="shape-del-bg"
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}
      />
      <text x={delX} y={delY} textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fill="#fff" fontWeight={700} fontFamily="sans-serif"
        data-del="1"
        style={{ cursor: 'pointer', opacity: 0, userSelect: 'none' }}
        className="shape-del-txt"
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}
      >×</text>
      {/* Hover shows delete: CSS trick via grouping */}
      <style>{`g:hover .shape-del-bg, g:hover .shape-del-txt { opacity: 1; }`}</style>
    </g>
  );
};

/* ── Arrow ─────────────────────────────────────────────────────────────── */
interface ArrowProps {
  obj: ArrowObject;
  onDelete: (id: string) => void;
}

export const ArrowEl: React.FC<ArrowProps> = ({ obj, onDelete }) => {
  const dx = obj.x2 - obj.x1;
  const dy = obj.y2 - obj.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return null;

  const ux = dx / len, uy = dy / len;
  const aw = 14, ah = 9;
  const bx = obj.x2 - ux * aw, by = obj.y2 - uy * aw;
  const px = -uy, py = ux;
  const p1 = { x: bx + px * ah / 2, y: by + py * ah / 2 };
  const p2 = { x: bx - px * ah / 2, y: by - py * ah / 2 };
  const mx = (obj.x1 + obj.x2) / 2;
  const my = (obj.y1 + obj.y2) / 2;

  return (
    <g style={{ cursor: 'default' }}>
      <line x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2}
        stroke={obj.color} strokeWidth={obj.size} strokeLinecap="round" />
      <polygon points={`${obj.x2},${obj.y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={obj.color} />
      <circle cx={mx} cy={my} r={10} fill="#ef4444" opacity={0} className="arrow-del"
        style={{ cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }} />
      <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#fff" fontWeight={700} fontFamily="sans-serif"
        opacity={0} className="arrow-del-txt"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}>×</text>
      <style>{`g:hover .arrow-del, g:hover .arrow-del-txt { opacity: 1; }`}</style>
    </g>
  );
};
