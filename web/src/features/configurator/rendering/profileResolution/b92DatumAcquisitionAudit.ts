export type B92DatumAcquisitionStatus = "missing" | "partial" | "confirmed";

export type B92DatumAcquisitionCategory =
  | "sash_bottom"
  | "fixed_no_sash"
  | "daylight_opening"
  | "glass_order"
  | "meeting_profile"
  | "horizontal_transom"
  | "segmented_sill"
  | "external_view";

export type B92DatumAcquisitionAuditItem = {
  id: string;
  category: B92DatumAcquisitionCategory;
  status: B92DatumAcquisitionStatus;
  requiredMeasurements: string[];
  affectedProjectionRegions: string[];
  affectedFutureRendererBehaviour: string[];
  sourceNote: string;
  todoNote: string;
};

export type B92DatumAcquisitionAuditSummary = {
  total: number;
  byStatus: Record<B92DatumAcquisitionStatus, number>;
  byCategory: Partial<Record<B92DatumAcquisitionCategory, number>>;
  missingOrPartial: number;
};

/**
 * B92 missing datum acquisition audit.
 *
 * This file is documentation/diagnostics only. It does not feed renderer output,
 * SVG generation, resolver routing, right-click behaviour, DB/API/server code, or
 * preview geometry. It must not become a geometry authority; confirmed datum
 * fixtures remain the source for projected geometry, and unknown measurements
 * must be acquired rather than inferred.
 */
export const B92_DATUM_ACQUISITION_AUDIT: B92DatumAcquisitionAuditItem[] = [
  {
    id: "b92-bottom-sash-overlay-rebate",
    category: "sash_bottom",
    status: "missing",
    requiredMeasurements: [
      "bottom sash overlay amount relative to structural frame datum",
      "bottom hidden/rebate relationship behind sash",
      "bottom relationship between visible sill face and sash body",
    ],
    affectedProjectionRegions: ["hidden_frame_rebate:bottom", "visible_sash_body:bottom"],
    affectedFutureRendererBehaviour: [
      "places the bottom sash body without assuming uniform 19.5mm overlay",
      "separates visible sill face from the concealed bottom rebate zone",
    ],
    sourceNote: "Current datum fixtures intentionally do not populate bottom sash overlay/rebate authority.",
    todoNote: "Acquire measured B92 bottom sash/frame section relationship before renderer migration.",
  },
  {
    id: "b92-bottom-sash-face-placement",
    category: "sash_bottom",
    status: "partial",
    requiredMeasurements: [
      "bottom sash face start datum",
      "bottom sash face direction relative to sill datum",
      "confirmation whether 57mm sash face/depth applies to bottom placement in the same way as top/sides",
    ],
    affectedProjectionRegions: ["visible_sash_body:bottom"],
    affectedFutureRendererBehaviour: [
      "draws the bottom sash face from explicit datum placement rather than mirrored top/side logic",
    ],
    sourceNote: "57mm sash face/depth is confirmed, but bottom placement is not confirmed.",
    todoNote: "Acquire bottom sash placement section before resolving bottom sash body bounds.",
  },
  {
    id: "b92-bottom-bead-placement",
    category: "sash_bottom",
    status: "partial",
    requiredMeasurements: [
      "bottom bead start datum",
      "bottom bead direction relative to sash face and sill",
      "confirmation that the 21mm bead/glass offset applies from the confirmed bottom sash face datum",
    ],
    affectedProjectionRegions: ["bead:bottom", "daylight_opening", "glass_order"],
    affectedFutureRendererBehaviour: [
      "closes sash-field daylight rectangles only after bottom bead placement is known",
      "prevents deriving glass order from an incomplete daylight opening",
    ],
    sourceNote: "21mm bead/glass offset is confirmed, but bottom bead placement depends on unresolved bottom sash placement.",
    todoNote: "Acquire bottom bead section datum tied to the confirmed bottom sash relationship.",
  },
  {
    id: "b92-fixed-no-sash-top-left-right-visible-frame",
    category: "fixed_no_sash",
    status: "partial",
    requiredMeasurements: [
      "fixed no-sash top visible frame datum",
      "fixed no-sash left visible frame datum",
      "fixed no-sash right visible frame datum",
      "fixed no-sash structural datum relationship for all edges",
    ],
    affectedProjectionRegions: [
      "visible_frame_face:top",
      "visible_frame_face:left",
      "visible_frame_face:right",
      "daylight_opening",
      "glass_order",
    ],
    affectedFutureRendererBehaviour: [
      "projects fixed no-sash daylight opening from all four confirmed frame faces",
      "keeps fixed glass sizing separate from sash-field assumptions",
    ],
    sourceNote: "Only fixed no-sash bottom visible frame datum is currently confirmed at 72mm.",
    todoNote: "Acquire fixed no-sash top/side visible and structural datum values before deriving full fixed daylight.",
  },
  {
    id: "b92-daylight-opening-derivation",
    category: "daylight_opening",
    status: "partial",
    requiredMeasurements: [
      "all four enclosing edge authorities for each field type",
      "fixed no-sash top/left/right visible frame datum",
      "sash-field bottom sash and bead placement",
      "meeting-side daylight closure rules for multi-field openings",
    ],
    affectedProjectionRegions: ["daylight_opening"],
    affectedFutureRendererBehaviour: [
      "derives daylight from datum-authoritative enclosing edges",
      "avoids rectangle inflation and symmetric frame-thickness assumptions",
    ],
    sourceNote: "Projection engine derives daylight only when four resolved enclosing edges exist.",
    todoNote: "Complete fixed, sash-bottom, and meeting-side edge authorities before renderer replacement.",
  },
  {
    id: "b92-glass-order-derivation",
    category: "glass_order",
    status: "partial",
    requiredMeasurements: [
      "resolved daylight opening bounds",
      "confirmation that +26mm width/height glass order delta applies to each supported field condition",
      "confirmation that 13mm bite behind bead applies to each supported field condition",
      "meeting-side glass order rules for owner/passive or mullion conditions",
    ],
    affectedProjectionRegions: ["glass_order"],
    affectedFutureRendererBehaviour: [
      "expands confirmed daylight openings to glass order geometry",
      "prevents glass order projection where daylight remains unresolved",
    ],
    sourceNote: "Glass order +26mm width/height and 13mm bite are confirmed, but they require resolved daylight bounds.",
    todoNote: "Validate glass order rules against fixed, sash, and meeting-field cases before migration.",
  },
  {
    id: "b92-15-static-meeting-measurements",
    category: "meeting_profile",
    status: "partial",
    requiredMeasurements: [
      "B92-15 static centre mullion visible face sequence",
      "B92-15 structural datum allocation",
      "B92-15 left/right field ownership and daylight closure",
      "confirmation or replacement of candidate 21 / 27 / 5 / 57 / 21 sequence",
    ],
    affectedProjectionRegions: ["meeting_profile:B92-15", "meeting_ownership", "daylight_opening"],
    affectedFutureRendererBehaviour: [
      "draws default T&T/T&T static centre condition without borrowing outer-frame logic",
      "allocates daylight and sash regions on each side of the meeting profile",
    ],
    sourceNote: "B92-15 exists as a default static meeting profile placeholder; detailed measurements are not authoritative.",
    todoNote: "Acquire measured B92-15 centre mullion section and ownership rules.",
  },
  {
    id: "b92-16-hinges-at-meeting-measurements",
    category: "meeting_profile",
    status: "missing",
    requiredMeasurements: [
      "B92-16 hinges-at-meeting structural width",
      "B92-16 visible face widths by side",
      "B92-16 hinge-side sash overlay and daylight closure",
      "handle/hinge ownership effects for adjacent fields",
    ],
    affectedProjectionRegions: ["meeting_profile:B92-16", "meeting_ownership", "visible_sash_body", "daylight_opening"],
    affectedFutureRendererBehaviour: [
      "projects hinge-side meeting geometry without inferring from B92-15",
      "preserves ownership differences between adjacent sashes",
    ],
    sourceNote: "B92-16 is currently candidate/unknown in the datum register.",
    todoNote: "Acquire hinges-at-meeting section dimensions and ownership semantics.",
  },
  {
    id: "b92-17-same-handing-measurements",
    category: "meeting_profile",
    status: "missing",
    requiredMeasurements: [
      "B92-17 same-handing structural width",
      "B92-17 visible face widths by side",
      "same-handing sash overlay and rebate relationships",
      "handle/hinge implications for active/passive adjacency",
    ],
    affectedProjectionRegions: ["meeting_profile:B92-17", "meeting_ownership", "visible_sash_body", "daylight_opening"],
    affectedFutureRendererBehaviour: [
      "projects same-handing meeting conditions from explicit profile authority",
      "keeps handle/hinge ownership from being guessed by operation labels",
    ],
    sourceNote: "B92-17 is currently candidate/unknown in the datum register.",
    todoNote: "Acquire same-handing meeting section dimensions and ownership semantics.",
  },
  {
    id: "b92-18-flying-mullion-owner-passive-measurements",
    category: "meeting_profile",
    status: "missing",
    requiredMeasurements: [
      "B92-18 flying mullion owner sash geometry",
      "B92-18 passive sash geometry",
      "owner/passive visible face allocation",
      "owner/passive daylight closure and glass order rules",
      "handle-side and hinge-side implications",
    ],
    affectedProjectionRegions: ["meeting_profile:B92-18", "meeting_ownership", "visible_sash_body", "daylight_opening", "glass_order"],
    affectedFutureRendererBehaviour: [
      "projects flying mullion geometry with explicit owner/passive roles",
      "prevents treating both meeting sides as symmetric static mullion geometry",
    ],
    sourceNote: "B92-18 is identified as flying mullion, but owner/passive measurements are not confirmed.",
    todoNote: "Acquire active/passive flying mullion section data and ownership rules.",
  },
  {
    id: "b92-horizontal-transom-datum-requirements",
    category: "horizontal_transom",
    status: "missing",
    requiredMeasurements: [
      "horizontal transom structural datum",
      "horizontal transom visible face widths above and below",
      "hidden/rebate relationships for adjacent top and bottom fields",
      "daylight closure rules across transom-separated fields",
    ],
    affectedProjectionRegions: ["meeting_profile:horizontal_transom", "meeting_ownership", "daylight_opening"],
    affectedFutureRendererBehaviour: [
      "projects stacked fields without reusing vertical meeting assumptions",
      "supports different datum chains above and below horizontal members",
    ],
    sourceNote: "Current projection fixtures are internal single-field only and do not define transom datum authority.",
    todoNote: "Acquire horizontal transom section and field ownership rules.",
  },
  {
    id: "b92-segmented-sill-datum-requirements",
    category: "segmented_sill",
    status: "missing",
    requiredMeasurements: [
      "segmented sill visible datum by segment",
      "segment transition rules at mullions/meetings",
      "interaction between fixed 72mm sill and sash 52.5mm sill conditions",
      "bottom rebate relationships for mixed fixed/sash segments",
    ],
    affectedProjectionRegions: ["visible_frame_face:bottom", "hidden_frame_rebate:bottom", "daylight_opening"],
    affectedFutureRendererBehaviour: [
      "draws bottom frame/sill geometry per segment rather than as one uniform bottom band",
      "supports mixed fixed and sash bottom conditions in multi-field windows",
    ],
    sourceNote: "Current datum fixtures distinguish fixed bottom 72mm and sash sill 52.5mm, but not segmented sill transitions.",
    todoNote: "Acquire segmented sill transition rules before multi-field bottom projection.",
  },
  {
    id: "b92-external-view-datum-requirements",
    category: "external_view",
    status: "missing",
    requiredMeasurements: [
      "external structural datum relationship for top, bottom, left, and right",
      "external visible frame face dimensions",
      "external sash, bead, and glass visibility rules",
      "external meeting profile visibility and ownership rules",
    ],
    affectedProjectionRegions: [
      "structural_frame_datum",
      "visible_frame_face",
      "visible_sash_body",
      "bead",
      "meeting_profile",
      "daylight_opening",
    ],
    affectedFutureRendererBehaviour: [
      "supports external projection without mirroring internal datum geometry",
      "keeps internal and external renderer migration paths explicitly separated",
    ],
    sourceNote: "Projection engine intentionally marks external-view divergence unsupported.",
    todoNote: "Acquire external B92 datum section set before enabling external projection.",
  },
];

function increment<K extends string>(counts: Partial<Record<K, number>>, key: K): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function listB92MissingDatumRequirements(input?: {
  status?: B92DatumAcquisitionStatus | B92DatumAcquisitionStatus[];
  category?: B92DatumAcquisitionCategory | B92DatumAcquisitionCategory[];
}): B92DatumAcquisitionAuditItem[] {
  const statuses = input?.status
    ? new Set(Array.isArray(input.status) ? input.status : [input.status])
    : new Set<B92DatumAcquisitionStatus>(["missing", "partial"]);
  const categories = input?.category ? new Set(Array.isArray(input.category) ? input.category : [input.category]) : null;

  return B92_DATUM_ACQUISITION_AUDIT.filter((item) => {
    if (!statuses.has(item.status)) return false;
    if (categories && !categories.has(item.category)) return false;
    return true;
  }).map((item) => ({
    ...item,
    requiredMeasurements: [...item.requiredMeasurements],
    affectedProjectionRegions: [...item.affectedProjectionRegions],
    affectedFutureRendererBehaviour: [...item.affectedFutureRendererBehaviour],
  }));
}

export function summarizeB92DatumAcquisitionAudit(
  items: readonly B92DatumAcquisitionAuditItem[] = B92_DATUM_ACQUISITION_AUDIT
): B92DatumAcquisitionAuditSummary {
  const byStatus: Record<B92DatumAcquisitionStatus, number> = {
    missing: 0,
    partial: 0,
    confirmed: 0,
  };
  const byCategory: Partial<Record<B92DatumAcquisitionCategory, number>> = {};

  for (const item of items) {
    byStatus[item.status] += 1;
    increment(byCategory, item.category);
  }

  return {
    total: items.length,
    byStatus,
    byCategory,
    missingOrPartial: byStatus.missing + byStatus.partial,
  };
}

export function formatB92DatumAcquisitionAuditReport(
  items: readonly B92DatumAcquisitionAuditItem[] = B92_DATUM_ACQUISITION_AUDIT
): string {
  const summary = summarizeB92DatumAcquisitionAudit(items);
  const lines = [
    "B92 Datum Acquisition Audit",
    `total: ${summary.total}`,
    `missing: ${summary.byStatus.missing}`,
    `partial: ${summary.byStatus.partial}`,
    `confirmed: ${summary.byStatus.confirmed}`,
    `missingOrPartial: ${summary.missingOrPartial}`,
  ];

  for (const item of items) {
    lines.push(
      "",
      `${item.id} [${item.status}]`,
      `category: ${item.category}`,
      `requiredMeasurements: ${item.requiredMeasurements.join("; ")}`,
      `affectedProjectionRegions: ${item.affectedProjectionRegions.join("; ")}`,
      `affectedFutureRendererBehaviour: ${item.affectedFutureRendererBehaviour.join("; ")}`,
      `sourceNote: ${item.sourceNote}`,
      `todoNote: ${item.todoNote}`
    );
  }

  return lines.join("\n");
}
