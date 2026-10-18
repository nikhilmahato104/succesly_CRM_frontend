import React from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { CleanButton } from "./CleanButton";

export interface BulkActionBarProps {
  selectedCount:  number;
  onDeleteAll:    () => void;
  onClear:        () => void;
  loading?:       boolean;
  warningLabel?:  string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onDeleteAll,
  onClear,
  loading       = false,
  warningLabel  = "This action cannot be undone",
}) => (
  <div
    style={{
      position:       "absolute",
      bottom:         0,
      left:           0,
      right:          0,
      zIndex:         100,
      transform:      selectedCount > 0 ? "translateY(0)" : "translateY(110%)",
      transition:     "transform 220ms cubic-bezier(0.4,0,0.2,1)",
      background:     "var(--dt-solid)",
      borderTop:      "2px solid var(--fi-border-error)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        "10px 16px",
      gap:            12,
      pointerEvents:  selectedCount > 0 ? "auto" : "none",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <AlertTriangle size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)", flexShrink: 0 }}>
        {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected
      </span>
      <span style={{ fontSize: 12, color: "var(--dt-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        — {warningLabel}
      </span>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <CleanButton
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={loading}
        iconLeft={<X size={13} />}
      >
        Clear
      </CleanButton>
      <CleanButton
        variant="danger"
        size="sm"
        onClick={onDeleteAll}
        loading={loading}
        iconLeft={<Trash2 size={13} />}
      >
        Delete All
      </CleanButton>
    </div>
  </div>
);

export default BulkActionBar;
