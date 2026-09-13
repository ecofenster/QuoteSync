export function createRouteSnapshotSaver<T>(
  send: (scenarioId: string, input: Record<string, unknown>) => Promise<T>,
  createKey?: () => string,
): (scenarioId: string, input: Record<string, unknown>) => Promise<T>;
