import React, { useEffect, useMemo, useRef, useState } from "react";
import QuoteSyncDrawingSvg from "./QuoteSyncDrawingSvg";
import DrawingPreviewToolbar from "./DrawingPreviewToolbar";
import {
  clampZoomMultiplier,
  getEffectiveDisplayScale,
  stepZoomMultiplier,
} from "./drawingViewport.helpers";
import type { DrawingViewportProps, DrawingScalePreset } from "./drawingViewport.types";

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
    showToolbar = true,
  } = props;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scalePreset, setScalePreset] = useState<DrawingScalePreset>(initialScalePreset);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

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

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {showToolbar ? (
        <DrawingPreviewToolbar
          scalePreset={scalePreset}
          zoomMultiplier={zoomMultiplier}
          onScalePresetChange={setScalePreset}
          onZoomIn={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "in"))}
          onZoomOut={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "out"))}
          onResetZoom={() => setZoomMultiplier(1)}
        />
      ) : null}
      <div
        ref={viewportRef}
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
        }}
      >
        <div
          style={{
            width: contentWidth,
            height: contentHeight,
            flex: "0 0 auto",
          }}
        >
          <QuoteSyncDrawingSvg
            model={model}
            selectedCellKey={selectedCellKey}
            onSelectCell={onSelectCell}
            onRemoveVerticalJunction={onRemoveVerticalJunction}
            onRemoveHorizontalJunction={onRemoveHorizontalJunction}
          />
        </div>
      </div>
    </div>
  );
}
