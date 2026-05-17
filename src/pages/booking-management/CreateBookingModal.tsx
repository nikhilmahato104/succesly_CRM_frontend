import React, { useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAccessToken } from "../../store/slices/authSlice";
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { postData } from "../../services/crmServices";
import { parseBookingRawText, ParsedBookingFields } from "./bookingParser";
import {
  CleanButton, CleanInput, CleanTextarea, CleanSelect, CleanModal, type SelectOption,
} from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────

type BookingVia = "app" | "website" | "laptop" | "whatsapp_to_crm" | "call";
type BookingFields = ParsedBookingFields & { booking_via: BookingVia };

interface BookingEntry {
  id:        string;
  rawText:   string;
  fields:    BookingFields;
  collapsed: boolean;
  errors:    Partial<Record<keyof BookingFields, string>>;
}

interface SubmitResult {
  id:      string;
  name:    string;
  status:  "success" | "error";
  message: string;
}

type AbandonReason = "close" | "navigate";

type Props = { isOpen: boolean; onClose: () => void; onCreated: () => void };

// ── Constants ──────────────────────────────────────────────────────────────

const DRAFT_KEY = "booking_creation_draft_v2";

const BRANCH_OPTIONS: SelectOption[] = [
  { value: "jalandhar",  label: "Jalandhar"  },
  { value: "chandigarh", label: "Chandigarh" },
  { value: "ludhiana",   label: "Ludhiana"   },
];

const BOOKING_VIA_OPTIONS: SelectOption[] = [
  { value: "app",             label: "App"            },
  { value: "website",         label: "Website"        },
  { value: "laptop",          label: "Laptop"         },
  { value: "whatsapp_to_crm", label: "WhatsApp → CRM" },
  { value: "call",            label: "Call"           },
];

const ABANDON_COPY: Record<AbandonReason, { title: string; body: string; confirm: string }> = {
  close: {
    title:   "Discard unsaved bookings?",
    body:    "Closing will permanently discard your unsaved booking data.",
    confirm: "Discard & Close",
  },
  navigate: {
    title:   "Unsaved bookings",
    body:    "Your draft is saved and will be restored when you return. Navigate away?",
    confirm: "Leave anyway",
  },
};

// ── Pure helpers ───────────────────────────────────────────────────────────

let _counter = 0;
const uid = () => `e_${Date.now()}_${++_counter}`;

function emptyFields(): BookingFields {
  const now = new Date();
  const p   = (n: number) => String(n).padStart(2, "0");
  return {
    user_name: "", user_phone: "", address: "", live_location_url: "",
    branch:    "jalandhar",
    booking_via: "whatsapp_to_crm",
    booking_created_date_and_time:
      `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`,
  };
}

const emptyEntry = (): BookingEntry =>
  ({ id: uid(), rawText: "", fields: emptyFields(), collapsed: false, errors: {} });

function validateEntry(f: BookingFields): Partial<Record<keyof BookingFields, string>> {
  const e: Partial<Record<keyof BookingFields, string>> = {};
  if (!f.user_phone.trim()) e.user_phone  = "Phone is required";
  if (!f.address.trim())    e.address     = "Address is required";
  if (!f.booking_via)       e.booking_via = "Source is required";
  return e;
}

const hasDraft = (entries: BookingEntry[]) =>
  entries.some(e => e.rawText.trim() || e.fields.user_phone || e.fields.address);

function buildPayload(
  entry:            BookingEntry,
  userId?:          string,
  fallbackUserName?: string,
): Record<string, unknown> {
  return {
    user_id:   userId || undefined,
    user_name: entry.fields.user_name || fallbackUserName || undefined,
    branch:    entry.fields.branch    || undefined,
    user_phone: entry.fields.user_phone,
    address:   entry.fields.address,
    live_location_url: entry.fields.live_location_url || undefined,
    booking_via: entry.fields.booking_via,
    booking_created_date_and_time: entry.fields.booking_created_date_and_time
      ? new Date(entry.fields.booking_created_date_and_time).toISOString()
      : new Date().toISOString(),
  };
}

function extractErrorMessage(err: unknown): string {
  const data = (err as any)?.error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0)
    return (data.errors as string[]).join(" · ");
  return data?.message ?? (err as any)?.message ?? "Failed to create booking";
}

// ── Storage helpers ────────────────────────────────────────────────────────

const saveDraft  = (e: BookingEntry[]) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(e)); } catch { /**/ } };
const clearDraft = ()                  => { try { localStorage.removeItem(DRAFT_KEY); } catch { /**/ } };
function loadDraft(): BookingEntry[] | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ── EntryAnimWrapper ───────────────────────────────────────────────────────

const EntryAnimWrapper: React.FC<{ exiting: boolean; id: string; children: React.ReactNode }> = ({ exiting, id, children }) => (
  <div id={id} style={{
    overflow:     "hidden",
    transition:   "max-height 380ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease",
    maxHeight:    exiting ? "0px" : "800px",
    opacity:      exiting ? 0 : 1,
  }}>
    {children}
  </div>
);

// ── BookingEntryCard ───────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  border: "1px solid var(--fi-border)", borderRadius: 10,
  overflow: "hidden", background: "var(--sc-card)",
};
const CARD_HDR: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", background: "var(--sb-hover)", borderBottom: "1px solid var(--fi-border)",
};

const BookingEntryCard: React.FC<{
  entry:          BookingEntry;
  index:          number;
  total:          number;
  isSubmitting:   boolean;
  globalBusy:     boolean;
  onChange:       (id: string, p: Partial<BookingEntry>) => void;
  onRemove:       (id: string) => void;
  onReset:        (id: string) => void;
  onCreateSingle: (id: string) => void;
}> = ({ entry, index, total, isSubmitting, globalBusy, onChange, onRemove, onReset, onCreateSingle }) => {

  const handleRawChange = (raw: string) => {
    const parsed = parseBookingRawText(raw);
    onChange(entry.id, {
      rawText: raw,
      fields:  {
        ...entry.fields, ...parsed,
        booking_via: (parsed.booking_via as BookingVia) || entry.fields.booking_via,
        branch:      entry.fields.branch, // preserve user's branch selection
      },
      errors: {},
    });
  };

  const setField = <K extends keyof BookingFields>(key: K, val: BookingFields[K]) =>
    onChange(entry.id, { fields: { ...entry.fields, [key]: val }, errors: { ...entry.errors, [key]: undefined } });

  const hasErrors = Object.values(entry.errors).some(Boolean);

  return (
    <div style={CARD_STYLE}>
      <div style={CARD_HDR}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fi-text)" }}>Booking #{index + 1}</span>
          {hasErrors && <AlertTriangle style={{ width: 13, height: 13, color: "#ef4444" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CleanButton
            variant="primary" size="xs"
            onClick={() => onCreateSingle(entry.id)}
            loading={isSubmitting} disabled={globalBusy}
          >
            Create
          </CleanButton>
          <CleanButton
            variant="ghost" size="xs"
            icon={entry.collapsed
              ? <ChevronDown style={{ width: 14, height: 14 }} />
              : <ChevronUp   style={{ width: 14, height: 14 }} />}
            onClick={() => onChange(entry.id, { collapsed: !entry.collapsed })}
            title={entry.collapsed ? "Expand" : "Collapse"}
          />
          <CleanButton
            variant="ghost" size="xs"
            icon={<Trash2 style={{ width: 13, height: 13 }} />}
            onClick={() => total > 1 ? onRemove(entry.id) : onReset(entry.id)}
            title={total > 1 ? "Remove booking" : "Clear booking"}
            style={{ color: "#ef4444" }}
            disabled={globalBusy || isSubmitting}
          />
        </div>
      </div>

      {!entry.collapsed && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <CleanTextarea
            label="Paste Raw Message / WhatsApp Data"
            value={entry.rawText}
            onChange={e => handleRawChange(e.target.value)}
            rows={5} fontMono
            placeholder={`Paste WhatsApp message here…\n\nExample:\nGreen View PG\n402\n7500560748`}
            hint={entry.rawText ? "Fields auto-filled below — edit if needed." : undefined}
          />
          <div className="form-grid">
            <CleanInput label="Customer Name" type="text"
              value={entry.fields.user_name} placeholder="Full name"
              onChange={e => setField("user_name", e.target.value)} />
            <CleanInput label="Phone" required type="text"
              value={entry.fields.user_phone} placeholder="+91XXXXXXXXXX"
              error={entry.errors.user_phone}
              onChange={e => setField("user_phone", e.target.value)} />
            <div className="form-grid-full">
              <CleanInput label="Address" required type="text"
                value={entry.fields.address} placeholder="Building / PG Name, Room No."
                error={entry.errors.address}
                onChange={e => setField("address", e.target.value)} />
            </div>
            <CleanSelect label="Branch" required
              value={entry.fields.branch} options={BRANCH_OPTIONS}
              error={entry.errors.branch}
              onChange={e => setField("branch", e.target.value)} />
            <CleanSelect label="Booking Via" required
              value={entry.fields.booking_via} options={BOOKING_VIA_OPTIONS}
              error={entry.errors.booking_via}
              onChange={e => setField("booking_via", e.target.value as BookingVia)} />
            <div className="form-grid-full">
              <CleanInput label="Live Location URL" type="url"
                value={entry.fields.live_location_url} placeholder="https://maps.google.com/..."
                onChange={e => setField("live_location_url", e.target.value)} />
            </div>
            <CleanInput label="Date & Time" type="datetime-local"
              value={entry.fields.booking_created_date_and_time}
              onChange={e => setField("booking_created_date_and_time", e.target.value)} />
          </div>

          {/* Bottom Create button — visible when expanded */}
          <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:4 }}>
            <CleanButton
              variant="primary" size="sm"
              onClick={() => onCreateSingle(entry.id)}
              loading={isSubmitting} disabled={globalBusy}
            >
              Create Booking
            </CleanButton>
          </div>
        </div>
      )}
    </div>
  );
};

// ── AbandonConfirm ─────────────────────────────────────────────────────────

const AbandonConfirm: React.FC<{
  isOpen: boolean; reason: AbandonReason; onStay: () => void; onLeave: () => void;
}> = ({ isOpen, reason, onStay, onLeave }) => {
  const c = ABANDON_COPY[reason];
  return (
    <CleanModal isOpen={isOpen} onClose={onStay} maxWidth={400} zIndex={999999} closeOnBackdrop
      footer={<><span /><div style={{ display:"flex", gap:8 }}>
        <CleanButton variant="outline" size="sm" onClick={onStay}>Stay</CleanButton>
        <CleanButton variant="primary" size="sm" onClick={onLeave}>{c.confirm}</CleanButton>
      </div></>}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <AlertTriangle style={{ width:20, height:20, color:"#f59e0b", flexShrink:0, marginTop:1 }} />
        <div>
          <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:600, color:"var(--fi-text)" }}>{c.title}</p>
          <p style={{ margin:0, fontSize:13, color:"var(--fi-muted)", lineHeight:1.5 }}>{c.body}</p>
        </div>
      </div>
    </CleanModal>
  );
};

// ── ClearDraftConfirm ──────────────────────────────────────────────────────

const ClearDraftConfirm: React.FC<{ isOpen: boolean; onCancel: () => void; onConfirm: () => void }> =
  ({ isOpen, onCancel, onConfirm }) => (
    <CleanModal isOpen={isOpen} onClose={onCancel} maxWidth={380} zIndex={999999} closeOnBackdrop
      footer={<><span /><div style={{ display:"flex", gap:8 }}>
        <CleanButton variant="outline" size="sm" onClick={onCancel}>Cancel</CleanButton>
        <CleanButton variant="primary" size="sm" onClick={onConfirm}
          style={{ background:"#ef4444", borderColor:"#ef4444" }}>Clear data</CleanButton>
      </div></>}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <AlertTriangle style={{ width:20, height:20, color:"#ef4444", flexShrink:0, marginTop:1 }} />
        <div>
          <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:600, color:"var(--fi-text)" }}>Clear saved draft?</p>
          <p style={{ margin:0, fontSize:13, color:"var(--fi-muted)", lineHeight:1.5 }}>
            All previously saved booking data will be permanently cleared.
          </p>
        </div>
      </div>
    </CleanModal>
  );

// ── Main Modal ─────────────────────────────────────────────────────────────

const CreateBookingModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const cookies = { t: useSelector(selectAccessToken) }; // compat shim — read from Redux
  const user                                = useSelector((s: any) => s.user?.userData || s.user);

  const [entries,          setEntries]      = useState<BookingEntry[]>([emptyEntry()]);
  const [globalBusy,       setGlobalBusy]   = useState(false);
  const [submittingIds,    setSubmittingIds] = useState<Set<string>>(new Set());
  const [exitingIds,       setExitingIds]   = useState<Set<string>>(new Set());
  const [results,          setResults]      = useState<SubmitResult[]>([]);
  const [showAbandon,      setShowAbandon]  = useState(false);
  const [abandonReason,    setAbandonReason]= useState<AbandonReason>("close");
  const [pendingClose,     setPendingClose] = useState(false);
  const [showClearDraft,   setShowClearDraft]= useState(false);
  const [hasSavedDraft,    setHasSavedDraft]= useState(false);

  const isDirty     = hasDraft(entries);
  const showResults = results.length > 0;

  // ── Draft lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft();
    if (draft && draft.length > 0) { setEntries(draft); setHasSavedDraft(true); }
    else                           { setEntries([emptyEntry()]); setHasSavedDraft(false); }
    setResults([]); setExitingIds(new Set()); setSubmittingIds(new Set());
  }, [isOpen]);

  useEffect(() => { if (isOpen) saveDraft(entries); }, [entries, isOpen]);

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [isOpen, isDirty]);

  const blocker = useBlocker(isDirty && isOpen);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    setAbandonReason("navigate");
    setShowAbandon(true);
  }, [blocker.state]);

  // ── Entry CRUD ───────────────────────────────────────────────────────────

  const updateEntry = useCallback((id: string, patch: Partial<BookingEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e)), []);

  const removeEntry = useCallback((id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id)), []);

  const resetEntry = useCallback((id: string) =>
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, rawText: "", fields: emptyFields(), errors: {}, collapsed: false } : e,
    )), []);

  const addEntry = () => {
    const newEntry = emptyEntry();
    setEntries(prev => [...prev, newEntry]);
    setTimeout(() => {
      document
        .getElementById(`booking-entry-${newEntry.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 160);
  };

  // ── Animation helper ─────────────────────────────────────────────────────

  const animateOut = useCallback(async (id: string): Promise<void> => {
    setExitingIds(prev => new Set([...prev, id]));
    await new Promise<void>(r => setTimeout(r, 420));
    setExitingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const addToSubmitting    = (id: string) => setSubmittingIds(prev => new Set([...prev, id]));
  const removeFromSubmitting = (id: string) => setSubmittingIds(prev => { const s = new Set(prev); s.delete(id); return s; });

  // ── Per-card create ──────────────────────────────────────────────────────

  const handleCreateSingle = useCallback(async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry || globalBusy || exitingIds.has(entryId)) return;

    const errors = validateEntry(entry.fields);
    if (Object.keys(errors).length > 0) { updateEntry(entryId, { errors, collapsed: false }); return; }

    addToSubmitting(entryId);
    try {
      await postData({ endpoint: "bookings", token: cookies.t, instance: "identity",
        data: buildPayload(entry, user?.user_id, user?.user_name) });
      showToastnew.success("Booking created");
      removeFromSubmitting(entryId);
      await animateOut(entryId);
    } catch (err: unknown) {
      showToastnew.error(extractErrorMessage(err));
      removeFromSubmitting(entryId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, globalBusy, exitingIds, user, cookies.t, animateOut, updateEntry]);

  // ── Create all (sequential) ──────────────────────────────────────────────

  const handleCreateAll = async () => {
    let hasError = false;
    const validated = entries.map(entry => {
      const errors = validateEntry(entry.fields);
      if (Object.keys(errors).length > 0) hasError = true;
      return { ...entry, errors, collapsed: Object.keys(errors).length > 0 ? false : entry.collapsed };
    });

    if (hasError) { setEntries(validated); showToastnew.error("Please fix the errors before submitting"); return; }

    setGlobalBusy(true);
    const snapshot   = [...entries];
    const resultsArr: SubmitResult[] = [];

    for (const entry of snapshot) {
      addToSubmitting(entry.id);
      try {
        await postData({ endpoint: "bookings", token: cookies.t, instance: "identity",
          data: buildPayload(entry, user?.user_id, user?.user_name) });
        resultsArr.push({ id: entry.id, name: entry.fields.user_name || entry.fields.user_phone, status: "success", message: "Created" });
        removeFromSubmitting(entry.id);
        await animateOut(entry.id);
      } catch (err: unknown) {
        const message = extractErrorMessage(err);
        resultsArr.push({ id: entry.id, name: entry.fields.user_name || entry.fields.user_phone, status: "error", message });
        showToastnew.error(message);
        removeFromSubmitting(entry.id);
      }
    }

    setGlobalBusy(false);
    const allOk = resultsArr.every(r => r.status === "success");
    if (allOk) {
      showToastnew.success(`${resultsArr.length} booking${resultsArr.length > 1 ? "s" : ""} created`);
      clearDraft(); onCreated();
    } else {
      setResults(resultsArr);
      const failed = resultsArr.filter(r => r.status === "error").length;
      showToastnew.error(`${failed} booking${failed > 1 ? "s" : ""} failed`);
    }
  };

  // ── Close / abandon handlers ─────────────────────────────────────────────

  const handleClose = () => {
    if (isDirty && !showResults) {
      setAbandonReason("close"); setPendingClose(true); setShowAbandon(true);
    } else {
      clearDraft(); onClose();
    }
  };

  const handleAbandonLeave = () => {
    setShowAbandon(false);
    if (blocker.state === "blocked") {
      blocker.proceed(); // navigate away — draft stays in localStorage
    } else if (pendingClose) {
      setPendingClose(false);
      clearDraft(); // intentional close → discard draft
      onClose();
    }
  };

  const handleAbandonStay = () => {
    setShowAbandon(false); setPendingClose(false);
    if (blocker.state === "blocked") blocker.reset();
  };

  const handleClearDraft = () => {
    clearDraft(); setEntries([emptyEntry()]); setHasSavedDraft(false);
    setShowClearDraft(false); setResults([]);
  };

  const handleDone = useCallback(() => { clearDraft(); onClose(); }, [onClose]);

  // ── Render ───────────────────────────────────────────────────────────────

  const visibleCount = entries.length;
  const allCreated   = visibleCount === 0 && !showResults;

  useEffect(() => {
    if (!allCreated || !isOpen) return;
    const t = window.setTimeout(handleDone, 3000);
    return () => clearTimeout(t);
  }, [allCreated, isOpen, handleDone]);

  return (
    <>
      <AbandonConfirm isOpen={showAbandon} reason={abandonReason} onStay={handleAbandonStay} onLeave={handleAbandonLeave} />
      <ClearDraftConfirm isOpen={showClearDraft} onCancel={() => setShowClearDraft(false)} onConfirm={handleClearDraft} />

      <CleanModal
        isOpen={isOpen} onClose={handleClose}
        maxWidth={740} zIndex={9999}
        title="Create Bookings"
        subtitle="Paste raw WhatsApp messages — fields auto-fill from the text"
        headerExtra={
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {hasSavedDraft && (
              <button onClick={() => setShowClearDraft(true)} style={{
                fontSize:11, color:"#ef4444", background:"transparent",
                border:"1px solid rgba(239,68,68,0.3)", borderRadius:5,
                padding:"2px 8px", cursor:"pointer", fontWeight:500,
              }}>
                Clear draft
              </button>
            )}
            {isDirty && <span style={{ fontSize:11, color:"#d97706", fontWeight:500 }}>Draft saved</span>}
          </div>
        }
        footer={
          <>
            <span style={{ fontSize:12, color:"var(--fi-muted)" }}>
              {visibleCount} booking{visibleCount !== 1 ? "s" : ""} queued
            </span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {showResults || allCreated ? (
                <CleanButton variant="primary" size="sm" onClick={handleDone}>Done</CleanButton>
              ) : (
                <>
                  <CleanButton variant="outline" size="sm" onClick={handleClose} disabled={globalBusy}>Cancel</CleanButton>
                  <CleanButton variant="primary" size="sm" onClick={handleCreateAll} loading={globalBusy}>
                    Create All ({visibleCount})
                  </CleanButton>
                </>
              )}
            </div>
          </>
        }
      >
        {/* Results panel */}
        {showResults && (
          <div style={{ marginBottom:16, padding:14, background:"var(--sb-hover)", borderRadius:8,
            border:"1px solid var(--fi-border)", display:"flex", flexDirection:"column", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em",
              textTransform:"uppercase", color:"var(--fi-muted)" }}>Results</span>
            {results.map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
                {r.status === "success"
                  ? <CheckCircle style={{ width:15, height:15, color:"#22c55e", flexShrink:0 }} />
                  : <XCircle    style={{ width:15, height:15, color:"#ef4444", flexShrink:0 }} />}
                <span style={{ fontWeight:500, color:"var(--fi-text)" }}>{r.name || "—"}</span>
                <span style={{ color:"var(--fi-muted)" }}>— {r.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty all-done state (from per-card creates) */}
        {allCreated && (
          <div style={{ textAlign:"center", padding:"40px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <CheckCircle style={{ width:40, height:40, color:"#22c55e" }} />
            <p style={{ margin:0, fontSize:14, fontWeight:600, color:"var(--fi-text)" }}>All bookings created!</p>
            <p style={{ margin:0, fontSize:12, color:"var(--fi-muted)" }}>Closing automatically…</p>
          </div>
        )}

        {/* Entry cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {entries.map((entry, i) => (
            <EntryAnimWrapper key={entry.id} id={`booking-entry-${entry.id}`} exiting={exitingIds.has(entry.id)}>
              <BookingEntryCard
                entry={entry} index={i} total={entries.length}
                isSubmitting={submittingIds.has(entry.id)}
                globalBusy={globalBusy}
                onChange={updateEntry}
                onRemove={removeEntry}
                onReset={resetEntry}
                onCreateSingle={handleCreateSingle}
              />
            </EntryAnimWrapper>
          ))}

          {visibleCount > 0 && !showResults && (
            <button type="button" onClick={addEntry} disabled={globalBusy}
              style={{
                width:"100%", padding:"12px 0", borderRadius:8,
                border:"2px dashed var(--fi-border)", background:"transparent",
                fontSize:13, color:"var(--fi-muted)",
                cursor: globalBusy ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                transition:"border-color 140ms ease, color 140ms ease",
                opacity: globalBusy ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (globalBusy) return;
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--fi-border-focus)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fi-text)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--fi-border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fi-muted)";
              }}
            >
              <Plus style={{ width:14, height:14 }} />
              Add Another Booking
            </button>
          )}
        </div>
      </CleanModal>
    </>
  );
};

export default CreateBookingModal;
