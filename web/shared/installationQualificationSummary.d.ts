export type QualificationSummaryEvidence = {
  id?: string;
  typeCode?: string;
  typeLabel: string;
  supersedesQualificationId?: string | null;
  attendanceValidity?: string;
  validityStatus: string;
  verificationStatus: string;
  expiryDate?: string | null;
};
export function installationQualificationSummary(check?: {members?: Array<{name: string; qualifications?: QualificationSummaryEvidence[]}>} | null): Array<{name: string; summary: string}>;
