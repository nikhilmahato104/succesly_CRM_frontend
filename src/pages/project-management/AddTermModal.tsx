import React, { useState } from "react";
import { CleanModal, CleanButton, CleanSelect, CleanInput } from "../../atoms/my_clean_code_atoms";
import { PAYMENT_MODE_OPTIONS, type PaymentMode, type AddTermPayload, toISO } from "./types";

interface Props {
  isOpen:         boolean;
  onClose:        () => void;
  onConfirm:      (payload: AddTermPayload) => Promise<void>;
  nextTermNumber: number;
  loading?:       boolean;
}

interface FormState {
  amount:       string;
  due_date:     string;
  payment_mode: PaymentMode | "";
  note:         string;
}

const EMPTY: FormState = { amount: "", due_date: "", payment_mode: "", note: "" };

const AddTermModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  nextTermNumber,
  loading = false,
}) => {
  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = <K extends keyof FormState>(key: K, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errs.amount = "Amount is required and must be a positive number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    const payload: AddTermPayload = {
      term_number:  nextTermNumber,
      amount:       Number(form.amount),
      due_date:     toISO(form.due_date) ?? undefined,
      payment_mode: form.payment_mode || undefined,
      note:         form.note || undefined,
    };
    await onConfirm(payload);
    setForm(EMPTY);
    setErrors({});
  };

  const handleClose = () => {
    setForm(EMPTY);
    setErrors({});
    onClose();
  };

  return (
    <CleanModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Payment Term"
      subtitle={`New term will be #${nextTermNumber}`}
      maxWidth={420}
      expandable={false}
      mode="modal"
      footer={
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <CleanButton variant="outline" size="sm" onClick={handleClose} disabled={loading}>
              Cancel
            </CleanButton>
            <CleanButton variant="primary" size="sm" onClick={handleConfirm} loading={loading}>
              Add Term
            </CleanButton>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <CleanInput
            label="Term #"
            type="number"
            value={String(nextTermNumber)}
            readOnly
            style={{ width: 80, flexShrink: 0 }}
          />
          <CleanInput
            label="Amount (₹)"
            type="number"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="e.g. 5000"
            error={errors.amount}
            required
            style={{ flex: 1 }}
            min={1}
          />
        </div>

        <CleanInput
          type="date"
          label="Due Date"
          value={form.due_date}
          onChange={(e) => set("due_date", e.target.value)}
        />

        <CleanSelect
          label="Payment Mode"
          value={form.payment_mode}
          onChange={(e) => set("payment_mode", e.target.value as PaymentMode | "")}
          options={PAYMENT_MODE_OPTIONS as unknown as { value: string; label: string }[]}
          placeholder="Select mode (optional)"
        />

        <CleanInput
          label="Note"
          type="text"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="e.g. Extra feature addition"
        />
      </div>
    </CleanModal>
  );
};

export default AddTermModal;
