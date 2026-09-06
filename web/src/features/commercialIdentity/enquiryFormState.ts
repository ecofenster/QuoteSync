export type EnquiryDraft = {
  displayName: string;
  companyName: string;
  email: string;
  telephone: string;
  source: string;
  leadSource: string;
  projectName: string;
  siteAddress: string;
  notes: string;
};

export type EnquiryDraftField = keyof EnquiryDraft;
export type SubmissionLock = { current: boolean };

export const emptyEnquiryDraft = (): EnquiryDraft => ({
  displayName: "",
  companyName: "",
  email: "",
  telephone: "",
  source: "",
  leadSource: "",
  projectName: "",
  siteAddress: "",
  notes: "",
});

export function readEnquiryControlValue(control: Pick<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, "value">): string {
  return control.value;
}

export function updateEnquiryDraft(draft: EnquiryDraft, field: EnquiryDraftField, value: string): EnquiryDraft {
  return { ...draft, [field]: value };
}

export function enquiryDraftHasIdentity(draft: EnquiryDraft): boolean {
  return Boolean(draft.displayName.trim() || draft.companyName.trim());
}

export function claimEnquirySubmission(lock: SubmissionLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseEnquirySubmission(lock: SubmissionLock): void {
  lock.current = false;
}
