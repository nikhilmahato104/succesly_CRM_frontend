import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolType, CanvasObject, StickyNote, TextObject, ImageObject, PALETTE } from './types';
import BoardHeader from './BoardHeader';
import BoardToolbar from './BoardToolbar';
import BoardCanvas, { CanvasHandle } from './BoardCanvas';
import { boardApi } from '../../services/boardApi';
import { uploadToImageKit } from '../../utils/imagekitUpload';
import './BoardPage.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  const [boardName,   setBoardName]   = useState('Untitled Board');
  const [loadState,   setLoadState]   = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle');
  const [uploadToast, setUploadToast] = useState<'uploading' | 'success' | 'error' | 'no-cookies' | null>(null);

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
        const cam = canvasRef.current?.getCamera() ?? { x: 0, y: 0, scale: 1 };
        const b64 = canvasRef.current?.getSnapshot();
        let thumbnail: string | undefined;
        if (b64) {
          try {
            const blob = await fetch(b64).then(r => r.blob());
            const tf   = new File([blob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
            thumbnail  = await uploadToImageKit(tf);
          } catch { /* ignore thumbnail upload failure — save without it */ }
        }
        await boardApi.save(boardId, {
          objects,
          cameraState: cam,
          thumbnail,
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

  /* ── Image upload (file picker or paste) ───────────────────────────── */
  const handleImageUpload = useCallback(async (file: File) => {
    // 1. Create a local blob URL so image appears on board instantly
    const blobUrl = URL.createObjectURL(file);

    const dims = await new Promise<{ w: number; h: number }>(resolve => {
      const img = new Image();
      img.onload = () => {
        // Keep full HD resolution so images stay crisp when zoomed in.
        // Only cap extremely large images (> 1920px on longest edge).
        const MAX = 1920;
        let w = img.naturalWidth  || 800;
        let h = img.naturalHeight || 600;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        resolve({ w, h });
      };
      img.onerror = () => resolve({ w: 800, h: 600 });
      img.src = blobUrl;
    });

    const cam = canvasRef.current?.getCamera() ?? { x: 0, y: 0, scale: 1 };
    const { cx, cy } = canvasRef.current?.getViewportCenter() ?? { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    const wx = (cx - cam.x) / cam.scale;
    const wy = (cy - cam.y) / cam.scale;
    const id  = uid();

    // Add image immediately with blob URL — user sees it right away
    setObjects(prev => [...prev, {
      id, kind: 'image' as const,
      x: wx - dims.w / 2, y: wy - dims.h / 2,
      width: dims.w, height: dims.h,
      url: blobUrl, uploading: true,
    }]);

    // 2. Upload to ImageKit in the background
    const ext        = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uniqueFile = new File([file], `board-${Date.now()}.${ext}`, { type: file.type });
    try {
      const cdnUrl = await uploadToImageKit(uniqueFile);
      // Swap blob URL → CDN URL; clear uploading flag
      setObjects(prev => prev.map(o =>
        o.id === id ? { ...o, url: cdnUrl, uploading: false } : o
      ));
      // Revoke blob URL only after the canvas has had a chance to load the CDN image
      // (the imageCache holds the blob HTMLImageElement as a fallback until then)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setObjects(prev => prev.filter(o => o.id !== id)); // remove placeholder
      const msg = err instanceof Error ? err.message : '';
      setUploadToast(msg === 'NO_COOKIES' ? 'no-cookies' : 'error');
      setTimeout(() => setUploadToast(null), 4000);
    }
  }, []);

  /* ── Paste image from clipboard (Win+Shift+S, PrtSc, copy image…) ─── */
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { handleImageUpload(file); break; }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [handleImageUpload]);

  /* ── Zoom helpers ───────────────────────────────────────────────────── */
  const stepZoom  = useCallback((dir: 1 | -1) => { canvasRef.current?.zoomStep(dir); }, []);
  const resetZoom = useCallback(() => { canvasRef.current?.resetZoom(); }, []);

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
        onImageFile={handleImageUpload}
      />

      {/* Upload toast */}
      {uploadToast && (
        <div className="fj-upload-toast error">
          {uploadToast === 'error'      && 'Upload failed — try again'}
          {uploadToast === 'no-cookies' && 'Image storage not configured — go to Help Chat to set it up'}
        </div>
      )}

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
