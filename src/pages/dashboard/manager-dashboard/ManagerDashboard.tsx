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
  Users, BookOpen, CheckCircle2, Clock,
  RefreshCw, BarChart2, TrendingUp,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { useChartTheme } from "../components/useChartTheme";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
);

// ── Static data (swap with API calls when ready) ──────────────────────────

const WEEKS = ["Wk 1","Wk 2","Wk 3","Wk 4","Wk 5","Wk 6","Wk 7","Wk 8"];

const KPI_STATS = [
  { title:"Team Bookings",  value:"2,418",   icon:<BookOpen size={16}/>,     iconBg:"rgba(99,102,241,0.12)",  iconColor:"#6366f1", change:9.3  },
  { title:"Team Members",   value:"14",      icon:<Users size={16}/>,         iconBg:"rgba(6,182,212,0.12)",   iconColor:"#06b6d4", change:0    },
  { title:"Completion Rate",value:"86.4%",   icon:<CheckCircle2 size={16}/>,  iconBg:"rgba(34,197,94,0.12)",   iconColor:"#22c55e", change:2.1  },
  { title:"Avg Handle Time",value:"4.2 min", icon:<Clock size={16}/>,         iconBg:"rgba(245,158,11,0.12)",  iconColor:"#f59e0b", change:-0.8 },
];

const TEAM_TREND    = [180,210,195,240,260,280,310,340];
const AGENT_NAMES   = ["Priya","Rohan","Nisha","Karan","Diya","Arjun","Meera"];
const AGENT_TARGET  = [200,200,200,200,200,200,200];
const AGENT_ACTUAL  = [238,185,212,197,244,165,221];
const CHANNEL_LABELS= ["App","Website","WhatsApp","Call","Laptop"];
const CHANNEL_DATA  = [920,680,420,278,120];
const CHANNEL_COLORS= ["#6366f1","#06b6d4","#22c55e","#f59e0b","#8b5cf6"];

const TEAM_TABLE = [
  { name:"Priya Sharma", bookings:238, completed:210, rate:"88.2%", status:"active"   },
  { name:"Rohan Verma",  bookings:185, completed:158, rate:"85.4%", status:"active"   },
  { name:"Nisha Patel",  bookings:212, completed:190, rate:"89.6%", status:"active"   },
  { name:"Karan Singh",  bookings:197, completed:162, rate:"82.2%", status:"on-leave" },
  { name:"Diya Iyer",    bookings:244, completed:225, rate:"92.2%", status:"active"   },
  { name:"Arjun Nair",   bookings:165, completed:130, rate:"78.8%", status:"active"   },
  { name:"Meera Joshi",  bookings:221, completed:198, rate:"89.6%", status:"active"   },
];

// ── Shared tooltip builder ────────────────────────────────────────────────
const tooltipStyle = (theme: ReturnType<typeof useChartTheme>) => ({
  backgroundColor: theme.tooltipBg,
  titleColor:      theme.tooltipText,
  bodyColor:       theme.tooltipText,
  borderColor:     theme.gridColor,
  borderWidth:     1,
  padding:         8,
});

// ── Component ─────────────────────────────────────────────────────────────

export const ManagerDashboard: React.FC = () => {
  // Static data — ready as soon as the charts have painted
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone())); }, []);

  const theme = useChartTheme();

  const lineData = useMemo(() => ({
    labels: WEEKS,
    datasets: [{
      label:"Bookings", data:TEAM_TREND,
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

  const agentBarData = useMemo(() => ({
    labels: AGENT_NAMES,
    datasets: [
      {
        label:"Target", data:AGENT_TARGET,
        backgroundColor:"rgba(99,102,241,0.15)", borderColor:"#6366f1",
        borderWidth:1.5, borderRadius:5, barThickness:16,
      },
      {
        label:"Actual", data:AGENT_ACTUAL,
        backgroundColor:"#6366f1", borderRadius:5, barThickness:16,
      },
    ],
  }), []);

  const agentBarOptions = useMemo(() => ({
    responsive:true, maintainAspectRatio:false,
    plugins: {
      legend: {
        position:"top" as const,
        labels:{ color:theme.textColor, font:{ size:11 }, boxWidth:9, boxHeight:9, padding:12 },
      },
      tooltip:tooltipStyle(theme),
    },
    scales: {
      x: { grid:{ display:false }, ticks:{ color:theme.textColor, font:{ size:11 } } },
      y: { grid:{ color:theme.gridColor }, ticks:{ color:theme.textColor, font:{ size:11 } }, beginAtZero:true },
    },
  }), [theme]);

  const channelData = useMemo(() => ({
    labels: CHANNEL_LABELS,
    datasets: [{ data:CHANNEL_DATA, backgroundColor:CHANNEL_COLORS, borderWidth:0, hoverOffset:6 }],
  }), []);

  const channelOptions = useMemo(() => ({
    responsive:true, maintainAspectRatio:false, cutout:"70%",
    plugins: {
      legend: {
        position:"bottom" as const,
        labels:{ color:theme.textColor, font:{ size:11 }, padding:14, boxWidth:9, boxHeight:9 },
      },
      tooltip:tooltipStyle(theme),
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
            <BarChart2 size={15} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--dt-text)", lineHeight:1.2 }}>Manager Dashboard</div>
            <div style={{ fontSize:11, color:"var(--dt-muted)" }}>Team performance overview · May 2026</div>
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

        {/* 4 KPI cards */}
        <div className="stat-grid stat-grid-4">
          {KPI_STATS.map((s) => <StatCard key={s.title} {...s} />)}
        </div>

        {/* Weekly Bookings + Channels — chart-pair: 1-col when sidebar open, 2-col when closed */}
        <div className="chart-pair">
          <ChartCard title="Weekly Team Bookings" subtitle="8-week rolling performance" minHeight={210}>
            <Line data={lineData} options={lineOptions} />
          </ChartCard>
          <ChartCard title="Booking Channels" subtitle="How customers reach your team" minHeight={210}>
            <Doughnut data={channelData} options={channelOptions} />
          </ChartCard>
        </div>

        {/* Agent vs Target — always full width */}
        <ChartCard title="Agent vs Target" subtitle="Individual booking count this month" minHeight={210}>
          <Bar data={agentBarData} options={agentBarOptions} />
        </ChartCard>

        {/* Top Performers + Team Summary table */}
        <div className="chart-duo">

          {/* Top Performers */}
          <div style={{
            background:"var(--sc-card)", border:"1px solid var(--sc-border)",
            borderRadius:"var(--radius)", overflow:"hidden",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)", display:"flex", flexDirection:"column",
          }}>
            <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--sc-border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <TrendingUp size={12} color="#6366f1" />
                <span style={{ fontSize:13, fontWeight:600, color:"var(--dt-text)" }}>Top Performers</span>
              </div>
              <div style={{ fontSize:11, color:"var(--dt-muted)", marginTop:2 }}>Sorted by completion rate</div>
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              {[...TEAM_TABLE]
                .sort((a,b) => parseFloat(b.rate) - parseFloat(a.rate))
                .map((agent, i) => (
                  <div
                    key={agent.name}
                    style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"8px 14px", gap:8,
                      borderBottom: i < TEAM_TABLE.length - 1 ? "1px solid var(--sc-border)" : "none",
                      transition:"background 120ms",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dt-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                      <div style={{
                        width:28, height:28, borderRadius:"50%", flexShrink:0,
                        background:"rgba(99,102,241,0.12)", color:"#6366f1",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:700,
                      }}>
                        {agent.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:"var(--dt-text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {agent.name}
                        </div>
                        <div style={{ fontSize:11, color:"var(--dt-muted)" }}>{agent.bookings} bookings</div>
                      </div>
                    </div>
                    <div style={{ flexShrink:0, textAlign:"right" }}>
                      <div style={{
                        fontSize:12, fontWeight:700,
                        color: parseFloat(agent.rate) >= 88 ? "#22c55e" : parseFloat(agent.rate) >= 82 ? "#f59e0b" : "#ef4444",
                      }}>{agent.rate}</div>
                      {agent.status === "on-leave" && (
                        <div style={{ fontSize:10, color:"#f59e0b", marginTop:1 }}>On Leave</div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Team Summary table */}
          <div style={{
            background:"var(--sc-card)", border:"1px solid var(--sc-border)",
            borderRadius:"var(--radius)", overflow:"hidden",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
          }}>
            <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--sc-border)" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--dt-text)" }}>Team Summary</span>
              <span style={{ fontSize:11, color:"var(--dt-muted)", marginLeft:8 }}>All agents this month</span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--dt-header)" }}>
                    {["Agent","Bookings","Completed","Rate","Status"].map((h) => (
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
                  {TEAM_TABLE.map((agent, i) => (
                    <tr
                      key={agent.name}
                      style={{ borderBottom: i < TEAM_TABLE.length - 1 ? "1px solid var(--sc-border)" : "none", transition:"background 120ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dt-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding:"8px 12px", color:"var(--dt-text)", fontWeight:500, whiteSpace:"nowrap" }}>{agent.name}</td>
                      <td style={{ padding:"8px 12px", color:"var(--dt-dim)" }}>{agent.bookings}</td>
                      <td style={{ padding:"8px 12px", color:"var(--dt-dim)" }}>{agent.completed}</td>
                      <td style={{ padding:"8px 12px" }}>
                        <span style={{
                          fontSize:11, fontWeight:700,
                          color: parseFloat(agent.rate) >= 88 ? "#22c55e" : parseFloat(agent.rate) >= 82 ? "#f59e0b" : "#ef4444",
                        }}>{agent.rate}</span>
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <span style={{
                          padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:600,
                          color:      agent.status === "active" ? "#22c55e" : "#f59e0b",
                          background: agent.status === "active" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
                        }}>
                          {agent.status === "active" ? "Active" : "On Leave"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
