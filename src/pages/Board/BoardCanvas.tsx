import React, {
  useRef, useEffect, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import {
  ToolType, CanvasObject, DrawStroke, StickyNote, TextObject, ShapeObject, ArrowObject, ImageObject,
  Camera, Point, NoteColor,
} from './types';
import BoardCard from './BoardCard';
import BoardColumn from './BoardColumn';
import BoardImageObject from './BoardImageObject';
import { ShapeEl, ArrowEl } from './BoardModal';

/* ─── World bounds ───────────────────────────────────────────────────────── */
const WB = { minX: -3000, maxX: 7000, minY: -2000, maxY: 5000 };

const CAM_PAD = 80; // px of world edge that must stay visible when panning

function clampCam(c: Camera, W: number, H: number): Camera {
  const wwPx = (WB.maxX - WB.minX) * c.scale;
  const whPx = (WB.maxY - WB.minY) * c.scale;
  // When world < viewport: allow free panning — user can slide world anywhere as long as
  //   at least the opposite edge is CAM_PAD inside the viewport.
  // When world > viewport: clamp so the viewport stays mostly within world bounds.
  const xLo = wwPx <= W ? CAM_PAD - WB.maxX * c.scale     : W - CAM_PAD - WB.maxX * c.scale;
  const xHi = wwPx <= W ? W - CAM_PAD - WB.minX * c.scale : CAM_PAD - WB.minX * c.scale;
  const yLo = whPx <= H ? CAM_PAD - WB.maxY * c.scale     : H - CAM_PAD - WB.maxY * c.scale;
  const yHi = whPx <= H ? H - CAM_PAD - WB.minY * c.scale : CAM_PAD - WB.minY * c.scale;
  return { ...c, x: Math.max(xLo, Math.min(xHi, c.x)), y: Math.max(yLo, Math.min(yHi, c.y)) };
}

/* ─── Drawing helpers ────────────────────────────────────────────────────── */
const DOT_WORLD  = 20;
const ZOOM_STEPS = [0.1,0.17,0.25,0.33,0.5,0.67,0.75,0.9,1,1.1,1.25,1.5,1.75,2,2.5,3,4,5];

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
  undo:              () => void;
  clearAll:          () => void;
  getCamera:         () => Camera;
  setCamera:         (c: Camera) => void;
  getSnapshot:       () => string | null;
  zoomStep:          (dir: 1 | -1) => void;
  resetZoom:         () => void;
  getViewportCenter: () => { cx: number; cy: number };
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
  const bgCanvasRef   = useRef<HTMLCanvasElement>(null);
  const actCanvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef    = useRef<HTMLDivElement>(null);
  const imgLayerRef   = useRef<HTMLDivElement>(null);   // image layer — below canvas strokes
  const dotGridRef    = useRef<HTMLDivElement>(null);
  const svgRef        = useRef<SVGSVGElement>(null);
  const wrapRef       = useRef<HTMLDivElement>(null);
  const sbXThumb      = useRef<HTMLDivElement>(null);
  const sbYThumb      = useRef<HTMLDivElement>(null);
  const rafDraw       = useRef(0);
  const rafAct        = useRef(0);

  const cam           = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const objectsRef    = useRef<CanvasObject[]>(objects);
  // imageCache is kept solely for getSnapshot (thumbnail generation)
  const imageCache    = useRef<Map<string, { url: string; img: HTMLImageElement }>>(new Map());
  const activeStroke  = useRef<DrawStroke | null>(null);
  const isDrawing     = useRef(false);
  const panAnchor     = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const shapeAnchor   = useRef<Point | null>(null);
  const drawingShape  = useRef<Partial<ShapeObject | ArrowObject> | null>(null);
  const spaceDown     = useRef(false);
  const touch2Dist    = useRef(0);
  const touch2Mid     = useRef({ x: 0, y: 0 });

  useEffect(() => { objectsRef.current = objects; }, [objects]);

  const getCamScale  = useCallback(() => cam.current.scale, []);

  /* ── applyTransform: updates all world-space overlay layers directly ──── */
  const applyTransform = useCallback(() => {
    const { x, y, scale } = cam.current;
    const t = `translate(${x}px,${y}px) scale(${scale})`;
    const origin = '0 0';

    if (overlayRef.current)  { overlayRef.current.style.transform  = t; overlayRef.current.style.transformOrigin  = origin; }
    if (imgLayerRef.current) { imgLayerRef.current.style.transform = t; imgLayerRef.current.style.transformOrigin = origin; }

    const g = svgRef.current?.querySelector<SVGGElement>('#cam-g');
    if (g) g.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);

    if (dotGridRef.current) {
      const sp = Math.max(14, DOT_WORLD * scale);
      const ox = ((x % sp) + sp) % sp;
      const oy = ((y % sp) + sp) % sp;
      dotGridRef.current.style.backgroundSize = `${sp}px ${sp}px`;
      dotGridRef.current.style.backgroundPosition = `${ox}px ${oy}px`;
    }

    const vp = wrapRef.current;
    if (!vp || !sbXThumb.current || !sbYThumb.current) return;
    const W = vp.clientWidth, H = vp.clientHeight;
    const ww = WB.maxX - WB.minX, wh = WB.maxY - WB.minY;
    const visW = W / scale, visH = H / scale;
    const wwPx = ww * scale, whPx = wh * scale;

    // Thumb size proportional to visible/world ratio, max 25 % of track, min 24 px
    const tw = Math.max(24, Math.min(Math.round(W * 0.25), Math.round(W * Math.min(1, visW / ww))));
    const th = Math.max(24, Math.min(Math.round(H * 0.25), Math.round(H * Math.min(1, visH / wh))));
    sbXThumb.current.style.width  = `${tw}px`;
    sbYThumb.current.style.height = `${th}px`;

    // Camera bounds — must match clampCam exactly so thumb always reaches track endpoints
    const xLo = wwPx <= W ? CAM_PAD - WB.maxX * scale     : W - CAM_PAD - WB.maxX * scale;
    const xHi = wwPx <= W ? W - CAM_PAD - WB.minX * scale : CAM_PAD - WB.minX * scale;
    const yLo = whPx <= H ? CAM_PAD - WB.maxY * scale     : H - CAM_PAD - WB.maxY * scale;
    const yHi = whPx <= H ? H - CAM_PAD - WB.minY * scale : CAM_PAD - WB.minY * scale;

    // posX: 0 = thumb at left (viewport shows world-left), 1 = thumb at right (world-right).
    // Higher cam.x means world moved right = viewport sees world-left = thumb near 0.
    const posX = xHi > xLo ? Math.max(0, Math.min(1, (xHi - x) / (xHi - xLo))) : 0.5;
    const posY = yHi > yLo ? Math.max(0, Math.min(1, (yHi - y) / (yHi - yLo))) : 0.5;
    sbXThumb.current.style.left = `${Math.round(posX * (W - tw))}px`;
    sbYThumb.current.style.top  = `${Math.round(posY * (H - th))}px`;
  }, []);

  /* ── bgCanvas: strokes only (images rendered as <img> in imgLayerRef) ─── */
  const rebuildBg = useCallback(() => {
    const canvas = bgCanvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const { x, y, scale } = cam.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, x, y);

    // Preload images into cache for use in getSnapshot thumbnail
    objectsRef.current.forEach(o => {
      if (o?.kind !== 'image') return;
      const imgObj = o as ImageObject;
      const cached = imageCache.current.get(imgObj.id);
      if (!cached || cached.url !== imgObj.url) {
        const el = new Image();
        if (!imgObj.url.startsWith('blob:')) el.crossOrigin = 'anonymous';
        el.onload = () => {
          imageCache.current.set(imgObj.id, { url: imgObj.url, img: el });
        };
        el.src = imgObj.url;
        imageCache.current.set(imgObj.id, { url: imgObj.url, img: el });
      }
    });

    // Draw committed strokes only
    objectsRef.current.forEach(o => { if (o?.kind === 'stroke') drawStroke(ctx, o); });

    ctx.restore();
  }, []);

  const scheduleBg = useCallback(() => {
    cancelAnimationFrame(rafDraw.current);
    rafDraw.current = requestAnimationFrame(rebuildBg);
  }, [rebuildBg]);

  /* ── actCanvas: current stroke only ──────────────────────────────────── */
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
    if (drawingShape.current && (tool === 'rect' || tool === 'circle')) {
      const s = drawingShape.current as ShapeObject;
      if (s.width && s.height) {
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, x, y);
        drawShapePreview(ctx, s);
        ctx.restore();
      }
    }
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

  /* ── Resize canvases when viewport changes ───────────────────────────── */
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

  useEffect(() => { scheduleBg(); }, [objects, scheduleBg]);

  /* ── Wheel ───────────────────────────────────────────────────────────── */
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
    undo: () => { onObjects(prev => prev.slice(0, -1)); },
    clearAll: () => {
      onObjects([]);
      const ctx = bgCanvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, bgCanvasRef.current!.width, bgCanvasRef.current!.height);
    },
    getCamera: () => ({ ...cam.current }),
    setCamera: (c: Camera) => { cam.current = c; applyTransform(); onCamScale(c.scale); scheduleBg(); },
    getSnapshot: () => {
      const strokeSrc = bgCanvasRef.current;
      if (!strokeSrc || strokeSrc.width === 0) return null;
      const W = strokeSrc.width, H = strokeSrc.height;
      const thumb = document.createElement('canvas');
      const ratio = Math.min(1, 400 / W);
      thumb.width  = Math.floor(W * ratio);
      thumb.height = Math.floor(H * ratio);
      const ctx = thumb.getContext('2d');
      if (!ctx) return null;
      try {
        // Background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, thumb.width, thumb.height);

        // Draw images from cache at thumbnail scale
        const { x, y, scale } = cam.current;
        ctx.save();
        ctx.setTransform(scale * ratio, 0, 0, scale * ratio, x * ratio, y * ratio);
        ctx.imageSmoothingEnabled = true;
        (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
        objectsRef.current.forEach(o => {
          if (o?.kind !== 'image') return;
          const imgObj = o as ImageObject;
          const cached = imageCache.current.get(imgObj.id);
          if (cached?.img?.complete && cached.img.naturalWidth > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(imgObj.x, imgObj.y, imgObj.width, imgObj.height);
            ctx.drawImage(cached.img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
          }
        });
        ctx.restore();

        // Draw strokes on top
        ctx.drawImage(strokeSrc, 0, 0, thumb.width, thumb.height);

        return thumb.toDataURL('image/jpeg', 0.55);
      } catch {
        return null;
      }
    },
    zoomStep: (dir: 1 | -1) => {
      const vp = wrapRef.current; if (!vp) return;
      const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
      const sorted = dir === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
      const next   = dir === 1
        ? sorted.find(s => s > cam.current.scale)
        : sorted.find(s => s < cam.current.scale);
      if (next == null) return;
      cam.current = clampCam(zoomAt(cam.current, cx, cy, next / cam.current.scale), vp.clientWidth, vp.clientHeight);
      onCamScale(cam.current.scale);
      applyTransform();
      scheduleBg();
    },
    resetZoom: () => {
      const vp = wrapRef.current; if (!vp) return;
      const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
      cam.current = clampCam(zoomAt(cam.current, cx, cy, 1 / cam.current.scale), vp.clientWidth, vp.clientHeight);
      onCamScale(cam.current.scale);
      applyTransform();
      scheduleBg();
    },
    getViewportCenter: () => {
      const vp = wrapRef.current;
      return {
        cx: vp ? vp.clientWidth  / 2 : window.innerWidth  / 2,
        cy: vp ? vp.clientHeight / 2 : window.innerHeight / 2,
      };
    },
  }), [onObjects, applyTransform, onCamScale, scheduleBg]);

  /* ── Stable mutators ─────────────────────────────────────────────────── */
  const deleteObj   = useCallback((id: string) => onObjects(prev => prev.filter(o => o.id !== id)), [onObjects]);
  const syncText    = useCallback((id: string, t: string) => onObjects(prev => prev.map(o => o.id === id ? { ...o, text: t } : o)), [onObjects]);
  const setAbsPos   = useCallback((id: string, nx: number, ny: number) =>
    onObjects(prev => prev.map(o => {
      if (o.id !== id) return o;
      if (o.kind === 'sticky' || o.kind === 'text' || o.kind === 'shape' || o.kind === 'image') return { ...o, x: nx, y: ny };
      if (o.kind === 'arrow') { const a = o as ArrowObject; const dx = nx-a.x1, dy = ny-a.y1; return { ...a, x1: a.x1+dx, y1: a.y1+dy, x2: a.x2+dx, y2: a.y2+dy }; }
      return o;
    })), [onObjects]);
  const doFormat    = useCallback((id: string, props: Partial<TextObject>) => onObjects(prev => prev.map(o => o.id === id ? { ...o, ...props } : o)), [onObjects]);
  const updateColor = useCallback((id: string, c: NoteColor) => onObjects(prev => prev.map(o => o.id === id ? { ...o, color: c } : o)), [onObjects]);
  const setImgSize  = useCallback((id: string, nx: number, ny: number, nw: number, nh: number) =>
    onObjects(prev => prev.map(o =>
      (o.id === id && o.kind === 'image') ? { ...o, x: nx, y: ny, width: nw, height: nh } : o
    )), [onObjects]);

  const removeBg = useCallback((id: string) => {
    const imgObj = objectsRef.current.find(o => o.id === id && o.kind === 'image') as ImageObject | undefined;
    if (!imgObj) return;
    onObjects(prev => prev.map(o => o.id === id ? { ...o, uploading: true } : o));
    (async () => {
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        const blob = await removeBackground(imgObj.url);
        let newUrl: string;
        try {
          const { uploadToImageKit } = await import('../../utils/imagekitUpload');
          const file = new File([blob], `nobg-${Date.now()}.png`, { type: 'image/png' });
          newUrl = await uploadToImageKit(file);
        } catch {
          newUrl = URL.createObjectURL(blob);
        }
        onObjects(prev => prev.map(o => o.id === id ? { ...o, url: newUrl, uploading: false } : o));
      } catch {
        onObjects(prev => prev.map(o => o.id === id ? { ...o, uploading: false } : o));
      }
    })();
  }, [onObjects]);

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

    if (isDrawing.current && activeStroke.current) {
      isDrawing.current = false;
      const committed = { ...activeStroke.current, points: [...activeStroke.current.points] };
      if (committed.points.length > 1) {
        const bgCtx = bgCanvasRef.current?.getContext('2d');
        if (bgCtx) {
          bgCtx.save();
          bgCtx.setTransform(cam.current.scale, 0, 0, cam.current.scale, cam.current.x, cam.current.y);
          drawStroke(bgCtx, committed);
          bgCtx.restore();
        }
        activeStroke.current = null;
        cancelAnimationFrame(rafAct.current);
        rafAct.current = requestAnimationFrame(() => {
          const ctx = actCanvasRef.current?.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, actCanvasRef.current!.width, actCanvasRef.current!.height);
        });
        onObjects(prev => [...prev, committed]);
      } else {
        activeStroke.current = null;
      }
      return;
    }

    if ((tool === 'rect' || tool === 'circle') && drawingShape.current) {
      const s = { ...drawingShape.current } as ShapeObject;
      shapeAnchor.current = null; drawingShape.current = null;
      cancelAnimationFrame(rafAct.current);
      rafAct.current = requestAnimationFrame(() => {
        const ctx = actCanvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, actCanvasRef.current!.width, actCanvasRef.current!.height);
      });
      if (s.width > 4 && s.height > 4) onObjects(prev => [...prev, { ...s, kind: 'shape' }]);
      return;
    }

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
  const imageObjs   = objects.filter(o => o?.kind === 'image')  as ImageObject[];

  return (
    <div
      ref={wrapRef}
      className={`fj-viewport ${cursorCls}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {/* CSS dot grid */}
      <div ref={dotGridRef} className="fj-dot-grid" />

      {/* Image layer — BELOW bgCanvas so strokes render on top of images.
          pointer-events:none so mouse events fall through to the canvas.
          Browser renders <img> natively: GPU-quality downscaling, no canvas blurring. */}
      <div ref={imgLayerRef} className="fj-img-layer">
        {imageObjs.map(img => (
          <div
            key={img.id}
            className="fj-imgcard"
            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
          >
            <img
              src={img.url}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        ))}
      </div>

      {/* Background canvas: strokes only (images moved to imgLayerRef above) */}
      <canvas ref={bgCanvasRef} className="fj-canvas" />

      {/* Active canvas: current stroke only */}
      <canvas
        ref={actCanvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}
      />

      {/* SVG shapes */}
      <svg ref={svgRef} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }}>
        <g id="cam-g">
          {shapeObjs.map(s => <ShapeEl key={s.id} obj={s} tool={tool} getCamScale={getCamScale} onDelete={deleteObj} onMoveEnd={setAbsPos} />)}
          {arrowObjs.map(a => <ArrowEl key={a.id} obj={a} onDelete={deleteObj} />)}
        </g>
      </svg>

      {/* HTML overlay: image handles + sticky notes + text */}
      <div ref={overlayRef} className="fj-overlay">
        {imageObjs.map(img => (
          <BoardImageObject key={img.id} obj={img} tool={tool} getCamScale={getCamScale}
            onMoveEnd={setAbsPos} onDelete={deleteObj} onResize={setImgSize} onRemoveBg={removeBg} />
        ))}
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
