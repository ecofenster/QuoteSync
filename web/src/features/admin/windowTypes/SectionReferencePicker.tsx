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
    <div className="qs-migrated-195">
      <div className="qs-migrated-17">
        <div className="admin-setting-label">{roleLabel}</div>
        {(conditionLabel || contextLabel) ? (
          <div className="admin-body-copy qs-migrated-194">
            {[conditionLabel, contextLabel].filter(Boolean).join(" • ")}
          </div>
        ) : null}
        {selectedOption ? (
          <div className="admin-body-copy qs-migrated-194">
            {selectedOption.referenceLabel}
          </div>
        ) : null}
      </div>

      <div className="qs-migrated-57">
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search section refs" className="qs-migrated-196"
        />
        <select
          value={selectedId ?? ""}
          onChange={(event) => onSelect(event.currentTarget.value || null)} className="qs-migrated-196"
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
