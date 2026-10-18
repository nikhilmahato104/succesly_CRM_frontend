import React, { useEffect, useMemo } from "react";
import { emitNavDone } from "../../../atoms/NavigationProgress";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  BookOpen, Clock, CheckCircle2, XCircle,
  TrendingUp, Users, RefreshCw, Activity,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { useChartTheme } from "../components/useChartTheme";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
);

// ── Static data (swap with API calls when ready) ──────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const KPI_STATS = [
  { title:"Total Bookings", value:"12,847", icon:<BookOpen size={16}/>, iconBg:"rgba(99,102,241,0.12)",  iconColor:"#6366f1", change:12.4 },
  { title:"Active Bookings",value:"3,291",  icon:<Clock size={16}/>,    iconBg:"rgba(245,158,11,0.12)", iconColor:"#f59e0b", change:8.1  },
  { title:"Completed",      value:"8,204",  icon:<CheckCircle2 size={16}/>, iconBg:"rgba(34,197,94,0.12)",  iconColor:"#22c55e", change:15.3 },
  { title:"Cancelled",      value:"1,352",  icon:<XCircle size={16}/>,  iconBg:"rgba(239,68,68,0.12)",  iconColor:"#ef4444", change:-3.2 },
  { title:"Total Revenue",  value:"₹24.5L", icon:<TrendingUp size={16}/>,iconBg:"rgba(6,182,212,0.12)",  iconColor:"#06b6d4", change:18.7 },
  { title:"Platform Users", value:"5,640",  icon:<Users size={16}/>,    iconBg:"rgba(139,92,246,0.12)", iconColor:"#8b5cf6", change:5.2  },
];

const BOOKING_TREND  = [820,940,1100,1050,1280,1340,1220,1450,1380,1600,1720,1847];
const CHANNEL_LABELS = ["App","Website","Laptop","WhatsApp","Call"];
const CHANNEL_DATA   = [4200,3100,2800,1600,1147];
const CHANNEL_COLORS = ["#6366f1","#06b6d4","#22c55e","#f59e0b","#8b5cf6"];
const STATUS_LABELS  = ["Completed","Ongoing","Cancelled"];
const STATUS_DATA    = [8204,3291,1352];
const STATUS_COLORS  = ["#22c55e","#f59e0b","#ef4444"];

const RECENT = [
  { ref:"BK-2026-001", name:"Aarav Mehta",  channel:"App",     status:"completed",          date:"08 May 2026" },
  { ref:"BK-2026-042", name:"Priya Sharma", channel:"Website", status:"ongoing",             date:"07 May 2026" },
  { ref:"BK-2026-031", name:"Rohan Verma",  channel:"Call",    status:"completed",           date:"07 May 2026" },
  { ref:"BK-2026-018", name:"Nisha Patel",  channel:"App",     status:"cancelled_via_user",  date:"06 May 2026" },
  { ref:"BK-2026-009", name:"Karan Singh",  channel:"WhatsApp",status:"ongoing",             date:"06 May 2026" },
  { ref:"BK-2026-055", name:"Diya Iyer",    channel:"Website", status:"completed",           date:"05 May 2026" },
];

const BADGES: Record<string,{label:string;color:string;bg:string}> = {
  completed:           { label:"Completed", color:"#22c55e", bg:"rgba(34,197,94,0.10)"  },
  ongoing:             { label:"Ongoing",   color:"#f59e0b", bg:"rgba(245,158,11,0.10)" },
  cancelled_via_user:  { label:"Cancelled", color:"#ef4444", bg:"rgba(239,68,68,0.10)"  },
  cancelled_by_admin_crm:{ label:"Admin Cancel",color:"#ef4444",bg:"rgba(239,68,68,0.10)"},
};

// ── Shared chart option builder ───────────────────────────────────────────
const tooltipStyle = (theme: ReturnType<typeof useChartTheme>) => ({
  backgroundColor: theme.tooltipBg,
  titleColor:      theme.tooltipText,
  bodyColor:       theme.tooltipText,
  borderColor:     theme.gridColor,
  borderWidth:     1,
  padding:         8,
});

// ── Component ─────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  // Static data — ready as soon as the charts have painted
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone())); }, []);

  const theme = useChartTheme();

  const lineData = useMemo(() => ({
    labels: MONTHS,
    datasets: [{
      label:"Bookings", data:BOOKING_TREND,
      borderColor:"#6366f1", backgroundColor:"rgba(99,102,241,0.07)",
      fill:true, tension:0.4, pointRadius:3, pointHoverRadius:5, borderWidth:2,
    }],
  }), []);

  const lineOptions = useMemo(() => ({
    responsive:true, maintainAspectRatio:false,
    plugins: { legend:{ display:false }, tooltip:tooltipStyle(theme) },
    scales: {
      x: { grid:{ color:theme.gridColor }, ticks:{ color:theme.textColor, font:{ size:11 } } },
      y: { grid:{ color:theme.gridColor }, ticks:{ color:theme.textColor, font:{ size:11 } }, beginAtZero:true },
    },
  }), [theme]);

  const barData = useMemo(() => ({
    labels: CHANNEL_LABELS,
    datasets: [{
      label:"Bookings", data:CHANNEL_DATA,
      backgroundColor:CHANNEL_COLORS, borderRadius:5, barThickness:28,
    }],
  }), []);

  const barOptions = useMemo(() => ({
    responsive:true, maintainAspectRatio:false,
    plugins: { legend:{ display:false }, tooltip:tooltipStyle(theme) },
    scales: {
      x: { grid:{ display:false }, ticks:{ color:theme.textColor, font:{ size:11 } } },
      y: { grid:{ color:theme.gridColor }, ticks:{ color:theme.textColor, font:{ size:11 } }, beginAtZero:true },
    },
  }), [theme]);

  const doughnutData = useMemo(() => ({
    labels: STATUS_LABELS,
    datasets: [{ data:STATUS_DATA, backgroundColor:STATUS_COLORS, borderWidth:0, hoverOffset:6 }],
  }), []);

  const doughnutOptions = useMemo(() => ({
    responsive:true, maintainAspectRatio:false, cutout:"70%",
    plugins: {
      legend: {
        position:"bottom" as const,
        labels:{ color:theme.textColor, font:{ size:11 }, padding:14, boxWidth:9, boxHeight:9 },
      },
      tooltip: tooltipStyle(theme),
    },
  }), [theme]);

  return (
    <div style={{ display:"flex", flexDirection:"column", background:"var(--dt-bg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        gap:10, padding:"8px 14px", borderBottom:"1px solid var(--sc-border)",
        flexShrink:0, background:"var(--sc-card)", flexWrap:"wrap",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:"var(--radius)",
            background:"rgba(99,102,241,0.12)",
            display:"flex", alignItems:"center", justifyContent:"center", color:"#6366f1",
          }}>
            <Activity size={15} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--dt-text)", lineHeight:1.2 }}>Admin Dashboard</div>
            <div style={{ fontSize:11, color:"var(--dt-muted)" }}>Platform-wide overview · May 2026</div>
          </div>
        </div>
        <button style={{
          display:"flex", alignItems:"center", gap:5, fontSize:11,
          color:"var(--dt-muted)", background:"transparent",
          border:"1px solid var(--sc-border)", borderRadius:"var(--radius)",
          padding:"4px 9px", cursor:"pointer",
        }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="sc-scrollbar dash-body">

        {/* 6 KPI cards — 3-col → 2-col → 1-col */}
        <div className="stat-grid stat-grid-6">
          {KPI_STATS.map((s) => <StatCard key={s.title} {...s} />)}
        </div>

        {/* Booking Trend — always full width so all 12 months are visible */}
        <ChartCard title="Booking Trend" subtitle="Monthly bookings · Jan – Dec 2026" minHeight={210}>
          <Line data={lineData} options={lineOptions} />
        </ChartCard>

        {/* Booking Status + Bookings by Channel — fluid 2-col */}
        <div className="chart-duo">
          <ChartCard title="Booking Status" subtitle="Current distribution" minHeight={230}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </ChartCard>
          <ChartCard title="Bookings by Channel" subtitle="Which platform drives the most bookings" minHeight={230}>
            <Bar data={barData} options={barOptions} />
          </ChartCard>
        </div>

        {/* Recent bookings */}
        <div style={{
          background:"var(--sc-card)", border:"1px solid var(--sc-border)",
          borderRadius:"var(--radius)", overflow:"hidden",
          boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
        }}>
          {/* Table header */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"10px 14px", borderBottom:"1px solid var(--sc-border)",
          }}>
            <div>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--dt-text)" }}>Recent Bookings</span>
              <span style={{ fontSize:11, color:"var(--dt-muted)", marginLeft:8 }}>Latest 6 transactions</span>
            </div>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"var(--dt-header)" }}>
                  {["Reference","Customer","Channel","Status","Date"].map((h) => (
                    <th key={h} style={{
                      padding:"7px 12px", textAlign:"left", fontWeight:600,
                      color:"var(--dt-muted)", fontSize:11, letterSpacing:".04em",
                      textTransform:"uppercase", whiteSpace:"nowrap",
                      borderBottom:"1px solid var(--sc-border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT.map((b, i) => {
                  const badge = BADGES[b.status] ?? { label:b.status, color:"var(--dt-muted)", bg:"transparent" };
                  return (
                    <tr
                      key={b.ref}
                      style={{ borderBottom: i < RECENT.length - 1 ? "1px solid var(--sc-border)" : "none", transition:"background 120ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dt-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding:"8px 12px", color:"var(--dt-text)", fontWeight:500, whiteSpace:"nowrap", fontFamily:"monospace", fontSize:11.5 }}>{b.ref}</td>
                      <td style={{ padding:"8px 12px", color:"var(--dt-dim)", whiteSpace:"nowrap" }}>{b.name}</td>
                      <td style={{ padding:"8px 12px", color:"var(--dt-muted)", whiteSpace:"nowrap" }}>{b.channel}</td>
                      <td style={{ padding:"8px 12px", whiteSpace:"nowrap" }}>
                        <span style={{
                          padding:"2px 7px", borderRadius:99, fontSize:11,
                          fontWeight:600, color:badge.color, background:badge.bg,
                        }}>{badge.label}</span>
                      </td>
                      <td style={{ padding:"8px 12px", color:"var(--dt-muted)", whiteSpace:"nowrap" }}>{b.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
