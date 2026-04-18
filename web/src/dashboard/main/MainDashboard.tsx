import React, { useMemo } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../models/types";
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
  onOpenMenu?: (menu: "follow_ups" | "orders" | "installation" | "client_database") => void;
  onOpenEstimate?: (clientId: ClientId, estimateId: EstimateId) => void;
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="main-dashboard-card ui-card"
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="main-dashboard-title">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="main-dashboard-heading">{children}</h3>;
}

function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="main-dashboard-small" style={style}>{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  const className = `main-dashboard-button ${variant === "primary" ? "main-dashboard-button--primary" : "main-dashboard-button--secondary"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{ cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDueDate(item: DashboardFollowUp) {
  const raw = item.dueAt || item.dueDateISO;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
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

function RowCard({
  title,
  meta,
  right,
  onClick,
}: {
  title: string;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="main-dashboard-row-card"
      style={{
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="main-dashboard-row-card-main">
        <div className="main-dashboard-row-card-title">{title}</div>
        {meta ? <Small>{meta}</Small> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

export default function MainDashboard({ clients, activeUserName = "User", onOpenMenu, onOpenEstimate }: Props) {
  const now = new Date();

  const dashboardData = useMemo(() => {
    const followUps = loadFollowUpsSafe();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const dueToday = followUps.filter((f) => {
      const d = parseDueDate(f);
      return d ? isSameDay(d, now) : false;
    });

    const dueThisWeek = followUps.filter((f) => {
      const d = parseDueDate(f);
      return d ? d >= weekStart && d <= weekEnd : false;
    });

    const orderRows: Array<{
      client: Client;
      estimateId: EstimateId;
      estimateRef: string;
      productionEndDate?: string;
      deliveryDate?: string;
      installationDate?: string;
      balanceInvoiceDueDate?: string;
      installerId?: string;
      needsAttention: boolean;
    }> = [];

    for (const client of clients) {
      const outcomes = loadEstimateOutcomesForClient(client.id);
      for (const estimate of client.estimates) {
        const outcome = (outcomes[estimate.id] ?? "Open") as EstimateOutcome;
        if (outcome !== "Order") continue;

        const meta = estimate.orderMeta ?? {};
        const needsAttention =
          !meta.clientSignoffReceivedDate ||
          !meta.factoryOrderSignedOffDate ||
          !meta.productionStartDate ||
          !meta.deliveryDate ||
          !meta.installationDate;

        orderRows.push({
          client,
          estimateId: estimate.id,
          estimateRef: estimate.estimateRef,
          productionEndDate: meta.productionEndDate || meta.productionCompletedDate,
          deliveryDate: meta.deliveryDate,
          installationDate: meta.installationDate,
          balanceInvoiceDueDate: meta.balanceInvoiceDueDate,
          installerId: meta.installerId,
          needsAttention,
        });
      }
    }

    const ordersNeedingAttention = orderRows.filter((x) => x.needsAttention).sort((a, b) => a.estimateRef.localeCompare(b.estimateRef));
    const productionEndDates = orderRows.filter((x) => !!x.productionEndDate).sort((a, b) => String(a.productionEndDate).localeCompare(String(b.productionEndDate)));
    const deliveriesScheduled = orderRows.filter((x) => !!x.deliveryDate).sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate)));
    const installationsScheduled = orderRows.filter((x) => !!x.installationDate).sort((a, b) => String(a.installationDate).localeCompare(String(b.installationDate)));
    const invoicesNeedingRaised = orderRows.filter((x) => !!x.balanceInvoiceDueDate).sort((a, b) => String(a.balanceInvoiceDueDate).localeCompare(String(b.balanceInvoiceDueDate)));

    const todayTaskCount =
      dueToday.length +
      deliveriesScheduled.filter((x) => x.deliveryDate && isSameDay(new Date(x.deliveryDate), now)).length +
      installationsScheduled.filter((x) => x.installationDate && isSameDay(new Date(x.installationDate), now)).length;

    const thisWeekTaskCount =
      dueThisWeek.length +
      deliveriesScheduled.filter((x) => {
        const d = x.deliveryDate ? new Date(x.deliveryDate) : null;
        return d ? d >= weekStart && d <= weekEnd : false;
      }).length +
      installationsScheduled.filter((x) => {
        const d = x.installationDate ? new Date(x.installationDate) : null;
        return d ? d >= weekStart && d <= weekEnd : false;
      }).length;

    return {
      dueToday,
      dueThisWeek,
      ordersNeedingAttention,
      productionEndDates,
      deliveriesScheduled,
      installationsScheduled,
      invoicesNeedingRaised,
      todayTaskCount,
      thisWeekTaskCount,
    };
  }, [clients]);

  return (
    <div className="main-dashboard">
      <Card>
        <div className="main-dashboard-card-grid">
          <div>
            <H2>Welcome {activeUserName}</H2>
            <Small>Operational dashboard for today and this week.</Small>
          </div>

          <div className="main-dashboard-summary-grid">
            <div className="main-dashboard-summary-card">
              <div className="main-dashboard-summary-label">Today</div>
              <div className="main-dashboard-summary-value">{dashboardData.todayTaskCount}</div>
              <Small>You have follow ups, deliveries and installations scheduled today.</Small>
            </div>
            <div className="main-dashboard-summary-card">
              <div className="main-dashboard-summary-label">This Week</div>
              <div className="main-dashboard-summary-value">{dashboardData.thisWeekTaskCount}</div>
              <Small>You have follow ups, deliveries and installations scheduled this week.</Small>
            </div>
          </div>
        </div>
      </Card>

      <div className="main-dashboard-three-col">
        <Card style={{ display: "grid", gap: 12 }}>
          <div className="main-dashboard-section-header">
            <H3>Follow Ups</H3>
            <Button variant="secondary" onClick={() => onOpenMenu?.("follow_ups")}>Open</Button>
          </div>
          <div className="main-dashboard-list">
            <RowCard
              title={`Due today: ${dashboardData.dueToday.length}`}
              meta="Items due today from the follow up system."
            />
            <RowCard
              title={`Due this week: ${dashboardData.dueThisWeek.length}`}
              meta="Items due this week from the follow up system."
            />
            {dashboardData.dueToday.slice(0, 3).map((item) => (
              <RowCard
                key={item.id}
                title={item.title || item.estimateRef || "Follow up"}
                meta={`${item.clientName || ""} ${item.clientRef ? `• ${item.clientRef}` : ""} ${item.dueDateISO ? `• ${formatDate(item.dueDateISO)}` : ""}`}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <div className="main-dashboard-section-header">
            <H3>Orders Requiring Attention</H3>
            <Button variant="secondary" onClick={() => onOpenMenu?.("orders")}>Open</Button>
          </div>
          <div className="main-dashboard-list">
            <RowCard
              title={`${dashboardData.ordersNeedingAttention.length} order(s) need attention`}
              meta="Orders missing key milestones, delivery dates or installation dates."
            />
            {dashboardData.ordersNeedingAttention.slice(0, 5).map((item) => (
              <RowCard
                key={`${item.client.id}_${item.estimateId}`}
                title={`${item.client.clientName} • ${item.estimateRef}`}
                meta={`Delivery: ${formatDate(item.deliveryDate)} • Installation: ${formatDate(item.installationDate)}`}
                onClick={onOpenEstimate ? () => onOpenEstimate(item.client.id, item.estimateId) : undefined}
              />
            ))}
          </div>
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <H3>Client Portal Queue</H3>
          <div className="main-dashboard-list">
            <RowCard title="Client estimate requests" meta="Frontend queue not connected yet." right={<strong>0</strong>} />
            <RowCard title="Service issues received" meta="Frontend queue not connected yet." right={<strong>0</strong>} />
            <RowCard title="Open service issues" meta="Frontend queue not connected yet." right={<strong>0</strong>} />
          </div>
        </Card>
      </div>

      <div className="main-dashboard-four-col">
        <Card style={{ display: "grid", gap: 12 }}>
          <H3>Production End Dates</H3>
          <div className="main-dashboard-list">
            {dashboardData.productionEndDates.slice(0, 5).map((item) => (
              <RowCard
                key={`${item.client.id}_${item.estimateId}_prod`}
                title={`${item.client.clientName} • ${item.estimateRef}`}
                meta={formatDate(item.productionEndDate)}
                onClick={onOpenEstimate ? () => onOpenEstimate(item.client.id, item.estimateId) : undefined}
              />
            ))}
            {dashboardData.productionEndDates.length === 0 && <Small>No production end dates set.</Small>}
          </div>
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <H3>Deliveries Scheduled</H3>
          <div className="main-dashboard-list">
            {dashboardData.deliveriesScheduled.slice(0, 5).map((item) => (
              <RowCard
                key={`${item.client.id}_${item.estimateId}_del`}
                title={`${item.client.clientName} • ${item.estimateRef}`}
                meta={formatDate(item.deliveryDate)}
                onClick={onOpenEstimate ? () => onOpenEstimate(item.client.id, item.estimateId) : undefined}
              />
            ))}
            {dashboardData.deliveriesScheduled.length === 0 && <Small>No deliveries scheduled.</Small>}
          </div>
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <div className="main-dashboard-section-header">
            <H3>Installations Scheduled</H3>
            <Button variant="secondary" onClick={() => onOpenMenu?.("installation")}>Open</Button>
          </div>
          <div className="main-dashboard-list">
            {dashboardData.installationsScheduled.slice(0, 5).map((item) => (
              <RowCard
                key={`${item.client.id}_${item.estimateId}_inst`}
                title={`${item.client.clientName} • ${item.estimateRef}`}
                meta={`${formatDate(item.installationDate)} • Team: ${item.installerId || "Not assigned"}`}
                onClick={onOpenEstimate ? () => onOpenEstimate(item.client.id, item.estimateId) : undefined}
              />
            ))}
            {dashboardData.installationsScheduled.length === 0 && <Small>No installations scheduled.</Small>}
          </div>
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <H3>Invoices Needing Raised</H3>
          <div className="main-dashboard-list">
            {dashboardData.invoicesNeedingRaised.slice(0, 5).map((item) => (
              <RowCard
                key={`${item.client.id}_${item.estimateId}_inv`}
                title={`${item.client.clientName} • ${item.estimateRef}`}
                meta={`Due: ${formatDate(item.balanceInvoiceDueDate)}`}
                onClick={onOpenEstimate ? () => onOpenEstimate(item.client.id, item.estimateId) : undefined}
              />
            ))}
            {dashboardData.invoicesNeedingRaised.length === 0 && <Small>No invoice due dates set.</Small>}
          </div>
        </Card>
      </div>
    </div>
  );
}
