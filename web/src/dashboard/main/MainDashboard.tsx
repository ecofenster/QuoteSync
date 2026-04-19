import React, { useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, MenuKey, OrderMeta } from "../../models/types";
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

type DashboardViewMode = "grid" | "list";

type DashboardMetricConfig = {
  id: string;
  title: string;
  value: number;
  description: string;
  tone?: "default" | "highlight" | "muted";
};

type DashboardSectionConfig = {
  id: string;
  title: string;
  description: string;
  metrics: DashboardMetricConfig[];
  actionMenu?: MenuKey;
  fixed?: boolean;
};

type Props = {
  clients: Client[];
  activeUserName?: string;
  onOpenMenu?: (menu: MenuKey) => void;
  onOpenEstimate?: (clientId: ClientId, estimateId: EstimateId) => void;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const nextClassName = ["main-dashboard-card", "ui-card", className].filter(Boolean).join(" ");
  return <div className={nextClassName}>{children}</div>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="main-dashboard-title">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="main-dashboard-heading">{children}</h3>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div className="main-dashboard-small">{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  active?: boolean;
}) {
  const className = [
    "main-dashboard-button",
    variant === "primary" ? "main-dashboard-button--primary" : "main-dashboard-button--secondary",
    active ? "main-dashboard-button--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

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

function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
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

function MetricCard({
  metric,
  viewMode,
}: {
  metric: DashboardMetricConfig;
  viewMode: DashboardViewMode;
}) {
  const className = [
    "main-dashboard-metric",
    `main-dashboard-metric--${viewMode}`,
    metric.tone === "highlight" ? "main-dashboard-metric--highlight" : "",
    metric.tone === "muted" ? "main-dashboard-metric--muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="main-dashboard-metric-copy">
        <div className="main-dashboard-metric-title">{metric.title}</div>
        <Small>{metric.description}</Small>
      </div>
      <div className="main-dashboard-metric-value">{metric.value}</div>
    </div>
  );
}

function DashboardSection({
  section,
  viewMode,
  order,
  onOpenMenu,
}: {
  section: DashboardSectionConfig;
  viewMode: DashboardViewMode;
  order: number;
  onOpenMenu?: (menu: MenuKey) => void;
}) {
  const actionMenu = section.actionMenu;

  return (
    <Card
      className={[
        "main-dashboard-section",
        section.fixed ? "main-dashboard-section--fixed" : "main-dashboard-section--sortable-ready",
      ].join(" ")}
    >
      <section data-section-id={section.id} data-section-order={order}>
        <div className="main-dashboard-section-header">
          <div className="main-dashboard-section-copy">
            <div className="main-dashboard-section-eyebrow">
              {section.fixed ? "Fixed Section" : "Section"}
            </div>
            <H3>{section.title}</H3>
            <Small>{section.description}</Small>
          </div>

          <div className="main-dashboard-section-actions">
            {!section.fixed ? (
              <div className="main-dashboard-section-grip" aria-hidden="true" title="Reorder placeholder">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {actionMenu ? (
              <Button variant="secondary" onClick={() => onOpenMenu?.(actionMenu)}>
                Open
              </Button>
            ) : null}
          </div>
        </div>

        <div className={`main-dashboard-metrics main-dashboard-metrics--${viewMode}`}>
          {section.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} viewMode={viewMode} />
          ))}
        </div>
      </section>
    </Card>
  );
}

export default function MainDashboard(props: Props) {
  const { clients, activeUserName = "User", onOpenMenu } = props;
  const [viewMode, setViewMode] = useState<DashboardViewMode>("grid");

  const dashboardData = useMemo(() => {
    const now = new Date();
    const followUps = loadFollowUpsSafe();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const countFollowUpsInRange = (start: Date, end: Date) =>
      followUps.filter((item) => {
        const dueDate = parseDate(item.dueAt || item.dueDateISO);
        return dueDate ? dueDate >= start && dueDate <= end : false;
      }).length;

    const orderRows: Array<{
      clientId: string;
      estimateId: string;
      outcome: EstimateOutcome;
      productionEndDate?: string;
      factoryDispatchDate?: string;
      deliveryDate?: string;
      installationDate?: string;
      balanceInvoiceDueDate?: string;
      clientSignoffReceivedDate?: string;
      factoryOrderSignedOffDate?: string;
      factoryInvoicePaidDate?: string;
      needsAttention: boolean;
    }> = [];

    let openEstimates = 0;

    for (const client of clients) {
      const outcomes = loadEstimateOutcomesForClient(client.id);

      for (const estimate of client.estimates) {
        const outcome = (outcomes[estimate.id] ?? estimate.outcome ?? "Open") as EstimateOutcome;
        if (outcome === "Open") openEstimates += 1;
        if (outcome !== "Order") continue;

        const meta = (estimate.orderMeta ?? {}) as Partial<OrderMeta>;
        const needsAttention =
          !meta.clientSignoffReceivedDate ||
          !meta.factoryOrderSignedOffDate ||
          !meta.productionStartDate ||
          !meta.deliveryDate ||
          !meta.installationDate;

        orderRows.push({
          clientId: client.id,
          estimateId: estimate.id,
          outcome,
          productionEndDate: meta.productionEndDate || meta.productionCompletedDate,
          factoryDispatchDate: meta.factoryDispatchDate,
          deliveryDate: meta.deliveryDate,
          installationDate: meta.installationDate,
          balanceInvoiceDueDate: meta.balanceInvoiceDueDate,
          clientSignoffReceivedDate: meta.clientSignoffReceivedDate,
          factoryOrderSignedOffDate: meta.factoryOrderSignedOffDate,
          factoryInvoicePaidDate: meta.factoryInvoicePaidDate,
          needsAttention,
        });
      }
    }

    const countOrderDatesInRange = (
      key:
        | "productionEndDate"
        | "factoryDispatchDate"
        | "deliveryDate"
        | "installationDate"
        | "balanceInvoiceDueDate",
      start: Date,
      end: Date
    ) =>
      orderRows.filter((row) => {
        const date = parseDate(row[key]);
        return date ? date >= start && date <= end : false;
      }).length;

    const deliveriesToday = countOrderDatesInRange("deliveryDate", todayStart, todayEnd);
    const deliveriesThisWeek = countOrderDatesInRange("deliveryDate", weekStart, weekEnd);
    const installationsToday = countOrderDatesInRange("installationDate", todayStart, todayEnd);
    const installationsThisWeek = countOrderDatesInRange("installationDate", weekStart, weekEnd);

    return {
      summary: {
        todayTaskCount: countFollowUpsInRange(todayStart, todayEnd) + deliveriesToday + installationsToday,
        thisWeekTaskCount: countFollowUpsInRange(weekStart, weekEnd) + deliveriesThisWeek + installationsThisWeek,
      },
      followUps: {
        today: countFollowUpsInRange(todayStart, todayEnd),
        thisWeek: countFollowUpsInRange(weekStart, weekEnd),
        thisMonth: countFollowUpsInRange(monthStart, monthEnd),
      },
      estimates: {
        openEstimates,
        openOrders: orderRows.length,
        ordersNeedingAttention: orderRows.filter((row) => row.needsAttention).length,
      },
      productionEndDates: {
        today: countOrderDatesInRange("productionEndDate", todayStart, todayEnd),
        thisWeek: countOrderDatesInRange("productionEndDate", weekStart, weekEnd),
        thisMonth: countOrderDatesInRange("productionEndDate", monthStart, monthEnd),
      },
      invoices: {
        sendToday: countOrderDatesInRange("balanceInvoiceDueDate", todayStart, todayEnd),
        thisWeek: countOrderDatesInRange("balanceInvoiceDueDate", weekStart, weekEnd),
        thisMonth: countOrderDatesInRange("balanceInvoiceDueDate", monthStart, monthEnd),
      },
      factoryPickups: {
        today: countOrderDatesInRange("factoryDispatchDate", todayStart, todayEnd),
        thisWeek: countOrderDatesInRange("factoryDispatchDate", weekStart, weekEnd),
        thisMonth: countOrderDatesInRange("factoryDispatchDate", monthStart, monthEnd),
      },
      deliveryDates: {
        today: deliveriesToday,
        thisWeek: deliveriesThisWeek,
        thisMonth: countOrderDatesInRange("deliveryDate", monthStart, monthEnd),
      },
      installations: {
        today: installationsToday,
        thisWeek: installationsThisWeek,
        thisMonth: countOrderDatesInRange("installationDate", monthStart, monthEnd),
      },
      clients: {
        clientPortalQueue: 0,
      },
      orders: {
        orderSignOffsNotReceived: orderRows.filter((row) => !row.clientSignoffReceivedDate).length,
        factorySignOffsNotProcessed: orderRows.filter((row) => !row.factoryOrderSignedOffDate).length,
        customersNotPaidInvoice: 0,
        factoryInvoicesNotPaid: orderRows.filter((row) => !row.factoryInvoicePaidDate).length,
      },
      serviceIssues: {
        openServiceIssues: 0,
        newServiceIssues: 0,
        pastDueDate: 0,
        siteServiceUpdates: 0,
      },
    };
  }, [clients]);

  const followUpsSection: DashboardSectionConfig = {
    id: "follow-ups",
    title: "Follow Ups",
    description: "Fixed priority section for immediate follow-up workload.",
    fixed: true,
    actionMenu: "follow_ups",
    metrics: [
      {
        id: "follow-ups-today",
        title: "Due Today",
        value: dashboardData.followUps.today,
        description: "Items due today from the follow up system.",
        tone: "highlight",
      },
      {
        id: "follow-ups-week",
        title: "Due This Week",
        value: dashboardData.followUps.thisWeek,
        description: "Items due this week from the follow up system.",
      },
      {
        id: "follow-ups-month",
        title: "Due This Month",
        value: dashboardData.followUps.thisMonth,
        description: "Items due this month from the follow up system.",
      },
    ],
  };

  const sections: DashboardSectionConfig[] = [
    {
      id: "estimates",
      title: "Estimates",
      description: "Pipeline totals covering open estimates and live orders.",
      actionMenu: "estimates",
      metrics: [
        {
          id: "estimates-open",
          title: "Open Estimates",
          value: dashboardData.estimates.openEstimates,
          description: "Estimates currently still open.",
          tone: "highlight",
        },
        {
          id: "orders-open",
          title: "Open Orders",
          value: dashboardData.estimates.openOrders,
          description: "Orders currently active in the workflow.",
        },
        {
          id: "orders-attention",
          title: "Orders Needing Attention",
          value: dashboardData.estimates.ordersNeedingAttention,
          description: "Orders missing key milestones or dates.",
        },
      ],
    },
    {
      id: "production-end-dates",
      title: "Production End Dates",
      description: "Upcoming production completions by time period.",
      actionMenu: "orders",
      metrics: [
        {
          id: "production-today",
          title: "Today",
          value: dashboardData.productionEndDates.today,
          description: "Production end dates scheduled for today.",
        },
        {
          id: "production-week",
          title: "This Week",
          value: dashboardData.productionEndDates.thisWeek,
          description: "Production end dates scheduled this week.",
        },
        {
          id: "production-month",
          title: "This Month",
          value: dashboardData.productionEndDates.thisMonth,
          description: "Production end dates scheduled this month.",
        },
      ],
    },
    {
      id: "invoices",
      title: "Invoices",
      description: "Balance invoice due dates ready for invoice sending.",
      actionMenu: "orders",
      metrics: [
        {
          id: "invoices-today",
          title: "Send Today",
          value: dashboardData.invoices.sendToday,
          description: "Invoices due to be sent today.",
        },
        {
          id: "invoices-week",
          title: "This Week",
          value: dashboardData.invoices.thisWeek,
          description: "Invoices due to be sent this week.",
        },
        {
          id: "invoices-month",
          title: "This Month",
          value: dashboardData.invoices.thisMonth,
          description: "Invoices due to be sent this month.",
        },
      ],
    },
    {
      id: "factory-pickups",
      title: "Factory Pickups",
      description: "Dispatch and pickup readiness from current order dates.",
      actionMenu: "orders",
      metrics: [
        {
          id: "factory-pickups-today",
          title: "Today",
          value: dashboardData.factoryPickups.today,
          description: "Factory pickups scheduled for today.",
        },
        {
          id: "factory-pickups-week",
          title: "This Week",
          value: dashboardData.factoryPickups.thisWeek,
          description: "Factory pickups scheduled this week.",
        },
        {
          id: "factory-pickups-month",
          title: "This Month",
          value: dashboardData.factoryPickups.thisMonth,
          description: "Factory pickups scheduled this month.",
        },
      ],
    },
    {
      id: "delivery-dates",
      title: "Delivery Dates",
      description: "Scheduled deliveries across the current workload.",
      actionMenu: "orders",
      metrics: [
        {
          id: "delivery-today",
          title: "Today",
          value: dashboardData.deliveryDates.today,
          description: "Deliveries scheduled for today.",
        },
        {
          id: "delivery-week",
          title: "This Week",
          value: dashboardData.deliveryDates.thisWeek,
          description: "Deliveries scheduled this week.",
        },
        {
          id: "delivery-month",
          title: "This Month",
          value: dashboardData.deliveryDates.thisMonth,
          description: "Deliveries scheduled this month.",
        },
      ],
    },
    {
      id: "installations",
      title: "Installations",
      description: "Installation workload over the active calendar windows.",
      actionMenu: "installation",
      metrics: [
        {
          id: "installations-today",
          title: "Today",
          value: dashboardData.installations.today,
          description: "Installations scheduled for today.",
        },
        {
          id: "installations-week",
          title: "This Week",
          value: dashboardData.installations.thisWeek,
          description: "Installations scheduled this week.",
        },
        {
          id: "installations-month",
          title: "This Month",
          value: dashboardData.installations.thisMonth,
          description: "Installations scheduled this month.",
        },
      ],
    },
    {
      id: "clients",
      title: "Clients",
      description: "Client-facing queue summary for future dashboard wiring.",
      actionMenu: "client_database",
      metrics: [
        {
          id: "clients-portal-queue",
          title: "Client Portal Queue",
          value: dashboardData.clients.clientPortalQueue,
          description: "Placeholder until client portal queue data is wired in.",
          tone: "muted",
        },
      ],
    },
    {
      id: "orders",
      title: "Orders",
      description: "Outstanding order admin and payment processing checks.",
      actionMenu: "orders",
      metrics: [
        {
          id: "orders-signoff-not-received",
          title: "Order Sign Offs Not Received",
          value: dashboardData.orders.orderSignOffsNotReceived,
          description: "Orders still missing client sign-off receipt.",
        },
        {
          id: "orders-factory-signoff",
          title: "Factory Sign Offs Not Processed",
          value: dashboardData.orders.factorySignOffsNotProcessed,
          description: "Orders still missing factory sign-off processing.",
        },
        {
          id: "orders-customer-unpaid",
          title: "Customers Not Paid Invoice",
          value: dashboardData.orders.customersNotPaidInvoice,
          description: "Placeholder until customer invoice payment tracking is available.",
          tone: "muted",
        },
        {
          id: "orders-factory-unpaid",
          title: "Factory Invoices Not Paid",
          value: dashboardData.orders.factoryInvoicesNotPaid,
          description: "Orders with no factory invoice payment date recorded.",
        },
      ],
    },
    {
      id: "service-issues",
      title: "Service Issues",
      description: "Service issue queue reserved for later wiring.",
      metrics: [
        {
          id: "service-open",
          title: "Open Service Issues",
          value: dashboardData.serviceIssues.openServiceIssues,
          description: "Placeholder until service issue data is wired in.",
          tone: "muted",
        },
        {
          id: "service-new",
          title: "New Service Issues",
          value: dashboardData.serviceIssues.newServiceIssues,
          description: "Placeholder until service issue data is wired in.",
          tone: "muted",
        },
        {
          id: "service-past-due",
          title: "Past Due Date",
          value: dashboardData.serviceIssues.pastDueDate,
          description: "Placeholder until service issue due dates are wired in.",
          tone: "muted",
        },
        {
          id: "service-site-updates",
          title: "Site Service Updates",
          value: dashboardData.serviceIssues.siteServiceUpdates,
          description: "Placeholder until site update data is wired in.",
          tone: "muted",
        },
      ],
    },
  ];

  return (
    <div className="main-dashboard">
      <Card className="main-dashboard-hero">
        <div className="main-dashboard-hero-header">
          <div className="main-dashboard-hero-copy">
            <H2>Welcome {activeUserName}</H2>
            <Small>Operational dashboard for today and this week.</Small>
          </div>

          <div className="main-dashboard-view-toggle" role="tablist" aria-label="Dashboard view mode">
            <Button
              variant="secondary"
              active={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </Button>
            <Button
              variant="secondary"
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>
        </div>

        <div className="main-dashboard-summary-grid">
          <div className="main-dashboard-summary-card">
            <div className="main-dashboard-summary-label">Today</div>
            <div className="main-dashboard-summary-value">{dashboardData.summary.todayTaskCount}</div>
            <Small>You have follow ups, deliveries and installations scheduled today.</Small>
          </div>
          <div className="main-dashboard-summary-card">
            <div className="main-dashboard-summary-label">This week</div>
            <div className="main-dashboard-summary-value">{dashboardData.summary.thisWeekTaskCount}</div>
            <Small>You have follow ups, deliveries and installations scheduled this week.</Small>
          </div>
        </div>
      </Card>

      <DashboardSection
        section={followUpsSection}
        viewMode={viewMode}
        order={0}
        onOpenMenu={onOpenMenu}
      />

      <div className="main-dashboard-sections">
        {sections.map((section, index) => (
          <DashboardSection
            key={section.id}
            section={section}
            viewMode={viewMode}
            order={index + 1}
            onOpenMenu={onOpenMenu}
          />
        ))}
      </div>
    </div>
  );
}
