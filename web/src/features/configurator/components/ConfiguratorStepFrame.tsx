import React from "react";
import { Button } from "../../estimatePicker/tabs/shared";

type Props = {
  title: string;
  description: string;
  errors?: string[];
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
};

export default function ConfiguratorStepFrame(props: Props) {
  const { title, description, errors = [], canGoBack, canGoNext, onBack, onNext, nextLabel = "Next", hideHeader = false, children } = props;

  return (
    <div style={{ borderRadius: 18, border: "1px solid #e4e4e7", background: "#fff", padding: 18, display: "grid", gap: 16 }}>
      {!hideHeader && (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>{title}</div>
          <div style={{ fontSize: 13, color: "#71717a" }}>{description}</div>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ borderRadius: 14, border: "1px solid #fecaca", background: "#fef2f2", padding: 12, display: "grid", gap: 6 }}>
          {errors.map((error) => (
            <div key={error} style={{ fontSize: 13, color: "#991b1b" }}>
              {error}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>{children}</div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={onBack} disabled={!canGoBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!canGoNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
