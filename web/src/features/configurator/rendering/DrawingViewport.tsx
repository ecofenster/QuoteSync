import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import QuoteSyncDrawingSvg from "./QuoteSyncDrawingSvg";
import DrawingPreviewToolbar from "./DrawingPreviewToolbar";
import {
  buildMeasurementAnnotation,
  clampPan,
  clampZoomMultiplier,
  collectDrawingSnapAnchors,
  getEffectiveDisplayScale,
  getMeasurementLabelPlacement,
  getMeasurementPointFromClientEvent,
  stepZoomMultiplier,
} from "./drawingViewport.helpers";
import type {
  DrawingMeasurementAnnotation,
  DrawingMeasurementPoint,
  DrawingViewportPan,
  DrawingViewportProps,
  DrawingScalePreset,
  DrawingViewportHandle,
  DrawingViewportTool,
} from "./drawingViewport.types";

function DrawingViewport(
  props: DrawingViewportProps,
  ref: React.ForwardedRef<DrawingViewportHandle>
) {
  const {
    model,
    selectedCellKey,
    onSelectCell,
    onCellContextMenu,
    onRemoveVerticalJunction,
    onRemoveHorizontalJunction,
    height,
    minHeight = 320,
    maxHeight,
    maxWidth,
    aspectRatio = "16 / 9",
    fitPadding = { x: 32, y: 44 },
    initialScalePreset = "auto",
    initialTool = "select",
    showToolbar = true,
    overlay,
    onViewportStateChange,
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
  const [hoveredMeasurementId, setHoveredMeasurementId] = useState<string | null>(null);

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
    const paddingX = typeof fitPadding === "number" ? fitPadding : fitPadding.x;
    const paddingY = typeof fitPadding === "number" ? fitPadding : fitPadding.y;
    const availableWidth = Math.max(1, viewportSize.width - paddingX * 2);
    const availableHeight = Math.max(1, viewportSize.height - paddingY * 2);
    const widthScale = availableWidth / Math.max(1, model.viewBox.width);
    const heightScale = availableHeight / Math.max(1, model.viewBox.height);
    return Math.max(0.01, Math.min(widthScale, heightScale));
  }, [fitPadding, model.viewBox.height, model.viewBox.width, viewportSize.height, viewportSize.width]);

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

  const resetView = React.useCallback(() => {
    setZoomMultiplier(1);
    setPan({ x: 0, y: 0 });
    setMeasurementStart(null);
    setMeasurementPreview(null);
    setMeasurements([]);
    setHoveredMeasurementId(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitToView: () => {
        setScalePreset("auto");
        resetView();
      },
      setOneToOne: () => {
        setScalePreset("1:1");
        resetView();
      },
      zoomIn: () => setZoomMultiplier((current) => stepZoomMultiplier(current, "in")),
      zoomOut: () => setZoomMultiplier((current) => stepZoomMultiplier(current, "out")),
      resetView,
      setTool,
    }),
    [resetView]
  );

  useEffect(() => {
    onViewportStateChange?.({ scalePreset, tool, zoomMultiplier });
  }, [onViewportStateChange, scalePreset, tool, zoomMultiplier]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const nextPan = clampPan(pan);
    if (Math.abs(element.scrollLeft - nextPan.x) > 1) element.scrollLeft = nextPan.x;
    if (Math.abs(element.scrollTop - nextPan.y) > 1) element.scrollTop = nextPan.y;
  }, [contentHeight, contentWidth, pan]);

  return (
    <div className="qs-migrated-41">
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
          onResetZoom={resetView}
          onClearMeasurements={() => {
            setMeasurementStart(null);
            setMeasurementPreview(null);
            setMeasurements([]);
            setHoveredMeasurementId(null);
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
          setHoveredMeasurementId(null);
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
        }} className="qs-migrated-237"
      >
        <div
          ref={contentRef}
          className="drawing-viewport__content"
          data-width={contentWidth}
          data-height={contentHeight}
          data-interaction={tool === "pan" || tool === "measure" ? "disabled" : "enabled"}
        >
          <QuoteSyncDrawingSvg
            model={model}
            selectedCellKey={tool === "pan" || tool === "measure" ? "" : selectedCellKey}
            onSelectCell={tool === "pan" || tool === "measure" ? undefined : onSelectCell}
            onCellContextMenu={tool === "pan" || tool === "measure" ? undefined : onCellContextMenu}
            onRemoveVerticalJunction={tool === "pan" || tool === "measure" ? undefined : onRemoveVerticalJunction}
            onRemoveHorizontalJunction={tool === "pan" || tool === "measure" ? undefined : onRemoveHorizontalJunction}
          />
          {overlay}
          <svg
            viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
            width="100%"
            height="100%"
            className="drawing-viewport__measurement-layer"
            data-interaction={tool === "measure" ? "enabled" : "disabled"}
          >
            {measurements.map((measurement) => (
              <g
                key={measurement.id}
                onMouseEnter={() => tool === "measure" && setHoveredMeasurementId(measurement.id)}
                onMouseLeave={() => setHoveredMeasurementId((current) => (current === measurement.id ? null : current))}
              >
                <line
                  x1={measurement.start.model.x}
                  y1={measurement.start.model.y}
                  x2={measurement.end.model.x}
                  y2={measurement.end.model.y}
                  stroke="transparent"
                  strokeWidth={14}
                  className={tool === "measure" ? "technical-hit-target technical-hit-target--interactive" : "technical-hit-target"}
                  onClick={(event) => {
                    if (tool !== "measure") return;
                    event.stopPropagation();
                    setMeasurements((current) => current.filter((entry) => entry.id !== measurement.id));
                    setHoveredMeasurementId((current) => (current === measurement.id ? null : current));
                  }}
                />
                <line
                  x1={measurement.start.model.x}
                  y1={measurement.start.model.y}
                  x2={measurement.end.model.x}
                  y2={measurement.end.model.y}
                  stroke={hoveredMeasurementId === measurement.id ? "#0f766e" : "#115e59"}
                  strokeWidth={hoveredMeasurementId === measurement.id ? 2.6 : 2}
                />
                <circle cx={measurement.start.model.x} cy={measurement.start.model.y} r={3.5} fill="#0f766e" />
                <circle cx={measurement.end.model.x} cy={measurement.end.model.y} r={3.5} fill="#0f766e" />
                <g
                  transform={`translate(${getMeasurementLabelPlacement({
                    start: measurement.start,
                    end: measurement.end,
                    viewBox: model.viewBox,
                  }).x} ${getMeasurementLabelPlacement({
                    start: measurement.start,
                    end: measurement.end,
                    viewBox: model.viewBox,
                  }).y})`}
                >
                  <rect x={-62} y={-18} width={124} height={28} rx={6} fill="#ffffff" stroke="#0f766e" strokeWidth={1} />
                  <text x={0} y={-2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f766e">
                    {`${measurement.distanceMm.toFixed(1)} mm`}
                  </text>
                  <text x={0} y={11} textAnchor="middle" fontSize={10} fontWeight={600} fill="#115e59">
                    {`${measurement.angleDeg.toFixed(1)}°`}
                  </text>
                </g>
                {tool === "measure" && hoveredMeasurementId === measurement.id ? (
                  <g
                    transform={`translate(${getMeasurementLabelPlacement({
                      start: measurement.start,
                      end: measurement.end,
                      viewBox: model.viewBox,
                    }).x + 52} ${getMeasurementLabelPlacement({
                      start: measurement.start,
                      end: measurement.end,
                      viewBox: model.viewBox,
                    }).y - 10})`} className="qs-migrated-218"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMeasurements((current) => current.filter((entry) => entry.id !== measurement.id));
                      setHoveredMeasurementId(null);
                    }}
                  >
                    <circle cx={0} cy={0} r={8} fill="#ffffff" stroke="#b91c1c" strokeWidth={1} />
                    <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#b91c1c">
                      ×
                    </text>
                  </g>
                ) : null}
              </g>
            ))}
          </svg>
          {measurementStart && activeMeasurementEnd ? (
            <svg
              viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`}
              width="100%"
              height="100%" className="qs-migrated-183"
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
              <g
                transform={`translate(${getMeasurementLabelPlacement({
                  start: measurementStart,
                  end: activeMeasurementEnd,
                  viewBox: model.viewBox,
                }).x} ${getMeasurementLabelPlacement({
                  start: measurementStart,
                  end: activeMeasurementEnd,
                  viewBox: model.viewBox,
                }).y})`}
              >
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

export default forwardRef<DrawingViewportHandle, DrawingViewportProps>(DrawingViewport);
