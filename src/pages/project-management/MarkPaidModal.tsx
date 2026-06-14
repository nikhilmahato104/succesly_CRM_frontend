import React, { useState } from "react";
import { CleanModal, CleanButton, CleanSelect, CleanInput } from "../../atoms/my_clean_code_atoms";
import { PAYMENT_MODE_OPTIONS, type PaymentMode } from "./types";

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  onConfirm:   (paidDate: string, paymentMode: PaymentMode | "") => Promise<void>;
  termNumber:  number;
  amount:      number;
  loading?:    boolean;
}

const MarkPaidModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  termNumber,
  amount,
  loading = false,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [paidDate,     setPaidDate]     = useState(today);
  const [paymentMode,  setPaymentMode]  = useState<PaymentMode | "">("");

  const handleConfirm = async () => {
    await onConfirm(paidDate, paymentMode);
  };

  return (
    <CleanModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mark Term #${termNumber} as Paid`}
      subtitle={`Amount: ₹${amount.toLocaleString("en-IN")}`}
      maxWidth={400}
      expandable={false}
      mode="modal"
      footer={
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <CleanButton variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </CleanButton>
            <CleanButton variant="primary" size="sm" onClick={handleConfirm} loading={loading}>
              Confirm Payment
            </CleanButton>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <CleanInput
          type="date"
          label="Payment Date"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          hint="Defaults to today if left blank"
        />
        <CleanSelect
          label="Payment Mode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as PaymentMode | "")}
          options={PAYMENT_MODE_OPTIONS as unknown as { value: string; label: string }[]}
          placeholder="Select mode (optional)"
        />
      </div>
    </CleanModal>
  );
};

export default MarkPaidModal;
