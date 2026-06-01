import React, {
  useRef, useEffect, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import {
  ToolType, CanvasObject, DrawStroke, StickyNote, TextObject, ShapeObject, ArrowObject,
  Camera, Point, NoteColor,
} from './types';
import BoardCard from './BoardCard';
import BoardColumn from './BoardColumn';
import { ShapeEl, ArrowEl } from './BoardModal';

/* ─── World bounds ───────────────────────────────────────────────────────── */
const WB = { minX: -3000, maxX: 7000, minY: -2000, maxY: 5000 };

function clampCam(c: Camera, W: number, H: number): Camera {
  const pad = 80;
  return {
    ...c,
    x: Math.max(W  - pad - WB.maxX * c.scale, Math.min(-WB.minX * c.scale + pad, c.x)),
    y: Math.max(H  - pad - WB.maxY * c.scale, Math.min(-WB.minY * c.scale + pad, c.y)),
  };
}

/* ─── Drawing helpers ────────────────────────────────────────────────────── */
const DOT_SPACING = 28;

/** Fast dots — fillRect (2×2 px) is ~8× faster than arc() */
function drawDots(ctx: CanvasRenderingContext2D, W: number, H: number, cam: Camera) {
  const ox = ((cam.x % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  const oy = ((cam.y % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  ctx.fillStyle = '#d4d4d4';
  for (let sx = ox - DOT_SPACING; sx <= W + DOT_SPACING; sx += DOT_SPACING)
    for (let sy = oy - DOT_SPACING; sy <= H + DOT_SPACING; sy += DOT_SPACING)
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
}

function drawStroke(ctx: CanvasRenderingContext2D, s: DrawStroke) {
  if (s.points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth   = s.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) {
    const mx = (s.points[i-1].x + s.points[i].x) / 2;
    const my = (s.points[i-1].y + s.points[i].y) / 2;
    ctx.quadraticCurveTo(s.points[i-1].x, s.points[i-1].y, mx, my);
  }
  ctx.lineTo(s.points[s.points.length-1].x, s.points[s.points.length-1].y);
  ctx.stroke();
  ctx.restore();
}

function drawShapePreview(ctx: CanvasRenderingContext2D, s: ShapeObject) {
  ctx.save();
  ctx.strokeStyle = s.stroke; ctx.fillStyle = s.fill; ctx.lineWidth = s.strokeWidth;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  if (s.shape === 'rect') ctx.roundRect(s.x, s.y, s.width, s.height, 8);
  else ctx.ellipse(s.x + s.width/2, s.y + s.height/2, s.width/2, s.height/2, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* ─── Coord helpers ──────────────────────────────────────────────────────── */
function screenToWorld(sx: number, sy: number, c: Camera): Point {
  return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale };
}
function zoomAt(c: Camera, mx: number, my: number, factor: number): Camera {
  const ns = Math.max(0.05, Math.min(5, c.scale * factor));
  return { scale: ns, x: mx - (mx - c.x) * ns / c.scale, y: my - (my - c.y) * ns / c.scale };
}

let _id = Date.now();
const uid = () => `c${++_id}`;

/* ─── Handle ─────────────────────────────────────────────────────────────── */
export interface CanvasHandle {
  undo:      () => void;
  clearAll:  () => void;
  getCamera: () => Camera;
  setCamera: (c: Camera) => void;
}

interface Props {
  tool: ToolType; color: string; size: number;
  objects:    CanvasObject[];
  onObjects:  React.Dispatch<React.SetStateAction<CanvasObject[]>>;
  onAddObject:(wx: number, wy: number) => void;
  isPanning:  boolean;
  onCamScale: (s: number) => void;
}

const BoardCanvas = forwardRef<CanvasHandle, Props>(({
  tool, color, size, objects, onObjects, onAddObject, isPanning, onCamScale,
}, ref) => {
  /* ── Two canvas refs:
       bgCanvas  = dots + committed strokes  (never erased during active drawing)
       actCanvas = current stroke being drawn (transparent overlay, fast clear)       */
  const bgCanvasRef  = useRef<HTMLCanvasElement>(null);
  const actCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const wrapRef      = useRef<HTMLDivElement>(null);
  const sbXThumb     = useRef<HTMLDivElement>(null);
  const sbYThumb     = useRef<HTMLDivElement>(null);
  const rafDraw      = useRef(0);  // for bg canvas
  const rafAct       = useRef(0);  // for active canvas

  const cam          = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const objectsRef   = useRef<CanvasObject[]>(objects); // always current, bypasses React closure
  const activeStroke = useRef<DrawStroke | null>(null);
  const isDrawing    = useRef(false);
  const panAnchor    = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const shapeAnchor  = useRef<Point | null>(null);
  const drawingShape = useRef<Partial<ShapeObject | ArrowObject> | null>(null);
  const spaceDown    = useRef(false);
  const touch2Dist   = useRef(0);
  const touch2Mid    = useRef({ x: 0, y: 0 });

  // Keep objectsRef synced without triggering re-renders
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  const getCamScale  = useCallback(() => cam.current.scale, []);

  /* ── applyTransform: updates overlay divs/svg directly ──────────────── */
  const applyTransform = useCallback(() => {
    const { x, y, scale } = cam.current;
    const t = `translate(${x}px,${y}px) scale(${scale})`;
    if (overlayRef.current) { overlayRef.current.style.transform = t; overlayRef.current.style.transformOrigin = '0 0'; }
    const g = svgRef.current?.querySelector<SVGGElement>('#cam-g');
    if (g) g.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);

    const vp = wrapRef.current;
    if (!vp || !sbXThumb.current || !sbYThumb.current) return;
    const W = vp.clientWidth, H = vp.clientHeight;
    const ww = WB.maxX - WB.minX, wh = WB.maxY - WB.minY;
    const visW = W / scale, visH = H / scale;
    const tw = Math.max(40, W * Math.min(1, visW / ww));
    const th = Math.max(40, H * Math.min(1, visH / wh));
    const lw = (-x / scale - WB.minX) / ww, lh = (-y / scale - WB.minY) / wh;
    sbXThumb.current.style.width  = `${tw}px`;
    sbXThumb.current.style.left   = `${Math.max(0, Math.min(W - tw, lw * W))}px`;
    sbYThumb.current.style.height = `${th}px`;
    sbYThumb.current.style.top    = `${Math.max(0, Math.min(H - th, lh * H))}px`;
  }, []);

  /* ── bgCanvas: dots + ALL committed strokes (full rebuild) ───────────── */
  const rebuildBg = useCallback(() => {
    const canvas = bgCanvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const { x, y, scale } = cam.current;

    ctx.clearRect(0, 0, W, H);
    drawDots(ctx, W, H, cam.current);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, x, y);
    objectsRef.current.forEach(o => { if (o?.kind === 'stroke') drawStroke(ctx, o); });
    ctx.restore();
  }, []);

  const scheduleBg = useCallback(() => {
    cancelAnimationFrame(rafDraw.current);
    rafDraw.current = requestAnimationFrame(rebuildBg);
  }, [rebuildBg]);

  /* ── actCanvas: ONLY the current stroke (fast, transparent) ──────────── */
  const renderActive = useCallback(() => {
    const canvas = actCanvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext('2d'); if (!ctx) return;
    const { x, y, scale } = cam.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (activeStroke.current) {
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, x, y);
      drawStroke(ctx, activeStroke.current);
      ctx.restore();
    }
    // Shape preview
    if (drawingShape.current && (tool === 'rect' || tool === 'circle')) {
      const s = drawingShape.current as ShapeObject;
      if (s.width && s.height) {
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, x, y);
        drawShapePreview(ctx, s);
        ctx.restore();
      }
    }
    // Arrow preview
    if (drawingShape.current && tool === 'arrow') {
      const a = drawingShape.current as ArrowObject;
      if (a.x2 !== undefined) {
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, x, y);
        ctx.strokeStyle = color; ctx.lineWidth = size; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        ctx.restore();
      }
    }
  }, [tool, color, size]);

  const scheduleActive = useCallback(() => {
    cancelAnimationFrame(rafAct.current);
    rafAct.current = requestAnimationFrame(renderActive);
  }, [renderActive]);

  /* ── Resize both canvases when viewport changes ──────────────────────── */
  useEffect(() => {
    const bg  = bgCanvasRef.current;
    const act = actCanvasRef.current;
    if (!bg || !act) return;
    const ro = new ResizeObserver(() => {
      bg.width  = bg.clientWidth;   bg.height  = bg.clientHeight;
      act.width = act.clientWidth;  act.height = act.clientHeight;
      rebuildBg();
    });
    ro.observe(bg);
    return () => ro.disconnect();
  }, [rebuildBg]);

  /* ── Rebuild bg when committed objects change ────────────────────────── */
  useEffect(() => {
    scheduleBg();
  }, [objects, scheduleBg]);

  /* ── Wheel: scroll=pan, ctrl/pinch=zoom ──────────────────────────────── */
  useEffect(() => {
    const vp = wrapRef.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (e.ctrlKey) {
        const smooth = Math.abs(e.deltaY) < 50;
        const factor = smooth ? Math.exp(-e.deltaY * 0.008) : e.deltaY < 0 ? 1.15 : 1/1.15;
        cam.current = clampCam(zoomAt(cam.current, mx, my, factor), vp.clientWidth, vp.clientHeight);
        onCamScale(cam.current.scale);
      } else {
        const lh = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 200 : 1;
        cam.current = clampCam({ ...cam.current, x: cam.current.x - e.deltaX * lh, y: cam.current.y - e.deltaY * lh }, vp.clientWidth, vp.clientHeight);
      }
      applyTransform();
      scheduleBg();
      scheduleActive();
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [applyTransform, onCamScale, scheduleBg, scheduleActive]);

  /* ── Touch ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const vp = wrapRef.current; if (!vp) return;
    const info = (ts: TouchList, r: DOMRect) => ({
      dist: Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY),
      mx:  (ts[0].clientX + ts[1].clientX) / 2 - r.left,
      my:  (ts[0].clientY + ts[1].clientY) / 2 - r.top,
    });
    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const r = vp.getBoundingClientRect(), i = info(e.touches, r);
        touch2Dist.current = i.dist; touch2Mid.current = { x: i.mx, y: i.my };
      }
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length !== 2) return;
      const r = vp.getBoundingClientRect(), i = info(e.touches, r);
      if (touch2Dist.current > 0) { cam.current = clampCam(zoomAt(cam.current, i.mx, i.my, i.dist / touch2Dist.current), vp.clientWidth, vp.clientHeight); onCamScale(cam.current.scale); }
      cam.current = clampCam({ ...cam.current, x: cam.current.x + i.mx - touch2Mid.current.x, y: cam.current.y + i.my - touch2Mid.current.y }, vp.clientWidth, vp.clientHeight);
      touch2Dist.current = i.dist; touch2Mid.current = { x: i.mx, y: i.my };
      applyTransform(); scheduleBg(); scheduleActive();
    };
    vp.addEventListener('touchstart', onStart, { passive: false });
    vp.addEventListener('touchmove',  onMove,  { passive: false });
    return () => { vp.removeEventListener('touchstart', onStart); vp.removeEventListener('touchmove', onMove); };
  }, [applyTransform, onCamScale, scheduleBg, scheduleActive]);

  /* ── Spacebar ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLTextAreaElement)) spaceDown.current = true; };
    const u = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', d); window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, []);

  /* ── Imperative API ──────────────────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    undo: () => {
      onObjects(prev => prev.slice(0, -1));
      // bg will rebuild via useEffect([objects])
    },
    clearAll: () => {
      onObjects([]);
      const ctx = bgCanvasRef.current?.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, bgCanvasRef.current!.width, bgCanvasRef.current!.height); drawDots(ctx, bgCanvasRef.current!.width, bgCanvasRef.current!.height, cam.current); }
    },
    getCamera: () => ({ ...cam.current }),
    setCamera: (c: Camera) => { cam.current = c; applyTransform(); onCamScale(c.scale); scheduleBg(); },
  }), [onObjects, applyTransform, onCamScale, scheduleBg]);

  /* ── Stable mutators (functional updates) ────────────────────────────── */
  const deleteObj   = useCallback((id: string)   => onObjects(prev => prev.filter(o => o.id !== id)), [onObjects]);
  const syncText    = useCallback((id: string, t: string) => onObjects(prev => prev.map(o => o.id === id ? { ...o, text: t } : o)), [onObjects]);
  const setAbsPos   = useCallback((id: string, nx: number, ny: number) =>
    onObjects(prev => prev.map(o => {
      if (o.id !== id) return o;
      if (o.kind === 'sticky' || o.kind === 'text' || o.kind === 'shape') return { ...o, x: nx, y: ny };
      if (o.kind === 'arrow') { const a = o as ArrowObject; const dx = nx-a.x1, dy = ny-a.y1; return { ...a, x1: a.x1+dx, y1: a.y1+dy, x2: a.x2+dx, y2: a.y2+dy }; }
      return o;
    })), [onObjects]);
  const doFormat    = useCallback((id: string, props: Partial<TextObject>) => onObjects(prev => prev.map(o => o.id === id ? { ...o, ...props } : o)), [onObjects]);
  const updateColor = useCallback((id: string, c: NoteColor) => onObjects(prev => prev.map(o => o.id === id ? { ...o, color: c } : o)), [onObjects]);

  /* ── Mouse helpers ───────────────────────────────────────────────────── */
  const isPanMode = () => tool === 'hand' || spaceDown.current || isPanning;
  const ptFrom = (e: React.MouseEvent) => {
    const rect = bgCanvasRef.current!.getBoundingClientRect();
    return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, cam.current);
  };

  /* ── mousedown ───────────────────────────────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isPanMode()) { panAnchor.current = { mx: e.clientX, my: e.clientY, cx: cam.current.x, cy: cam.current.y }; return; }
    const pt = ptFrom(e);
    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      isDrawing.current = true;
      activeStroke.current = {
        id: uid(), kind: 'stroke', points: [pt],
        color: tool === 'eraser' ? '#f5f5f5' : color,
        size:  tool === 'eraser' ? size*5 : tool === 'marker' ? size*2.5 : size,
        opacity: tool === 'marker' ? 0.45 : 1,
      };
      return;
    }
    if (tool === 'rect' || tool === 'circle') {
      shapeAnchor.current  = pt;
      drawingShape.current = { id: uid(), kind: 'shape', shape: tool, x: pt.x, y: pt.y, width: 0, height: 0, stroke: color, fill: `${color}14`, strokeWidth: size };
      return;
    }
    if (tool === 'arrow') {
      shapeAnchor.current  = pt;
      drawingShape.current = { id: uid(), kind: 'arrow', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color, size };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, size, isPanning]);

  /* ── mousemove ───────────────────────────────────────────────────────── */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panAnchor.current) {
      const vp = wrapRef.current;
      cam.current = clampCam({ ...cam.current, x: panAnchor.current.cx + (e.clientX - panAnchor.current.mx), y: panAnchor.current.cy + (e.clientY - panAnchor.current.my) }, vp?.clientWidth ?? 1400, vp?.clientHeight ?? 800);
      applyTransform();
      // Rebuild bg for dot offset change
      cancelAnimationFrame(rafDraw.current);
      rafDraw.current = requestAnimationFrame(rebuildBg);
      return;
    }
    const pt = ptFrom(e);
    if (isDrawing.current && activeStroke.current) {
      activeStroke.current = { ...activeStroke.current, points: [...activeStroke.current.points, pt] };
      scheduleActive(); return;
    }
    if ((tool === 'rect' || tool === 'circle') && shapeAnchor.current && drawingShape.current) {
      const s = shapeAnchor.current;
      drawingShape.current = { ...drawingShape.current, x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y), width: Math.abs(pt.x - s.x), height: Math.abs(pt.y - s.y) };
      scheduleActive(); return;
    }
    if (tool === 'arrow' && shapeAnchor.current && drawingShape.current) {
      drawingShape.current = { ...drawingShape.current, x2: pt.x, y2: pt.y };
      scheduleActive();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, applyTransform, rebuildBg, scheduleActive]);

  /* ── mouseup ─────────────────────────────────────────────────────────── */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    panAnchor.current = null;

    /* ── Commit pen/marker/eraser stroke ──────────────────────────────── */
    if (isDrawing.current && activeStroke.current) {
      isDrawing.current = false;
      const committed = { ...activeStroke.current, points: [...activeStroke.current.points] };

      if (committed.points.length > 1) {
        // 1️⃣ Draw directly onto bgCanvas — no React state involved, zero lag
        const bgCtx = bgCanvasRef.current?.getContext('2d');
        if (bgCtx) {
          bgCtx.save();
          bgCtx.setTransform(cam.current.scale, 0, 0, cam.current.scale, cam.current.x, cam.current.y);
          drawStroke(bgCtx, committed);
          bgCtx.restore();
        }
        // 2️⃣ Clear the active canvas (stroke is now on bgCanvas — seamless!)
        activeStroke.current = null;
        cancelAnimationFrame(rafAct.current);
        rafAct.current = requestAnimationFrame(() => {
          const ctx = actCanvasRef.current?.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, actCanvasRef.current!.width, actCanvasRef.current!.height);
        });
        // 3️⃣ Persist to state for undo (no visual impact — already on bgCanvas)
        onObjects(prev => [...prev, committed]);
      } else {
        activeStroke.current = null;
      }
      return;
    }

    /* ── Commit rect / circle ─────────────────────────────────────────── */
    if ((tool === 'rect' || tool === 'circle') && drawingShape.current) {
      const s = { ...drawingShape.current } as ShapeObject;
      shapeAnchor.current = null; drawingShape.current = null;
      // Clear active canvas preview
      cancelAnimationFrame(rafAct.current);
      rafAct.current = requestAnimationFrame(() => {
        const ctx = actCanvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, actCanvasRef.current!.width, actCanvasRef.current!.height);
      });
      if (s.width > 4 && s.height > 4) onObjects(prev => [...prev, { ...s, kind: 'shape' }]);
      return;
    }

    /* ── Commit arrow ─────────────────────────────────────────────────── */
    if (tool === 'arrow' && drawingShape.current) {
      const a = { ...drawingShape.current } as ArrowObject;
      shapeAnchor.current = null; drawingShape.current = null;
      cancelAnimationFrame(rafAct.current);
      rafAct.current = requestAnimationFrame(() => {
        const ctx = actCanvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, actCanvasRef.current!.width, actCanvasRef.current!.height);
      });
      if (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 10) onObjects(prev => [...prev, { ...a, kind: 'arrow' }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, onObjects]);

  /* ── click: place sticky / text ─────────────────────────────────────── */
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'sticky' || tool === 'text') {
      const rect = bgCanvasRef.current!.getBoundingClientRect();
      const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, cam.current);
      onAddObject(pt.x, pt.y);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, onAddObject]);

  const cursorCls = isPanMode() ? (panAnchor.current ? 'panning' : 'tool-hand') : `tool-${tool}`;

  const stickyNotes = objects.filter(o => o?.kind === 'sticky') as StickyNote[];
  const textObjs    = objects.filter(o => o?.kind === 'text')   as TextObject[];
  const shapeObjs   = objects.filter(o => o?.kind === 'shape')  as ShapeObject[];
  const arrowObjs   = objects.filter(o => o?.kind === 'arrow')  as ArrowObject[];

  return (
    <div
      ref={wrapRef}
      className={`fj-viewport ${cursorCls}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {/* Background canvas: dots + committed strokes. Never erased during drawing. */}
      <canvas ref={bgCanvasRef}  className="fj-canvas" style={{ background: '#f5f5f5' }} />

      {/* Active canvas: current stroke only. Transparent overlay. */}
      <canvas
        ref={actCanvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}
      />

      {/* SVG shapes */}
      <svg ref={svgRef} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }}>
        <g id="cam-g">
          {shapeObjs.map(s => <ShapeEl key={s.id} obj={s} getCamScale={getCamScale} onDelete={deleteObj} onMoveEnd={setAbsPos} />)}
          {arrowObjs.map(a => <ArrowEl key={a.id} obj={a} onDelete={deleteObj} />)}
        </g>
      </svg>

      {/* HTML overlay: sticky notes + text */}
      <div ref={overlayRef} className="fj-overlay">
        {stickyNotes.map(n => (
          <BoardCard key={n.id} note={n} getCamScale={getCamScale}
            onSync={syncText} onMoveEnd={setAbsPos} onDelete={deleteObj} onColor={updateColor} />
        ))}
        {textObjs.map(t => (
          <BoardColumn key={t.id} obj={t} getCamScale={getCamScale}
            onSync={syncText} onMoveEnd={setAbsPos} onDelete={deleteObj} onFormat={doFormat} />
        ))}
      </div>

      {/* Scrollbars */}
      <div className="fj-scrollbar-x"><div ref={sbXThumb} className="fj-scrollbar-thumb" style={{ height: '100%' }} /></div>
      <div className="fj-scrollbar-y"><div ref={sbYThumb} className="fj-scrollbar-thumb" style={{ width: '100%' }} /></div>
    </div>
  );
});

BoardCanvas.displayName = 'BoardCanvas';
export default BoardCanvas;
