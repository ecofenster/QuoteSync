import React, { useMemo } from "react";
import type { Client, ClientId, Estimate, EstimateId, EstimateOutcome, MenuKey, OrderMeta } from "../../models/types";
import "./MainDashboard.css";

type DashboardFollowUp = {
  id: string;
  clientId?: string;
  clientName?: string;
  clientRef?: string;
  estimateId?: string;
  estimateRef?: string;
  dueDateISO?: string;
  dueAt?: string;
  title?: string;
  notes?: string;
  status?: string;
};

type Props = {
  clients: Client[];
  activeUserName?: string;
  onOpenMenu?: (menu: MenuKey) => void;
  onOpenEstimate?: (clientId: ClientId, estimateId: EstimateId) => void;
};

type PriorityTone = "sales" | "today" | "warning" | "invoice";
type KpiTone = "lead" | "quote" | "order" | "revenue";

type PriorityAction = {
  id: string;
  icon: React.ReactNode;
  value: string;
  label: string;
  text: string;
  tone: PriorityTone;
  menu?: MenuKey;
};

type KpiCard = {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  tone: KpiTone;
  unavailable?: boolean;
};

type ScheduleItem = {
  id: string;
  time: string;
  type: string;
  title: string;
  subtitle: string;
  person: string;
  menu?: MenuKey;
};

type ActivityItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  timestamp: string;
  menu?: MenuKey;
};

type PipelineStage = {
  label: string;
  value: number;
  tone: KpiTone;
  unavailable?: boolean;
};

type OrderRow = {
  client: Client;
  estimate: Estimate;
  outcome: EstimateOutcome;
  meta: Partial<OrderMeta>;
  needsAttention: boolean;
  value: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDate(raw?: string) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInRange(date: Date | null, start: Date, end: Date) {
  return !!date && date >= start && date <= end;
}

function formatTime(date: Date | null) {
  if (!date) return "Today";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatRelativeDate(date: Date | null) {
  if (!date) return "Date unavailable";
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function clientDisplayName(client: Client) {
  return client.type === "Business" ? client.businessName || client.clientName || "Client" : client.clientName || "Client";
}

function clientAddress(client: Client, estimate?: Estimate) {
  return (
    estimate?.location?.projectAddress ||
    estimate?.projectAddress ||
    client.projectAddress ||
    client.customerAddress ||
    client.postcode ||
    "Address not recorded"
  );
}

function estimateValue(estimate: Estimate) {
  return estimate.positions.reduce((sum, position) => sum + Number(position.itemPrice || 0) * Number(position.qty || 1), 0);
}

function loadEstimateOutcomesForClient(clientId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`qs_estimate_outcomes_v1_${clientId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function loadFollowUpsSafe(): DashboardFollowUp[] {
  try {
    const raw = localStorage.getItem("qs_followups_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DashboardFollowUp[]) : [];
  } catch {
    return [];
  }
}

function Icon(props: { name: "phone" | "calendar" | "warning" | "invoice" | "lead" | "quote" | "order" | "revenue" | "activity" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {props.name === "phone" ? (
        <path {...common} d="M6.5 4.5 9 7l-1.5 2c1.2 2.5 3 4.3 5.5 5.5L15 13l2.5 2.5-1.2 3c-.3.7-1 1-1.7.9C9 18.5 5.5 15 4.6 9.4c-.1-.7.2-1.4.9-1.7l1-3.2Z" />
      ) : props.name === "calendar" ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" {...common} />
          <path {...common} d="M8 3v4M16 3v4M4 10h16" />
        </>
      ) : props.name === "warning" ? (
        <>
          <path {...common} d="M12 4 21 20H3L12 4Z" />
          <path {...common} d="M12 9v5M12 17h.01" />
        </>
      ) : props.name === "invoice" ? (
        <>
          <path {...common} d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3Z" />
          <path {...common} d="M9 8h6M9 12h6M9 16h4" />
        </>
      ) : props.name === "lead" ? (
        <>
          <circle cx="12" cy="8" r="4" {...common} />
          <path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ) : props.name === "quote" ? (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" {...common} />
          <path {...common} d="M8 9h8M8 13h5" />
        </>
      ) : props.name === "order" ? (
        <>
          <path {...common} d="M6 7h12l-1 14H7L6 7Z" />
          <path {...common} d="M9 7a3 3 0 0 1 6 0M9.5 12l2 2 4-4" />
        </>
      ) : props.name === "revenue" ? (
        <>
          <path {...common} d="M12 3v18M17 7.5c0-1.7-1.7-3-4.2-3H10c-2 0-3.5 1.2-3.5 2.8 0 4.2 11 1.8 11 6.8 0 1.9-1.7 3.4-4.2 3.4H10c-2.4 0-4-1.4-4-3.2" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path {...common} d="M12 8v4l3 2" />
        </>
      )}
    </svg>
  );
}

function PriorityCard(props: { action: PriorityAction; onOpenMenu?: (menu: MenuKey) => void }) {
  const clickable = !!props.action.menu && !!props.onOpenMenu;
  return (
    <button
      type="button"
      className={`qs-priority-card qs-priority-card--${props.action.tone}`}
      onClick={clickable ? () => props.onOpenMenu?.(props.action.menu as MenuKey) : undefined}
      disabled={!clickable}
    >
      <span className="qs-priority-card__icon">{props.action.icon}</span>
      <span className="qs-priority-card__body">
        <span className="qs-priority-card__value">{props.action.value}</span>
        <span className="qs-priority-card__label">{props.action.label}</span>
        <span className="qs-priority-card__text">{props.action.text}</span>
      </span>
      <span className="qs-priority-card__chevron">›</span>
    </button>
  );
}

function KpiCardView(props: { card: KpiCard }) {
  return (
    <div className={`qs-kpi-card qs-kpi-card--${props.card.tone}${props.card.unavailable ? " qs-kpi-card--unavailable" : ""}`}>
      <div className="qs-kpi-card__top">
        <span className="qs-kpi-card__icon">{props.card.icon}</span>
        <span className="qs-kpi-card__trend">{props.card.trend}</span>
      </div>
      <div className="qs-kpi-card__label">{props.card.label}</div>
      <div className="qs-kpi-card__value">{props.card.value}</div>
      <svg className="qs-kpi-card__spark" viewBox="0 0 120 28" aria-hidden="true">
        <path d="M2 22 C20 16, 26 18, 38 10 S62 18, 76 8 S100 12, 118 5" />
      </svg>
    </div>
  );
}

export default function MainDashboard(props: Props) {
  const { clients, activeUserName = "User", onOpenMenu } = props;

  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const followUps = loadFollowUpsSafe();
    const orderRows: OrderRow[] = [];
    const openEstimateRows: Array<{ client: Client; estimate: Estimate; value: number }> = [];

    for (const client of clients) {
      const outcomes = loadEstimateOutcomesForClient(client.id);
      for (const estimate of client.estimates) {
        const outcome = (outcomes[estimate.id] ?? estimate.outcome ?? "Open") as EstimateOutcome;
        const value = estimateValue(estimate);
        if (outcome === "Open") openEstimateRows.push({ client, estimate, value });
        if (outcome !== "Order") continue;

        const meta = (estimate.orderMeta ?? {}) as Partial<OrderMeta>;
        const needsAttention =
          !meta.clientSignoffReceivedDate ||
          !meta.factoryOrderSignedOffDate ||
          !meta.productionStartDate ||
          !meta.deliveryDate ||
          !meta.installationDate;

        orderRows.push({
          client,
          estimate,
          outcome,
          meta,
          needsAttention,
          value,
        });
      }
    }

    const followUpsToday = followUps.filter((item) => isInRange(parseDate(item.dueAt || item.dueDateISO), todayStart, todayEnd));
    const followUpsThisWeek = followUps.filter((item) => {
      const date = parseDate(item.dueAt || item.dueDateISO);
      return !!date && date >= weekStart && date <= todayEnd;
    });
    const installationsToday = orderRows.filter((row) => isInRange(parseDate(row.meta.installationDate), todayStart, todayEnd));
    const invoicesToday = orderRows.filter((row) => isInRange(parseDate(row.meta.balanceInvoiceDueDate), todayStart, todayEnd));
    const overdueOrders = orderRows.filter((row) => row.needsAttention);
    const revenueMtd = orderRows
      .filter((row) => isInRange(parseDate(row.meta.clientSignoffReceivedDate || row.meta.factoryOrderSignedOffDate), monthStart, monthEnd))
      .reduce((sum, row) => sum + row.value, 0);
    const pipelineValue = [...openEstimateRows.map((row) => row.value), ...orderRows.map((row) => row.value)].reduce((sum, value) => sum + value, 0);

    const schedule: ScheduleItem[] = [
      ...installationsToday.map((row) => ({
        id: `install-${row.client.id}-${row.estimate.id}`,
        time: formatTime(parseDate(row.meta.installationDate)),
        type: "Install",
        title: row.estimate.estimateRef || "Installation",
        subtitle: clientAddress(row.client, row.estimate),
        person: row.meta.installerId || row.estimate.createdByName || "Unassigned",
        menu: "installation" as MenuKey,
      })),
      ...followUpsToday.map((item) => ({
        id: `follow-${item.id}`,
        time: formatTime(parseDate(item.dueAt || item.dueDateISO)),
        type: "Follow up",
        title: item.title || item.estimateRef || "Customer follow-up",
        subtitle: item.clientName || item.clientRef || "Client not linked",
        person: "Sales",
        menu: "follow_ups" as MenuKey,
      })),
      ...invoicesToday.map((row) => ({
        id: `invoice-${row.client.id}-${row.estimate.id}`,
        time: formatTime(parseDate(row.meta.balanceInvoiceDueDate)),
        type: "Invoice",
        title: row.estimate.estimateRef || "Balance invoice",
        subtitle: clientDisplayName(row.client),
        person: "Accounts",
        menu: "orders" as MenuKey,
      })),
    ].slice(0, 5);

    const datedActivities: Array<ActivityItem & { date: Date | null }> = [];
    for (const row of orderRows) {
      datedActivities.push({
        id: `activity-order-${row.client.id}-${row.estimate.id}`,
        icon: <Icon name="order" />,
        title: row.estimate.estimateRef ? `Order ${row.estimate.estimateRef}` : "Order updated",
        subtitle: clientDisplayName(row.client),
        timestamp: formatRelativeDate(parseDate(row.meta.factoryOrderSignedOffDate || row.meta.clientSignoffReceivedDate)),
        date: parseDate(row.meta.factoryOrderSignedOffDate || row.meta.clientSignoffReceivedDate),
        menu: "orders",
      });
    }
    for (const item of followUps.slice(0, 8)) {
      datedActivities.push({
        id: `activity-follow-${item.id}`,
        icon: <Icon name="phone" />,
        title: item.title || "Follow-up scheduled",
        subtitle: item.clientName || item.estimateRef || "Follow-up item",
        timestamp: formatRelativeDate(parseDate(item.dueAt || item.dueDateISO)),
        date: parseDate(item.dueAt || item.dueDateISO),
        menu: "follow_ups",
      });
    }

    const activities = datedActivities
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .slice(0, 5)
      .map(({ date: _date, ...activity }) => activity);

    return {
      followUpsToday: followUpsToday.length,
      followUpsThisWeek: followUpsThisWeek.length,
      installationsToday: installationsToday.length,
      invoicesToday: invoicesToday.length,
      ordersNeedingAttention: overdueOrders.length,
      openEstimates: openEstimateRows.length,
      ordersWon: orderRows.length,
      revenueMtd,
      pipelineValue,
      schedule,
      activities,
      pipeline: [
        { label: "New Leads", value: 0, tone: "lead" as KpiTone, unavailable: true },
        { label: "Quoted", value: openEstimateRows.length, tone: "quote" as KpiTone },
        { label: "In Negotiation", value: followUpsThisWeek.length, tone: "revenue" as KpiTone },
        { label: "Won", value: orderRows.length, tone: "order" as KpiTone },
      ],
    };
  }, [clients]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const priorityActions: PriorityAction[] = [
    {
      id: "follow-ups",
      icon: <Icon name="phone" />,
      value: String(dashboardData.followUpsToday),
      label: "Quotes to Follow Up",
      text: dashboardData.followUpsThisWeek ? `${dashboardData.followUpsThisWeek} due this week` : "No follow-ups due this week",
      tone: "sales",
      menu: "follow_ups",
    },
    {
      id: "installations",
      icon: <Icon name="calendar" />,
      value: String(dashboardData.installationsToday),
      label: "Installations Today",
      text: "Scheduled installation work",
      tone: "today",
      menu: "installation",
    },
    {
      id: "orders",
      icon: <Icon name="warning" />,
      value: String(dashboardData.ordersNeedingAttention),
      label: "Orders Needing Attention",
      text: "Missing sign-off, production or install dates",
      tone: "warning",
      menu: "orders",
    },
    {
      id: "invoices",
      icon: <Icon name="invoice" />,
      value: String(dashboardData.invoicesToday),
      label: "Invoices to Send",
      text: "Balance invoices due today",
      tone: "invoice",
      menu: "orders",
    },
  ];

  const kpis: KpiCard[] = [
    {
      id: "new-leads",
      icon: <Icon name="lead" />,
      label: "New Leads",
      value: "N/A",
      trend: "Lead source not wired",
      tone: "lead",
      unavailable: true,
    },
    {
      id: "quotes-sent",
      icon: <Icon name="quote" />,
      label: "Quotes Sent",
      value: String(dashboardData.openEstimates),
      trend: "Open quote pipeline",
      tone: "quote",
    },
    {
      id: "orders-won",
      icon: <Icon name="order" />,
      label: "Orders Won",
      value: String(dashboardData.ordersWon),
      trend: "Active order book",
      tone: "order",
    },
    {
      id: "revenue-mtd",
      icon: <Icon name="revenue" />,
      label: "Revenue MTD",
      value: formatCurrency(dashboardData.revenueMtd),
      trend: "From recorded order values",
      tone: "revenue",
    },
  ];

  const maxPipeline = Math.max(1, ...dashboardData.pipeline.map((stage) => stage.value));

  return (
    <div className="qs-dashboard">
      <section className="qs-dashboard-hero">
        <div className="qs-dashboard-hero__copy">
          <div className="qs-dashboard-eyebrow">Operational dashboard</div>
          <h1>{greeting}, {activeUserName}</h1>
          <p>Here&apos;s what needs your attention today.</p>
        </div>
        <div className="qs-dashboard-hero__actions">
          <label className="qs-dashboard-search">
            <span>Search</span>
            <input placeholder="Find client, quote or order" />
          </label>
          <button type="button" className="qs-dashboard-primary-action" onClick={() => onOpenMenu?.("client_database")}>
            Add Client
          </button>
        </div>
      </section>

      <section className="qs-priority-panel">
        <div className="qs-section-header">
          <div>
            <div className="qs-dashboard-eyebrow">Now</div>
            <h2>Priority Actions</h2>
          </div>
          <button type="button" className="qs-link-button" onClick={() => onOpenMenu?.("follow_ups")}>
            View Priority Actions
          </button>
        </div>
        <div className="qs-priority-grid">
          {priorityActions.map((action) => (
            <PriorityCard key={action.id} action={action} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      </section>

      <section className="qs-kpi-grid" aria-label="Business performance">
        {kpis.map((card) => (
          <KpiCardView key={card.id} card={card} />
        ))}
      </section>

      <section className="qs-dashboard-row">
        <article className="qs-schedule-card">
          <div className="qs-section-header">
            <div>
              <div className="qs-dashboard-eyebrow">Today</div>
              <h2>Upcoming Schedule</h2>
            </div>
            <button type="button" className="qs-link-button" onClick={() => onOpenMenu?.("installation")}>
              View Calendar
            </button>
          </div>
          <div className="qs-timeline">
            {dashboardData.schedule.length ? (
              dashboardData.schedule.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="qs-timeline-item"
                  onClick={() => item.menu && onOpenMenu?.(item.menu)}
                >
                  <span className="qs-timeline-item__time">{item.time}</span>
                  <span className="qs-timeline-item__dot" />
                  <span className="qs-timeline-item__copy">
                    <strong>{item.type}: {item.title}</strong>
                    <span>{item.subtitle}</span>
                    <em>{item.person}</em>
                  </span>
                </button>
              ))
            ) : (
              <div className="qs-empty-state">No dated follow-ups, invoices or installations for today.</div>
            )}
          </div>
        </article>

        <article className="qs-pipeline-card">
          <div className="qs-section-header">
            <div>
              <div className="qs-dashboard-eyebrow">Pipeline</div>
              <h2>Pipeline Overview</h2>
            </div>
            <div className="qs-pipeline-value">{formatCurrency(dashboardData.pipelineValue)}</div>
          </div>
          <div className="qs-pipeline-bars">
            {dashboardData.pipeline.map((stage) => (
              <div key={stage.label} className={`qs-pipeline-stage qs-pipeline-stage--${stage.tone}${stage.unavailable ? " qs-pipeline-stage--unavailable" : ""}`}>
                <div className="qs-pipeline-stage__meta">
                  <span>{stage.label}</span>
                  <strong>{stage.unavailable ? "N/A" : stage.value}</strong>
                </div>
                <progress className="qs-pipeline-stage__track" max={100} value={Math.max(8, (stage.value / maxPipeline) * 100)} aria-label={`${stage.label} pipeline progress`} />
              </div>
            ))}
          </div>
        </article>

        <article className="qs-activity-card">
          <div className="qs-section-header">
            <div>
              <div className="qs-dashboard-eyebrow">Latest</div>
              <h2>Recent Activity</h2>
            </div>
            <button type="button" className="qs-link-button" onClick={() => onOpenMenu?.("orders")}>
              View all activity
            </button>
          </div>
          <div className="qs-activity-list">
            {dashboardData.activities.length ? (
              dashboardData.activities.map((item) => (
                <button key={item.id} type="button" className="qs-activity-item" onClick={() => item.menu && onOpenMenu?.(item.menu)}>
                  <span className="qs-activity-item__icon">{item.icon}</span>
                  <span className="qs-activity-item__copy">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </span>
                  <span className="qs-activity-item__time">{item.timestamp}</span>
                </button>
              ))
            ) : (
              <div className="qs-empty-state">No recent dated activity available.</div>
            )}
          </div>
        </article>
      </section>

      <section className="qs-dashboard-callout">
        <div>
          <h2>Stay on top of your business</h2>
          <p>You have priority actions that need your attention.</p>
        </div>
        <button type="button" className="qs-dashboard-primary-action" onClick={() => onOpenMenu?.("follow_ups")}>
          View Priority Actions
        </button>
      </section>
    </div>
  );
}
