import React from 'react';
import { ToolType, PALETTE } from './types';

/* ── SVG icons matching FigJam exactly ─────────────────────────────────── */
const Icons: Record<string, React.ReactNode> = {
  select: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-7 2-2 7z"/>
    </svg>
  ),
  hand: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  ),
  pen: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.88 3.88a3 3 0 0 0-4.24 0L4 13.52V20h6.48l9.64-9.64a3 3 0 0 0 0-4.24l-2.24-2.24zM9.66 18H6v-3.66l8-8L17.66 10l-8 8z"/>
    </svg>
  ),
  marker: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.07 4.93a1 1 0 0 0-1.42 0l-11.3 11.3a1 1 0 0 0-.27.51L5 21l4.26-1.08a1 1 0 0 0 .51-.27l11.3-11.3a1 1 0 0 0 0-1.42l-2-2zM8.37 18.24 7 19l-.24-1.37L17.07 7.3l1.63 1.63-10.33 9.31z" opacity=".3"/>
      <path d="m19.07 4.93-2-2a1 1 0 0 0-1.42 0l-1.06 1.07 3.42 3.42 1.06-1.07a1 1 0 0 0 0-1.42z"/>
      <rect x="5" y="19" width="14" height="2" rx="1"/>
    </svg>
  ),
  eraser: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
      <path d="M22 21H7"/>
      <path d="m5 11 9 9"/>
    </svg>
  ),
  sticky: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/>
      <polyline points="15 3 15 9 21 9"/>
    </svg>
  ),
  text: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  ),
  rect: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
    </svg>
  ),
  circle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  ),
  arrow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  image: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
};

const SIZES = [
  { v: 2,  dot: 4 },
  { v: 5,  dot: 7 },
  { v: 10, dot: 11 },
];

interface Props {
  tool: ToolType;
  onTool: (t: ToolType) => void;
  color: string;
  onColor: (c: string) => void;
  size: number;
  onSize: (s: number) => void;
  onImageFile: (f: File) => void;
}

const DRAW_TOOLS: ToolType[] = ['pen', 'marker', 'eraser'];
const isDrawTool  = (t: ToolType) => DRAW_TOOLS.includes(t) || t === 'arrow';
// Which draw sub-tool is currently active (defaults to 'pen' when none selected)
const activeDrawIcon = (t: ToolType): ToolType => DRAW_TOOLS.includes(t) ? t : 'pen';

const BoardToolbar: React.FC<Props> = ({ tool, onTool, color, onColor, size, onSize, onImageFile }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const showContext = isDrawTool(tool) || tool === 'rect' || tool === 'circle';

  return (
    <div className="fj-toolbars">
      {/* ── Context row (colors + sizes) — FigJam top row ──────────────── */}
      {showContext && (
        <div className="fj-tool-row">
          {/* Pen type quick-switch */}
          {(['pen', 'marker', 'eraser'] as ToolType[]).map(t => (
            <button
              key={t}
              className={`fj-tbtn${tool === t ? ' active-draw' : ''}`}
              onClick={() => onTool(t)}
              style={{ width: 34, height: 34 }}
            >
              {Icons[t]}
              <span className="fj-tip">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          ))}

          <div className="fj-tsep" />

          {/* Color palette */}
          {PALETTE.map((c, i) => (
            <div
              key={i}
              className={`fj-cdot${c === '#ffffff' ? ' fj-cdot-white' : ''}${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onColor(c)}
              title={c}
            />
          ))}

          <div className="fj-tsep" />

          {/* Stroke sizes */}
          {SIZES.map(s => (
            <button
              key={s.v}
              className={`fj-sbtn${size === s.v ? ' active' : ''}`}
              onClick={() => onSize(s.v)}
              title={`Size ${s.v}`}
            >
              <span className="fj-sdot" style={{ width: s.dot, height: s.dot }} />
            </button>
          ))}
        </div>
      )}

      {/* ── Main row — FigJam bottom row ─────────────────────────────── */}
      <div className="fj-tool-row">
        {/* Navigation */}
        <Btn id="select"  active={tool === 'select'}  onClick={() => onTool('select')}  tip="Select  V">{Icons.select}</Btn>
        <Btn id="hand"    active={tool === 'hand'}    onClick={() => onTool('hand')}    tip="Hand  H">{Icons.hand}</Btn>

        <div className="fj-tsep" />

        {/* Drawing — icon updates to reflect active sub-tool (pen / marker / eraser) */}
        <Btn id="draw"
          active={DRAW_TOOLS.includes(tool)}
          onClick={() => onTool(activeDrawIcon(tool))}
          tip="Draw  P"
        >{Icons[activeDrawIcon(tool)]}</Btn>

        {/* Sticky notes */}
        <Btn id="sticky"  active={tool === 'sticky'}  onClick={() => onTool('sticky')}  tip="Sticky Note  N">{Icons.sticky}</Btn>

        <div className="fj-tsep" />

        {/* Shapes */}
        <Btn id="rect"    active={tool === 'rect'}    onClick={() => onTool('rect')}    tip="Rectangle  R">{Icons.rect}</Btn>
        <Btn id="circle"  active={tool === 'circle'}  onClick={() => onTool('circle')}  tip="Circle  C">{Icons.circle}</Btn>
        <Btn id="arrow"   active={tool === 'arrow'}   onClick={() => onTool('arrow')}   tip="Arrow  A">{Icons.arrow}</Btn>

        <div className="fj-tsep" />

        {/* Text */}
        <Btn id="text"    active={tool === 'text'}    onClick={() => onTool('text')}    tip="Text  T">{Icons.text}</Btn>

        <div className="fj-tsep" />

        {/* Eraser — also accessible via context row when draw tool is active */}
        <Btn id="eraser"  active={tool === 'eraser'}  onClick={() => onTool('eraser')}  tip="Eraser  E">{Icons.eraser}</Btn>

        <div className="fj-tsep" />

        {/* Image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { onImageFile(f); e.target.value = ''; }
          }}
        />
        <button
          className="fj-tbtn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Image (or paste screenshot)"
        >
          {Icons.image}
          <span className="fj-tip">Image</span>
        </button>
      </div>
    </div>
  );
};

/* Tiny helper */
const Btn: React.FC<{
  id: string; active: boolean; onClick: () => void; tip: string; children: React.ReactNode;
}> = ({ active, onClick, tip, children }) => (
  <button className={`fj-tbtn${active ? ' active' : ''}`} onClick={onClick}>
    {children}
    <span className="fj-tip">{tip}</span>
  </button>
);

export default BoardToolbar;
