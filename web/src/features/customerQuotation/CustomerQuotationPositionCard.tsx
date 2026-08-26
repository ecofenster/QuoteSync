import type { ComponentType } from "react";
import type { Position } from "../../models/types";
import { resolveManufacturerVisualAssetUrl } from "../manufacturerVisuals/manufacturerVisualAssetUrl";
import {
  resolveCustomerQuotationTechnicalLayout,
  type CustomerQuotationDisplayOptions,
  type CustomerQuotationPositionThermal,
} from "./customerQuotationDisplay";
import type { CustomerQuotationPosition } from "./customerQuotationProjection";

const money = (value: string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(Number(value));
const assetUrl = resolveManufacturerVisualAssetUrl;
const thermalRows = (
  thermal: CustomerQuotationPositionThermal,
  mode: CustomerQuotationDisplayOptions["thermalPerformance"],
) => {
  const rows: Array<[string, string, string]> = [];
  if (mode === "full") {
    if (thermal.ufLeft) rows.push(["Frame Uf — Left", thermal.ufLeft, "W/m²K"]);
    if (thermal.ufTop) rows.push(["Frame Uf — Top", thermal.ufTop, "W/m²K"]);
    if (thermal.ufRight)
      rows.push(["Frame Uf — Right", thermal.ufRight, "W/m²K"]);
    if (thermal.ufBottom)
      rows.push(["Frame Uf — Bottom", thermal.ufBottom, "W/m²K"]);
  }
  if (thermal.ug) rows.push(["Manufacturer quoted Ug", thermal.ug, "W/m²K"]);
  if (mode === "full" && thermal.spacerPsi)
    rows.push(["Spacer Ψ (Psi)", thermal.spacerPsi, "W/mK"]);
  if (thermal.manufacturerQuotedUw)
    rows.push([
      "Manufacturer quoted Uw",
      thermal.manufacturerQuotedUw,
      "W/m²K",
    ]);
  if (mode === "full" && thermal.calculatedUw)
    rows.push(["QuoteSuite-calculated Uw", thermal.calculatedUw, "W/m²K"]);
  return rows;
};

export default function CustomerQuotationPositionCard({
  position,
  options,
  wide,
  PositionPreview,
}: {
  position: CustomerQuotationPosition;
  options: CustomerQuotationDisplayOptions;
  wide: boolean;
  PositionPreview?: ComponentType<{ position: Position }>;
}) {
  const technical = resolveCustomerQuotationTechnicalLayout(options, {
    thermal: position.thermal,
    sectionDetailIds: position.sectionDetailIds,
  });
  const area = ((position.widthMm * position.heightMm) / 1_000_000).toFixed(2);
  return (
    <section
      className={`customer-quotation-position${wide ? " customer-quotation-position--wide" : ""}${position.classification === "alternative" ? " customer-quotation-position--alternative" : ""}`}
      data-position-reference={position.customerReference}
      data-position-classification={position.classification}
    >
      <header className="customer-quotation-position__bar">
        <b>{position.sequence}</b>
        <strong>{position.customerReference}</strong>
        <span>{position.roomName || "Location not supplied"}</span>
        <span>{position.classification === "alternative" ? `Alternative to ${position.alternativeToReference || "included position"}` : position.productSystem || position.description}</span>
        <span>
          Quantity: <b>{position.quantity}</b>
        </span>
        <span>
          Total: <b>{money(position.totalSellingPriceGbp)}</b>
        </span>
      </header>
      <div className="customer-quotation-position__body">
        <div className="customer-quotation-position__drawing">
          <h3>
            {position.drawing.source === "manufacturer"
              ? position.drawing.orientation === "inside"
                ? "Inside view"
                : position.drawing.orientation === "outside"
                  ? "Outside view"
                  : "Manufacturer elevation"
              : "Inside / Outside views"}
          </h3>
          <div className="customer-quotation-position__drawing-stage">
            {position.drawing.source === "manufacturer" ? (
              <img
                src={assetUrl(position.drawing.imageUrl)}
                alt={`${position.drawing.orientation === "unknown" ? "Manufacturer elevation" : `${position.drawing.orientation} view`} for ${position.customerReference}`}
              />
            ) : position.hasConfiguredDrawing &&
              position.estimatePosition &&
              PositionPreview ? (
              <PositionPreview position={position.estimatePosition} />
            ) : (
              <div className="customer-quotation-position__unavailable">
                Drawing unavailable
              </div>
            )}
          </div>
          {position.drawing.source === "manufacturer" ? (
            <small>
              {position.drawing.orientation === "inside"
                ? "Reviewed manufacturer evidence · View from inside"
                : position.drawing.orientation === "outside"
                  ? "Reviewed manufacturer evidence · View from outside"
                  : "Reviewed manufacturer elevation · Orientation not supplied"}
            </small>
          ) : null}
        </div>
        <div className="customer-quotation-position__specification">
          <h3>Specification</h3>
          <dl>
            <div>
              <dt>Product / system</dt>
              <dd>{position.productSystem || position.description}</dd>
            </div>
            {position.configurationDescription ? (
              <div>
                <dt>Configuration</dt>
                <dd>{position.configurationDescription}</dd>
              </div>
            ) : null}
            {position.specification.map((item) => (
              <div key={`${item.label}-${item.value}`}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="customer-quotation-position__facts">
          <section>
            <h3>Price</h3>
            {position.classification === "alternative" ? <p className="customer-quotation-position__alternative-note">Alternative option — not included in quotation total</p> : null}
            <dl>
              <div>
                <dt>Unit price</dt>
                <dd>{money(position.unitSellingPriceGbp)}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{position.quantity}</dd>
              </div>
              <div className="is-total">
                <dt>Total</dt>
                <dd>{money(position.totalSellingPriceGbp)}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Dimensions</h3>
            <dl>
              <div>
                <dt>Width</dt>
                <dd>{position.widthMm} mm</dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>{position.heightMm} mm</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{area} m²</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
      {technical.layout !== "hidden" ? (
        <div
          className={`customer-quotation-position__technical customer-quotation-position__technical--${technical.layout}`}
        >
          {technical.showThermal && position.thermal ? (
            <section>
              <h3>Thermal Performance</h3>
              <table>
                <tbody>
                  {thermalRows(position.thermal, technical.thermalMode).map(
                    ([label, value, unit]) => (
                      <tr key={label}>
                        <th>{label}</th>
                        <td>{value}</td>
                        <td>{unit}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <small>
                Manufacturer values are quoted source evidence, not QuoteSuite
                calculations.
              </small>
            </section>
          ) : null}
          {technical.showSections ? (
            <section>
              <h3>Section Details</h3>
              <p>{position.sectionDetailIds.join(", ")}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
