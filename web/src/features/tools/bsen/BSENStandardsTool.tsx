import React, { useMemo, useState } from "react";
import { BSEN_STANDARDS } from "./bsen.data";
import type { BSENStandard } from "./bsen.types";
import "./BSENStandardsTool.css";

function normalise(value: string) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function titleNormalise(value: string) {
  return String(value || "").trim().toLowerCase();
}

function findStandard(family: string, number: string): BSENStandard | null {
  if (!number) return null;

  const normFam = normalise(family);
  const normNum = normalise(number);

  let match =
    BSEN_STANDARDS.find((s) => normalise(s.family) === normFam && normalise(s.number) === normNum) ??
    null;
  if (match) return match;

  const combined = `${family} ${number}`.trim();
  match = BSEN_STANDARDS.find((s) => normalise(s.code) === normalise(combined)) ?? null;
  if (match) return match;

  match = BSEN_STANDARDS.find((s) => normalise(s.number) === normNum) ?? null;
  if (match) return match;

  match = BSEN_STANDARDS.find((s) => normalise(s.number).includes(normNum)) ?? null;
  return match;
}

const categoryOrder = ["All", "Security", "Performance", "Glazing", "Thermal", "Fire", "General"] as const;
type CategoryFilter = (typeof categoryOrder)[number];

function inferCategories(item: BSENStandard): string[] {
  const bucket = new Set<string>();
  const words = [item.code, item.title, item.applies, item.covers, item.plain, ...(item.tags || [])]
    .join(" ")
    .toLowerCase();

  if (
    words.includes("security") ||
    words.includes("burglar") ||
    words.includes("pas 24") ||
    words.includes("secured by design") ||
    words.includes("manual attack") ||
    words.includes("forced entry")
  ) {
    bucket.add("Security");
  }

  if (
    words.includes("thermal") ||
    words.includes("u-value") ||
    words.includes("uw value") ||
    words.includes("low-e") ||
    words.includes("emissivity") ||
    words.includes("solar") ||
    words.includes("insulating glass")
  ) {
    bucket.add("Thermal");
  }

  if (
    words.includes("glazing") ||
    words.includes("glass in building") ||
    words.includes("laminated") ||
    words.includes("toughened") ||
    words.includes("heat soaked") ||
    words.includes("impact")
  ) {
    bucket.add("Glazing");
  }

  if (
    words.includes("fire") ||
    words.includes("smoke") ||
    words.includes("fire resisting") ||
    words.includes("smoke control")
  ) {
    bucket.add("Fire");
  }

  if (
    words.includes("performance") ||
    words.includes("weathertightness") ||
    words.includes("wind load") ||
    words.includes("operating forces") ||
    words.includes("product standard") ||
    words.includes("classification")
  ) {
    bucket.add("Performance");
  }

  if (bucket.size === 0) {
    bucket.add("General");
  }

  return Array.from(bucket);
}

export default function BSENStandardsTool() {
  const [family, setFamily] = useState("BS EN");
  const [number, setNumber] = useState("14351-1");
  const [selectedCode, setSelectedCode] = useState("BS EN 14351-1");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");

  const selected = useMemo(() => {
    if (selectedCode) {
      return BSEN_STANDARDS.find((s) => s.code === selectedCode) ?? findStandard(family, number) ?? BSEN_STANDARDS[0];
    }
    return findStandard(family, number) ?? BSEN_STANDARDS[0];
  }, [family, number, selectedCode]);

  const filtered = useMemo(() => {
    const q = titleNormalise(query);

    return BSEN_STANDARDS.filter((item) => {
      const categories = inferCategories(item);
      const categoryMatch = category === "All" || categories.includes(category);
      if (!categoryMatch) return false;

      if (!q) return true;

      return [
        item.code,
        item.family,
        item.number,
        item.title,
        item.applies,
        item.covers,
        item.plain,
        ...(item.tags || []),
        ...categories,
      ].some((value) => titleNormalise(String(value || "")).includes(q));
    });
  }, [category, query]);

  function handleSearch() {
    const match = findStandard(family, number);
    if (match) {
      setSelectedCode(match.code);
      setFamily(match.family);
      setNumber(match.number);
    } else {
      setSelectedCode("");
    }
  }

  const selectedCategories = selected ? inferCategories(selected) : [];

  return (
    <div className="bsen-tool" style={{ display: "grid", gap: 16, alignItems: "start" }}>
      <div className="bsen-card ui-card">
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>EN / BS Numbers</div>
          <div style={{ fontSize: 13, color: "#52525b", maxWidth: 900 }}>
            Search and review relevant EN / BS standards for windows, doors, glazing, thermal, fire, security and related compliance topics.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0, 1fr) auto", gap: 10 }}>
          <select value={family} onChange={(e) => setFamily(e.currentTarget.value)} className="bsen-input ui-input">
            <option value="BS">BS</option>
            <option value="EN">EN</option>
            <option value="BS EN">BS EN</option>
            <option value="BS EN ISO">BS EN ISO</option>
          </select>

          <input
            value={number}
            onChange={(e) => setNumber(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Enter standard number, e.g. 14351-1"
            className="bsen-input ui-input"
          />

          <button
            type="button"
            onClick={handleSearch}
            className="bsen-button ui-button"
          >
            Search
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div
          className="bsen-card bsen-card--library ui-card"
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#18181b" }}>Standards library</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Filter by code, title, tag, category or topic"
              className="bsen-input ui-input"
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categoryOrder.map((item) => {
                const active = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={active ? "bsen-chip bsen-chip--active ui-chip" : "bsen-chip ui-chip"}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#71717a" }}>{filtered.length} standards shown</div>
          </div>

          <div style={{ minHeight: 0, overflowY: "auto", paddingRight: 6, display: "grid", gap: 8 }}>
            {filtered.map((item) => {
              const active = selected?.code === item.code;
              const categories = inferCategories(item);

              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(item.code);
                    setFamily(item.family);
                    setNumber(item.number);
                  }}
                  className={active ? "bsen-list-item bsen-list-item--active" : "bsen-list-item"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#18181b" }}>{item.code}</div>
                    <span
                      className="bsen-badge"
                    >
                      {categories[0] || "General"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.35, color: "#52525b" }}>{item.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="bsen-card bsen-card--detail ui-card"
        >
          {selected ? (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#71717a" }}>Overview only</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#18181b" }}>
                    {selected.code}{selected.year ? `: ${selected.year}` : ""}
                  </div>
                  {selectedCategories.map((item) => (
                    <span
                      key={item}
                      className="bsen-badge"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#18181b" }}>{selected.title}</div>
                <div style={{ fontSize: 13, color: "#52525b" }}>
                  <strong>Applies to:</strong> {selected.applies}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#18181b" }}>What this standard covers</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "#3f3f46" }}>{selected.covers}</div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#18181b" }}>Explained in plain English</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "#3f3f46" }}>{selected.plain}</div>
              </div>

              {!!(selected.tags || []).length && (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#18181b" }}>Related tags</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(selected.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="bsen-tag"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#52525b" }}>
              No matching standard found. Check the family (BS / EN / BS EN / BS EN ISO) and try a number such as 14351-1, 12150 or 10077-1.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

