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

/* ─── Canvas helpers ─────────────────────────────────────────────────────── */

const DOT_SPACING = 28; // constant screen-pixels between dots
const DOT_R       = 1.3;

function drawDots(ctx: CanvasRenderingContext2D, W: number, H: number, cam: Camera) {
  // Dots live in SCREEN space — they shift with pan but never scale with zoom
  const ox = ((cam.x % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  const oy = ((cam.y % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  ctx.fillStyle = '#c9d4de';
  for (let sx = ox - DOT_SPACING; sx <= W + DOT_SPACING; sx += DOT_SPACING)
    for (let sy = oy - DOT_SPACING; sy <= H + DOT_SPACING; sy += DOT_SPACING) {
      ctx.beginPath();
      ctx.arc(sx, sy, DOT_R, 0, Math.PI * 2);
      ctx.fill();
    }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: DrawStroke) {
  if (s.points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth   = s.size;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) {
    const mx = (s.points[i - 1].x + s.points[i].x) / 2;
    const my = (s.points[i - 1].y + s.points[i].y) / 2;
    ctx.quadraticCurveTo(s.points[i - 1].x, s.points[i - 1].y, mx, my);
  }
  ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

function drawShapeOnCanvas(ctx: CanvasRenderingContext2D, s: ShapeObject) {
  ctx.save();
  ctx.strokeStyle = s.stroke;
  ctx.fillStyle   = s.fill;
  ctx.lineWidth   = s.strokeWidth;
  ctx.beginPath();
  if (s.shape === 'rect') ctx.roundRect(s.x, s.y, s.width, s.height, 8);
  else ctx.ellipse(s.x + s.width / 2, s.y + s.height / 2, s.width / 2, s.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ─── Coordinate conversion ──────────────────────────────────────────────── */

function screenToWorld(sx: number, sy: number, c: Camera): Point {
  return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale };
}

function getPoint(e: React.MouseEvent, rect: DOMRect, c: Camera): Point {
  return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, c);
}

/* ─── Zoom helpers ───────────────────────────────────────────────────────── */

function zoomAt(c: Camera, mx: number, my: number, factor: number): Camera {
  const newScale = Math.max(0.05, Math.min(5, c.scale * factor));
  return {
    scale: newScale,
    x: mx - (mx - c.x) * (newScale / c.scale),
    y: my - (my - c.y) * (newScale / c.scale),
  };
}

/* ─── ID counter ─────────────────────────────────────────────────────────── */
let _id = Date.now();
const uid = () => `c${++_id}`;

/* ─── Component ──────────────────────────────────────────────────────────── */
export interface CanvasHandle {
  undo: () => void;
  clearAll: () => void;
  getCamera: () => Camera;
  setCamera: (c: Camera) => void;
}

interface Props {
  tool:       ToolType;
  color:      string;
  size:       number;
  objects:    CanvasObject[];
  onObjects:  (o: CanvasObject[]) => void;
  onAddObject:(wx: number, wy: number) => void;
  isPanning:  boolean;
  onCamScale: (s: number) => void;
}

const BoardCanvas = forwardRef<CanvasHandle, Props>(({
  tool, color, size, objects, onObjects, onAddObject, isPanning, onCamScale,
}, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef(0);

  // ── Camera: stored in ref → zero React re-renders during pan/zoom ─────
  const cam          = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const activeStroke = useRef<DrawStroke | null>(null);
  const isDrawing    = useRef(false);
  const panAnchor    = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const shapeAnchor  = useRef<Point | null>(null);
  const drawingShape = useRef<Partial<ShapeObject | ArrowObject> | null>(null);
  const spaceDown    = useRef(false);
  // Touch state
  const touch2Dist   = useRef(0);
  const touch2Mid    = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /* ── Apply camera directly to DOM overlays (no React re-render) ───── */
  const applyTransform = useCallback(() => {
    const { x, y, scale } = cam.current;
    const t = `translate(${x}px,${y}px) scale(${scale})`;
    if (overlayRef.current) {
      overlayRef.current.style.transform = t;
      overlayRef.current.style.transformOrigin = '0 0';
    }
    if (svgRef.current) {
      const g = svgRef.current.querySelector<SVGGElement>('#cam-g');
      if (g) g.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
    }
  }, []);

  /* ── RAF render ──────────────────────────────────────────────────── */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // dot grid (screen space — never zooms)
    drawDots(ctx, W, H, cam.current);

    // world-space content
    ctx.save();
    ctx.setTransform(cam.current.scale, 0, 0, cam.current.scale, cam.current.x, cam.current.y);
    objects.forEach(o => { if (o.kind === 'stroke') drawStroke(ctx, o); });
    if (activeStroke.current) drawStroke(ctx, activeStroke.current);
    if (drawingShape.current && (tool === 'rect' || tool === 'circle'))
      drawShapeOnCanvas(ctx, drawingShape.current as ShapeObject);
    if (drawingShape.current && tool === 'arrow') {
      const a = drawingShape.current as ArrowObject;
      if (a.x2 !== undefined) {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = size;
        ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }, [objects, tool, color, size]);

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  /* ── Resize canvas ────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      scheduleRender();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [scheduleRender]);

  useEffect(() => { scheduleRender(); }, [objects, scheduleRender]);

  /* ── WHEEL: two-finger scroll = PAN, ctrl/pinch = ZOOM ─────────────── */
  useEffect(() => {
    const vp = wrapRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = vp.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;

      if (e.ctrlKey) {
        // ── Pinch gesture OR Ctrl+scroll → ZOOM ───────────────────────
        // Small deltaY = smooth trackpad pinch; large = mouse wheel click
        const smoothPinch = Math.abs(e.deltaY) < 50;
        const factor = smoothPinch
          ? Math.exp(-e.deltaY * 0.008)      // smooth continuous zoom
          : e.deltaY < 0 ? 1.15 : 1 / 1.15; // discrete step zoom

        cam.current = zoomAt(cam.current, mx, my, factor);
        onCamScale(cam.current.scale);
      } else {
        // ── Two-finger scroll → PAN ────────────────────────────────────
        const lineH = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 200 : 1;
        cam.current = {
          ...cam.current,
          x: cam.current.x - e.deltaX * lineH,
          y: cam.current.y - e.deltaY * lineH,
        };
      }

      applyTransform();
      scheduleRender();
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [applyTransform, onCamScale, scheduleRender]);

  /* ── TOUCH: two-finger pinch+pan ─────────────────────────────────── */
  useEffect(() => {
    const vp = wrapRef.current;
    if (!vp) return;

    const getTouchInfo = (touches: TouchList, rect: DOMRect) => {
      const t0 = touches[0], t1 = touches[1];
      return {
        dist: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
        mx:   (t0.clientX + t1.clientX) / 2 - rect.left,
        my:   (t0.clientY + t1.clientY) / 2 - rect.top,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const r = vp.getBoundingClientRect();
        const info = getTouchInfo(e.touches, r);
        touch2Dist.current = info.dist;
        touch2Mid.current  = { x: info.mx, y: info.my };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length !== 2) return;
      const r    = vp.getBoundingClientRect();
      const info = getTouchInfo(e.touches, r);
      const prev = touch2Mid.current;

      // Zoom based on distance change
      if (touch2Dist.current > 0) {
        const factor = info.dist / touch2Dist.current;
        cam.current = zoomAt(cam.current, info.mx, info.my, factor);
        onCamScale(cam.current.scale);
      }

      // Pan based on midpoint shift
      cam.current = {
        ...cam.current,
        x: cam.current.x + (info.mx - prev.x),
        y: cam.current.y + (info.my - prev.y),
      };

      touch2Dist.current = info.dist;
      touch2Mid.current  = { x: info.mx, y: info.my };

      applyTransform();
      scheduleRender();
    };

    const onTouchEnd = () => {
      touch2Dist.current = 0;
    };

    vp.addEventListener('touchstart', onTouchStart, { passive: false });
    vp.addEventListener('touchmove',  onTouchMove,  { passive: false });
    vp.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove',  onTouchMove);
      vp.removeEventListener('touchend',   onTouchEnd);
    };
  }, [applyTransform, onCamScale, scheduleRender]);

  /* ── Spacebar for temporary pan mode ────────────────────────────── */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLTextAreaElement))
        spaceDown.current = true;
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  /* ── Imperative API ──────────────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    undo:      () => { if (objects.length) onObjects(objects.slice(0, -1)); },
    clearAll:  () => { onObjects([]); scheduleRender(); },
    getCamera: () => ({ ...cam.current }),
    setCamera: (c: Camera) => {
      cam.current = c;
      applyTransform();
      onCamScale(c.scale);
      scheduleRender();
    },
  }), [objects, onObjects, scheduleRender, applyTransform, onCamScale]);

  /* ── Mouse helpers ────────────────────────────────────────────────── */
  const isPanMode = () => tool === 'hand' || spaceDown.current || isPanning;
  const getRect   = () => canvasRef.current!.getBoundingClientRect();

  /* ── mousedown ────────────────────────────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current; if (!canvas) return;

    if (isPanMode()) {
      panAnchor.current = {
        mx: e.clientX, my: e.clientY,
        cx: cam.current.x, cy: cam.current.y,
      };
      return;
    }

    const pt = getPoint(e, getRect(), cam.current);

    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      isDrawing.current = true;
      activeStroke.current = {
        id: uid(), kind: 'stroke', points: [pt],
        color: tool === 'eraser' ? '#f0f0f0' : color,
        size:  tool === 'eraser' ? size * 5 : tool === 'marker' ? size * 2.5 : size,
        opacity: tool === 'marker' ? 0.5 : 1,
      };
      return;
    }

    if (tool === 'rect' || tool === 'circle') {
      shapeAnchor.current  = pt;
      drawingShape.current = {
        id: uid(), kind: 'shape', shape: tool,
        x: pt.x, y: pt.y, width: 0, height: 0,
        stroke: color, fill: `${color}18`, strokeWidth: size,
      };
      return;
    }

    if (tool === 'arrow') {
      shapeAnchor.current  = pt;
      drawingShape.current = { id: uid(), kind: 'arrow', x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color, size };
    }
  }, [tool, color, size, isPanning]);

  /* ── mousemove ────────────────────────────────────────────────────── */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panAnchor.current) {
      cam.current = {
        ...cam.current,
        x: panAnchor.current.cx + (e.clientX - panAnchor.current.mx),
        y: panAnchor.current.cy + (e.clientY - panAnchor.current.my),
      };
      applyTransform();
      scheduleRender();
      return;
    }

    const canvas = canvasRef.current; if (!canvas) return;
    const pt = getPoint(e, getRect(), cam.current);

    if (isDrawing.current && activeStroke.current) {
      activeStroke.current = { ...activeStroke.current, points: [...activeStroke.current.points, pt] };
      scheduleRender();
      return;
    }

    if ((tool === 'rect' || tool === 'circle') && shapeAnchor.current && drawingShape.current) {
      const s = shapeAnchor.current;
      drawingShape.current = {
        ...drawingShape.current,
        x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y),
        width: Math.abs(pt.x - s.x), height: Math.abs(pt.y - s.y),
      };
      scheduleRender();
      return;
    }

    if (tool === 'arrow' && shapeAnchor.current && drawingShape.current) {
      drawingShape.current = { ...drawingShape.current, x2: pt.x, y2: pt.y };
      scheduleRender();
    }
  }, [tool, applyTransform, scheduleRender]);

  /* ── mouseup ──────────────────────────────────────────────────────── */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    panAnchor.current = null;

    if (isDrawing.current && activeStroke.current) {
      isDrawing.current = false;
      if (activeStroke.current.points.length > 1)
        onObjects([...objects, activeStroke.current]);
      activeStroke.current = null;
      scheduleRender();
      return;
    }

    if ((tool === 'rect' || tool === 'circle') && drawingShape.current) {
      const s = drawingShape.current as ShapeObject;
      if (s.width > 4 && s.height > 4)
        onObjects([...objects, { ...s, kind: 'shape' }]);
      shapeAnchor.current  = null;
      drawingShape.current = null;
      scheduleRender();
      return;
    }

    if (tool === 'arrow' && drawingShape.current) {
      const a = drawingShape.current as ArrowObject;
      if (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 10)
        onObjects([...objects, { ...a, kind: 'arrow' }]);
      shapeAnchor.current  = null;
      drawingShape.current = null;
      scheduleRender();
    }
  }, [tool, objects, onObjects, scheduleRender]);

  /* ── click: place sticky / text ──────────────────────────────────── */
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'sticky' || tool === 'text') {
      const pt = getPoint(e, getRect(), cam.current);
      onAddObject(pt.x, pt.y);
    }
  }, [tool, onAddObject]);

  /* ── Object mutations ────────────────────────────────────────────── */
  const moveObj = useCallback((id: string, dx: number, dy: number) =>
    onObjects(objects.map(o => {
      if (o.id !== id) return o;
      if (o.kind === 'sticky' || o.kind === 'text' || o.kind === 'shape')
        return { ...o, x: o.x + dx, y: o.y + dy };
      if (o.kind === 'arrow') {
        const a = o as ArrowObject;
        return { ...a, x1: a.x1+dx, y1: a.y1+dy, x2: a.x2+dx, y2: a.y2+dy };
      }
      return o;
    })), [objects, onObjects]);

  const deleteObj  = useCallback((id: string) => onObjects(objects.filter(o => o.id !== id)), [objects, onObjects]);
  const updateText = useCallback((id: string, t: string) => onObjects(objects.map(o => o.id === id ? { ...o, text: t } : o)), [objects, onObjects]);
  const updateColor= useCallback((id: string, c: NoteColor) => onObjects(objects.map(o => o.id === id ? { ...o, color: c } : o)), [objects, onObjects]);

  const cursorCls  = isPanMode() ? (panAnchor.current ? 'panning' : 'tool-hand') : `tool-${tool}`;

  const stickyNotes = objects.filter(o => o.kind === 'sticky') as StickyNote[];
  const textObjs    = objects.filter(o => o.kind === 'text')   as TextObject[];
  const shapeObjs   = objects.filter(o => o.kind === 'shape')  as ShapeObject[];
  const arrowObjs   = objects.filter(o => o.kind === 'arrow')  as ArrowObject[];

  return (
    <div
      ref={wrapRef}
      className={`fj-viewport ${cursorCls}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {/* The drawing canvas — fills viewport, never transforms */}
      <canvas ref={canvasRef} className="fj-canvas" />

      {/* SVG shapes layer */}
      <svg
        ref={svgRef}
        className="fj-svg"
        style={{ width:'100%', height:'100%', position:'absolute', top:0, left:0, overflow:'visible', pointerEvents:'none' }}
      >
        <g id="cam-g">
          {shapeObjs.map(s => <ShapeEl key={s.id} obj={s} camScale={cam.current.scale} onDelete={deleteObj} onMove={moveObj} />)}
          {arrowObjs.map(a => <ArrowEl key={a.id} obj={a} onDelete={deleteObj} />)}
        </g>
      </svg>

      {/* HTML overlay: sticky notes + text */}
      <div ref={overlayRef} className="fj-overlay">
        {stickyNotes.map(n => (
          <BoardCard key={n.id} note={n} camScale={cam.current.scale}
            onChange={updateText} onDelete={deleteObj} onMove={moveObj} onColor={updateColor} />
        ))}
        {textObjs.map(t => (
          <BoardColumn key={t.id} obj={t} camScale={cam.current.scale}
            onChange={updateText} onDelete={deleteObj} onMove={moveObj} />
        ))}
      </div>
    </div>
  );
});

BoardCanvas.displayName = 'BoardCanvas';
export default BoardCanvas;
