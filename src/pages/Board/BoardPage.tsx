import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ToolType, CanvasObject, StickyNote, TextObject, Camera, PALETTE } from './types';
import { initialObjects } from './mockData';
import BoardHeader from './BoardHeader';
import BoardToolbar from './BoardToolbar';
import BoardCanvas, { CanvasHandle } from './BoardCanvas';
import './BoardPage.css';

const ZOOM_STEPS = [0.1, 0.17, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

let _uid = Date.now();
const uid = () => `p${++_uid}`;

const BoardPage: React.FC = () => {
  const [tool,      setTool]      = useState<ToolType>('select');
  const [color,     setColor]     = useState(PALETTE[0]);
  const [size,      setSize]      = useState(5);
  const [zoomPct,   setZoomPct]   = useState(100);
  const [objects,   setObjects]   = useState<CanvasObject[]>(initialObjects);
  const [isPanning, setIsPanning] = useState(false);

  const canvasRef = useRef<CanvasHandle>(null);

  /* ── Block browser zoom (Ctrl+scroll) everywhere on this page ──────── */
  useEffect(() => {
    const block = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    document.addEventListener('wheel', block, { passive: false });
    return () => document.removeEventListener('wheel', block);
  }, []);

  /* ── Zoom via buttons ───────────────────────────────────────────────── */
  const stepZoom = useCallback((dir: 1 | -1) => {
    const handle = canvasRef.current;
    if (!handle) return;
    const cam = handle.getCamera();
    const sorted = dir === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
    const next = dir === 1
      ? sorted.find(s => s > cam.scale)
      : sorted.find(s => s < cam.scale);
    if (next == null) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newCam: Camera = {
      scale: next,
      x: cx - (cx - cam.x) * (next / cam.scale),
      y: cy - (cy - cam.y) * (next / cam.scale),
    };
    handle.setCamera(newCam);
  }, []);

  const resetZoom = useCallback(() => {
    const handle = canvasRef.current;
    if (!handle) return;
    const cam = handle.getCamera();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    handle.setCamera({
      scale: 1,
      x: cx - (cx - cam.x) * (1 / cam.scale),
      y: cy - (cy - cam.y) * (1 / cam.scale),
    });
  }, []);

  /* ── Keyboard shortcuts ─────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); canvasRef.current?.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); stepZoom(1); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); stepZoom(-1); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); resetZoom(); return; }

      const map: Partial<Record<string, ToolType>> = {
        v: 'select', h: 'hand', p: 'pen', m: 'marker',
        e: 'eraser', n: 'sticky', t: 'text', r: 'rect',
        c: 'circle', a: 'arrow',
      };
      if (map[e.key]) { setTool(map[e.key]!); return; }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // handled by canvas via undo or selection
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepZoom, resetZoom]);

  /* ── Canvas click → place sticky / text ────────────────────────────── */
  const handleAddObject = useCallback((wx: number, wy: number) => {
    if (tool === 'sticky') {
      const note: StickyNote = {
        id: uid(), kind: 'sticky',
        x: wx - 100, y: wy - 85,
        width: 200, height: 170,
        text: '', color: 'yellow',
      };
      setObjects(prev => [...prev, note]);
      setTool('select');
    } else if (tool === 'text') {
      const t: TextObject = {
        id: uid(), kind: 'text',
        x: wx, y: wy,
        text: 'Double click to edit',
        color: '#1e293b', fontSize: 18, bold: false,
      };
      setObjects(prev => [...prev, t]);
      setTool('select');
    }
  }, [tool]);

  const handleClear = useCallback(() => {
    if (window.confirm('Clear the entire board? This cannot be undone.')) {
      canvasRef.current?.clearAll();
      setObjects([]);
    }
  }, []);

  return (
    <div className="fj-root">
      <BoardHeader
        title="Project Whiteboard"
        onUndo={() => canvasRef.current?.undo()}
        onClear={handleClear}
      />

      <BoardCanvas
        ref={canvasRef}
        tool={tool}
        color={color}
        size={size}
        objects={objects}
        onObjects={setObjects}
        onAddObject={handleAddObject}
        isPanning={isPanning}
        onCamScale={s => setZoomPct(Math.round(s * 100))}
      />

      {/* Bottom toolbars */}
      <BoardToolbar
        tool={tool}   onTool={setTool}
        color={color} onColor={setColor}
        size={size}   onSize={setSize}
      />

      {/* Zoom cluster bottom-right */}
      <div className="fj-zoom-cluster">
        <button className="fj-zcircle" onClick={() => stepZoom(-1)} disabled={zoomPct <= 10} aria-label="Zoom out">−</button>
        <button className="fj-zoom-val" onClick={resetZoom} title="Reset to 100%">{zoomPct}%</button>
        <button className="fj-zcircle" onClick={() => stepZoom(1)} disabled={zoomPct >= 500} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
};

export default BoardPage;
