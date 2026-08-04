import B92PlaceholderModalContent from "./B92PlaceholderModalContent";

const PRODUCT_CATEGORIES = [
  { label: "Windows", status: "Active", detail: "Europa 92 Alu Clad / B92 resolver active" },
  { label: "Balcony/French Doors", status: "Future", detail: "Parked for donor product migration" },
  { label: "Entrance Doors", status: "Future", detail: "Parked; door resolver not active" },
  { label: "Lift & Slide", status: "Future", detail: "Dedicated product flow later" },
  { label: "Folding Doors", status: "Future", detail: "Dedicated product flow later" },
  { label: "Curtain Wall", status: "Future", detail: "Dedicated product flow later" },
  { label: "Rooflights", status: "Future", detail: "Dedicated product flow later" },
  { label: "Internal Doors", status: "Future", detail: "Dedicated product flow later" },
  { label: "Garage Doors", status: "Future", detail: "Dedicated product flow later" },
  { label: "Pergolas", status: "Future", detail: "Dedicated product flow later" },
  { label: "Blinds", status: "Future", detail: "Dedicated product flow later" },
  { label: "Shutters", status: "Future", detail: "Dedicated product flow later" },
] as const;

export default function B92ProductSystemModal() {
  return (
    <div className="b92-product-modal">
      <div className="b92-product-modal__intro">
        <div className="b92-section-title">Product category</div>
        <div className="b92-body-copy">
          Windows is the active B92 path. Parked categories are visible for roadmap context and do not change resolver state.
        </div>
      </div>
      <div className="b92-product-modal__grid">
        {PRODUCT_CATEGORIES.map((category) => {
          const active = category.status === "Active";
          return (
            <button
              key={category.label}
              type="button"
              disabled={!active}
              className={`b92-product-tile${active ? " b92-product-tile--active" : ""}`}
            >
              <span className="b92-product-tile__copy">
                <span className="b92-product-tile__title">{category.label}</span>
                <span className="b92-body-copy">{category.detail}</span>
              </span>
              <span className={`b92-product-tile__status${active ? " b92-product-tile__status--active" : ""}`}>
                {category.status}
              </span>
            </button>
          );
        })}
      </div>
      <B92PlaceholderModalContent>
        Active selection: Windows / Europa 92 Alu Clad. The B92 resolver remains active; profile references stay automatic and diagnostic-only.
      </B92PlaceholderModalContent>
    </div>
  );
}
