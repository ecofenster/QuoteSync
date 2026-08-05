# Supplier Quote Import Roadmap

## Completed work

| Stage | Outcome | Commit |
|---|---|---|
| 1A | Read-only architecture and integration audit | No dedicated commit |
| 1B | Supplier quote and calculator domain contracts and invariants | `29bc9ba45f61f1bf8d39db9c242109c6846fa066` |
| 1C | Estimate-owned supplier persistence and managed attachment foundation | `03aaf615209578e27adc077c540ef010444115eb` |
| Tooling | External E2E Chrome profiles and cleanup | `0b44557dd8d1a615aad75e3652b727cf7ea57cb1` |
| 1D/1D.1 | Secure upload plus standalone Admin Import Lab | `2c28b392d9e03b998e66a51af4873d1e46b26144` |
| 1E | PDF/DOCX commercial-field extraction | `76b09d1cd2c8f3601ead7267d4b581369aa1729b` |
| 1G | Bulk commercial review workflow | `158e2b7c6980f537cef8bdac21d217ec593b2421` |
| 1F | Zyle quotation summary and additional-cost extraction | `57fba5b29245c975a45961307452cf1e007b893f` |

## Current architecture

The Beta tool is available at **Administration → Feature Controls → Supplier Quote Import (Beta)**. Its standalone Import Lab sessions require no client or estimate and remain separate from the production estimate-owned supplier aggregate.

An Import Lab session owns uploaded PDF/DOCX evidence, append-only extraction runs, extracted commercial position rows, a run-specific supplier quotation summary, additional supplier-cost lines, corrections, selection state, source traceability, and immutable original snapshots.

Current position extraction covers reference, width, height, quantity, unit price, total price, currency, warnings, and source trace. Summary extraction covers total quantity, total area, product subtotal, supplier additional costs, original supplier delivery, VAT when supplied, final supplier total, average U-value, weight, closing notes, and exact reconciliation evidence.

## Invariants

- Grouped references such as `W7, W8` remain one commercial row with quantity `2`. Reference-token count never derives or validates quantity and never creates extra positions.
- Original supplier files, references, descriptions, quantities, prices, totals, delivery, notes, hashes, traces, and extraction snapshots are immutable supplier evidence.
- Corrections and future-use selections are separate review state. Selection is not approval, promotion, estimate inclusion, calculator inclusion, or customer presentation.
- Supplier delivery and other costs are never redistributed or rewritten by the importer.

## Deferred work

OCR, drawing/image recognition, product and opening-direction recognition, numbered specifications, configurator/B92 mapping, `ConfiguredPositionContract`, canonical estimate positions, estimate promotion, customer documents, and Project Calculator integration remain deferred.

## Next planned stage

**Project Calculator — Stage 2A: Estimate-Independent Commercial Cost Allocation Lab**

This may explore allocation and presentation scenarios while preserving all original supplier evidence. It must not silently change the Import Lab or production estimate-owned domains.

See the [execution rules](CODEX_EXECUTION_RULES.md) before starting a new stage.
