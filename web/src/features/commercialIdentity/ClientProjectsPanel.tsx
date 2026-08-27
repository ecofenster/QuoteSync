import { useCallback, useEffect, useState } from "react";
import { commercialIdentityApi, type ProjectRecord } from "../../services/commercialIdentity/commercialIdentityApi";
import CanonicalDocumentsPanel from "../documents/CanonicalDocumentsPanel";

export function ClientProjectsPanel({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false), [busy, setBusy] = useState(false);
  const [name, setName] = useState(""), [year, setYear] = useState(new Date().getFullYear()), [siteAddress, setSiteAddress] = useState(""), [message, setMessage] = useState("");
  const load = useCallback(async () => setProjects(await commercialIdentityApi.listProjects(clientId)), [clientId]);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Projects could not be loaded.")); }, [load]);

  async function create() {
    setBusy(true); setMessage("");
    try {
      const project = await commercialIdentityApi.createProject({ clientId, name, contextYear: year, siteAddress });
      setName(""); setSiteAddress(""); setAdding(false); setSelectedProjectId(project.id); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Project could not be created."); }
    finally { setBusy(false); }
  }

  return <section className="client-projects ui-card" aria-labelledby="client-projects-title">
    <header><div><h3 id="client-projects-title">Projects</h3><p>One permanent Client may own multiple named Projects across years.</p></div><button type="button" className="ui-button ui-button--primary" onClick={() => setAdding((value) => !value)}>+ New Project</button></header>
    {message ? <p role="status">{message}</p> : null}
    {adding ? <div className="commercial-identity-form__grid"><label><span>Reviewed Project / site name</span><input className="ui-input" value={name} onChange={(event) => setName(event.currentTarget.value)}/></label><label><span>Operational year</span><input className="ui-input" type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(Number(event.currentTarget.value))}/></label><label className="commercial-identity-form__wide"><span>Site address</span><input className="ui-input" value={siteAddress} onChange={(event) => setSiteAddress(event.currentTarget.value)}/></label><div className="commercial-identity-form__wide"><button className="ui-button" onClick={() => setAdding(false)}>Cancel</button> <button className="ui-button ui-button--primary" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? "Creating…" : "Create Project"}</button></div></div> : null}
    <div className="client-projects__list">{projects.map((project) => <article key={project.id}><div><strong>{project.name}</strong><small>{project.contextYear || "Year review"} · {project.status}</small></div><span>{project.estimateCount} Estimate{project.estimateCount === 1 ? "" : "s"} · {project.orderCount} Order{project.orderCount === 1 ? "" : "s"} <button type="button" className="ui-button ui-button--ghost" aria-expanded={selectedProjectId === project.id} onClick={() => setSelectedProjectId((current) => current === project.id ? null : project.id)}>Files</button></span></article>)}{!projects.length ? <p>No canonical Projects yet. Historical Client project text remains available until reviewed migration.</p> : null}</div>
    {selectedProjectId ? <CanonicalDocumentsPanel projectId={selectedProjectId} /> : null}
  </section>;
}
