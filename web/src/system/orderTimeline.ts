import type { OrderTimeline } from "../models/types";

export function createDefaultTimeline(): OrderTimeline[] {
  return [
    { stage: "signoff_sent", completed: false },
    { stage: "signoff_received", completed: false },
    { stage: "factory_order", completed: false },
    { stage: "in_production", completed: false },
    { stage: "pre_dispatch_invoice", completed: false },
    { stage: "production_complete", completed: false },
    { stage: "factory_dispatch", completed: false },
    { stage: "delivery", completed: false },
    { stage: "installation", completed: false },
  ];
}