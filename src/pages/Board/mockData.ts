import { CanvasObject } from './types';

export const initialObjects: CanvasObject[] = [
  {
    id: 'n-001', kind: 'sticky',
    x: 160, y: 140, width: 200, height: 170,
    text: '📊 Dashboard UI\n\nStat cards redesign\nChart.js integration\nDark mode ✅',
    color: 'yellow',
  },
  {
    id: 'n-002', kind: 'sticky',
    x: 390, y: 140, width: 200, height: 170,
    text: '👥 User Management\n\nTable UI fix ✅\nSearch by name ✅\nAdvanced filter 🔄',
    color: 'green',
  },
  {
    id: 'n-003', kind: 'sticky',
    x: 620, y: 140, width: 200, height: 170,
    text: '🔐 Role & Permissions\n\nPermission matrix ✅\nRBAC Redux ✅\nBottom sheet 🔄',
    color: 'blue',
  },
  {
    id: 'n-004', kind: 'sticky',
    x: 850, y: 140, width: 200, height: 170,
    text: '📅 Booking\n\nCreate booking ✅\nStatus workflow 🔄\nCSV export ⏳',
    color: 'orange',
  },
  {
    id: 'n-005', kind: 'sticky',
    x: 160, y: 345, width: 200, height: 155,
    text: '🚫 Blocked\n\nPDF export pending\nDecision needed:\njsPDF vs Puppeteer',
    color: 'pink',
  },
  {
    id: 'n-006', kind: 'sticky',
    x: 390, y: 345, width: 200, height: 155,
    text: '⚙️ Settings\n\nAPI Keys ✅\nProfile 🔄\nSystem config ⏳',
    color: 'purple',
  },
  {
    id: 't-001', kind: 'text',
    x: 160, y: 96, text: 'MY LEARNING — PROJECT BOARD',
    color: '#1e293b', fontSize: 20, bold: true,
  },
];
