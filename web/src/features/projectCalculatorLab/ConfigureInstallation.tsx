import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { projectCalculatorLabApi } from "./api/projectCalculatorLabApi";
import type { CalculatorScenario, InstallationWorkforce } from "./domain/projectCalculatorLab.types";
import { calculateDirectionalRoute, resolveRouteEndpoint } from "./integrations/routeIntegration";

type RouteResult = { distanceMiles: number; durationMinutes: number; raw: Record<string, unknown> };
type CompanyCandidate = { id: string; name: string; basePostcode: string; crewCapacity: number; capabilities: string[] };

const numberValue = (value: FormDataEntryValue | null, fallback = 0) => (value == null || value === "" ? fallback : Number(value));

export default function ConfigureInstallation({ scenario }: { scenario: CalculatorScenario }) {
  const [open, setOpen] = useState(false);
  const [workforce, setWorkforce] = useState<InstallationWorkforce | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sitePostcode, setSitePostcode] = useState("");
  const [recommendedCompanyId, setRecommendedCompanyId] = useState<string | null>(null);

  const profile = (scenario.options?.installationProfile ?? {}) as Record<string, unknown>;
  const savedPositionRequirements = (profile.positionRequirements ?? {}) as Record<string, Record<string, unknown>>;
  const programme = scenario.installationProgramme;
  const resolvedPostcode = String(profile.sitePostcode ?? scenario.options?.siteVisitTravel?.sitePostcode ?? "");
  const postcodeSource = String(profile.sitePostcodeSource ?? scenario.options?.sitePostcodeSource ?? "missing");
  const installationRequired = Boolean(scenario.options?.installationRequired);

  useEffect(() => {
    if (open && !workforce) void projectCalculatorLabApi.getInstallationWorkforce().then(setWorkforce).catch(error => setStatus(error instanceof Error ? error.message : "Installation workforce could not be loaded."));
  }, [open, workforce]);

  useEffect(() => {
    if (open) setSitePostcode(resolvedPostcode);
  }, [open, resolvedPostcode]);

  const requiredCrew = useMemo(
    () => Math.max(2, ...(programme?.tasks.map(task => Number(task.minimumCrew ?? 2)) ?? [2])),
    [programme],
  );

  const requiredCapabilities = useMemo(() => programme?.requiredCapabilities ?? [], [programme?.requiredCapabilities]);

  const candidates = useMemo<CompanyCandidate[]>(() => {
    if (!workforce) return [];
    return workforce.companies
      .filter((company) => company.active)
      .map((company) => {
        const teams = workforce.teams.filter((team) => team.active && team.companyId === company.id && requiredCapabilities.every((capability) => team.capabilities.includes(capability)));
        return {
          id: company.id,
          name: company.name,
          basePostcode: String(company.postcode ?? teams.find((team) => team.basePostcode)?.basePostcode ?? ""),
          crewCapacity: teams.reduce((sum, team) => sum + team.normalCrewSize, 0),
          capabilities: [...new Set(teams.flatMap((team) => team.capabilities))],
        };
      })
      .filter((company) => company.crewCapacity >= requiredCrew);
  }, [workforce, requiredCapabilities, requiredCrew]);

  const ranked = useMemo(
    () =>
      [...candidates].sort(
        (left, right) =>
          (routes[left.id]?.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (routes[right.id]?.durationMinutes ?? Number.MAX_SAFE_INTEGER) ||
          (routes[left.id]?.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (routes[right.id]?.distanceMiles ?? Number.MAX_SAFE_INTEGER),
      ),
    [candidates, routes],
  );

  const rank = async () => {
    const postcode = sitePostcode.trim();
    if (!postcode) {
      setStatus("Project postcode required");
      return;
    }
    const activeCompanies = workforce?.companies.filter((company) => company.active) ?? [];
    if (!activeCompanies.length) {
      setStatus("No capable installation company available");
      return;
    }
    if (!candidates.length) {
      const capableTeams = (workforce?.teams ?? []).filter((team) => team.active && requiredCapabilities.every((capability) => team.capabilities.includes(capability)));
      setStatus(capableTeams.length ? "Insufficient available crew configuration" : "No capable installation company available");
      return;
    }

    const routable = candidates.filter((item) => item.basePostcode);
    if (!routable.length) {
      setStatus("Company/team base postcode required");
      return;
    }

    setBusy(true);
    setStatus("");
    setRecommendedCompanyId(null);
    try {
      const destination = await resolveRouteEndpoint(postcode, { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
      if (!destination) throw new Error();
      const next: Record<string, RouteResult> = {};
      for (const company of routable) {
        const origin = await resolveRouteEndpoint(company.basePostcode, { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
        if (!origin) continue;
        const route = await calculateDirectionalRoute("installer_to_site", origin, destination, { googleMapsApiKey: "server-managed", what3wordsApiKey: "server-managed" });
        if (route?.distanceKm != null && route.durationMinutes != null) {
          next[company.id] = { distanceMiles: Number(route.distanceKm) * 0.621371192, durationMinutes: route.durationMinutes, raw: route as unknown as Record<string, unknown> };
        }
      }
      const result = routable.filter((company) => next[company.id]).sort((left, right) => next[left.id].durationMinutes - next[right.id].durationMinutes || next[left.id].distanceMiles - next[right.id].distanceMiles);
      if (!result.length) throw new Error();
      setRoutes(next);
      setRecommendedCompanyId(result[0].id);
      setStatus(`Recommended Installation Company: ${result[0].name}. Selection remains user-controlled.`);
    } catch {
      setStatus("Google routing unavailable/not configured");
    } finally {
      setBusy(false);
    }
  };

  const save = async (form: HTMLFormElement) => {
    setBusy(true);
    setStatus("");
    try {
      const data = new FormData(form);
      const selectedCompanyId = String(data.get("selectedCompanyId") ?? "");
      const company = candidates.find((item) => item.id === selectedCompanyId);
      const selectedRoute = routes[selectedCompanyId];
      const positionRequirements: Record<string, Record<string, unknown>> = { ...savedPositionRequirements };
      for (const item of scenario.products.filter((row) => /lift|slide|bifold/i.test(row.productClass))) {
        const key = item.estimatePositionId ?? item.id;
        const kitFormat = data.get(`kit:${key}`) === "yes";
        const duration = data.get(`duration:${key}`);
        const customDuration = data.get(`customDuration:${key}`);
        positionRequirements[key] = {
          ...(positionRequirements[key] ?? {}),
          kitFormat,
          durationHours: kitFormat ? (customDuration ? Number(customDuration) : duration ? Number(duration) : null) : null,
          customDurationHours: customDuration ? Number(customDuration) : null,
        };
      }

      let snapshotId: string | null = null;
      if (selectedRoute) {
        const withSnapshot = await projectCalculatorLabApi.addRouteSnapshot(scenario.id, selectedRoute.raw);
        snapshotId = withSnapshot.routeSnapshots[0]?.id ?? null;
      }

      const updated = await projectCalculatorLabApi.updateInstallationProfile(scenario.id, {
        enabled: installationRequired,
        selectedInstallationCompanyId: selectedCompanyId || null,
        selectedInstallationCompanySnapshot: company
          ? {
              id: company.id,
              name: company.name,
              crewCapacity: company.crewCapacity,
              basePostcode: company.basePostcode,
              capabilities: company.capabilities,
            }
          : null,
        selectedTeamId: null,
        selectedTeamSnapshot: company
          ? {
              id: `company:${company.id}`,
              name: "Company allocated workforce",
              companyId: company.id,
              companyName: company.name,
              normalCrewSize: requiredCrew,
              basePostcode: company.basePostcode,
              capabilities: company.capabilities,
              active: true,
            }
          : null,
        crewSize: requiredCrew,
        sitePostcode: String(data.get("sitePostcode") ?? ""),
        sitePostcodeSource: String(data.get("sitePostcode") ?? "") === resolvedPostcode ? postcodeSource : "estimate_override",
        travelMode: String(data.get("travelMode") ?? "auto"),
        vehicleCount: numberValue(data.get("vehicleCount"), 1),
        mileageRate: String(data.get("mileageRate") ?? "0.55"),
        installerDayRate: String(data.get("installerDayRate") ?? "350.00"),
        foodPerPersonDay: String(data.get("foodPerPersonDay") ?? "30.00"),
        accommodationPerPersonNight: String(data.get("accommodationPerPersonNight") ?? "125.00"),
        mobilisationSetOutHours: data.get("mobilisationSetOutHours") === "" ? null : numberValue(data.get("mobilisationSetOutHours")),
        supportDays: numberValue(data.get("supportDays")),
        surveyDays: numberValue(data.get("surveyDays")),
        skipDecision: String(data.get("skipDecision") ?? ""),
        liftingDecision: String(data.get("liftingDecision") ?? ""),
        positionRequirements,
        route: selectedRoute
          ? {
              snapshotId,
              oneWayMiles: selectedRoute.distanceMiles.toFixed(2),
              oneWayDurationMinutes: selectedRoute.durationMinutes,
            }
          : profile.route ?? null,
      });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Installation configuration could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="ui-button ui-button--secondary" onClick={() => setOpen(true)}>
        Configure Installation
      </button>
      {open &&
        createPortal(
          <div className="ui-modal-backdrop" role="presentation">
            <section className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="installation-config-title">
              <header>
                <div>
                  <h3 id="installation-config-title">Configure Installation</h3>
                  <small>Estimate-only snapshot · Administration defaults remain unchanged</small>
                </div>
                <button type="button" className="ui-button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </header>
              <form onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget); }}>
                <div className="calculator-lab__form calculator-lab__form--installation">
                  <div className="calculator-lab__installation-top-grid">
                    <label>
                      Project/site postcode
                      <input name="sitePostcode" className="ui-input" value={sitePostcode} onChange={(event) => setSitePostcode(event.currentTarget.value)} />
                      <small>{postcodeSource.replaceAll("_", " ")}</small>
                    </label>
                    <label>
                      Selected Installation Company
                      <select name="selectedCompanyId" className="ui-input" defaultValue={String(profile.selectedInstallationCompanyId ?? "")}>
                        <option value="">Select explicitly</option>
                        {ranked.map((company) => (
                          <option key={company.id} value={company.id}>
                            {recommendedCompanyId === company.id ? "Recommended · " : ""}
                            {company.name} · capacity {company.crewCapacity}
                            {routes[company.id] ? ` · ${routes[company.id].distanceMiles.toFixed(1)} mi / ${routes[company.id].durationMinutes} min` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Required concurrent crew
                      <input className="ui-input" value={requiredCrew} readOnly />
                    </label>
                    <label>
                      Travel mode
                      <select name="travelMode" className="ui-input" defaultValue={String(profile.travelMode ?? "auto")}>
                        <option value="auto">Auto / Recommended</option>
                        <option value="daily_travel">Daily Travel</option>
                        <option value="stay_away">Stay Away</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label>
                      Vehicles
                      <input name="vehicleCount" type="number" min="1" className="ui-input" defaultValue={String(profile.vehicleCount ?? 1)} />
                    </label>
                    <label>
                      Mileage / mile
                      <input name="mileageRate" className="ui-input" defaultValue={String(profile.mileageRate ?? "0.55")} />
                    </label>
                    <label>
                      Installer / full day
                      <input name="installerDayRate" className="ui-input" defaultValue={String(profile.installerDayRate ?? "350.00")} />
                    </label>
                  </div>
                  <label>Food / person/day
                    <input name="foodPerPersonDay" className="ui-input" defaultValue={String(profile.foodPerPersonDay ?? "30.00")} />
                  </label>
                  <label>Accommodation / person/night
                    <input
                      name="accommodationPerPersonNight"
                      className="ui-input"
                      defaultValue={String(profile.accommodationPerPersonNight ?? "125.00")}
                    />
                  </label>
                  <label>
                    Mobilisation/offload/set-out hours
                    <input
                      name="mobilisationSetOutHours"
                      className="ui-input"
                      placeholder="Review required"
                      defaultValue={String(profile.mobilisationSetOutHours ?? "")}
                    />
                  </label>
                  <label>
                    Support days
                    <input name="supportDays" className="ui-input" defaultValue={String(profile.supportDays ?? 0)} />
                  </label>
                  <label>
                    Retrofit survey days
                    <input name="surveyDays" className="ui-input" defaultValue={String(profile.surveyDays ?? 0)} />
                  </label>
                  <div className="calculator-lab__cill-summary" aria-label="Calculated cill installation">
                    <span>Applicable windows</span>
                    <b>{programme?.allowances.cillApplicableQuantity ?? 0}</b>
                    <small>
                      Cill fitting · {programme?.allowances.cillApplicableQuantity ?? 0} × {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(programme?.allowances.cillInstallationRate ?? 25))} = {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(programme?.costs.cillInstallation ?? 0))}
                    </small>
                  </div>
                  <label>
                    Skip Hire
                    <select name="skipDecision" className="ui-input" defaultValue={String(profile.skipDecision ?? "")}>
                      <option value="">Review Required</option>
                      <option value="required">Required</option>
                      <option value="not_required">Not required</option>
                    </select>
                  </label>
                  <label>
                    Lifting equipment
                    <select name="liftingDecision" className="ui-input" defaultValue={String(profile.liftingDecision ?? "")}>
                      <option value="">Review Required</option>
                      <option value="required">Required — product review</option>
                      <option value="not_required">Not required</option>
                    </select>
                  </label>
                </div>
                <div className="costing-sheet__product-actions">
                  <button type="button" className="ui-button ui-button--secondary" disabled={busy || !workforce} onClick={() => void rank()}>
                    Recommend Installation Company
                  </button>
                  <button type="submit" className="ui-button" disabled={busy}>
                    Save Installation Snapshot
                  </button>
                </div>
                {programme?.recommendFourPersonTeam ? <p role="status">More than 28 standard units: a four-person workforce is recommended.</p> : null}
                {status ? <p role="status">{status}</p> : null}
                <details>
                  <summary>Specialist / kit position requirements</summary>
                  {scenario.products.filter((item) => /lift|slide|bifold/i.test(item.productClass)).map((item) => {
                    const key = item.estimatePositionId ?? item.id;
                    const current = savedPositionRequirements[key] ?? {};
                    return (
                      <div key={item.id} className="costing-sheet__facts">
                        <span>
                          <b>{item.displayReference}</b> · {item.productClass} · {item.widthMm} mm
                        </span>
                        <label>
                          Kit format?
                          <select name={`kit:${key}`} className="ui-input" defaultValue={current.kitFormat ? "yes" : "no"}>
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </label>
                        <label>
                          Kit duration
                          <select name={`duration:${key}`} className="ui-input" defaultValue={String(current.durationHours ?? "")}>
                            <option value="">Select when kit</option>
                            <option value="4">0.5 day</option>
                            <option value="8">1 day</option>
                            <option value="12">1.5 days</option>
                            <option value="16">2 days</option>
                            <option value="24">3 days</option>
                          </select>
                        </label>
                        <label>
                          Custom productive hours
                          <input
                            name={`customDuration:${key}`}
                            className="ui-input"
                            inputMode="decimal"
                            defaultValue={String(current.customDurationHours ?? "")}
                          />
                        </label>
                      </div>
                    );
                  })}
                </details>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
