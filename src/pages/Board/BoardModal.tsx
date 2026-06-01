import React, { useRef, useCallback } from 'react';
import { ShapeObject, ArrowObject } from './types';

/* ── ShapeEl — direct DOM drag, no React re-renders during move ───────────── */
interface ShapeProps {
  obj:       ShapeObject;
  getCamScale: () => number;
  onDelete:  (id: string) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
}

export const ShapeEl: React.FC<ShapeProps> = React.memo(({ obj, getCamScale, onDelete, onMoveEnd }) => {
  const gRef = useRef<SVGGElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGElement>) => {
    const el = e.target as SVGElement;
    if (el.dataset.del) return;
    e.stopPropagation();

    const g = gRef.current; if (!g) return;
    const startX = obj.x, startY = obj.y;
    const startMX = e.clientX, startMY = e.clientY;

    const onMove = (mv: MouseEvent) => {
      const scale = getCamScale();
      const dx = (mv.clientX - startMX) / scale;
      const dy = (mv.clientY - startMY) / scale;
      g.setAttribute('transform', `translate(${dx},${dy})`);
    };
    const onUp = (mu: MouseEvent) => {
      g.removeAttribute('transform');
      const scale = getCamScale();
      onMoveEnd(obj.id, startX + (mu.clientX - startMX) / scale, startY + (mu.clientY - startMY) / scale);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [obj.id, obj.x, obj.y, getCamScale, onMoveEnd]);

  const cx = obj.x + obj.width / 2, cy = obj.y + obj.height / 2;

  return (
    <g ref={gRef} style={{ cursor: 'move' }} onMouseDown={handleMouseDown}>
      {obj.shape === 'rect'
        ? <rect x={obj.x} y={obj.y} width={obj.width} height={obj.height} rx={8}
            fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />
        : <ellipse cx={cx} cy={cy} rx={obj.width/2} ry={obj.height/2}
            fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />}
      {/* Invisible larger hit area for delete */}
      <circle cx={obj.x + obj.width} cy={obj.y} r={12} fill="#ef4444" opacity={0}
        data-del="1" style={{ cursor: 'pointer', transition: 'opacity .15s' }}
        className="shape-del"
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }} />
      <text x={obj.x + obj.width} y={obj.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fill="#fff" fontWeight={700} fontFamily="sans-serif"
        data-del="1" opacity={0} className="shape-del"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}>×</text>
      <style>{`g:hover .shape-del { opacity: 1 !important; }`}</style>
    </g>
  );
});

/* ── ArrowEl ──────────────────────────────────────────────────────────────── */
interface ArrowProps {
  obj:      ArrowObject;
  onDelete: (id: string) => void;
}

export const ArrowEl: React.FC<ArrowProps> = React.memo(({ obj, onDelete }) => {
  const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
  const len = Math.hypot(dx, dy); if (len < 4) return null;
  const ux = dx/len, uy = dy/len, aw = 14, ah = 9;
  const bx = obj.x2 - ux*aw, by = obj.y2 - uy*aw;
  const px = -uy, py = ux;
  const mx = (obj.x1 + obj.x2) / 2, my = (obj.y1 + obj.y2) / 2;

  return (
    <g>
      <line x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2}
        stroke={obj.color} strokeWidth={obj.size} strokeLinecap="round" />
      <polygon points={`${obj.x2},${obj.y2} ${bx+px*ah/2},${by+py*ah/2} ${bx-px*ah/2},${by-py*ah/2}`}
        fill={obj.color} />
      <circle cx={mx} cy={my} r={10} fill="#ef4444" opacity={0} className="arrow-del"
        style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDelete(obj.id); }} />
      <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#fff" fontWeight={700} fontFamily="sans-serif"
        opacity={0} className="arrow-del"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={e => { e.stopPropagation(); onDelete(obj.id); }}>×</text>
      <style>{`g:hover .arrow-del { opacity: 1 !important; }`}</style>
    </g>
  );
});
