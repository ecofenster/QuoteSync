import { useEffect, useMemo, useState } from "react";
import "./GlassWeightCalculatorTool.css";

type GlazingType = "single" | "double" | "triple" | "quad";
type ShapeType = "rectangle" | "circle" | "triangle" | "trapezoid" | "angled" | "gable" | "hip";
type PaneType = "float" | "toughened" | "laminated";

type PaneState = {
  type: PaneType;
  size: string;
};

type PositionRow = {
  index: number;
  shape: string;
  dimText: string;
  glazing: string;
  build: string;
  area: number;
  totalWeight: number;
  avgPaneWeight: number;
};

const laminatedEffective: Record<string, number> = {
  "22.1": 4.38,
  "33.1": 6.38,
  "33.2": 6.76,
  "44.1": 8.38,
  "44.2": 8.76,
  "55.2": 10.76,
  "66.2": 12.76,
  "88.2": 16.76,
  "1010.2": 20.76,
  "1212.8": 27.04,
  "1313.5": 27.9,
};

const standardThicknessOptions = [4, 5, 6, 8, 10, 12, 15, 19];
const laminatedOptions = [
  "22.1",
  "33.1",
  "33.2",
  "44.1",
  "44.2",
  "55.2",
  "66.2",
  "88.2",
  "1010.2",
  "1212.8",
  "1313.5",
];

function makeDefaultPane(): PaneState {
  return { type: "float", size: "4" };
}

function getPaneCount(glazing: GlazingType): number {
  if (glazing === "single") return 1;
  if (glazing === "double") return 2;
  if (glazing === "triple") return 3;
  return 4;
}

function glazingLabel(glazing: GlazingType): string {
  if (glazing === "single") return "Single glazed";
  if (glazing === "double") return "Double glazed IGU";
  if (glazing === "triple") return "Triple glazed IGU";
  return "Quadruple glazed IGU";
}

function glazingShortLabel(glazing: GlazingType): string {
  if (glazing === "single") return "Single";
  if (glazing === "double") return "Double IGU";
  if (glazing === "triple") return "Triple IGU";
  return "Quad IGU";
}

function getPaneConfigs(panes: PaneState[]) {
  return panes.map((pane) => {
    if (pane.type === "laminated") {
      const effThickness = laminatedEffective[pane.size] || 0;
      return {
        effThickness,
        label: "Laminated " + pane.size + " (~" + effThickness.toFixed(2) + " mm)",
      };
    }

    const effThickness = parseFloat(pane.size) || 0;
    return {
      effThickness,
      label:
        (pane.type === "toughened" ? "Toughened " : "Float ") +
        effThickness.toFixed(1) +
        " mm",
    };
  });
}

function ShapeIcon({ shape }: { shape: ShapeType }) {
  const common = { fill: "#e3f2fd", stroke: "#555", strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 40 40" style={{ width: 80, height: 80, display: "block" }}>
      {shape === "rectangle" && <rect x="6" y="9" width="28" height="22" {...common} />}
      {shape === "circle" && <circle cx="20" cy="20" r="12" {...common} />}
      {shape === "triangle" && <polygon points="7,29 33,29 20,9" {...common} />}
      {shape === "trapezoid" && <polygon points="9,29 31,29 27,11 13,11" {...common} />}
      {shape === "angled" && <polygon points="9,29 31,29 31,15 17,9 9,9" {...common} />}
      {shape === "gable" && <polygon points="8,29 8,17 20,9 32,17 32,29" {...common} />}
      {shape === "hip" && <polygon points="10,29 10,17 16,12 24,12 30,17 30,29" {...common} />}
    </svg>
  );
}

function IGUDiagram({ glazing }: { glazing: GlazingType }) {
  return (
    <svg viewBox="0 0 420 260" style={{ width: "100%", maxWidth: 420, height: "auto" }}>
      <defs>
        <linearGradient id="gFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7eef9" />
          <stop offset="100%" stopColor="#b8e0f2" />
        </linearGradient>
        <linearGradient id="gBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe5f0" />
          <stop offset="100%" stopColor="#a8cfdc" />
        </linearGradient>
      </defs>

      {glazing === "single" && (
        <polygon
          points="70,210 120,70 260,70 210,210"
          fill="url(#gFront)"
          fillOpacity="0.55"
          stroke="#6ba7c9"
          strokeWidth="2"
        />
      )}

      {glazing === "double" && (
        <>
          <polygon
            points="60,215 110,75 250,75 200,215"
            fill="url(#gBack)"
            fillOpacity="0.45"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="80,210 130,70 270,70 220,210"
            fill="url(#gFront)"
            fillOpacity="0.60"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
        </>
      )}

      {glazing === "triple" && (
        <>
          <polygon
            points="55,220 105,80 245,80 195,220"
            fill="url(#gBack)"
            fillOpacity="0.40"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="70,215 120,75 260,75 210,215"
            fill="url(#gBack)"
            fillOpacity="0.50"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="90,210 140,70 280,70 230,210"
            fill="url(#gFront)"
            fillOpacity="0.65"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
        </>
      )}

      {glazing === "quad" && (
        <>
          <polygon
            points="45,225 95,85 235,85 185,225"
            fill="url(#gBack)"
            fillOpacity="0.35"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="60,220 110,80 250,80 200,220"
            fill="url(#gBack)"
            fillOpacity="0.45"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="75,215 125,75 265,75 215,215"
            fill="url(#gBack)"
            fillOpacity="0.55"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
          <polygon
            points="95,210 145,70 285,70 235,210"
            fill="url(#gFront)"
            fillOpacity="0.70"
            stroke="#6ba7c9"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export default function GlassWeightCalculatorTool() {
  const [glazingType, setGlazingType] = useState<GlazingType>("single");
  const [currentShape, setCurrentShape] = useState<ShapeType>("rectangle");
  const [panes, setPanes] = useState<PaneState[]>([makeDefaultPane()]);
  const [positions, setPositions] = useState<PositionRow[]>([]);

  const [rectWidth, setRectWidth] = useState("");
  const [rectHeight, setRectHeight] = useState("");
  const [circleDia, setCircleDia] = useState("");
  const [triBase, setTriBase] = useState("");
  const [triHeight, setTriHeight] = useState("");
  const [trapTop, setTrapTop] = useState("");
  const [trapBottom, setTrapBottom] = useState("");
  const [trapHeight, setTrapHeight] = useState("");
  const [angTop, setAngTop] = useState("");
  const [angBottom, setAngBottom] = useState("");
  const [angHeight, setAngHeight] = useState("");
  const [angAngle, setAngAngle] = useState("");
  const [gableWidth, setGableWidth] = useState("");
  const [gableHeight, setGableHeight] = useState("");
  const [gableEaves, setGableEaves] = useState("");
  const [hipBottom, setHipBottom] = useState("");
  const [hipTop, setHipTop] = useState("");
  const [hipHeight, setHipHeight] = useState("");

  useEffect(() => {
    const count = getPaneCount(glazingType);
    setPanes((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(makeDefaultPane());
      while (next.length > count) next.pop();
      return next.map((p) =>
        p.type === "laminated" && !laminatedEffective[p.size]
          ? { type: "laminated", size: laminatedOptions[0] }
          : p.type !== "laminated" && !standardThicknessOptions.includes(Number(p.size))
          ? { type: p.type, size: String(standardThicknessOptions[0]) }
          : p
      );
    });
  }, [glazingType]);

  function updatePane(index: number, patch: Partial<PaneState>) {
    setPanes((prev) => prev.map((pane, i) => (i === index ? { ...pane, ...patch } : pane)));
  }

  const paneConfigs = useMemo(() => getPaneConfigs(panes), [panes]);

  function calculateValues() {
    let area = 0;
    let dimText = "";

    if (currentShape === "rectangle") {
      const rw = Number(rectWidth || 0);
      const rh = Number(rectHeight || 0);
      area = (rw / 1000) * (rh / 1000);
      dimText = rw + " × " + rh + " mm";
    } else if (currentShape === "circle") {
      const cd = Number(circleDia || 0);
      area = Math.PI * Math.pow(cd / 2000, 2);
      dimText = "Ø " + cd + " mm";
    } else if (currentShape === "triangle") {
      const tb = Number(triBase || 0);
      const th = Number(triHeight || 0);
      area = 0.5 * (tb / 1000) * (th / 1000);
      dimText = tb + " × " + th + " mm (tri)";
    } else if (currentShape === "trapezoid") {
      const tt = Number(trapTop || 0);
      const bb = Number(trapBottom || 0);
      const ht = Number(trapHeight || 0);
      area = (((tt + bb) / 2) / 1000) * (ht / 1000);
      dimText = tt + "/" + bb + " × " + ht + " mm (trap)";
    } else if (currentShape === "angled") {
      const at = Number(angTop || 0);
      const ab = Number(angBottom || 0);
      const ah = Number(angHeight || 0);
      area = (((at + ab) / 2) / 1000) * (ah / 1000);
      dimText = at + "/" + ab + " × " + ah + " mm (angled)";
    } else if (currentShape === "gable") {
      const gw = Number(gableWidth || 0);
      const gh = Number(gableHeight || 0);
      const ge = Number(gableEaves || 0);
      const rectH = Math.min(gh, ge) / 1000;
      let triH = (gh - ge) / 1000;
      if (triH < 0) triH = 0;
      area = (gw / 1000) * rectH + 0.5 * (gw / 1000) * triH;
      dimText = gw + " × " + gh + " mm (gable; eaves " + ge + " mm)";
    } else if (currentShape === "hip") {
      const hb = Number(hipBottom || 0);
      const ht = Number(hipTop || 0);
      const hh = Number(hipHeight || 0);
      area = (((hb + ht) / 2) / 1000) * (hh / 1000);
      dimText = ht + "/" + hb + " × " + hh + " mm (hip)";
    }

    const totalThickness = paneConfigs.reduce((sum, pane) => sum + pane.effThickness, 0);
    const weightPerM2 = totalThickness * 2.5;
    const totalWeight = area * weightPerM2;
    const paneWeights = paneConfigs.map((pane) => area * pane.effThickness * 2.5);
    const avgPaneWeight = paneWeights.length
      ? paneWeights.reduce((a, b) => a + b, 0) / paneWeights.length
      : 0;

    return {
      area,
      dimText,
      weightPerM2,
      totalWeight,
      avgPaneWeight,
      buildLines: paneConfigs.map((pane, i) => "Pane " + (i + 1) + ": " + pane.label),
    };
  }

  const calculated = useMemo(
    () => calculateValues(),
    [
      currentShape,
      rectWidth,
      rectHeight,
      circleDia,
      triBase,
      triHeight,
      trapTop,
      trapBottom,
      trapHeight,
      angTop,
      angBottom,
      angHeight,
      angAngle,
      gableWidth,
      gableHeight,
      gableEaves,
      hipBottom,
      hipTop,
      hipHeight,
      paneConfigs,
    ]
  );

  function addToPositionsTable() {
    const shapeLabelMap: Record<ShapeType, string> = {
      rectangle: "Rectangle / square",
      circle: "Circle",
      triangle: "Triangle",
      trapezoid: "Trapezoid",
      angled: "Angled / raked",
      gable: "Gable",
      hip: "Hip",
    };

    setPositions((prev) => [
      ...prev,
      {
        index: prev.length + 1,
        shape: shapeLabelMap[currentShape] || currentShape,
        dimText: calculated.dimText,
        glazing: glazingShortLabel(glazingType),
        build: calculated.buildLines.join(" | "),
        area: calculated.area,
        totalWeight: calculated.totalWeight,
        avgPaneWeight: calculated.avgPaneWeight,
      },
    ]);
  }

  function exportCSV() {
    if (!positions.length) {
      window.alert("No positions to export.");
      return;
    }

    const headers = [
      "Position",
      "Shape",
      "Dimensions",
      "Glazing",
      "Build",
      "Area_m2",
      "Unit_weight_kg",
      "Avg_pane_weight_kg",
    ];

    const csv =
      headers.join(",") +
      "\n" +
      positions
        .map((p) =>
          [
            p.index,
            p.shape,
            p.dimText,
            p.glazing,
            p.build.replace(/\|/g, " / "),
            p.area.toFixed(3),
            p.totalWeight.toFixed(1),
            p.avgPaneWeight.toFixed(1),
          ]
            .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "glass-weight-positions.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!positions.length) {
      window.alert("No positions to export.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Glass Weight Positions</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;padding:16px;}
            table{border-collapse:collapse;width:100%;font-size:12px;}
            th,td{border:1px solid #999;padding:4px 6px;text-align:left;}
            th{background:#f0f0f0;}
          </style>
        </head>
        <body>
          <h2>Glass Weight Positions</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Shape</th>
                <th>Dimensions</th>
                <th>Glazing</th>
                <th>Build</th>
                <th>Area (m²)</th>
                <th>Unit weight (kg)</th>
                <th>Avg pane weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              ${positions
                .map(
                  (p) => `
                <tr>
                  <td>${p.index}</td>
                  <td>${p.shape}</td>
                  <td>${p.dimText}</td>
                  <td>${p.glazing}</td>
                  <td>${p.build}</td>
                  <td>${p.area.toFixed(3)}</td>
                  <td>${p.totalWeight.toFixed(1)}</td>
                  <td>${p.avgPaneWeight.toFixed(1)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="glass-tool">
      <div className="glass-layout">
        <div className="glass-card ui-card">
          <h2 className="glass-card-title">Glass position</h2>

          <label className="glass-label">Glazing type</label>
          <select
            value={glazingType}
            onChange={(e) => setGlazingType(e.target.value as GlazingType)}
            className="glass-input ui-input"
          >
            <option value="single">Single glazed</option>
            <option value="double">Double glazed (IGU)</option>
            <option value="triple">Triple glazed (IGU)</option>
            <option value="quad">Quadruple glazed (IGU)</option>
          </select>

          <div className="glass-pane-list">
            {panes.map((pane, index) => (
              <div
                key={index}
                className="glass-pane-card"
              >
                <div className="glass-pane-title">Pane {index + 1}</div>
                <div className="glass-pane-controls">
                  <select
                    value={pane.type}
                    onChange={(e) => {
                      const nextType = e.target.value as PaneType;
                      updatePane(index, {
                        type: nextType,
                        size: nextType === "laminated" ? laminatedOptions[0] : String(standardThicknessOptions[0]),
                      });
                    }}
                    className="glass-input glass-input--pane ui-input"
                  >
                    <option value="float">Standard (float)</option>
                    <option value="toughened">Toughened</option>
                    <option value="laminated">Laminated</option>
                  </select>

                  <select
                    value={pane.size}
                    onChange={(e) => updatePane(index, { size: e.target.value })}
                    className="glass-input glass-input--pane ui-input"
                  >
                    {pane.type === "laminated"
                      ? laminatedOptions.map((code) => (
                          <option key={code} value={code}>
                            {code} ({laminatedEffective[code].toFixed(2)} mm)
                          </option>
                        ))
                      : standardThicknessOptions.map((mm) => (
                          <option key={mm} value={String(mm)}>
                            {mm} mm
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-content-grid">
          <div className="glass-card ui-card">
            <h2 className="glass-card-title">Position summary</h2>
            <div>Glass area: {calculated.area ? calculated.area.toFixed(3) + " m²" : "–"}</div>
            <div>Weight per m² (unit): {calculated.weightPerM2.toFixed(1)} kg/m²</div>
            <div>Total unit weight: {calculated.totalWeight.toFixed(1)} kg</div>
            <div>
              Approx. weight per pane:{" "}
              {calculated.avgPaneWeight ? calculated.avgPaneWeight.toFixed(1) + " kg" : "–"}
            </div>
            <div className="glass-summary-build">
              <strong>{glazingLabel(glazingType)}</strong>
              <br />
              {calculated.buildLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>

          <div className="glass-card ui-card">
            <h2 className="glass-card-title">Insulated glazing unit</h2>
            <IGUDiagram glazing={glazingType} />
            <div className="glass-summary-build">
              {glazingLabel(glazingType)}: {calculated.buildLines.join(" | ")}
            </div>
          </div>

          <div className="glass-card ui-card">
            <h2 className="glass-card-title">Shape</h2>
            <div className="glass-shape-list">
              {[
                ["rectangle", "Rectangle / square"],
                ["circle", "Circle"],
                ["triangle", "Triangle"],
                ["trapezoid", "Trapezoid"],
                ["angled", "Angled / raked"],
                ["gable", "Gable"],
                ["hip", "Hip"],
              ].map(([shape, label]) => {
                const selected = currentShape === shape;
                return (
                  <div
                    key={shape}
                    onClick={() => setCurrentShape(shape as ShapeType)}
                    className={`glass-shape-option${selected ? " glass-shape-option--selected" : ""}`}
                    title={label}
                  >
                    <ShapeIcon shape={shape as ShapeType} />
                    <div className="glass-shape-option__label">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card ui-card">
            <h2 className="glass-card-title">Dimensions & actions</h2>

            {currentShape === "rectangle" && (
              <>
                <label className="glass-label">Width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={rectWidth} onChange={(e) => setRectWidth(e.target.value)} />
                <label className="glass-label">Height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={rectHeight} onChange={(e) => setRectHeight(e.target.value)} />
              </>
            )}

            {currentShape === "circle" && (
              <>
                <label className="glass-label">Diameter (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={circleDia} onChange={(e) => setCircleDia(e.target.value)} />
              </>
            )}

            {currentShape === "triangle" && (
              <>
                <label className="glass-label">Base (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={triBase} onChange={(e) => setTriBase(e.target.value)} />
                <label className="glass-label">Height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={triHeight} onChange={(e) => setTriHeight(e.target.value)} />
              </>
            )}

            {currentShape === "trapezoid" && (
              <>
                <label className="glass-label">Top width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={trapTop} onChange={(e) => setTrapTop(e.target.value)} />
                <label className="glass-label">Bottom width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={trapBottom} onChange={(e) => setTrapBottom(e.target.value)} />
                <label className="glass-label">Height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={trapHeight} onChange={(e) => setTrapHeight(e.target.value)} />
              </>
            )}

            {currentShape === "angled" && (
              <>
                <label className="glass-label">Top width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={angTop} onChange={(e) => setAngTop(e.target.value)} />
                <label className="glass-label">Bottom width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={angBottom} onChange={(e) => setAngBottom(e.target.value)} />
                <label className="glass-label">Height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={angHeight} onChange={(e) => setAngHeight(e.target.value)} />
                <label className="glass-label">Angle (°)</label>
                <input className="glass-input ui-input" type="number" value={angAngle} onChange={(e) => setAngAngle(e.target.value)} />
              </>
            )}

            {currentShape === "gable" && (
              <>
                <label className="glass-label">Width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={gableWidth} onChange={(e) => setGableWidth(e.target.value)} />
                <label className="glass-label">Overall height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={gableHeight} onChange={(e) => setGableHeight(e.target.value)} />
                <label className="glass-label">Eaves height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={gableEaves} onChange={(e) => setGableEaves(e.target.value)} />
              </>
            )}

            {currentShape === "hip" && (
              <>
                <label className="glass-label">Bottom width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={hipBottom} onChange={(e) => setHipBottom(e.target.value)} />
                <label className="glass-label">Top width (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={hipTop} onChange={(e) => setHipTop(e.target.value)} />
                <label className="glass-label">Height (mm)</label>
                <input className="glass-input ui-input" type="number" min="0" value={hipHeight} onChange={(e) => setHipHeight(e.target.value)} />
              </>
            )}

            <div className="glass-actions">
              <button className="glass-button ui-button" onClick={() => void 0}>Calculate weight</button>
              <button className="glass-button ui-button" onClick={addToPositionsTable}>Add to positions table</button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card ui-card">
        <h2 className="glass-card-title">Positions table</h2>
        <div className="glass-table-scroll">
          <table id="positionsTable" className="glass-table">
            <thead>
              <tr>
                {[
                  "Position",
                  "Shape",
                  "Dimensions",
                  "Glazing",
                  "Build",
                  "Area (m²)",
                  "Unit weight (kg)",
                  "Avg pane weight (kg)",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="glass-table__head"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.index}>
                  <td className="glass-table__cell">{pos.index}</td>
                  <td className="glass-table__cell">{pos.shape}</td>
                  <td className="glass-table__cell">{pos.dimText}</td>
                  <td className="glass-table__cell">{pos.glazing}</td>
                  <td className="glass-table__cell">{pos.build}</td>
                  <td className="glass-table__cell">{pos.area.toFixed(3)}</td>
                  <td className="glass-table__cell">{pos.totalWeight.toFixed(1)}</td>
                  <td className="glass-table__cell">{pos.avgPaneWeight.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-actions">
          <button className="glass-button ui-button" onClick={exportCSV}>Export to CSV</button>
          <button className="glass-button ui-button" onClick={exportPDF}>Export to PDF</button>
        </div>
      </div>
    </div>
  );
}


