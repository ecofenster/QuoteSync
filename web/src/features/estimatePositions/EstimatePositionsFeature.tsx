import React, { useEffect, useMemo, useState } from "react";
import EstimatePositionsTable from "../estimatePicker/tabs/EstimatePositionsTable";
import { useEstimateWorkflow } from "../estimateWorkflow/useEstimateWorkflow";

type Props = {
  e: any;
  itemPriceByPositionId: Record<string, string>;
  setItemPriceByPositionId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  PositionPreview: React.ComponentType<{ position: any }>;
  onUpdatePositions: (updatedPositions: any[]) => Promise<void>;
};

type QuickAddPositionType = "Window" | "Door";

const WINDOW_INSERTIONS = ["Fixed", "Tilt & Turn", "Top Hung"];
const DOOR_INSERTIONS = ["Single Door", "French Door", "Sliding Door"];

function nextPositionRef(positions: any[], positionType: QuickAddPositionType) {
  const prefix = positionType === "Door" ? "D" : "W";
  let maxIndex = 0;

  for (const position of positions) {
    const value = String(position?.positionRef ?? "").trim().toUpperCase();
    const match = value.match(new RegExp(`^${prefix}-(\d+)$`));
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > maxIndex) {
      maxIndex = n;
    }
  }

  return `${prefix}-${String(maxIndex + 1).padStart(3, "0")}`;
}

export default function EstimatePositionsFeature(props: Props) {
  const { e, onUpdatePositions } = props;
  const { openConfigurationStep } = useEstimateWorkflow();

  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [draftPositions, setDraftPositions] = useState<any[]>(() => (Array.isArray(e?.positions) ? e.positions : []));
  const [quickAddPositionType, setQuickAddPositionType] = useState<QuickAddPositionType>("Window");
  const [quickAddInsertion, setQuickAddInsertion] = useState<string>("Fixed");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftPositions(Array.isArray(e?.positions) ? e.positions : []);
    setExpandedPositionId(null);
  }, [e?.id, e?.positions]);

  const availableInsertions = useMemo(
    () => (quickAddPositionType === "Door" ? DOOR_INSERTIONS : WINDOW_INSERTIONS),
    [quickAddPositionType]
  );

  useEffect(() => {
    if (!availableInsertions.includes(quickAddInsertion)) {
      setQuickAddInsertion(availableInsertions[0] ?? "");
    }
  }, [availableInsertions, quickAddInsertion]);

  function updatePositionDraft(positionId: string, patch: Record<string, any>) {
    setDraftPositions((prev) =>
      prev.map((position) => (String(position?.id) === String(positionId) ? { ...position, ...patch } : position))
    );
  }

  async function persistPosition(positionId: string) {
    const updatedPositions = draftPositions.map((position) =>
      String(position?.id) === String(positionId) ? { ...position } : position
    );

    setIsSaving(true);
    try {
      await onUpdatePositions(updatedPositions);
    } finally {
      setIsSaving(false);
    }
  }

  async function quickAddPosition() {
    const currentPositions = Array.isArray(draftPositions) ? draftPositions : [];
    const nextId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const nextPosition = {
      id: nextId,
      positionRef: nextPositionRef(currentPositions, quickAddPositionType),
      qty: 1,
      itemPrice: 0,
      roomName: "",
      widthMm: 1000,
      heightMm: 1200,
      fieldsX: 1,
      fieldsY: 1,
      insertion: quickAddInsertion,
      cellInsertions: {},
      positionType: quickAddPositionType,
      useEstimateDefaults: true,
      overrides: {},
    };

    const updatedPositions = [...currentPositions, nextPosition];
    setDraftPositions(updatedPositions);
    setExpandedPositionId(nextId);

    setIsSaving(true);
    try {
      await onUpdatePositions(updatedPositions);
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicatePosition(positionId: string) {
    const currentPositions = Array.isArray(draftPositions) ? draftPositions : [];
    const source = currentPositions.find((position) => String(position?.id) === String(positionId));
    if (!source) return;

    const duplicatedType: QuickAddPositionType = source.positionType === "Door" ? "Door" : "Window";
    const nextId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const duplicate = {
      ...source,
      id: nextId,
      positionRef: nextPositionRef(currentPositions, duplicatedType),
    };

    const sourceIndex = currentPositions.findIndex((position) => String(position?.id) === String(positionId));
    const updatedPositions = [...currentPositions];
    updatedPositions.splice(sourceIndex + 1, 0, duplicate);

    setDraftPositions(updatedPositions);
    setExpandedPositionId(nextId);

    setIsSaving(true);
    try {
      await onUpdatePositions(updatedPositions);
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePosition(positionId: string) {
    const currentPositions = Array.isArray(draftPositions) ? draftPositions : [];
    const updatedPositions = currentPositions.filter((position) => String(position?.id) !== String(positionId));

    setDraftPositions(updatedPositions);
    setExpandedPositionId((prev) => (String(prev ?? "") === String(positionId) ? null : prev));

    setIsSaving(true);
    try {
      await onUpdatePositions(updatedPositions);
    } finally {
      setIsSaving(false);
    }
  }

  async function movePosition(positionId: string, direction: -1 | 1) {
    const currentPositions = Array.isArray(draftPositions) ? draftPositions : [];
    const currentIndex = currentPositions.findIndex((position) => String(position?.id) === String(positionId));
    if (currentIndex < 0) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= currentPositions.length) return;

    const updatedPositions = [...currentPositions];
    const [moved] = updatedPositions.splice(currentIndex, 1);
    updatedPositions.splice(nextIndex, 0, moved);

    setDraftPositions(updatedPositions);
    setExpandedPositionId((prev) => (String(prev ?? "") === String(positionId) ? positionId : prev));

    setIsSaving(true);
    try {
      await onUpdatePositions(updatedPositions);
    } finally {
      setIsSaving(false);
    }
  }

  async function movePositionUp(positionId: string) {
    await movePosition(positionId, -1);
  }

  async function movePositionDown(positionId: string) {
    await movePosition(positionId, 1);
  }

  function handleConfigurePosition(positionId: string) {
    console.log("QuoteSync configurator requested for position:", positionId, "estimate:", e?.id);
    openConfigurationStep(String(e?.id || ""), String(positionId || ""));
  }

  const effectiveEstimate = useMemo(() => ({ ...e, positions: draftPositions }), [e, draftPositions]);

  return (
    <EstimatePositionsTable
      {...props}
      e={effectiveEstimate}
      expandedPositionId={expandedPositionId}
      setExpandedPositionId={setExpandedPositionId}
      onUpdatePositionDraft={updatePositionDraft}
      onPersistPosition={persistPosition}
      onDuplicatePosition={duplicatePosition}
      onDeletePosition={deletePosition}
      onMovePositionUp={movePositionUp}
      onMovePositionDown={movePositionDown}
      onConfigurePosition={handleConfigurePosition}
      quickAddPositionType={quickAddPositionType}
      setQuickAddPositionType={setQuickAddPositionType}
      quickAddInsertion={quickAddInsertion}
      setQuickAddInsertion={setQuickAddInsertion}
      availableInsertions={availableInsertions}
      onQuickAddPosition={quickAddPosition}
      isSaving={isSaving}
    />
  );
}
