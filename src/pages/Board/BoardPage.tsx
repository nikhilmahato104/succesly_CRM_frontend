import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolType, CanvasObject, StickyNote, TextObject, PALETTE } from './types';
import BoardHeader from './BoardHeader';
import BoardToolbar from './BoardToolbar';
import BoardCanvas, { CanvasHandle } from './BoardCanvas';
import { boardApi } from '../../services/boardApi';
import './BoardPage.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const ZOOM_STEPS = [0.1,0.17,0.25,0.33,0.5,0.67,0.75,0.9,1,1.1,1.25,1.5,1.75,2,2.5,3,4,5];
let _uid = Date.now();
const uid = () => `p${++_uid}`;

const BoardPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate    = useNavigate();

  const [tool,       setTool]       = useState<ToolType>('select');
  const [color,      setColor]      = useState(PALETTE[0]);
  const [size,       setSize]       = useState(5);
  const [zoomPct,    setZoomPct]    = useState(100);
  const [objects,    setObjects]    = useState<CanvasObject[]>([]);
  const [isPanning,  setIsPanning]  = useState(false);

  /* ── API state ──────────────────────────────────────────────────────── */
  const [boardName,  setBoardName]  = useState('Untitled Board');
  const [loadState,  setLoadState]  = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const canvasRef   = useRef<CanvasHandle>(null);
  const isDirtyRef  = useRef(false);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Block browser ctrl+scroll zoom ────────────────────────────────── */
  useEffect(() => {
    const block = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    document.addEventListener('wheel', block, { passive: false });
    return () => document.removeEventListener('wheel', block);
  }, []);

  /* ── Load board from API ────────────────────────────────────────────── */
  useEffect(() => {
    if (!boardId) { navigate('/boards'); return; }

    let cancelled = false;
    (async () => {
      setLoadState('loading');
      try {
        const board = await boardApi.getById(boardId);
        if (cancelled) return;
        setBoardName(board.name);
        setObjects((board.objects ?? []) as CanvasObject[]);
        // Set camera after canvas mounts (give it a tick)
        if (board.cameraState) {
          setTimeout(() => {
            canvasRef.current?.setCamera(board.cameraState);
          }, 100);
        }
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [boardId, navigate]);

  /* ── Mark dirty when objects change (after initial load) ────────────── */
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (loadState !== 'ready') return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    isDirtyRef.current = true;
  }, [objects, loadState]);

  /* ── Autosave — debounced 3 seconds after last change ───────────────── */
  const triggerAutosave = useCallback(() => {
    if (!boardId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      isDirtyRef.current = false;
      setSaveStatus('saving');
      try {
        const cam      = canvasRef.current?.getCamera() ?? { x: 0, y: 0, scale: 1 };
        const snapshot = canvasRef.current?.getSnapshot() ?? undefined;
        await boardApi.save(boardId, {
          objects,
          cameraState: cam,
          thumbnail:   snapshot ?? undefined,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
        isDirtyRef.current = true; // retry on next change
      }
    }, 3000);
  }, [boardId, objects]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    if (!isDirtyRef.current) return;
    triggerAutosave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [objects, loadState, triggerAutosave]);

  /* ── Zoom helpers ───────────────────────────────────────────────────── */
  const stepZoom = useCallback((dir: 1 | -1) => {
    const handle = canvasRef.current; if (!handle) return;
    const cam    = handle.getCamera();
    const sorted = dir === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
    const next   = dir === 1 ? sorted.find(s => s > cam.scale) : sorted.find(s => s < cam.scale);
    if (next == null) return;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    handle.setCamera({ scale: next, x: cx - (cx - cam.x) * next / cam.scale, y: cy - (cy - cam.y) * next / cam.scale });
  }, []);

  const resetZoom = useCallback(() => {
    const handle = canvasRef.current; if (!handle) return;
    const cam = handle.getCamera();
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    handle.setCamera({ scale: 1, x: cx - (cx - cam.x) / cam.scale, y: cy - (cy - cam.y) / cam.scale });
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
      const map: Partial<Record<string, ToolType>> = { v:'select',h:'hand',p:'pen',m:'marker',e:'eraser',n:'sticky',t:'text',r:'rect',c:'circle',a:'arrow' };
      if (map[e.key]) { setTool(map[e.key]!); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepZoom, resetZoom]);

  /* ── Place sticky note / text ────────────────────────────────────────── */
  const handleAddObject = useCallback((wx: number, wy: number) => {
    if (tool === 'sticky') {
      const note: StickyNote = { id: uid(), kind: 'sticky', x: wx - 100, y: wy - 85, width: 200, height: 170, text: '', color: 'yellow' };
      setObjects(prev => [...prev, note]);
      setTool('select');
    } else if (tool === 'text') {
      const t: TextObject = { id: uid(), kind: 'text', x: wx, y: wy, text: 'Type here…', color: '#1e293b', fontSize: 18, bold: false };
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

  /* ── Loading / error screens ─────────────────────────────────────────── */
  if (loadState === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:14, background:'#f5f5f5', fontFamily:'sans-serif' }}>
        <div style={{ width:36, height:36, border:'3px solid #e2e8f0', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        <p style={{ color:'#94a3b8', fontSize:14 }}>Loading board…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:14, background:'#f5f5f5', fontFamily:'sans-serif' }}>
        <span style={{ fontSize:40 }}>⚠️</span>
        <p style={{ color:'#ef4444', fontSize:15, fontWeight:700 }}>Failed to load board</p>
        <p style={{ color:'#94a3b8', fontSize:13 }}>Check your API connection and try again.</p>
        <button onClick={() => navigate('/boards')} style={{ marginTop:8, padding:'8px 20px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'sans-serif' }}>
          ← Back to Boards
        </button>
      </div>
    );
  }

  return (
    <div className="fj-root">
      <BoardHeader
        title={boardName}
        saveStatus={saveStatus}
        onBack={() => navigate('/boards')}
        onUndo={() => canvasRef.current?.undo()}
        onClear={handleClear}
      />

      <BoardCanvas
        ref={canvasRef}
        tool={tool} color={color} size={size}
        objects={objects} onObjects={setObjects}
        onAddObject={handleAddObject}
        isPanning={isPanning}
        onCamScale={s => setZoomPct(Math.round(s * 100))}
      />

      <BoardToolbar
        tool={tool}   onTool={setTool}
        color={color} onColor={setColor}
        size={size}   onSize={setSize}
      />

      {/* Zoom cluster */}
      <div className="fj-zoom-cluster">
        <button className="fj-zcircle" onClick={() => stepZoom(-1)} disabled={zoomPct <= 10} aria-label="Zoom out">−</button>
        <button className="fj-zoom-val" onClick={resetZoom} title="Reset to 100%">{zoomPct}%</button>
        <button className="fj-zcircle" onClick={() => stepZoom(1)} disabled={zoomPct >= 500} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
};

export default BoardPage;
