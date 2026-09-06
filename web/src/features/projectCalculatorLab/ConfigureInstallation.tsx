import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { projectCalculatorLabApi } from "./api/projectCalculatorLabApi";
import {
  buildInstallationCompanyCandidates,
  companyForSavedTeam,
  rankInstallationCompaniesByDistance,
} from "./domain/installationCompanyRecommendation";
import type { CalculatorScenario, InstallationRecommendationCandidate, InstallationRecommendations, InstallationTeam, InstallationWorkforce } from "./domain/projectCalculatorLab.types";
import { calculateDirectionalRoute, resolveRouteEndpoint } from "./integrations/routeIntegration";

type RouteResult = { distanceMiles: number; durationMinutes: number; raw: Record<string, unknown>; capturedAt: string; source: string };

const numberValue = (value: FormDataEntryValue | null, fallback = 0) => (value == null || value === "" ? fallback : Number(value));
const text = (value: unknown) => typeof value === "string" ? value : "";
const normalizedPostcode = (value: unknown) => text(value).replace(/\s+/g, "").toUpperCase();

function teamSnapshot(team: InstallationTeam) {
  return { id: team.id, name: team.name, companyId: team.companyId, companyName: team.companyName, normalCrewSize: team.normalCrewSize, basePostcode: team.basePostcode, capabilities: team.capabilities, active: team.active };
}

const gbp = (value: string | number | null | undefined) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value ?? 0));

function InstallationRecommendation({ candidates, recommendedTeamId, selectedTeamId, onSelect }: { candidates: InstallationRecommendationCandidate[]; recommendedTeamId: string | null; selectedTeamId: string; onSelect: (candidate: InstallationRecommendationCandidate) => void }) {
  const recommended = candidates.find((item) => item.id === recommendedTeamId) ?? null;
  return <section className="costing-sheet__installation-recommendation" aria-label="Installation Team recommendation">
    <header><div><span>Recommended — review and approve</span><b>{recommended ? `${recommended.companyName} · ${recommended.teamName}` : "No complete recommendation"}</b><small>{recommended ? "Estimated lowest total Installation cost among suitable, fully costed Teams." : "Capability or route evidence requires review."}</small></div>{recommended ? <button type="button" className="ui-button ui-button--secondary" onClick={() => onSelect(recommended)}>{selectedTeamId === recommended.id ? "Selected for approval" : "Review recommended Team"}</button> : null}</header>
    {recommended ? <div className="costing-sheet__recommendation-facts"><span>Days <b>{recommended.programme.programmeDays}</b></span><span>Crew <b>{recommended.crewSize}</b></span><span>Distance <b>{recommended.route ? `${recommended.route.distanceMiles.toFixed(1)} mi` : "Unavailable"}</b></span><span>Travel <b>{recommended.route ? `${recommended.route.durationMinutes} min` : "Review"}</b></span><span>Mode <b>{recommended.programme.travel.recommendation === "stay_away" ? "Stay Over" : "Daily Travel"}</b></span><span>Vehicles <b>{recommended.programme.travel.vehicleCount}</b></span><span>Hotel <b>{recommended.programme.allowances.accommodationRooms ?? 0} rooms × {recommended.programme.allowances.nights} nights</b></span><span>Estimated total <b>{gbp(recommended.programme.costs.purchaseCost)}</b></span></div> : null}
    <details><summary>Compare suitable Installation Teams</summary><div className="costing-sheet__team-comparison">{candidates.map((candidate) => <article key={candidate.id} data-status={candidate.status}><div><b>{candidate.companyName} · {candidate.teamName}</b><small>{candidate.crewSize} people · {candidate.programme.programmeDays} days · {candidate.route ? `${candidate.route.distanceMiles.toFixed(1)} mi / ${candidate.route.durationMinutes} min` : "distance unavailable"}</small><small>{candidate.status === "suitable" ? `${candidate.programme.travel.recommendation === "stay_away" ? "Stay Over" : "Daily Travel"} · estimated total ${gbp(candidate.programme.costs.purchaseCost)}` : candidate.reason}</small></div><button type="button" className="ui-button" disabled={candidate.status === "not_suitable"} onClick={() => onSelect(candidate)}>{selectedTeamId === candidate.id ? "Selected" : candidate.status === "suitable" ? "Select" : "Review"}</button></article>)}</div></details>
  </section>;
}

export default function ConfigureInstallation({ scenario }: { scenario: CalculatorScenario }) {
  const [open, setOpen] = useState(false);
  const [workforce, setWorkforce] = useState<InstallationWorkforce | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [recommendedCompanyId, setRecommendedCompanyId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<InstallationRecommendations | null>(null);
  const automaticRouteKey = useRef("");
  const manualCompanyChoice = useRef(false);
  const advancedTrigger = useRef<HTMLButtonElement>(null);
  const advancedDialog = useRef<HTMLElement>(null);

  const profile = (scenario.options?.installationProfile ?? {}) as Record<string, unknown>;
  const savedPositionRequirements = (profile.positionRequirements ?? {}) as Record<string, Record<string, unknown>>;
  const programme = scenario.installationProgramme;
  const resolvedPostcode = text(scenario.options?.siteVisitTravel?.sitePostcode) || text(profile.sitePostcode);
  const postcodeSource = text(scenario.options?.sitePostcodeSource ?? profile.sitePostcodeSource) || "missing";
  const savedCompanyId = text(profile.selectedInstallationCompanyId);
  const savedTeamSnapshot = (profile.selectedTeamSnapshot ?? {}) as Record<string, unknown>;
  const savedTeamId = text(profile.selectedTeamId) || scenario.selectedInstallationTeam?.id || text(savedTeamSnapshot.id);
  const savedCompanySnapshot = (profile.selectedInstallationCompanySnapshot ?? {}) as Record<string, unknown>;
  const savedRoute = (profile.route ?? {}) as Record<string, unknown>;
  const installationRequired = Boolean(scenario.options?.installationRequired);
  const liftingSelection = (profile.liftingEquipment ?? {}) as Record<string, unknown>;
  const skipSelection = (profile.skipHire ?? {}) as Record<string, unknown>;
  const liftingProducts = (scenario.catalogueSnapshot?.catalogue ?? []).filter((item) => item.category === "mechanical_lifting" && item.active && item.variant.equipmentType !== "skip_hire");
  const skipProducts = (scenario.catalogueSnapshot?.catalogue ?? []).filter((item) => item.category === "mechanical_lifting" && item.active && item.variant.equipmentType === "skip_hire");

  useEffect(() => {
    let active = true;
    void projectCalculatorLabApi.getInstallationWorkforce()
      .then((value) => { if (active) setWorkforce(value); })
      .catch((error) => { if (active) setStatus(error instanceof Error ? error.message : "Installation workforce could not be loaded."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        advancedTrigger.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(advancedDialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const requiredCrew = useMemo(() => Math.max(2, ...(programme?.tasks.map((task) => Number(task.minimumCrew ?? 2)) ?? [2])), [programme]);
  const requiredCapabilities = useMemo(() => programme?.requiredCapabilities ?? [], [programme?.requiredCapabilities]);
  const candidates = useMemo(() => buildInstallationCompanyCandidates({ workforce, requiredCrew, requiredCapabilities }), [workforce, requiredCapabilities, requiredCrew]);
  const savedTeamCompany = useMemo(() => companyForSavedTeam(candidates, savedTeamId), [candidates, savedTeamId]);
  const effectiveSavedCompanyId = savedCompanyId || savedTeamCompany?.id || text(savedTeamSnapshot.companyId);

  useEffect(() => {
    setSelectedCompanyId(effectiveSavedCompanyId);
    setSelectedTeamId(savedTeamId);
    manualCompanyChoice.current = false;
    automaticRouteKey.current = "";
  }, [scenario.id, scenario.revisionNumber, effectiveSavedCompanyId, savedTeamId]);
  const ranked = useMemo(() => rankInstallationCompaniesByDistance(candidates, routes), [candidates, routes]);
  const selectedCompany = candidates.find((item) => item.id === selectedCompanyId) ?? null;
  const selectedTeam = workforce?.teams.find((item) => item.id === selectedTeamId && item.companyId === selectedCompanyId && item.active) ?? null;
  const selectedRecommendationCandidate = recommendations?.candidates.find((item) => item.id === selectedTeamId) ?? null;
  const selectedRoute = routes[selectedTeamId] ?? routes[selectedCompanyId];
  const savedDistance = Boolean(selectedCompanyId) && selectedCompanyId === effectiveSavedCompanyId && Number.isFinite(Number(savedRoute.oneWayMiles))
    ? { distanceMiles: Number(savedRoute.oneWayMiles), durationMinutes: Number(savedRoute.oneWayDurationMinutes ?? 0), source: text(savedRoute.calculationSource ?? savedRoute.source) || "saved route snapshot" }
    : null;
  const displayRoute = selectedRoute ?? savedDistance;
  const selectedChoiceIsCurrent = Boolean(selectedCompanyId && selectedCompanyId === effectiveSavedCompanyId && selectedTeamId === savedTeamId && !selectedRoute);
  const companyActionLabel = busy ? "Saving…" : selectedChoiceIsCurrent ? "Current Company / Team" : selectedCompanyId && selectedCompanyId === effectiveSavedCompanyId ? "Use Selected Team" : "Use Installation Company";
  const savedRouteUsesCurrentPostcode = !savedDistance || !text(savedRoute.sitePostcode) || normalizedPostcode(savedRoute.sitePostcode) === normalizedPostcode(resolvedPostcode);

  const rankCompanies = async (automatic = false) => {
    const postcode = resolvedPostcode.trim();
    if (!postcode) { setStatus("Distance unavailable — project/site postcode is not configured. Select an Installation Company manually."); return; }
    if (!workforce) return;
    const activeTeams = workforce.teams.filter((item) => item.active);
    if (!activeTeams.length) { setStatus("No active Installation Teams are configured. Manual review is required."); return; }
    const routable = activeTeams.filter((item) => item.basePostcode || workforce.companies.find((company) => company.id === item.companyId)?.postcode);
    if (!routable.length) { setStatus("Distance unavailable — active Installation Companies or Teams need a postcode. Manual selection remains available."); return; }
    setBusy(true);
    if (!automatic) setStatus("");
    try {
      const destination = await resolveRouteEndpoint(postcode, { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
      if (!destination) throw new Error();
      const next: Record<string, RouteResult> = {};
      for (const team of routable) {
        try {
          const companyPostcode = workforce.companies.find((company) => company.id === team.companyId)?.postcode;
          const origin = await resolveRouteEndpoint(team.basePostcode || companyPostcode || "", { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
          if (!origin) continue;
          const route = await calculateDirectionalRoute("installer_to_site", origin, destination, { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
          if (route?.distanceKm != null && route.durationMinutes != null) {
            const result = { distanceMiles: Number(route.distanceKm) * 0.621371192, durationMinutes: route.durationMinutes, raw: route as unknown as Record<string, unknown>, capturedAt: route.calculatedAt, source: route.integration };
            next[team.id] = result;
            if (!next[team.companyId] || result.distanceMiles < next[team.companyId].distanceMiles) next[team.companyId] = result;
          }
        } catch { /* one unroutable company must not prevent manual selection */ }
      }
      if (!Object.keys(next).length) throw new Error();
      const recommendation = await projectCalculatorLabApi.getInstallationRecommendations(scenario.id, Object.fromEntries(Object.entries(next).flatMap(([id, route]) => [[id, route], [`company:${id}`, route]])));
      const recommended = recommendation.candidates.find((item) => item.id === recommendation.recommendedTeamId) ?? null;
      setRoutes(next);
      setRecommendations(recommendation);
      setRecommendedCompanyId(recommended?.companyId ?? null);
      setStatus(effectiveSavedCompanyId ? "Saved Installation Company and Team retained. Costed alternatives are available for review." : recommended ? `${recommended.companyName} · ${recommended.teamName} is recommended for review because it has the lowest estimated total Installation cost.` : "No fully costed suitable Team is available. Review capability and route evidence.");
    } catch {
      setStatus("Distance unavailable — Google Maps routing is unavailable or could not resolve these postcodes. Manual selection remains available.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!workforce || effectiveSavedCompanyId || !resolvedPostcode || !candidates.length) return;
    const key = `${scenario.id}:${scenario.revisionNumber}:${resolvedPostcode}:${candidates.map((item) => `${item.id}:${item.basePostcode}`).join("|")}`;
    if (automaticRouteKey.current === key) return;
    automaticRouteKey.current = key;
    void rankCompanies(true);
  // One automatic recommendation per stable postcode/workforce input; saved choices are never reranked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workforce, effectiveSavedCompanyId, resolvedPostcode, candidates, scenario.id, scenario.revisionNumber]);

  const persistCompanySelection = async () => {
    if (!selectedCompany || !selectedTeam) { setStatus("Select a suitable active Installation Company and Team before saving."); return; }
    if (selectedRecommendationCandidate?.status === "not_suitable") { setStatus(`${selectedTeam.name} is not suitable for this Installation programme. Select a suitable Team or review the programme requirements.`); return; }
    setBusy(true); setStatus("");
    try {
      let snapshotId: string | null = null;
      if (selectedRoute) { const withSnapshot = await projectCalculatorLabApi.addRouteSnapshot(scenario.id, selectedRoute.raw); snapshotId = withSnapshot.routeSnapshots[0]?.id ?? null; }
      const route = selectedRoute ? { snapshotId, oneWayMiles: selectedRoute.distanceMiles.toFixed(2), oneWayDurationMinutes: selectedRoute.durationMinutes, distanceUnit: "miles", calculationSource: selectedRoute.source, calculationMethod: "google_routes", capturedAt: selectedRoute.capturedAt, sitePostcode: resolvedPostcode, companyId: selectedCompany.id, companyPostcode: selectedCompany.basePostcode } : selectedCompanyId === effectiveSavedCompanyId ? savedRoute : null;
      const updated = await projectCalculatorLabApi.updateInstallationProfile(scenario.id, {
        enabled: installationRequired,
        sitePostcode: resolvedPostcode,
        sitePostcodeSource: postcodeSource,
        selectedInstallationCompanyId: selectedCompany.id,
        selectedInstallationCompanySnapshot: { id: selectedCompany.id, name: selectedCompany.name, basePostcode: selectedCompany.basePostcode, crewCapacity: selectedCompany.crewCapacity, capabilities: selectedCompany.capabilities, sitePostcode: resolvedPostcode, distanceMiles: route?.oneWayMiles ?? null, distanceUnit: "miles", distanceCalculationSource: route?.calculationSource ?? null, distanceCalculationMethod: route?.calculationMethod ?? null, distanceCapturedAt: route?.capturedAt ?? null },
        selectedTeamId: selectedTeam.id,
        selectedTeamSelectionSource: "user_selected",
        selectedTeamSnapshot: teamSnapshot(selectedTeam),
        crewSize: selectedTeam.normalCrewSize,
        route,
      });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
      setStatus(`${selectedCompany.name} and ${selectedTeam.name} saved for this costing revision.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Installation Company selection could not be saved."); }
    finally { setBusy(false); }
  };

  const saveAdvanced = async (form: HTMLFormElement) => {
    setBusy(true); setStatus("");
    try {
      const data = new FormData(form);
      const positionRequirements: Record<string, Record<string, unknown>> = { ...savedPositionRequirements };
      for (const item of scenario.products.filter((row) => /lift|slide|bifold/i.test(row.productClass))) {
        const key = item.estimatePositionId ?? item.id, kitFormat = data.get(`kit:${key}`) === "yes", duration = data.get(`duration:${key}`), customDuration = data.get(`customDuration:${key}`);
        positionRequirements[key] = { ...(positionRequirements[key] ?? {}), kitFormat, durationHours: kitFormat ? (customDuration ? Number(customDuration) : duration ? Number(duration) : null) : null, customDurationHours: customDuration ? Number(customDuration) : null };
      }
      const liftingRequired = data.get("liftingDecision") === "required";
      const skipRequired = data.get("skipDecision") === "required";
      const updated = await projectCalculatorLabApi.updateInstallationProfile(scenario.id, { enabled: installationRequired, travelMode: String(data.get("travelMode") ?? "auto"), vehicleCount: numberValue(data.get("vehicleCount"), 1), mileageRate: String(data.get("mileageRate") ?? "0.55"), installerDayRate: String(data.get("installerDayRate") ?? "350.00"), foodPerPersonDay: String(data.get("foodPerPersonDay") ?? "30.00"), accommodationPerPersonNight: String(data.get("accommodationPerPersonNight") ?? "125.00"), mobilisationSetOutHours: data.get("mobilisationSetOutHours") === "" ? null : numberValue(data.get("mobilisationSetOutHours")), supportDays: numberValue(data.get("supportDays")), surveyDays: numberValue(data.get("surveyDays")), liftingEquipment: { required: liftingRequired, productId: liftingRequired ? String(data.get("liftingProductId") ?? "") || null : liftingSelection.productId ?? null }, skipHire:{required:skipRequired,productId:skipRequired?String(data.get("skipProductId")??"")||null:skipSelection.productId??null,quantity:numberValue(data.get("skipQuantity"),1)}, positionRequirements });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
      setOpen(false);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Advanced Installation changes could not be saved."); }
    finally { setBusy(false); }
  };

  const savedCompanyMissing = Boolean(effectiveSavedCompanyId && !candidates.some((item) => item.id === effectiveSavedCompanyId));
  return <>
    <div className="costing-sheet__installation-context">
      <div><span>Site postcode</span><b>{resolvedPostcode || "Not configured"}</b><small>{postcodeSource.replaceAll("_", " ")}</small></div>
      <label><span>Installation Company</span><select className="ui-input" aria-label="Installation Company" value={selectedCompanyId} disabled={!workforce || busy} onChange={(event) => { manualCompanyChoice.current = true; setSelectedCompanyId(event.currentTarget.value); setSelectedTeamId(""); setStatus(""); }}><option value="">Select Installation Company</option>{savedCompanyMissing ? <option value={effectiveSavedCompanyId}>{text(savedCompanySnapshot.name) || scenario.selectedInstallationTeam?.companyName || text(savedTeamSnapshot.companyName) || "Saved Installation Company"} · saved selection</option> : null}{ranked.map((company) => <option key={company.id} value={company.id}>{recommendedCompanyId === company.id && !effectiveSavedCompanyId ? "Recommended · " : ""}{company.name}</option>)}</select></label>
      <div><span>Distance from site</span><b>{displayRoute ? `${displayRoute.distanceMiles.toFixed(1)} miles` : "Distance unavailable"}</b><small>{displayRoute ? `${displayRoute.durationMinutes} min · ${displayRoute.source.replaceAll("_", " ")}` : "Manual company selection remains available"}</small>{!savedRouteUsesCurrentPostcode ? <small>Saved evidence used {text(savedRoute.sitePostcode)}; refresh before accepting the current postcode.</small> : null}</div>
      <label><span>Installation Team</span><select className="ui-input" aria-label="Installation Team" value={selectedTeamId} disabled={!selectedCompanyId || busy} onChange={(event) => { manualCompanyChoice.current = true; setSelectedTeamId(event.currentTarget.value); setStatus(""); }}><option value="">Select Installation Team</option>{(workforce?.teams ?? []).filter((item) => item.active && item.companyId === selectedCompanyId).map((team) => { const candidate = recommendations?.candidates.find((item) => item.id === team.id); return <option key={team.id} value={team.id}>{candidate?.id === recommendations?.recommendedTeamId ? "Recommended · " : ""}{team.name} · {team.normalCrewSize} people{candidate?.route ? ` · ${candidate.route.distanceMiles.toFixed(1)} mi` : ""}</option>; })}</select><small>{selectedTeam ? `${selectedTeam.normalCrewSize} people · user approval required` : "Recommendation does not select a Team"}</small></label>
      <div className="costing-sheet__installation-context-actions"><button type="button" className="ui-button ui-button--secondary" disabled={busy || !workforce || !resolvedPostcode} onClick={() => void rankCompanies(false)}>Refresh recommendation</button><button type="button" className="ui-button ui-button--primary" disabled={busy || !selectedCompany || !selectedTeam || selectedChoiceIsCurrent || selectedRecommendationCandidate?.status === "not_suitable"} onClick={() => void persistCompanySelection()}>{companyActionLabel}</button><button ref={advancedTrigger} type="button" className="ui-button ui-button--secondary" onClick={() => setOpen(true)}>Advanced Installation</button></div>
      {status ? <p role={/could not|unavailable|required/i.test(status) ? "alert" : "status"}>{status}</p> : null}
    </div>
    {recommendations ? <InstallationRecommendation candidates={recommendations.candidates} recommendedTeamId={recommendations.recommendedTeamId} selectedTeamId={selectedTeamId} onSelect={(candidate) => { manualCompanyChoice.current = true; setSelectedCompanyId(candidate.companyId); setSelectedTeamId(candidate.id); setStatus(`${candidate.companyName} · ${candidate.teamName} selected for review. Use the button above to save it.`); }} /> : null}
    {open && createPortal(<div className="ui-modal-backdrop" role="presentation"><section ref={advancedDialog} className="ui-modal calculator-lab__installation-modal" role="dialog" aria-modal="true" aria-labelledby="installation-config-title"><header><div><h3 id="installation-config-title">Advanced Installation</h3><small>Routine postcode, company and team choices remain in Installation. Change exceptional programme assumptions here.</small></div><button type="button" className="ui-button" autoFocus onClick={() => { setOpen(false); advancedTrigger.current?.focus(); }}>Close</button></header>
      <form onSubmit={(event) => { event.preventDefault(); void saveAdvanced(event.currentTarget); }}><div className="calculator-lab__installation-groups">
        <fieldset><legend>Company / Team</legend><div className="costing-sheet__facts"><span>Company <b>{selectedCompany?.name ?? (text(savedCompanySnapshot.name) || "Not selected")}</b></span><span>Team <b>{selectedTeam?.name ?? scenario.selectedInstallationTeam?.name ?? "Not selected"}</b></span><span>Required crew <b>{requiredCrew}</b></span></div></fieldset>
        <fieldset><legend>Travel / Vehicles</legend><label>Travel mode<select name="travelMode" className="ui-input" defaultValue={String(profile.travelMode ?? "auto")}><option value="auto">Auto / Recommended</option><option value="daily_travel">Daily Travel</option><option value="stay_away">Stay Away</option><option value="manual">Manual</option></select></label><label>Vehicles<input name="vehicleCount" type="number" min="1" className="ui-input" defaultValue={String(profile.vehicleCount ?? 1)} /></label><label>Mileage / mile<input name="mileageRate" className="ui-input" defaultValue={String(profile.mileageRate ?? "0.55")} /></label><label>Mobilisation/offload/set-out hours<input name="mobilisationSetOutHours" className="ui-input" placeholder="Review required" defaultValue={String(profile.mobilisationSetOutHours ?? "")} /></label></fieldset>
        <fieldset><legend>Rates / Allowances</legend><label>Installer / full day<input name="installerDayRate" className="ui-input" defaultValue={String(profile.installerDayRate ?? "350.00")} /></label><label>Food / person/day<input name="foodPerPersonDay" className="ui-input" defaultValue={String(profile.foodPerPersonDay ?? "30.00")} /></label><label>Accommodation / person/night<input name="accommodationPerPersonNight" className="ui-input" defaultValue={String(profile.accommodationPerPersonNight ?? "125.00")} /></label><div className="calculator-lab__cill-summary"><span>Calculated cill fitting</span><b>{programme?.allowances.cillApplicableQuantity ?? 0} applicable window(s)</b><small>{programme?.allowances.cillApplicableQuantity ?? 0} × {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(programme?.allowances.cillInstallationRate ?? 25))}</small></div></fieldset>
        <fieldset><legend>Survey / Support</legend><label>Support days<input name="supportDays" className="ui-input" defaultValue={String(profile.supportDays ?? 0)} /></label><label>Retrofit survey days<input name="surveyDays" className="ui-input" defaultValue={String(profile.surveyDays ?? 0)} /></label></fieldset>
        <fieldset><legend>Specialist Requirements</legend><label>Equipment Hire<select name="liftingDecision" className="ui-input" defaultValue={liftingSelection.required === true ? "required" : "not_required"}><option value="required">Required</option><option value="not_required">Not required</option></select></label><label>Equipment product<select name="liftingProductId" className="ui-input" defaultValue={String(liftingSelection.productId ?? "")}><option value="">Select configured equipment</option>{liftingProducts.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.priceAmount == null ? "hire cost required" : gbp(item.priceAmount)}{Number(item.variant.deliveryCost ?? 0) || Number(item.variant.collectionCost ?? 0) ? ` + ${gbp(Number(item.variant.deliveryCost ?? 0) + Number(item.variant.collectionCost ?? 0))} delivery / collection` : ""}</option>)}</select></label><label>Skip Hire<select name="skipDecision" className="ui-input" defaultValue={skipSelection.required===true?"required":"not_required"}><option value="required">Required</option><option value="not_required">Not required</option></select></label><label>Skip size<select name="skipProductId" className="ui-input" defaultValue={String(skipSelection.productId??"")}><option value="">Select skip size</option>{skipProducts.map(item=><option key={item.id} value={item.id}>{item.label} · {gbp(item.priceAmount)}</option>)}</select></label><label>Skip quantity<input name="skipQuantity" className="ui-input" type="number" min="1" step="1" defaultValue={String(skipSelection.quantity??1)}/></label><details><summary>Specialist / kit position requirements</summary>{scenario.products.filter((item) => /lift|slide|bifold/i.test(item.productClass)).map((item) => { const key = item.estimatePositionId ?? item.id; const current = savedPositionRequirements[key] ?? {}; return <div key={item.id} className="calculator-lab__specialist-row"><b>{item.displayReference}</b><span>{item.productClass} · {item.widthMm} mm</span><label>Kit format?<select name={`kit:${key}`} className="ui-input" defaultValue={current.kitFormat ? "yes" : "no"}><option value="no">No</option><option value="yes">Yes</option></select></label><label>Kit duration<select name={`duration:${key}`} className="ui-input" defaultValue={String(current.durationHours ?? "")}><option value="">Select when kit</option><option value="4">0.5 day</option><option value="8">1 day</option><option value="12">1.5 days</option><option value="16">2 days</option><option value="24">3 days</option></select></label><label>Custom productive hours<input name={`customDuration:${key}`} className="ui-input" inputMode="decimal" defaultValue={String(current.customDurationHours ?? "")} /></label></div>; })}</details></fieldset>
      </div><footer><span>{programme?.recommendFourPersonTeam ? "More than 28 standard units: a four-person workforce is recommended." : "Saved changes create a new costing revision snapshot."}</span><button type="submit" className="ui-button ui-button--primary" disabled={busy}>{busy ? "Saving…" : "Save Advanced Installation"}</button></footer></form></section></div>, document.body)}
  </>;
}
