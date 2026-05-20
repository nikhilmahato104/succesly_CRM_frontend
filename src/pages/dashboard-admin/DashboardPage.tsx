// import React, { useState } from "react";
// import { DashboardLayout } from "../../templates/DashboardLayout";
// import {  
//   Sparkles, 
// } from "lucide-react";
// import { useSelector } from "react-redux";
// import { selectUserData } from "../../store/slices/userSlice"; 

// export const DashboardPage: React.FC = () => {
//   const userData = useSelector(selectUserData);
//   const userName = userData?.user_name || "Admin"; 

//   return (
//     <DashboardLayout>
//       <div className="globalPadding">
//         <div className="space-y-6">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div>
//               <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
//                 Admin Dashboard
//               </h1>
//               <p className="text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
//                 <Sparkles className="h-4 w-4 text-yellow-500" />
//                 Welcome back, {userName}!
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </DashboardLayout>
//   );
// };
// export default DashboardPage;










//v2
import React, { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "../../templates/DashboardLayout";
import {
  RefreshCw,
  Volume2,
  MessageSquare,
  Copy,
  Share2,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Paperclip,
  Mic,
  ChevronDown,
  BarChart2,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectUserData } from "../../store/slices/userSlice";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

// ─── Rotating dev responses ───────────────────────────────────────────────────

const DEV_RESPONSES = [
  "Hi! 👋 We're currently in development mode — things might be a little rough around the edges.",
  "Hi there! 🛠️ This is a test AI modal under development mode. Responses are simulated.",
  "Hey! 🚧 Development mode active. I'm not fully wired up yet, but I'm here!",
  "Hello! ⚙️ Just so you know, this AI is running in dev mode. Expect placeholder responses.",
];

let devIndex = 0;
const getDevResponse = () => DEV_RESPONSES[devIndex++ % DEV_RESPONSES.length];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonLoader: React.FC = () => (
  <div style={{ display: "flex", gap: 12, padding: "8px 0 16px" }}>
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--sk-base)",
        flexShrink: 0,
        marginTop: 2,
      }}
    />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
      {[88, 68, 48].map((w, i) => (
        <div
          key={i}
          style={{
            height: 13,
            borderRadius: 6,
            width: `${w}%`,
            background: "linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%)",
            backgroundSize: "200% 100%",
            animation: `grokShimmer 1.5s ease-in-out infinite`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  </div>
);

// ─── Grok swirl icon ──────────────────────────────────────────────────────────

const GrokIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
      fill="currentColor"
    />
  </svg>
);

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  if (msg.loading) return <SkeletonLoader />;

  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <div
          style={{
            background: "var(--user-bubble)",
            border: "1px solid var(--user-bubble-border)",
            borderRadius: 18,
            padding: "10px 16px",
            maxWidth: 520,
            color: "var(--text-primary)",
            fontSize: 14.5,
            lineHeight: 1.55,
          }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  // Assistant
  const actions = [
    { icon: <RefreshCw size={13} />, label: "Regenerate" },
    { icon: <Volume2 size={13} />, label: "Read aloud" },
    { icon: <MessageSquare size={13} />, label: "Comment" },
    { icon: <Copy size={13} />, label: "Copy" },
    { icon: <Share2 size={13} />, label: "Share" },
    { icon: <ThumbsUp size={13} />, label: "Like" },
    { icon: <ThumbsDown size={13} />, label: "Dislike" },
    { icon: <MoreHorizontal size={13} />, label: "More" },
  ];

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {/* AI avatar */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--avatar-bg)",
            border: "1px solid var(--avatar-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
            color: "var(--text-muted)",
          }}
        >
          <GrokIcon size={14} />
        </div>
        <p
          style={{
            color: "var(--text-primary)",
            fontSize: 14.5,
            lineHeight: 1.65,
            margin: 0,
            paddingTop: 4,
            flex: 1,
          }}
        >
          {msg.content}
        </p>
      </div>

      {/* Action row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          marginTop: 8,
          marginLeft: 38,
        }}
      >
        {actions.map(({ icon, label }) => (
          <button
            key={label}
            title={label}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--action-icon)",
              padding: "4px 5px",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--action-icon-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--action-icon)")
            }
          >
            {icon}
          </button>
        ))}
        <span style={{ color: "var(--text-faint)", fontSize: 11, marginLeft: 4 }}>1.4s</span>
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 11,
            background: "var(--badge-bg)",
            border: "1px solid var(--badge-border)",
            borderRadius: 4,
            padding: "1px 6px",
            marginLeft: 4,
          }}
        >
          Fast
        </span>
      </div>
    </div>
  );
};

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen: React.FC<{ userName: string }> = ({ userName }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      userSelect: "none",
    }}
  >
    {/* Grok-style logo mark */}
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "var(--logo-bg)",
        border: "1px solid var(--logo-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        fontSize: 30,
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "-1px",
        fontFamily: "Georgia, serif",
      }}
    >
      N
    </div>
    <h2
      style={{
        margin: 0,
        fontSize: 22,
        fontWeight: 600,
        color: "var(--text-primary)",
        letterSpacing: "-0.4px",
      }}
    >
      My Learning
    </h2>
    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
      How can I help you today?
    </p>
  </div>
);

// ─── Input bar ────────────────────────────────────────────────────────────────

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  hasStarted: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ value, onChange, onSend, disabled, hasStarted }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const active = value.trim().length > 0 && !disabled;

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div style={{ flexShrink: 0, paddingTop: 0}}>
      <div
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          borderRadius: 22,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          padding: "8px 10px 8px 14px",
          boxShadow: "0 0 0 1px var(--input-shadow)",
          transition: "border-color 0.2s",
        }}
      >
        {/* Attach */}
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--action-icon)",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <Paperclip size={16} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKey}
          placeholder="Ask anything"
          rows={1}
          disabled={disabled}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            resize: "none",
            color: "var(--text-primary)",
            fontSize: 14.5,
            lineHeight: 1.5,
            padding: "3px 0",
            maxHeight: 120,
            overflowY: "auto",
            fontFamily: "inherit",
          }}
          // inline placeholder colour via CSS class added below
          className="grok-textarea"
        />

        {/* Auto */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "none",
            border: "none",
            color: "var(--action-icon)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            padding: "4px 2px",
            marginBottom: 2,
            whiteSpace: "nowrap",
          }}
        >
          Auto <ChevronDown size={12} />
        </button>

        {/* Mic */}
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--action-icon)",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <Mic size={16} />
        </button>

        {/* Send */}
        <button
          onClick={onSend}
          disabled={!active}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: active ? "var(--send-active)" : "var(--send-inactive)",
            border: "none",
            cursor: active ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <BarChart2 size={15} color={active ? "var(--send-icon-active)" : "var(--send-icon)"} />
        </button>
      </div>

      {!hasStarted && (
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-faint)",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          New · Hold Ctrl+D to dictate
        </p>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const userData = useSelector(selectUserData);
  const userName = userData?.user_name || "Admin";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const skeleton: Message = { id: "skeleton", role: "assistant", content: "", loading: true };

    setHasStarted(true);
    setMessages((p) => [...p, userMsg, skeleton]);
    setInput("");
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 1400 + Math.random() * 700));

    const reply = getDevResponse();
    setMessages((p) =>
      p.filter((m) => m.id !== "skeleton").concat({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
      })
    );
    setIsLoading(false);
  };

  return (
    <>
      <style>{`
        @keyframes grokShimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        .grok-textarea::placeholder { color: var(--placeholder); }
        .grok-textarea::-webkit-scrollbar { width: 3px; }
        .grok-textarea::-webkit-scrollbar-thumb { background: var(--input-border); border-radius: 2px; }

        /* CSS variable palette — adapts to light/dark automatically */
        :root {
          --text-primary:        #1a1a1a;
          --text-muted:          #666;
          --text-faint:          #999;
          --placeholder:         #aaa;

          --user-bubble:         #f4f4f4;
          --user-bubble-border:  #e8e8e8;

          --avatar-bg:           #f0f0f0;
          --avatar-border:       #e0e0e0;

          --action-icon:         #bbb;
          --action-icon-hover:   #555;

          --badge-bg:            #f5f5f5;
          --badge-border:        #e5e5e5;

          --input-bg:            #f9f9f9;
          --input-border:        #e2e2e2;
          --input-shadow:        transparent;

          --send-active:         #1a1a1a;
          --send-inactive:       #e8e8e8;
          --send-icon-active:    #fff;
          --send-icon:           #aaa;

          --logo-bg:             #111;
          --logo-border:         #333;

          --sk-base:             #ebebeb;
          --sk-shine:            #f8f8f8;
        }

        .dark, [data-theme="dark"], .dark-mode {
          --text-primary:        #e0e0e0;
          --text-muted:          #777;
          --text-faint:          #444;
          --placeholder:         #555;

          --user-bubble:         #1a1a1a;
          --user-bubble-border:  #2a2a2a;

          --avatar-bg:           #111;
          --avatar-border:       #2a2a2a;

          --action-icon:         #555;
          --action-icon-hover:   #aaa;

          --badge-bg:            #1a1a1a;
          --badge-border:        #2a2a2a;

          --input-bg:            #141414;
          --input-border:        #252525;
          --input-shadow:        #1a1a1a;

          --send-active:         #ffffff;
          --send-inactive:       #222;
          --send-icon-active:    #000;
          --send-icon:           #555;

          --logo-bg:             #111;
          --logo-border:         #2a2a2a;

          --sk-base:             #1e1e1e;
          --sk-shine:            #2a2a2a;
        }
      `}</style>

      <DashboardLayout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxWidth: 760,
            margin: "0 auto",
            padding: "0 16px 20px",
            boxSizing: "border-box",
          }}
        >
          {/* Messages / Welcome */}
          {!hasStarted ? (
            <WelcomeScreen userName={userName} />
          ) : (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingTop: 24,
                paddingBottom: 8,
              }}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <InputBar
            value={input}
            onChange={setInput}
            onSend={sendMessage}
            disabled={isLoading}
            hasStarted={hasStarted}
          />
        </div>
      </DashboardLayout>
    </>
  );
};

export default DashboardPage;