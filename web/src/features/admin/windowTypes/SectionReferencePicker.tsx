import React, { useMemo, useState } from "react";

export type SectionReferenceOption = {
  id: string;
  referenceLabel: string;
  description?: string | null;
};

type Props = {
  roleLabel: string;
  conditionLabel?: string;
  contextLabel?: string;
  options: SectionReferenceOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const inputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  padding: "0 10px",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

export default function SectionReferencePicker(props: Props) {
  const { roleLabel, conditionLabel, contextLabel, options, selectedId, onSelect } = props;
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const haystack = `${option.referenceLabel} ${option.description ?? ""}`.trim().toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  const selectedOption = options.find((option) => option.id === selectedId) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div className="admin-setting-label">{roleLabel}</div>
        {(conditionLabel || contextLabel) ? (
          <div className="admin-body-copy" style={{ fontSize: 12 }}>
            {[conditionLabel, contextLabel].filter(Boolean).join(" • ")}
          </div>
        ) : null}
        {selectedOption ? (
          <div className="admin-body-copy" style={{ fontSize: 12 }}>
            {selectedOption.referenceLabel}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search section refs"
          style={inputStyle}
        />
        <select
          value={selectedId ?? ""}
          onChange={(event) => onSelect(event.currentTarget.value || null)}
          style={inputStyle}
        >
          <option value="">Unmapped</option>
          {filteredOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.referenceLabel}
              {option.description ? ` — ${option.description}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
