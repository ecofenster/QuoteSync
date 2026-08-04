import { useMemo, useState } from "react";
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
    <div className="bsen-tool">
      <div className="bsen-card ui-card">
        <div className="bsen-stack bsen-stack--compact">
          <div className="bsen-title">EN / BS Numbers</div>
          <div className="bsen-intro">
            Search and review relevant EN / BS standards for windows, doors, glazing, thermal, fire, security and related compliance topics.
          </div>
        </div>

        <div className="bsen-search-grid">
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

      <div className="bsen-content-grid">
        <div
          className="bsen-card bsen-card--library ui-card"
        >
          <div className="bsen-stack">
            <div className="bsen-section-title">Standards library</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Filter by code, title, tag, category or topic"
              className="bsen-input ui-input"
            />
            <div className="bsen-chip-row">
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
            <div className="bsen-count">{filtered.length} standards shown</div>
          </div>

          <div className="bsen-list">
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
                  <div className="bsen-list-item__header">
                    <div className="bsen-list-item__code">{item.code}</div>
                    <span
                      className="bsen-badge"
                    >
                      {categories[0] || "General"}
                    </span>
                  </div>
                  <div className="bsen-list-item__title">{item.title}</div>
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
              <div className="bsen-stack bsen-stack--compact">
                <div className="bsen-eyebrow">Overview only</div>
                <div className="bsen-detail-heading">
                  <div className="bsen-title">
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
                <div className="bsen-detail-title">{selected.title}</div>
                <div className="bsen-intro">
                  <strong>Applies to:</strong> {selected.applies}
                </div>
              </div>

              <div className="bsen-stack bsen-stack--compact">
                <div className="bsen-detail-section-title">What this standard covers</div>
                <div className="bsen-detail-copy">{selected.covers}</div>
              </div>

              <div className="bsen-stack bsen-stack--compact">
                <div className="bsen-detail-section-title">Explained in plain English</div>
                <div className="bsen-detail-copy">{selected.plain}</div>
              </div>

              {!!(selected.tags || []).length && (
                <div className="bsen-stack">
                  <div className="bsen-detail-section-title">Related tags</div>
                  <div className="bsen-chip-row">
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
            <div className="bsen-empty">
              No matching standard found. Check the family (BS / EN / BS EN / BS EN ISO) and try a number such as 14351-1, 12150 or 10077-1.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

