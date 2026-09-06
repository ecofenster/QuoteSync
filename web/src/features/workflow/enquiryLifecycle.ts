export type EnquiryLifecycleStage = "enquiry" | "qualified_estimate" | "quotation" | "order";

export type LeadSourceAttribution = Readonly<{
  leadSource: string | null;
  leadSourceDetail: string | null;
}>;

export type EnquiryLifecycleContext = Readonly<{
  clientName: string;
  projectName: string | null;
  attribution: LeadSourceAttribution;
}>;

export function preserveLeadSourceAttribution(input: LeadSourceAttribution): LeadSourceAttribution {
  return Object.freeze({
    leadSource: input.leadSource?.trim() || null,
    leadSourceDetail: input.leadSourceDetail?.trim() || null,
  });
}
