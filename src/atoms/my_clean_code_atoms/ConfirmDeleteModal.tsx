import React from "react";
import { AlertTriangle } from "lucide-react";
import { CleanModal } from "./CleanModal";
import { CleanButton } from "./CleanButton";

export interface ConfirmDeleteModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  onConfirm:    () => void;
  loading?:     boolean;
  title?:       string;
  description?: string;
  zIndex?:      number;
  /** "modal" (default) = always centered  |  "auto" = mobile→sheet, desktop→modal  |  "sheet" = always bottom sheet */
  mode?:        "auto" | "modal" | "sheet";
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading     = false,
  title       = "Delete this item?",
  description = "This action cannot be undone. The record will be permanently removed.",
  zIndex      = 99999,
  mode        = "modal",
}) => (
  <CleanModal
    isOpen={isOpen}
    onClose={onClose}
    maxWidth={420}
    zIndex={zIndex}
    expandable={false}
    closeOnBackdrop={!loading}
    mode={mode}
    footer={
      <>
        <span />
        <div style={{ display: "flex", gap: 8 }}>
          <CleanButton variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </CleanButton>
          <CleanButton variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            Delete
          </CleanButton>
        </div>
      </>
    }
  >
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width:           36,
        height:          36,
        borderRadius:    8,
        background:      "rgba(239,68,68,0.10)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        flexShrink:      0,
      }}>
        <AlertTriangle size={18} style={{ color: "#ef4444" }} />
      </div>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--fi-text)", lineHeight: 1.3 }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--fi-muted)", lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  </CleanModal>
);

export default ConfirmDeleteModal;
