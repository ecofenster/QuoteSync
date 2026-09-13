// A draft retains its save identity across an uncertain response or a later
// profile-save failure. A freshly calculated draft is a separate reviewed save.
export function createRouteSnapshotSaver(send, createKey = () => globalThis.crypto.randomUUID()) {
  const identities = new WeakMap();
  return async (scenarioId, input) => {
    let scenarios = identities.get(input);
    if (!scenarios) { scenarios = new Map(); identities.set(input, scenarios); }
    if (!scenarios.has(scenarioId)) scenarios.set(scenarioId, input.requestKey ?? createKey());
    const response = await send(scenarioId, { ...input, requestKey: scenarios.get(scenarioId) });
    const savedId = response?.savedRouteSnapshotId;
    const matches = (response?.routeSnapshots ?? []).filter(route => route.id === savedId);
    const saved = matches[0];
    const endpointMatches = (a, b) => a && b && a.label === String(b.label).trim()
      && Number(a.lat) === Number(b.lat) && Number(a.lng) === Number(b.lng);
    if (!savedId || matches.length !== 1 || saved.scenarioId !== scenarioId
      || saved.direction !== input.direction
      || !endpointMatches(saved.origin, input.origin) || !endpointMatches(saved.destination, input.destination)
      || Number(saved.distanceKm) !== Number(input.distanceKm)
      || Number(saved.durationMinutes) !== Number(input.durationMinutes)
      || saved.integration !== String(input.integration).trim()) {
      throw new Error("The route save could not be confirmed against the selected journey. Your choices are retained; no route has been applied. Check the saved routes and that the application is up to date before retrying.");
    }
    return response;
  };
}
