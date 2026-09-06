import type { InstallationTeam, InstallationWorkforce } from "./projectCalculatorLab.types";

export type InstallationCompanyRoute = {
  distanceMiles: number;
  durationMinutes: number;
};

export type InstallationCompanyCandidate = {
  id: string;
  name: string;
  basePostcode: string;
  crewCapacity: number;
  capabilities: string[];
  teams: InstallationTeam[];
};

export type InstallationTeamRecommendation = {
  teamId: string | null;
  snapshot: InstallationTeam;
  source: "saved_team" | "named_team" | "company_allocated_workforce";
};

const capable = (team: InstallationTeam, requiredCapabilities: string[]) =>
  team.active !== false && requiredCapabilities.every((capability) => team.capabilities.includes(capability));

export function buildInstallationCompanyCandidates({
  workforce,
  requiredCrew,
  requiredCapabilities,
}: {
  workforce: InstallationWorkforce | null;
  requiredCrew: number;
  requiredCapabilities: string[];
}): InstallationCompanyCandidate[] {
  if (!workforce) return [];
  return workforce.companies
    .filter((company) => company.active)
    .map((company) => {
      const teams = workforce.teams
        .filter((team) => team.companyId === company.id && capable(team, requiredCapabilities))
        .sort((left, right) => left.normalCrewSize - right.normalCrewSize || left.name.localeCompare(right.name));
      const crewCapacity = teams.reduce((total, team) => total + team.normalCrewSize, 0);
      return {
        id: company.id,
        name: company.name,
        basePostcode: String(company.postcode ?? teams.find((team) => team.basePostcode)?.basePostcode ?? ""),
        crewCapacity,
        capabilities: [...new Set(teams.flatMap((team) => team.capabilities))],
        teams,
      };
    })
    .filter((company) => company.crewCapacity >= requiredCrew);
}

export function recommendInstallationTeam(
  company: InstallationCompanyCandidate,
  requiredCrew: number,
  savedTeamId = "",
): InstallationTeamRecommendation {
  const saved = company.teams.find((team) => team.id === savedTeamId && team.normalCrewSize >= requiredCrew);
  if (saved) return { teamId: saved.id, snapshot: saved, source: "saved_team" };
  const named = company.teams.find((team) => team.normalCrewSize >= requiredCrew);
  if (named) return { teamId: named.id, snapshot: named, source: "named_team" };
  return {
    teamId: null,
    source: "company_allocated_workforce",
    snapshot: {
      id: `company:${company.id}`,
      companyId: company.id,
      companyName: company.name,
      name: "Company allocated workforce",
      normalCrewSize: requiredCrew,
      baseAddress: {},
      basePostcode: company.basePostcode || null,
      capabilities: company.capabilities,
      active: true,
      version: 1,
      installerIds: [],
    },
  };
}

export function companyForSavedTeam(candidates: InstallationCompanyCandidate[], savedTeamId: string) {
  return savedTeamId ? candidates.find((company) => company.teams.some((team) => team.id === savedTeamId)) ?? null : null;
}

export function rankInstallationCompaniesByDistance(
  candidates: InstallationCompanyCandidate[],
  routesByCompanyId: Record<string, InstallationCompanyRoute>,
) {
  return [...candidates].sort((left, right) =>
    (routesByCompanyId[left.id]?.distanceMiles ?? Number.MAX_SAFE_INTEGER)
      - (routesByCompanyId[right.id]?.distanceMiles ?? Number.MAX_SAFE_INTEGER)
    || (routesByCompanyId[left.id]?.durationMinutes ?? Number.MAX_SAFE_INTEGER)
      - (routesByCompanyId[right.id]?.durationMinutes ?? Number.MAX_SAFE_INTEGER)
    || left.name.localeCompare(right.name));
}
