import React, { useEffect, useMemo, useRef, useState } from "react";
import QuoteSyncDrawingSvg from "./QuoteSyncDrawingSvg";
import DrawingPreviewToolbar from "./DrawingPreviewToolbar";
import {
  clampPan,
  clampZoomMultiplier,
  getEffectiveDisplayScale,
  stepZoomMultiplier,
} from "./drawingViewport.helpers";
import type { DrawingViewportPan, DrawingViewportProps, DrawingScalePreset, DrawingViewportTool } from "./drawingViewport.types";

export default function DrawingViewport(props: DrawingViewportProps) {
  const {
    model,
    selectedCellKey,
    onSelectCell,
    onRemoveVerticalJunction,
    onRemoveHorizontalJunction,
    minHeight = 320,
    aspectRatio = "16 / 9",
    initialScalePreset = "auto",
    initialTool = "select",
    showToolbar = true,
  } = props;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [scalePreset, setScalePreset] = useState<DrawingScalePreset>(initialScalePreset);
  const [tool, setTool] = useState<DrawingViewportTool>(initialTool);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState<DrawingViewportPan>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) return 1;
    const widthScale = viewportSize.width / Math.max(1, model.viewBox.width);
    const heightScale = viewportSize.height / Math.max(1, model.viewBox.height);
    return Math.max(0.01, Math.min(widthScale, heightScale));
  }, [model.viewBox.height, model.viewBox.width, viewportSize.height, viewportSize.width]);

  const effectiveScale = useMemo(
    () =>
      getEffectiveDisplayScale({
        preset: scalePreset,
        zoomMultiplier,
        fitScale,
      }),
    [fitScale, scalePreset, zoomMultiplier]
  );

  const contentWidth = Math.max(1, model.viewBox.width * effectiveScale);
  const contentHeight = Math.max(1, model.viewBox.height * effectiveScale);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const nextPan = clampPan(pan);
    if (Math.abs(element.scrollLeft - nextPan.x) > 1) element.scrollLeft = nextPan.x;
    if (Math.abs(element.scrollTop - nextPan.y) > 1) element.scrollTop = nextPan.y;
  }, [contentHeight, contentWidth, pan]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {showToolbar ? (
        <DrawingPreviewToolbar
          scalePreset={scalePreset}
          tool={tool}
          zoomMultiplier={zoomMultiplier}
          onScalePresetChange={setScalePreset}
          onToolChange={setTool}
          onZoomIn={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "in"))}
          onZoomOut={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "out"))}
          onResetZoom={() => {
            setZoomMultiplier(1);
            setPan({ x: 0, y: 0 });
          }}
        />
      ) : null}
      <div
        ref={viewportRef}
        onMouseDown={(event) => {
          if (tool !== "pan") return;
          if (event.button !== 0) return;
          const element = viewportRef.current;
          if (!element) return;
          dragStartRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop,
          };
          setIsDragging(true);
        }}
        onMouseMove={(event) => {
          const element = viewportRef.current;
          const dragStart = dragStartRef.current;
          if (!element || !dragStart) return;
          const nextPan = clampPan({
            x: dragStart.scrollLeft - (event.clientX - dragStart.pointerX),
            y: dragStart.scrollTop - (event.clientY - dragStart.pointerY),
          });
          element.scrollLeft = nextPan.x;
          element.scrollTop = nextPan.y;
          setPan(nextPan);
        }}
        onMouseUp={() => {
          dragStartRef.current = null;
          setIsDragging(false);
        }}
        onMouseLeave={() => {
          dragStartRef.current = null;
          setIsDragging(false);
        }}
        onWheel={(event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          setZoomMultiplier((current) =>
            clampZoomMultiplier(event.deltaY < 0 ? current * 1.1 : current / 1.1)
          );
        }}
        style={{
          width: "100%",
          minHeight,
          aspectRatio,
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          cursor: tool === "pan" ? (isDragging ? "grabbing" : "grab") : "default",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: contentWidth,
            height: contentHeight,
            flex: "0 0 auto",
            pointerEvents: tool === "pan" ? "none" : "auto",
          }}
        >
          <QuoteSyncDrawingSvg
            model={model}
            selectedCellKey={tool === "pan" ? "" : selectedCellKey}
            onSelectCell={tool === "pan" ? undefined : onSelectCell}
            onRemoveVerticalJunction={tool === "pan" ? undefined : onRemoveVerticalJunction}
            onRemoveHorizontalJunction={tool === "pan" ? undefined : onRemoveHorizontalJunction}
          />
        </div>
      </div>
    </div>
  );
}
