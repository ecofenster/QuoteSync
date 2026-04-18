import React, { useMemo } from "react";
import { getConfiguratorAssetMeta } from "../configuratorAssetRegistry";

type Props = {
  assetKey: string;
  widthMm: number;
  heightMm: number;
};

function toSafeDimension(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 300 ? next : fallback;
}

export default function WindowRenderer(props: Props) {
  const { assetKey, widthMm, heightMm } = props;
  const asset = getConfiguratorAssetMeta(assetKey);
  const src = asset.src;
  const alt = asset.alt;

  const safeWidth = toSafeDimension(widthMm, 1000);
  const safeHeight = toSafeDimension(heightMm, 1200);

  const drawing = useMemo(() => {
    const viewW = 900;
    const viewH = 560;
    const leftPad = 78;
    const rightPad = 104;
    const topPad = 44;
    const bottomPad = 96;
    const availW = viewW - leftPad - rightPad;
    const availH = viewH - topPad - bottomPad;

    const ratio = Math.max(0.1, safeWidth / Math.max(1, safeHeight));

    let drawW = availW;
    let drawH = drawW / ratio;

    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * ratio;
    }

    drawW = Math.max(24, drawW * 0.88);
    drawH = Math.max(24, drawH * 0.88);

    const x = leftPad + (availW - drawW) / 2;
    const y = topPad + (availH - drawH) / 2;

    return { viewW, viewH, x, y, drawW, drawH };
  }, [safeWidth, safeHeight]);

  const dimStroke = 1.2;
  const dimOffset = 28;
  const tickHalf = 8;

  return (
    <svg
      viewBox={`0 0 ${drawing.viewW} ${drawing.viewH}`}
      width="100%"
      height="100%"
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-label={alt}
      role="img"
    >
      <image
        href={src}
        x={drawing.x}
        y={drawing.y}
        width={drawing.drawW}
        height={drawing.drawH}
        preserveAspectRatio="xMidYMid meet"
      />

      <g stroke="#18181b" strokeWidth={dimStroke} fill="none">
        <line
          x1={drawing.x}
          y1={drawing.y + drawing.drawH + dimOffset}
          x2={drawing.x + drawing.drawW}
          y2={drawing.y + drawing.drawH + dimOffset}
        />
        <line
          x1={drawing.x}
          y1={drawing.y + drawing.drawH + dimOffset - tickHalf}
          x2={drawing.x}
          y2={drawing.y + drawing.drawH + dimOffset + tickHalf}
        />
        <line
          x1={drawing.x + drawing.drawW}
          y1={drawing.y + drawing.drawH + dimOffset - tickHalf}
          x2={drawing.x + drawing.drawW}
          y2={drawing.y + drawing.drawH + dimOffset + tickHalf}
        />

        <line
          x1={drawing.x + drawing.drawW + dimOffset}
          y1={drawing.y}
          x2={drawing.x + drawing.drawW + dimOffset}
          y2={drawing.y + drawing.drawH}
        />
        <line
          x1={drawing.x + drawing.drawW + dimOffset - tickHalf}
          y1={drawing.y}
          x2={drawing.x + drawing.drawW + dimOffset + tickHalf}
          y2={drawing.y}
        />
        <line
          x1={drawing.x + drawing.drawW + dimOffset - tickHalf}
          y1={drawing.y + drawing.drawH}
          x2={drawing.x + drawing.drawW + dimOffset + tickHalf}
          y2={drawing.y + drawing.drawH}
        />
      </g>

      <text
        x={drawing.x + drawing.drawW / 2}
        y={drawing.y + drawing.drawH + dimOffset + 24}
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#18181b"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        {Math.round(safeWidth)}
      </text>

      <text
        x={drawing.x + drawing.drawW + dimOffset + 24}
        y={drawing.y + drawing.drawH / 2}
        transform={`rotate(90 ${drawing.x + drawing.drawW + dimOffset + 24} ${drawing.y + drawing.drawH / 2})`}
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#18181b"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        {Math.round(safeHeight)}
      </text>
    </svg>
  );
}