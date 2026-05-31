import React from "react";

const docs = [
  {
    file: "ImageKit_Integration_Guide.html",
    title: "ImageKit Upload Integration",
    description: "Vite proxy, Netlify function, CSRF token, session cookies, 2-step upload — local & production guide.",
    tag: "Integration",
    color: "#e44d26",
  },
  {
    file: "Frontend_Auth_Security_v2.html",
    title: "Frontend Auth Security v2.0",
    description: "JWT · CSRF Token · httpOnly Refresh Token · Silent Refresh · 5-layer security architecture.",
    tag: "Security",
    color: "#6366f1",
  },
  {
    file: "Auth_Security_PRD.html",
    title: "Auth Security PRD",
    description: "Product requirements document for the authentication and security system.",
    tag: "PRD",
    color: "#a855f7",
  },
  {
    file: "BookingParser_SystemDesign.html",
    title: "Booking Parser System Design",
    description: "System design document for the booking management parsing architecture.",
    tag: "System Design",
    color: "#06b6d4",
  },
  {
    file: "PWA_iOS_Safari_Guide.html",
    title: "PWA & iOS Safari Guide",
    description: "Progressive Web App setup, iOS Safari quirks, service worker, manifest configuration.",
    tag: "PWA",
    color: "#22c55e",
  },
  {
    file: "Rapid_Refresh_Fix_PRD.html",
    title: "Rapid Refresh Fix PRD",
    description: "Fix documentation for the rapid refresh token and session management issues.",
    tag: "Fix",
    color: "#f59e0b",
  },
  {
    file: "ThemeTransition_Guide.html",
    title: "Theme Transition Guide",
    description: "Dark/light mode implementation, CSS variables, transition animations.",
    tag: "UI",
    color: "#f97316",
  },
  {
    file: "QueryCache_Optimization.html",
    title: "Query Cache & Tab Optimization",
    description: "SWR cache, in-flight dedup, CSS mount preservation — eliminate redundant API calls on tab switching. Industry-standard patterns, zero dependencies.",
    tag: "Performance",
    color: "#3fb950",
  },
];

const DocListPage: React.FC = () => {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f1117",
      padding: "48px 32px",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{
            display: "inline-block",
            background: "rgba(99,102,241,.15)",
            color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,.25)",
            borderRadius: 100,
            padding: "3px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
          }}>My Learning Admin</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#e2e4ed", margin: "10px 0 6px" }}>
          Developer Documentation
        </h1>
        <p style={{ color: "#8b8fa8", fontSize: 14, marginBottom: 36 }}>
          {docs.length} guides — click any card to open in browser
        </p>

        {/* Doc Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 16,
        }}>
          {docs.map((doc) => (
            <a
              key={doc.file}
              href={`/doc/${doc.file}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div style={{
                background: "#1a1d27",
                border: "1px solid #2a2d3a",
                borderLeft: `3px solid ${doc.color}`,
                borderRadius: 10,
                padding: "20px 22px",
                cursor: "pointer",
                transition: "transform 120ms, box-shadow 120ms",
                height: "100%",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Tag */}
                <span style={{
                  display: "inline-block",
                  background: `${doc.color}1a`,
                  color: doc.color,
                  border: `1px solid ${doc.color}40`,
                  borderRadius: 100,
                  padding: "2px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}>{doc.tag}</span>

                {/* Title */}
                <h2 style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#e2e4ed",
                  margin: "0 0 8px",
                  lineHeight: 1.3,
                }}>{doc.title}</h2>

                {/* Description */}
                <p style={{
                  fontSize: 12,
                  color: "#8b8fa8",
                  margin: 0,
                  lineHeight: 1.6,
                }}>{doc.description}</p>

                {/* Footer */}
                <div style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: doc.color,
                  fontWeight: 600,
                }}>
                  Open guide →
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ color: "#3a3d4d", fontSize: 12, textAlign: "center", marginTop: 48 }}>
          All docs are in <code style={{ color: "#4a4d5d" }}>public/doc/</code> — open any HTML file directly in the browser.
        </p>
      </div>
    </div>
  );
};

export default DocListPage;
