import React from "react";

export type EstimateCommercialView = "internal" | "customer";

export default function EstimateCommercialViewSwitch({
  view,
  onChange,
}: {
  view: EstimateCommercialView;
  onChange: (view: EstimateCommercialView) => void;
}) {
  const nextView = view === "internal" ? "customer" : "internal";
  const label = nextView === "customer" ? "Customer View" : "Internal View";

  return (
    <button
      type="button"
      className="ui-button"
      aria-label={`Switch to ${label}`}
      onClick={() => onChange(nextView)}
    >
      {label}
    </button>
  );
}
