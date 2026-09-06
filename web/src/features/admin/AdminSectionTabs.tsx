import { useRef } from "react";

export type AdminSectionTab<T extends string> = { id: T; label: string };

export default function AdminSectionTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  label,
}: {
  tabs: readonly AdminSectionTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    refs.current[index]?.focus();
  };
  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(next);
  };
  return (
    <div className="ui-tabs calculator-admin__tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(node) => { refs.current[index] = node; }}
          type="button"
          role="tab"
          id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className="ui-tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(index, event)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
