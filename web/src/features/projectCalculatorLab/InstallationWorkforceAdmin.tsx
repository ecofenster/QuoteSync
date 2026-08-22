import { useEffect, useState } from "react";
import { projectCalculatorLabApi } from "./api/projectCalculatorLabApi";
import type { InstallationWorkforce } from "./domain/projectCalculatorLab.types";

const EMPTY: InstallationWorkforce = { companies: [], installers: [], teams: [], capabilities: [] };
type Company = InstallationWorkforce["companies"][number];
type Installer = InstallationWorkforce["installers"][number];
type Team = InstallationWorkforce["teams"][number];
type Editor = { kind: "company"; item?: Company } | { kind: "installer"; item?: Installer } | { kind: "team"; item?: Team };

const CAPABILITY_LABELS: Record<string, string> = {
  standard_windows: "Standard Windows", entrance_doors: "Entrance Doors", sliding_doors: "Sliding Doors",
  lift_and_slide: "Lift & Slide", bifolds: "Bifolds", large_heavy_glazing: "Large / Heavy Glazing",
  retrofit: "Retrofit", new_build: "New Build", aluminium: "Aluminium", timber: "Timber", pvc_u: "PVC-U",
  specialist_lifting: "Specialist Lifting / Equipment", kit_assembly: "Kit Assembly",
};
const capabilityLabel = (value: string) => CAPABILITY_LABELS[value] ?? value.replaceAll("_", " ");

function CapabilityChecklist({ capabilities, selected = [] }: { capabilities: string[]; selected?: string[] }) {
  return <fieldset className="workforce-admin__fieldset"><legend>Capabilities</legend><div className="workforce-admin__check-grid">
    {capabilities.map(item => <label key={item}><input type="checkbox" name="capabilities" value={item} defaultChecked={selected.includes(item)} /> <span>{capabilityLabel(item)}</span></label>)}
  </div></fieldset>;
}

export default function InstallationWorkforceAdmin() {
  const [value, setValue] = useState<InstallationWorkforce>(EMPTY);
  const [tab, setTab] = useState<"companies" | "installers" | "teams">("companies");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorCompanyId, setEditorCompanyId] = useState("");
  const [managedCompanyId, setManagedCompanyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void projectCalculatorLabApi.getInstallationWorkforce().then(setValue).catch(error => setMessage(error instanceof Error ? error.message : "Installation workforce could not be loaded.")); }, []);
  useEffect(() => { if (editor?.kind === "installer" || editor?.kind === "team") setEditorCompanyId(editor.item?.companyId ?? managedCompanyId ?? value.companies.find(item => item.active)?.id ?? ""); }, [editor, managedCompanyId, value.companies]);

  const companyName = (id: string) => value.companies.find(item => item.id === id)?.name ?? "Unknown company";
  const showTab = (next: typeof tab) => { setTab(next); if (next === "companies") setManagedCompanyId(null); };
  const manageCompany = (id: string) => { setManagedCompanyId(id); setTab("installers"); };
  const save = async (form: HTMLFormElement) => {
    if (!editor) return;
    const data = new FormData(form); setBusy(true); setMessage("");
    try {
      if (editor.kind === "company") setValue(await projectCalculatorLabApi.saveInstallationCompany(editor.item?.id, { name:data.get("name"),address:{line1:data.get("address")},postcode:data.get("postcode"),telephone:data.get("telephone"),email:data.get("email"),notes:data.get("notes"),dayRate:data.get("dayRate"),active:data.get("active")==="on" }));
      if (editor.kind === "installer") setValue(await projectCalculatorLabApi.saveInstallationInstaller(editor.item?.id, { companyId:data.get("companyId"),name:data.get("name"),mobile:data.get("mobile"),email:data.get("email"),address:{line1:data.get("address")},postcode:data.get("postcode"),dayRate:data.get("dayRate"),active:data.get("active")==="on",capabilities:data.getAll("capabilities") }));
      if (editor.kind === "team") setValue(await projectCalculatorLabApi.saveInstallationTeam(editor.item?.id, { companyId:data.get("companyId"),name:data.get("name"),normalCrewSize:Number(data.get("crewSize")),baseAddress:{line1:data.get("address")},basePostcode:data.get("postcode"),active:data.get("active")==="on",capabilities:data.getAll("capabilities"),installerIds:data.getAll("installerIds") }));
      setMessage(`${editor.kind === "company" ? "Installation Company" : editor.kind === "installer" ? "Installer" : "Installation Team"} saved.`); setEditor(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Installation workforce could not be saved."); }
    finally { setBusy(false); }
  };

  const selectedCompany = editor?.kind === "company" ? editor.item : undefined;
  const selectedInstaller = editor?.kind === "installer" ? editor.item : undefined;
  const selectedTeam = editor?.kind === "team" ? editor.item : undefined;
  const defaultCompanyId = editorCompanyId || selectedInstaller?.companyId || selectedTeam?.companyId || managedCompanyId || value.companies.find(item => item.active)?.id || "";
  const visibleInstallers = managedCompanyId ? value.installers.filter(item => item.companyId === managedCompanyId) : value.installers;

  return <section className="ui-card calculator-lab__card workforce-admin">
    <header className="workforce-admin__header"><div><h3>Installation Workforce</h3><p>Manage companies, installers and teams. Estimates retain their saved workforce snapshots.</p></div></header>
    <nav className="workforce-admin__tabs" aria-label="Installation Workforce sections">
      {(["companies", "installers", "teams"] as const).map(item => <button key={item} type="button" className={`ui-button ${tab === item ? "ui-button--primary" : ""}`} aria-pressed={tab === item} onClick={() => showTab(item)}>{item[0].toUpperCase() + item.slice(1)} <span>{value[item].length}</span></button>)}
    </nav>
    {managedCompanyId && tab !== "companies" ? <div className="workforce-admin__context"><span>Managing <b>{companyName(managedCompanyId)}</b></span><button type="button" className="ui-button" onClick={() => setManagedCompanyId(null)}>Show all</button></div> : null}

    {tab === "companies" ? <div className="workforce-admin__section"><div className="workforce-admin__section-heading"><h4>Installation Companies</h4><button type="button" className="ui-button ui-button--primary" onClick={() => setEditor({ kind:"company" })}>+ Add Installation Company</button></div><div className="workforce-admin__table-wrap"><table className="ui-table workforce-admin__table"><thead><tr><th>Company</th><th>Postcode</th><th>Telephone</th><th>Email</th><th>Installers</th><th>Teams</th><th>Active</th><th>Actions</th></tr></thead><tbody>{value.companies.map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.postcode || "—"}</td><td>{item.telephone || "—"}</td><td>{item.email || "—"}</td><td>{value.installers.filter(installer => installer.companyId === item.id).length}</td><td>{value.teams.filter(team => team.companyId === item.id).length}</td><td>{item.active ? "Yes" : "No"}</td><td><div className="workforce-admin__actions"><button type="button" className="ui-button" onClick={() => setEditor({ kind:"company", item })}>Edit</button><button type="button" className="ui-button" onClick={() => manageCompany(item.id)}>Manage</button></div></td></tr>)}{!value.companies.length ? <tr><td colSpan={8}>No Installation Companies configured.</td></tr> : null}</tbody></table></div></div> : null}

    {tab === "installers" ? <div className="workforce-admin__section"><div className="workforce-admin__section-heading"><h4>Installers</h4><button type="button" className="ui-button ui-button--primary" disabled={!value.companies.length} onClick={() => setEditor({ kind:"installer" })}>+ Add Installer</button></div><div className="workforce-admin__table-wrap"><table className="ui-table workforce-admin__table"><thead><tr><th>Installer</th><th>Company</th><th>Mobile</th><th>Email</th><th>Base / Postcode</th><th>Day Rate</th><th>Capabilities</th><th>Active</th><th>Actions</th></tr></thead><tbody>{visibleInstallers.map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{companyName(item.companyId)}</td><td>{item.mobile || "—"}</td><td>{item.email || "—"}</td><td>{item.postcode || "—"}</td><td>{item.dayRate ? `£${item.dayRate}` : "Company default"}</td><td><span className="workforce-admin__capability-summary">{item.capabilities.map(capabilityLabel).join(", ") || "—"}</span></td><td>{item.active ? "Yes" : "No"}</td><td><button type="button" className="ui-button" onClick={() => setEditor({ kind:"installer", item })}>Edit</button></td></tr>)}{!visibleInstallers.length ? <tr><td colSpan={9}>No installers configured.</td></tr> : null}</tbody></table></div></div> : null}

    {tab === "teams" ? <div className="workforce-admin__section"><div className="workforce-admin__section-heading"><h4>Installation Teams</h4><button type="button" className="ui-button ui-button--primary" disabled={!value.companies.length} onClick={() => setEditor({ kind:"team" })}>+ Add Team</button></div><div className="workforce-admin__table-wrap"><table className="ui-table workforce-admin__table"><thead><tr><th>Team</th><th>Company</th><th>Base Postcode</th><th>Crew Size</th><th>Members</th><th>Capabilities</th><th>Active</th><th>Actions</th></tr></thead><tbody>{value.teams.filter(item => !managedCompanyId || item.companyId === managedCompanyId).map(item => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.companyName}</td><td>{item.basePostcode || "—"}</td><td>{item.normalCrewSize}</td><td>{item.installerIds.map(id => value.installers.find(installer => installer.id === id)?.name ?? "Unknown installer").join(", ") || "—"}</td><td><span className="workforce-admin__capability-summary">{item.capabilities.map(capabilityLabel).join(", ") || "—"}</span></td><td>{item.active ? "Yes" : "No"}</td><td><button type="button" className="ui-button" onClick={() => setEditor({ kind:"team", item })}>Edit</button></td></tr>)}{!value.teams.filter(item => !managedCompanyId || item.companyId === managedCompanyId).length ? <tr><td colSpan={8}>No teams configured.</td></tr> : null}</tbody></table></div></div> : null}

    {message ? <p role="status" className="workforce-admin__status">{message}</p> : null}
    {editor ? <div className="ui-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditor(null); }}><form className="ui-modal workforce-admin__modal" role="dialog" aria-modal="true" aria-labelledby="workforce-editor-title" onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
      <header><div><h3 id="workforce-editor-title">{editor.item ? "Edit" : "Add"} {editor.kind === "company" ? "Installation Company" : editor.kind === "installer" ? "Installer" : "Installation Team"}</h3><p>Changes affect Administration workforce data; saved Estimates retain their snapshots.</p></div><button type="button" className="ui-button" aria-label="Close editor" onClick={() => setEditor(null)}>×</button></header>
      <div className="workforce-admin__editor-grid">
        {editor.kind !== "company" ? <label>Company<select required name="companyId" className="ui-input" value={defaultCompanyId} onChange={event => setEditorCompanyId(event.target.value)}><option value="">Select</option>{value.companies.filter(item => item.active || item.id === defaultCompanyId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        <label>{editor.kind === "company" ? "Company name" : editor.kind === "installer" ? "Installer name" : "Team name"}<input required name="name" className="ui-input" defaultValue={selectedCompany?.name ?? selectedInstaller?.name ?? selectedTeam?.name ?? ""} /></label>
        {editor.kind === "team" ? <label>Normal crew size<input required name="crewSize" type="number" min="1" className="ui-input" defaultValue={selectedTeam?.normalCrewSize ?? 2} /></label> : null}
        <label>{editor.kind === "team" ? "Base address" : "Address"}<input name="address" className="ui-input" defaultValue={String((selectedCompany?.address ?? selectedInstaller?.address ?? selectedTeam?.baseAddress)?.line1 ?? "")} /></label>
        <label>{editor.kind === "team" ? "Base postcode" : "Postcode"}<input required name="postcode" className="ui-input" defaultValue={selectedCompany?.postcode ?? selectedInstaller?.postcode ?? selectedTeam?.basePostcode ?? ""} /></label>
        {editor.kind === "company" ? <><label>Telephone<input name="telephone" className="ui-input" defaultValue={selectedCompany?.telephone ?? ""} /></label><label>Email<input name="email" type="email" className="ui-input" defaultValue={selectedCompany?.email ?? ""} /></label><label>Default installer / full-day cost<input name="dayRate" inputMode="decimal" className="ui-input" defaultValue={selectedCompany?.dayRate ?? "350.00"} /></label><label className="workforce-admin__wide">Notes<textarea name="notes" className="ui-input" rows={3} defaultValue={selectedCompany?.notes ?? ""} /></label></> : null}
        {editor.kind === "installer" ? <><label>Mobile<input name="mobile" className="ui-input" defaultValue={selectedInstaller?.mobile ?? ""} /></label><label>Email<input name="email" type="email" className="ui-input" defaultValue={selectedInstaller?.email ?? ""} /></label><label>Labour cost / full day<input name="dayRate" inputMode="decimal" className="ui-input" defaultValue={selectedInstaller?.dayRate ?? "350.00"} /></label></> : null}
        <label className="workforce-admin__active"><input type="checkbox" name="active" defaultChecked={editor.item?.active ?? true} /> Active</label>
      </div>
      {editor.kind === "team" ? <fieldset className="workforce-admin__fieldset"><legend>Members</legend><div className="workforce-admin__check-grid workforce-admin__check-grid--members">{value.installers.filter(item => item.active && item.companyId === defaultCompanyId || selectedTeam?.installerIds.includes(item.id)).map(item => <label key={item.id}><input type="checkbox" name="installerIds" value={item.id} defaultChecked={selectedTeam?.installerIds.includes(item.id)} /> <span>{item.name}</span></label>)}</div></fieldset> : null}
      {editor.kind !== "company" ? <CapabilityChecklist capabilities={value.capabilities} selected={selectedInstaller?.capabilities ?? selectedTeam?.capabilities} /> : null}
      <footer><button type="button" className="ui-button" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="ui-button ui-button--primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></footer>
    </form></div> : null}
  </section>;
}
