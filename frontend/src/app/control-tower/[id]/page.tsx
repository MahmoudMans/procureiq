"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  Clock,
  Coins,
  Gauge,
  Info,
  Play,
  RefreshCw,
  UserRoundSearch,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  Field,
  KpiGrid,
  type KpiItem,
  Skeleton,
  StatusBadge,
  formatDate,
  formatDateTime,
  readable,
  useToast,
} from "@/components/kit";
import { RationaleDialog } from "@/components/kit/rationale-dialog";
import {
  acknowledgeControlTowerItem,
  assignControlTowerOwner,
  dismissControlTowerItem,
  getControlTowerContext,
  getControlTowerItem,
  resolveControlTowerItem,
  startControlTowerItem,
} from "@/lib/api";
import type { ControlTowerContext, ControlTowerItem } from "@/types/control-tower";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

type RationaleKind = "ACKNOWLEDGE" | "RESOLVE" | "DISMISS";

const MANAGE_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const DISMISS_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function ItemBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS") {
    return <StatusBadge value="IN_PROGRESS" label="In progress" />;
  }

  return <StatusBadge value={status} label={readable(status)} />;
}

interface RationaleCopy {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirm: string;
  busy: string;
  cancelLabel?: string;
  tone: "primary" | "danger";
  done: string;
}

function rationaleCopy(kind: RationaleKind, item: ControlTowerItem): RationaleCopy {
  switch (kind) {
    case "ACKNOWLEDGE":
      return {
        eyebrow: "Exception workflow",
        title: "Acknowledge this exception",
        description: `Confirm that “${item.title}” has been seen and is being looked at.`,
        label: "Acknowledgement note",
        placeholder: "What is being done about it?",
        confirm: "Acknowledge",
        busy: "Acknowledging…",
        tone: "primary",
        done: "Exception acknowledged",
      };

    case "RESOLVE":
      return {
        eyebrow: "Exception workflow",
        title: "Resolve this exception",
        description:
          "The exception will be closed in the management queue. The source record is not changed.",
        label: "Resolution note",
        placeholder: "What resolved the condition?",
        confirm: "Resolve",
        busy: "Resolving…",
        tone: "primary",
        done: "Exception resolved",
      };

    case "DISMISS":
      return {
        eyebrow: "Exception workflow",
        title: "Dismiss this exception",
        description:
          "The exception will be dismissed from the management queue without a resolution. The source record is not changed.",
        label: "Dismissal rationale",
        placeholder: "Why does this exception not need action?",
        confirm: "Dismiss",
        busy: "Dismissing…",
        cancelLabel: "Keep open",
        tone: "danger",
        done: "Exception dismissed",
      };
  }
}

function performRationale(kind: RationaleKind, itemId: string, note: string): Promise<unknown> {
  switch (kind) {
    case "ACKNOWLEDGE":
      return acknowledgeControlTowerItem(itemId, note);

    case "RESOLVE":
      return resolveControlTowerItem(itemId, note);

    case "DISMISS":
      return dismissControlTowerItem(itemId, note);
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface ItemData {
  id: string;
  item: ControlTowerItem;
  context: ControlTowerContext;
}

export default function ControlTowerItemPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canManage = user !== null && MANAGE_ROLES.includes(user.role);
  const canDismiss = user !== null && DISMISS_ROLES.includes(user.role);

  const [result, setResult] = useState<ItemData | null>(null);
  const [rationale, setRationale] = useState<RationaleKind | null>(null);
  const [rationaleRunning, setRationaleRunning] = useState(false);
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [ownerChoice, setOwnerChoice] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const id = params.id;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const [itemResponse, contextResponse] = await Promise.all([
          getControlTowerItem(id),
          getControlTowerContext(),
        ]);

        if (active) {
          setResult({ id, item: itemResponse, context: contextResponse });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load control-tower item.",
          );
        }
      } finally {
        if (active) {
          setFetching(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [params.id, reloadKey]);

  const data = result !== null && result.id === params.id ? result : null;
  const item = data?.item ?? null;
  const context = data?.context ?? null;

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function refresh() {
    const id = params.id;

    try {
      const fresh = await getControlTowerItem(id);

      setResult((current) =>
        current && current.id === id ? { ...current, item: fresh } : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh the item.");
    }
  }

  if (item === null) {
    if (error === null) {
      return (
        <div className="page-stack">
          <Skeleton height={28} />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={260} />
        </div>
      );
    }

    return (
      <div className="page-stack">
        <Link href="/control-tower" className="request-back-link">
          <ArrowLeft size={16} />
          Control tower
        </Link>

        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const status = String(item.status);
  const active = status === "OPEN" || status === "ACKNOWLEDGED" || status === "IN_PROGRESS";
  const owners = (context?.users ?? []).filter((candidate) => candidate.role !== "REQUESTER");
  const busyAny = rationaleRunning || working || assigning;
  const selectedOwner = ownerChoice ?? item.ownerUserId ?? "";
  const currentOwner = item.ownerUserId ?? "";
  const canAssign = selectedOwner !== "" && selectedOwner !== currentOwner;
  const rationaleInfo = rationale !== null ? rationaleCopy(rationale, item) : null;

  async function confirmRationale(note: string) {
    if (rationale === null) {
      return;
    }

    const kind = rationale;
    const copy = rationaleCopy(kind, item as ControlTowerItem);

    setRationaleRunning(true);
    setRationaleError(null);

    try {
      await performRationale(kind, params.id, note.trim());

      await refresh();

      setRationale(null);

      toast.success(copy.done, (item as ControlTowerItem).title);
    } catch (caught) {
      setRationaleError(
        caught instanceof Error ? caught.message : "Unable to record the decision.",
      );
    } finally {
      setRationaleRunning(false);
    }
  }

  function openRationale(kind: RationaleKind) {
    setRationaleError(null);
    setRationale(kind);
  }

  async function startWork() {
    if (working) {
      return;
    }

    setWorking(true);

    try {
      await startControlTowerItem(params.id);

      await refresh();

      toast.success("Work started", (item as ControlTowerItem).title);
    } catch (caught) {
      toast.error(
        "Could not start work",
        caught instanceof Error ? caught.message : "Unable to start control-tower item.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function assignOwner() {
    if (assigning || !canAssign) {
      return;
    }

    const ownerId = selectedOwner;

    setAssigning(true);

    try {
      await assignControlTowerOwner(params.id, ownerId);

      await refresh();

      setOwnerChoice(null);

      const owner = owners.find((candidate) => candidate.id === ownerId);

      toast.success("Owner assigned", owner ? owner.fullName : (item as ControlTowerItem).title);
    } catch (caught) {
      toast.error(
        "Could not assign the owner",
        caught instanceof Error ? caught.message : "Unable to assign control-tower owner.",
      );
    } finally {
      setAssigning(false);
    }
  }

  const kpis: KpiItem[] = [
    {
      label: "Priority score",
      icon: Gauge,
      value: item.priorityScore.toFixed(1),
      note: `Severity ${readable(String(item.severity))}`,
    },
    {
      label: "Exposure",
      icon: Coins,
      value: item.monetaryExposure > 0 ? money(item.monetaryExposure, item.currency) : "—",
      note: "Monetary exposure",
    },
    {
      label: "Age",
      icon: Clock,
      value: `${item.ageDays} ${item.ageDays === 1 ? "day" : "days"}`,
      note: item.slaOverdue ? "SLA overdue" : "Within SLA",
      tone: item.slaOverdue ? "warning" : "default",
    },
    {
      label: "Source due date",
      icon: CalendarDays,
      value: item.sourceDueDate ? formatDate(item.sourceDueDate) : "—",
      note: "On the source record",
    },
  ];

  return (
    <div className="page-stack">
      <Link href="/control-tower" className="request-back-link">
        <ArrowLeft size={16} />
        Control tower
      </Link>

      <section className="control-tower-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <StatusBadge value={String(item.severity)} label={readable(String(item.severity))} />

            <ItemBadge status={status} />

            <span>Priority {item.priorityScore.toFixed(0)}</span>
          </div>

          <h1>{item.title}</h1>

          <p>
            {readable(String(item.exceptionType))}
            {" · "}
            {item.sourceReference}
            {" · "}
            {item.currency}
          </p>
        </div>

        <div
          className={
            item.slaOverdue
              ? "control-tower-sla-card control-tower-sla-card--overdue"
              : "control-tower-sla-card"
          }
        >
          <span>SLA due</span>

          <strong>{formatDateTime(item.slaDueAt)}</strong>

          <small>{item.slaOverdue ? "OVERDUE" : "Within SLA"}</small>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          className="button button--secondary"
          onClick={reload}
          disabled={fetching}
        >
          <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
          Refresh
        </button>

        {canManage && status === "OPEN" ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busyAny}
            onClick={() => openRationale("ACKNOWLEDGE")}
          >
            <BadgeCheck size={15} />
            Acknowledge
          </button>
        ) : null}

        {canManage && (status === "OPEN" || status === "ACKNOWLEDGED") ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busyAny}
            onClick={() => void startWork()}
          >
            <Play size={15} />
            {working ? "Starting…" : "Start work"}
          </button>
        ) : null}

        {canDismiss && active ? (
          <button
            type="button"
            className="button button--secondary request-cancel-button"
            disabled={busyAny}
            onClick={() => openRationale("DISMISS")}
          >
            <XCircle size={15} />
            Dismiss
          </button>
        ) : null}

        {canManage && active ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busyAny}
            onClick={() => openRationale("RESOLVE")}
          >
            <BadgeCheck size={16} />
            Resolve
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button type="button" className="kit-banner-action" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {item.slaOverdue && active ? (
        <div className="kit-callout kit-callout--warning" role="status">
          <AlertTriangle size={17} />

          <div>
            <strong>The SLA is overdue.</strong> It was due {formatDateTime(item.slaDueAt)}.
          </div>
        </div>
      ) : null}

      {active && canManage && !item.ownerName ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>No owner is assigned.</strong> Assign an owner under Ownership so the exception
            has someone accountable.
          </div>
        </div>
      ) : null}

      {status === "OPEN" && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This exception has not been picked up.</strong> Acknowledge it or start work on
            it, then resolve it once the condition is dealt with.
          </div>
        </div>
      ) : null}

      {(status === "ACKNOWLEDGED" || status === "IN_PROGRESS") && canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>Resolve it when the condition is dealt with.</strong>{" "}
            {canDismiss
              ? "Dismiss it instead if it needs no action."
              : "A procurement manager or administrator can dismiss it if it needs no action."}
          </div>
        </div>
      ) : null}

      {active && !canManage ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>You can view this exception.</strong> A buyer, procurement manager or
            administrator needs to work it.
          </div>
        </div>
      ) : null}

      {!active ? (
        <div className="kit-callout kit-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>This exception is {readable(status).toLowerCase()}.</strong> It is no longer
            active, so no further action is available.
          </div>
        </div>
      ) : null}

      <KpiGrid items={kpis} ariaLabel="Exception summary" />

      <section className="control-tower-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Exception context</span>

              <h2>Source condition</h2>
            </div>

            <AlertTriangle size={19} />
          </div>

          <div className="control-tower-details">{item.details}</div>

          <div className="control-tower-source-grid">
            <div>
              <span>Source entity</span>

              <strong>{readable(String(item.sourceEntityType))}</strong>
            </div>

            <div>
              <span>Source reference</span>

              <strong>{item.sourceReference}</strong>
            </div>

            <div>
              <span>First seen</span>

              <strong>{formatDateTime(item.firstSeenAt)}</strong>
            </div>

            <div>
              <span>Last seen</span>

              <strong>{formatDateTime(item.lastSeenAt)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Accountability</span>

              <h2>Ownership</h2>
            </div>

            <UserRoundSearch size={19} />
          </div>

          <div className="control-tower-owner-card">
            <span>Current owner</span>

            <strong>{item.ownerName ?? "Unassigned"}</strong>
          </div>

          {canManage && active ? (
            <>
              <Field label="Assign owner" htmlFor="tower-owner">
                <select
                  id="tower-owner"
                  className="kit-field-input"
                  value={selectedOwner}
                  disabled={assigning}
                  onChange={(event) => setOwnerChoice(event.target.value)}
                >
                  <option value="">Select owner</option>

                  {owners.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} — {candidate.role}
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={assigning || !canAssign}
                  onClick={() => void assignOwner()}
                >
                  <UserRoundSearch size={15} />
                  {assigning ? "Assigning…" : "Assign owner"}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Exception workflow</span>

            <h2>Management disposition</h2>
          </div>

          <BadgeCheck size={19} />
        </div>

        {item.acknowledgementNote ? (
          <div className="control-tower-history-note">
            <strong>Acknowledgement</strong>

            <span>
              {item.acknowledgementNote}
              {item.acknowledgedByName ? ` — ${item.acknowledgedByName}` : ""}
            </span>
          </div>
        ) : null}

        {item.resolutionNote ? (
          <div className="control-tower-history-note">
            <strong>Resolution / disposition</strong>

            <span>
              {item.resolutionNote}
              {item.resolvedByName ? ` — ${item.resolvedByName}` : ""}
            </span>
          </div>
        ) : null}

        {!item.acknowledgementNote && !item.resolutionNote ? (
          <p className="kit-meta-line">
            No acknowledgement or resolution has been recorded for this exception yet.
          </p>
        ) : null}
      </section>

      <section className="control-tower-method-note">
        <AlertTriangle size={18} />

        <div>
          <strong>Queue disposition does not rewrite the source</strong>

          <p>
            Resolving or dismissing this control-tower item changes only the management queue. The
            supplier, sourcing, benefits, leakage or governance source record remains
            authoritative and unchanged.
          </p>
        </div>
      </section>

      {rationale !== null && rationaleInfo !== null ? (
        <RationaleDialog
          eyebrow={rationaleInfo.eyebrow}
          title={rationaleInfo.title}
          description={rationaleInfo.description}
          label={rationaleInfo.label}
          placeholder={rationaleInfo.placeholder}
          confirmLabel={rationaleInfo.confirm}
          busyLabel={rationaleInfo.busy}
          cancelLabel={rationaleInfo.cancelLabel}
          tone={rationaleInfo.tone}
          maxLength={2000}
          busy={rationaleRunning}
          error={rationaleError}
          onConfirm={(note) => void confirmRationale(note)}
          onCancel={() => setRationale(null)}
        />
      ) : null}
    </div>
  );
}
