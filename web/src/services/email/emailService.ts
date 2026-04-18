export function buildSendEmailText(args: { pickerClient: any; estimateId: string }) {
  const e = args.pickerClient?.estimates?.find((x: any) => x.id === args.estimateId);
  const estimateRef = (e as any)?.estimateRef ?? "";
  const clientRef = (args.pickerClient as any)?.clientRef ?? "";
  const clientName = args.pickerClient?.clientName ?? "Client";
  const itemsCount = e?.positions?.length ?? 0;

  const subject = `Your quotation ${clientRef || clientName}${estimateRef ? "" + estimateRef : ""}`.trim();

  const bodyLines = [
    `Dear ${clientName},`,
    ``,
    `Please find our quotation attached / linked below.`,
    ``,
    `Estimate: ${estimateRef || "(ref)"}  (${itemsCount} item${itemsCount === 1 ? "" : "s"})`,
    ``,
    `Summary (to be expanded):`,
    `Materials/finishes: (later)`,
    `Quantity: ${itemsCount}`,
    `Area (m²) and linear metres: (later)`,
    ``,
    `Kind regards,`,
    `Ecofenster Ltd`,
  ];

  return { subject, body: bodyLines.join("\n") };
}

export function openMailClient(to: string, subject: string, body: string) {
  const mailto = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}
