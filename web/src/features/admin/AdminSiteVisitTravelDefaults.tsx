import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

const SETTING_KEY = "projectCalculator.siteVisitTravelDefaults";
const defaults = { officePostcode: "", mileageRate: "0.55", travelLabourRate: "0", defaultPeople: 1, mealPerPerson: "0", siteVisitMarkup: "10", allocation: "separate", allocationBasis: "equal_per_position" };
type Defaults = typeof defaults;
type Setting = { key: string; value: unknown };

function normalize(value: unknown): Defaults {
  const source = value && typeof value === "object" ? value as Partial<Defaults> : {};
  return { ...defaults, ...source, officePostcode: String(source.officePostcode ?? ""), mileageRate: String(source.mileageRate ?? "0.55"), travelLabourRate: String(source.travelLabourRate ?? "0"), defaultPeople: Math.max(1, Number(source.defaultPeople) || 1), mealPerPerson: String(source.mealPerPerson ?? "0"), siteVisitMarkup: String(source.siteVisitMarkup ?? "10") };
}

export default function AdminSiteVisitTravelDefaults() {
  const [value, setValue] = useState<Defaults>(defaults);
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/settings/projectPreferences")
      .then((result) => {
        const row = (Array.isArray(result) ? result as Setting[] : []).find((item) => item.key === SETTING_KEY);
        if (!cancelled) { setValue(normalize(row?.value)); setExists(Boolean(row)); }
      })
      .catch(() => { if (!cancelled) setStatus("Site Visit defaults could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setStatus("");
    const body = exists ? { value, group_name: "projectPreferences" } : { key: SETTING_KEY, value, group_name: "projectPreferences" };
    try {
      await apiFetch(exists ? `/api/settings/${SETTING_KEY}` : "/api/settings", { method: exists ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setExists(true);
      setStatus("Site Visit defaults saved. Existing costing revisions are unchanged.");
    } catch {
      setStatus("Site Visit defaults could not be saved.");
    }
  }

  return <section className="admin-card admin-card--section ui-card">
    <div><div className="admin-group-title">Site Visit / Travel Defaults</div><div className="admin-body-copy">Company travel defaults for new Project Costings. Google Maps credentials remain under Integrations.</div></div>
    <div className="admin-dimensions-grid admin-aligned-fields">
      <label><span className="admin-setting-label">Office postcode / base location</span><input className="admin-input ui-input" value={value.officePostcode} onChange={(event) => setValue({ ...value, officePostcode: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">Mileage rate (£ per mile)</span><input className="admin-input ui-input" inputMode="decimal" value={value.mileageRate} onChange={(event) => setValue({ ...value, mileageRate: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">Travel labour (£ per person/hour)</span><input className="admin-input ui-input" inputMode="decimal" value={value.travelLabourRate} onChange={(event) => setValue({ ...value, travelLabourRate: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">People travelling</span><input className="admin-input ui-input" type="number" min="1" value={value.defaultPeople} onChange={(event) => setValue({ ...value, defaultPeople: Number(event.currentTarget.value) })} /></label>
      <label><span className="admin-setting-label">Meals/subsistence per person</span><input className="admin-input ui-input" inputMode="decimal" value={value.mealPerPerson} onChange={(event) => setValue({ ...value, mealPerPerson: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">Site Visit / Travel markup (%)</span><input className="admin-input ui-input" inputMode="decimal" value={value.siteVisitMarkup} onChange={(event) => setValue({ ...value, siteVisitMarkup: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">Default allocation</span><select className="admin-input ui-input" value={value.allocation} onChange={(event) => setValue({ ...value, allocation: event.currentTarget.value })}><option value="separate">Separate Site Visit / Travel category</option><option value="products">Products / Supply Only</option></select></label>
      <label><span className="admin-setting-label">Product allocation basis</span><select className="admin-input ui-input" value={value.allocationBasis} onChange={(event) => setValue({ ...value, allocationBasis: event.currentTarget.value })}><option value="equal_per_position">Equal per included position</option><option value="quantity">By included quantity</option><option value="purchase_value">By included purchase value</option></select></label>
    </div>
    <div className="admin-flex-row"><button className="ui-button ui-button--primary" onClick={() => void save()}>Save Site Visit Defaults</button>{status ? <span role="status" className="admin-body-copy">{status}</span> : null}</div>
  </section>;
}
