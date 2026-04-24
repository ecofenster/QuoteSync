import React, { useEffect, useMemo, useRef, useState } from "react";
import QuoteSyncDrawingSvg from "./QuoteSyncDrawingSvg";
import DrawingPreviewToolbar from "./DrawingPreviewToolbar";
import {
  buildMeasurementAnnotation,
  clampPan,
  clampZoomMultiplier,
  collectDrawingSnapAnchors,
  getEffectiveDisplayScale,
  getMeasurementPointFromClientEvent,
  stepZoomMultiplier,
} from "./drawingViewport.helpers";
import type {
  DrawingMeasurementAnnotation,
  DrawingMeasurementPoint,
  DrawingViewportPan,
  DrawingViewportProps,
  DrawingScalePreset,
  DrawingViewportTool,
} from "./drawingViewport.types";

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
  const contentRef = useRef<HTMLDivElement | null>(null);
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
  const [measurementStart, setMeasurementStart] = useState<DrawingMeasurementPoint | null>(null);
  const [measurementPreview, setMeasurementPreview] = useState<DrawingMeasurementPoint | null>(null);
  const [measurements, setMeasurements] = useState<DrawingMeasurementAnnotation[]>([]);

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
  const snapAnchors = useMemo(() => collectDrawingSnapAnchors(model), [model]);
  const activeMeasurementEnd = measurementPreview;

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
          measurementCount={measurements.length}
          onScalePresetChange={setScalePreset}
          onToolChange={setTool}
          onZoomIn={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "in"))}
          onZoomOut={() => setZoomMultiplier((current) => stepZoomMultiplier(current, "out"))}
          onResetZoom={() => {
            setZoomMultiplier(1);
            setPan({ x: 0, y: 0 });
            setMeasurementStart(null);
            setMeasurementPreview(null);
            setMeasurements([]);
          }}
          onClearMeasurements={() => {
            setMeasurementStart(null);
            setMeasurementPreview(null);
            setMeasurements([]);
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
          if (tool === "measure") {
            const viewportElement = viewportRef.current;
            const contentElement = contentRef.current;
            if (!viewportElement || !contentElement || !measurementStart) return;
            const nextPoint = getMeasurementPointFromClientEvent({
              clientX: event.clientX,
              clientY: event.clientY,
              viewportRect: viewportElement.getBoundingClientRect(),
              contentRect: contentElement.getBoundingClientRect(),
              model,
              snapAnchors,
            });
            if (nextPoint) setMeasurementPreview(nextPoint);
            return;
          }
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
          if (tool === "measure") setMeasurementPreview(null);
        }}
        onClick={(event) => {
          if (tool !== "measure") return;
          const viewportElement = viewportRef.current;
          const contentElement = contentRef.current;
          if (!viewportElement || !contentElement) return;
          const point = getMeasurementPointFromClientEvent({
            clientX: event.clientX,
            clientY: event.clientY,
            viewportRect: viewportElement.getBoundingClientRect(),
            contentRect: contentElement.getBoundingClientRect(),
            model,
            snapAnchors,
          });
          if (!point) return;
          if (!measurementStart) {
            setMeasurementStart(point);
            setMeasurementPreview(point);
            return;
          }
          setMeasurements((current) => [
            ...current,
            buildMeasurementAnnotation(`measurement-${current.length + 1}`, measurementStart, point),
          ]);
          setMeasurementStart(null);
          setMeasurementPreview(point);
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
          cursor: tool === "pan" ? (isDragging ? "grabbing" : "grab") : tool === "measure" ? "crosshair" : "default",
          userSelect: "none",
        }}
      >
        <div
          ref={contentRef}
          style={{
            width: contentWidth,
            height: contentHeight,
            flex: "0 0 auto",
            pointerEvents: tool === "pan" || tool === "measure" ? "none" : "auto",
            position: "relative",
          }}
        >
          <QuoteSyncDrawingSvg
            model={model}
            selectedCellKey={tool === "pan" || tool === "measure" ? "" : selectedCellKey}
            onSelectCell={tool === "pan" || tool === "measure" ? undefined : onSelectCell}
            onRemoveVerticalJunction={tool === "pan" || tool === "measure" ? undefined : onRemoveVerticalJunction}
            onRemoveHorizontalJunction={tool === "pan" || tool === "measure" ? undefined : onRemoveHorizontalJunction}
          />
          <svg
            viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
          >
            {measurements.map((measurement) => (
              <g key={measurement.id}>
                <line
                  x1={measurement.start.model.x}
                  y1={measurement.start.model.y}
                  x2={measurement.end.model.x}
                  y2={measurement.end.model.y}
                  stroke="#0f766e"
                  strokeWidth={2}
                />
                <circle cx={measurement.start.model.x} cy={measurement.start.model.y} r={3.5} fill="#0f766e" />
                <circle cx={measurement.end.model.x} cy={measurement.end.model.y} r={3.5} fill="#0f766e" />
                <g transform={`translate(${(measurement.start.model.x + measurement.end.model.x) / 2} ${(measurement.start.model.y + measurement.end.model.y) / 2 - 10})`}>
                  <rect x={-62} y={-18} width={124} height={28} rx={6} fill="#ffffff" stroke="#0f766e" strokeWidth={1} />
                  <text x={0} y={-2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f766e">
                    {`${measurement.distanceMm.toFixed(1)} mm`}
                  </text>
                  <text x={0} y={11} textAnchor="middle" fontSize={10} fontWeight={600} fill="#115e59">
                    {`${measurement.angleDeg.toFixed(1)}°`}
                  </text>
                </g>
              </g>
            ))}
          </svg>
          {measurementStart && activeMeasurementEnd ? (
            <svg
              viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
              width="100%"
              height="100%"
              style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
            >
              <line
                x1={measurementStart.model.x}
                y1={measurementStart.model.y}
                x2={activeMeasurementEnd.model.x}
                y2={activeMeasurementEnd.model.y}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="8 6"
              />
              <circle cx={measurementStart.model.x} cy={measurementStart.model.y} r={4} fill="#2563eb" />
              <circle cx={activeMeasurementEnd.model.x} cy={activeMeasurementEnd.model.y} r={4} fill="#2563eb" />
              <g transform={`translate(${(measurementStart.model.x + activeMeasurementEnd.model.x) / 2} ${(measurementStart.model.y + activeMeasurementEnd.model.y) / 2 - 10})`}>
                <rect x={-62} y={-18} width={124} height={28} rx={6} fill="#ffffff" stroke="#2563eb" strokeWidth={1} />
                <text x={0} y={-2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1d4ed8">
                  {`${buildMeasurementAnnotation("preview", measurementStart, activeMeasurementEnd).distanceMm.toFixed(1)} mm`}
                </text>
                <text x={0} y={11} textAnchor="middle" fontSize={10} fontWeight={600} fill="#1d4ed8">
                  {`${buildMeasurementAnnotation("preview", measurementStart, activeMeasurementEnd).angleDeg.toFixed(1)}°`}
                </text>
              </g>
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
