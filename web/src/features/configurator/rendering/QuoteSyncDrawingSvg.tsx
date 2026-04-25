import React from "react";
import type { DrawingHandle, DrawingMarker, DrawingModel, DrawingShape } from "./drawingModel";

function renderShape(shape: DrawingShape, key: string) {
  if (shape.kind === "line") {
    return (
      <line
        key={key}
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        stroke={shape.stroke || "#111"}
        strokeWidth={shape.strokeWidth ?? 1}
        strokeDasharray={shape.dashed ? "6 6" : undefined}
      />
    );
  }
  if (shape.kind === "rect") {
    return (
      <rect
        key={key}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        stroke={shape.stroke || "#111"}
        strokeWidth={shape.strokeWidth ?? 1}
        fill={shape.fill ?? "none"}
      />
    );
  }
  return (
    <polygon
      key={key}
      points={shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
      stroke={shape.stroke || "#111"}
      strokeWidth={shape.strokeWidth ?? 1}
      strokeLinejoin="bevel"
      strokeMiterlimit={1}
      fill={shape.fill ?? "none"}
    />
  );
}

function renderMarker(marker: DrawingMarker, key: string) {
  return (
    <g key={key}>
      <circle cx={marker.x} cy={marker.y} r={marker.radius} fill="#fff" stroke="#111" strokeWidth={1} />
      <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize={14} fontWeight={600} fill="#111">
        {marker.value}
      </text>
    </g>
  );
}

function renderHandle(handle: DrawingHandle, key: string) {
  const size = handle.size;
  return <line key={key} x1={handle.x} y1={handle.y - size} x2={handle.x} y2={handle.y + size} stroke="#111" strokeWidth={1.6} strokeLinecap="round" />;
}

type Props = {
  model: DrawingModel;
  selectedCellKey?: string;
  onSelectCell?: (cell: { col: number; row: number }) => void;
  onRemoveVerticalJunction?: (index: number) => void;
  onRemoveHorizontalJunction?: (index: number) => void;
};

export default function QuoteSyncDrawingSvg(props: Props) {
  const { model, selectedCellKey, onSelectCell, onRemoveVerticalJunction, onRemoveHorizontalJunction } = props;

  return (
    <svg viewBox={`0 0 ${model.viewBox.width} ${model.viewBox.height}`} width="100%" height="100%" style={{ display: "block" }}>
      <rect x={0} y={0} width={model.viewBox.width} height={model.viewBox.height} fill="#ffffff" />

      {model.elements.flatMap((element) => element.shapes.map((shape, index) => renderShape(shape, `${element.id}-${index}`)))}

      {model.annotations.dimensions.map((dimension, index) => (
        <g key={`dimension-${index}`} fill="none" fontFamily="ui-sans-serif, system-ui, -apple-system">
          {renderShape(dimension.line, `dimension-line-${index}`)}
          {renderShape(dimension.tickA, `dimension-tick-a-${index}`)}
          {renderShape(dimension.tickB, `dimension-tick-b-${index}`)}
          <text
            x={dimension.text.x}
            y={dimension.text.y}
            textAnchor={dimension.text.anchor || "middle"}
            fontSize={dimension.text.fontSize ?? 12}
            fill={dimension.text.fill || "#111"}
            transform={dimension.text.rotate ? `rotate(${dimension.text.rotate} ${dimension.text.x} ${dimension.text.y})` : undefined}
          >
            {dimension.text.value}
          </text>
        </g>
      ))}

      {model.annotations.labels.map((label, index) => (
        <text key={`label-${index}`} x={label.x} y={label.y} textAnchor={label.anchor || "start"} fontSize={label.fontSize ?? 10} fontWeight={label.fontWeight ?? 500} fill={label.fill || "#71717a"}>
          {label.value}
        </text>
      ))}

      {model.annotations.handles.map((handle, index) => renderHandle(handle, `handle-${index}`))}
      {model.annotations.markers.map((marker, index) => renderMarker(marker, `marker-${index}`))}

      {model.interaction.verticalJunctions.map((junction) => (
        <line
          key={`interactive-v-${junction.index}`}
          x1={junction.x}
          y1={junction.y1}
          x2={junction.x}
          y2={junction.y2}
          stroke="transparent"
          strokeWidth={16}
          style={{ cursor: onRemoveVerticalJunction ? "pointer" : "default" }}
          onClick={() => onRemoveVerticalJunction?.(junction.index)}
        />
      ))}

      {model.interaction.horizontalJunctions.map((junction) => (
        <line
          key={`interactive-h-${junction.index}`}
          x1={junction.x1}
          y1={junction.y}
          x2={junction.x2}
          y2={junction.y}
          stroke="transparent"
          strokeWidth={16}
          style={{ cursor: onRemoveHorizontalJunction ? "pointer" : "default" }}
          onClick={() => onRemoveHorizontalJunction?.(junction.index)}
        />
      ))}

      {model.interaction.cells.map((cell) => {
        const [col, row] = cell.key.split(",").map((value) => Number(value));
        const isSelected = selectedCellKey === cell.key;
        return (
          <g key={`cell-hit-${cell.key}`}>
            <rect
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill="transparent"
              style={{ cursor: onSelectCell ? "pointer" : "default" }}
              onClick={() => onSelectCell?.({ col, row })}
            />
            {isSelected ? (
              <rect
                x={cell.x + 2}
                y={cell.y + 2}
                width={Math.max(0, cell.width - 4)}
                height={Math.max(0, cell.height - 4)}
                fill="none"
                stroke="#2563eb"
                strokeOpacity={0.8}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                rx={4}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
