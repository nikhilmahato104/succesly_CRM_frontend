import React, { useRef, useState, useCallback } from 'react';
import { ImageObject, ToolType } from './types';

interface Props {
  obj:         ImageObject;
  tool:        ToolType;
  getCamScale: () => number;
  onMoveEnd:   (id: string, x: number, y: number) => void;
  onDelete:    (id: string) => void;
  onResize:    (id: string, x: number, y: number, w: number, h: number) => void;
  onRemoveBg:  (id: string) => void;
}

// Only intercept in select mode — hand tool and draw tools must pan/draw through images.
const INTERACT_TOOLS: ToolType[] = ['select'];

// 8-handle set: 4 corners (aspect-ratio locked) + 4 mid-edges (single-axis free)
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = typeof HANDLES[number];

const BoardImageObject: React.FC<Props> = ({
  obj, tool, getCamScale, onMoveEnd, onDelete, onResize, onRemoveBg,
}) => {
  const divRef  = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const canInteract = INTERACT_TOOLS.includes(tool);

  /* ── Drag to move ─────────────────────────────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canInteract) return;
    if ((e.target as HTMLElement).dataset.action) return;
    e.preventDefault();
    e.stopPropagation();

    const div     = divRef.current; if (!div) return;
    const startX  = obj.x,      startY  = obj.y;
    const startMX = e.clientX,  startMY = e.clientY;

    const onMouseMove = (mv: MouseEvent) => {
      const s = getCamScale();
      div.style.left = `${startX + (mv.clientX - startMX) / s}px`;
      div.style.top  = `${startY + (mv.clientY - startMY) / s}px`;
    };
    const onMouseUp = (mu: MouseEvent) => {
      const s = getCamScale();
      onMoveEnd(obj.id, startX + (mu.clientX - startMX) / s, startY + (mu.clientY - startMY) / s);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }, [canInteract, obj.id, obj.x, obj.y, getCamScale, onMoveEnd]);

  /* ── Drag handle to resize ────────────────────────────────────────────── */
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();

    const startMX = e.clientX, startMY = e.clientY;
    const startX  = obj.x,     startY  = obj.y;
    const startW  = obj.width,  startH  = obj.height;
    const aspect  = startW / Math.max(1, startH);
    const MIN     = 40;

    const onMouseMove = (mv: MouseEvent) => {
      const s  = getCamScale();
      const dx = (mv.clientX - startMX) / s;
      const dy = (mv.clientY - startMY) / s;
      let nx = startX, ny = startY, nw = startW, nh = startH;

      // Corners — aspect-ratio locked
      if (handle === 'se') {
        nw = Math.max(MIN, startW + dx); nh = nw / aspect;
      } else if (handle === 'sw') {
        nw = Math.max(MIN, startW - dx); nh = nw / aspect;
        nx = startX + startW - nw;
      } else if (handle === 'ne') {
        nw = Math.max(MIN, startW + dx); nh = nw / aspect;
        ny = startY + startH - nh;
      } else if (handle === 'nw') {
        nw = Math.max(MIN, startW - dx); nh = nw / aspect;
        nx = startX + startW - nw; ny = startY + startH - nh;

      // Mid-edges — aspect-ratio locked (width or height drives the other)
      } else if (handle === 'e') {
        nw = Math.max(MIN, startW + dx); nh = nw / aspect;
      } else if (handle === 'w') {
        nw = Math.max(MIN, startW - dx); nh = nw / aspect;
        nx = startX + startW - nw;
      } else if (handle === 's') {
        nh = Math.max(MIN, startH + dy); nw = nh * aspect;
      } else if (handle === 'n') {
        nh = Math.max(MIN, startH - dy); nw = nh * aspect;
        ny = startY + startH - nh;
      }

      onResize(obj.id, Math.round(nx), Math.round(ny), Math.round(nw), Math.round(nh));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }, [obj.id, obj.x, obj.y, obj.width, obj.height, getCamScale, onResize]);

  return (
    <div
      ref={divRef}
      className={`fj-imgobj${hovered && canInteract ? ' hovered' : ''}`}
      style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {obj.uploading && (
        <div className="fj-imgobj-uploading">
          <div className="fj-imgobj-spinner" />
        </div>
      )}

      {hovered && canInteract && !obj.uploading && (
        <>
          {/* Delete button — top-right */}
          <button
            className="fj-imgobj-del"
            data-action="del"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(obj.id); }}
            aria-label="Delete image"
          >×</button>

          {/* Remove background — bottom center floating label */}
          <button
            className="fj-imgobj-removebg"
            data-action="removebg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemoveBg(obj.id); }}
            title="Remove background (AI)"
          >Remove BG</button>

          {/* 8 resize handles */}
          {HANDLES.map(h => (
            <div
              key={h}
              className={`fj-imgobj-handle fj-imgobj-handle-${h}`}
              onMouseDown={e => { e.stopPropagation(); handleResizeStart(e, h); }}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default React.memo(BoardImageObject, (prev, next) =>
  prev.obj.id        === next.obj.id        &&
  prev.obj.x         === next.obj.x         &&
  prev.obj.y         === next.obj.y         &&
  prev.obj.width     === next.obj.width     &&
  prev.obj.height    === next.obj.height    &&
  prev.obj.url       === next.obj.url       &&
  prev.obj.uploading === next.obj.uploading &&
  prev.tool          === next.tool
);
