import type { Installer } from "../models/types";

export const INSTALLERS: Installer[] = [
  {
    id: "inst_001",
    companyName: "Ecofenster Install Team South",
    contactPerson: "John Smith",
    phone: "07123456789",
    postcode: "SS14 3DP",
    address: "Basildon, Essex"
  },
  {
    id: "inst_002",
    companyName: "Ecofenster Install Team North",
    contactPerson: "Mark Taylor",
    phone: "07987654321",
    postcode: "LS1 4AP",
    address: "Leeds"
  },
  {
    id: "inst_003",
    companyName: "Ecofenster Install Team Midlands",
    contactPerson: "Chris Evans",
    phone: "07800111222",
    postcode: "B1 1AA",
    address: "Birmingham"
  }
];

export function getInstallers(): Installer[] {
  return INSTALLERS;
}

// Placeholder for next phase (distance engine)
export function sortInstallersByDistance(installers: Installer[], postcode: string): Installer[] {
  return installers;
}
