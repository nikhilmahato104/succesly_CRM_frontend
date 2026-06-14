export type ToolType =
  | 'select' | 'hand'
  | 'pen' | 'marker' | 'eraser'
  | 'sticky' | 'text'
  | 'rect' | 'circle' | 'arrow';

export interface Camera { x: number; y: number; scale: number; }
export interface Point  { x: number; y: number; }

export interface DrawStroke {
  id: string;
  kind: 'stroke';
  points: Point[];
  color: string;
  size: number;
  opacity: number;
}

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export interface StickyNote {
  id: string;
  kind: 'sticky';
  x: number; y: number;
  width: number; height: number;
  text: string;
  color: NoteColor;
}

export interface TextObject {
  id: string;
  kind: 'text';
  x: number; y: number;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
}

export interface ShapeObject {
  id: string;
  kind: 'shape';
  shape: 'rect' | 'circle';
  x: number; y: number;
  width: number; height: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface ArrowObject {
  id: string;
  kind: 'arrow';
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  size: number;
}

export interface ImageObject {
  id: string;
  kind: 'image';
  x: number; y: number;
  width: number; height: number;
  url: string;
  uploading?: boolean; // true while blob URL is live, false after CDN URL replaces it
}

export type CanvasObject = DrawStroke | StickyNote | TextObject | ShapeObject | ArrowObject | ImageObject;

export const NOTE_COLORS: Record<NoteColor, { bg: string; header: string; text: string }> = {
  yellow: { bg: '#fff9c4', header: '#f5e642', text: '#4a3900' },
  pink:   { bg: '#fce4ec', header: '#f06292', text: '#5c0030' },
  blue:   { bg: '#e3f2fd', header: '#64b5f6', text: '#003063' },
  green:  { bg: '#e8f5e9', header: '#66bb6a', text: '#1a3d1c' },
  purple: { bg: '#f3e5f5', header: '#ba68c8', text: '#3d0a4a' },
  orange: { bg: '#fff3e0', header: '#ffa726', text: '#4a2100' },
};

export const PALETTE = [
  '#1e293b', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];
