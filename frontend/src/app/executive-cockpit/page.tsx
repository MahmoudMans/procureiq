"use client";

import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Coins,
  Download,
  FileWarning,
  Gauge,
  Lightbulb,
  Radar,
  RefreshCw,
  SearchX,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type Column,
  DataTable,
  EmptyState,
  Field,
  type FilterChip,
  FilterChips,
  KpiGrid,
  type KpiItem,
  Modal,
  SearchField,
  SegmentedFilter,
  type SegmentedOption,
  SelectField,
  type SelectOption,
  Skeleton,
  type StatItem,
  StatStrip,
  StatusBadge,
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  readable,
  timeOf,
  useToast,
} from "@/components/kit";
import {
  acknowledgeExecutiveWarning,
  getExecutiveCockpit,
  unacknowledgeExecutiveWarning,
  updateExecutiveWarningRule,
} from "@/lib/api";
import type {
  ExecutiveCockpit,
  ExecutiveRule,
  ExecutiveWarning,
  ExecutiveWarningSeverity,
} from "@/types/executive-cockpit";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const ACK_ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "BUYER"];
const CONFIG_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];
const PAGE_SIZE = 12;

const CURRENCY_OPTIONS: SelectOption[] = ["EUR", "USD", "GBP", "TND"].map((code) => ({
  value: code,
  label: code,
}));

const SIGNAL_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "PROCESS", label: "Process" },
  { value: "INVOICE", label: "Invoice" },
  { value: "CONTRACT", label: "Contract" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "DEMAND", label: "Demand" },
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "INFO", label: "Info" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "priority", label: "Priority" },
  { value: "exposure", label: "Exposure" },
  { value: "due", label: "Due date" },
];

const RULE_SEVERITIES: ExecutiveWarningSeverity[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const EMPTY_WARNINGS: ExecutiveWarning[] = [];
const EMPTY_RULES: ExecutiveRule[] = [];

interface CockpitData {
  currency: string;
  cockpit: ExecutiveCockpit;
}

function compareWarnings(
  sortBy: string,
): (a: ExecutiveWarning, b: ExecutiveWarning) => number {
  if (sortBy === "exposure") {
    return (a, b) =>
      (b.exposureValue ?? -1) - (a.exposureValue ?? -1) || b.priorityScore - a.priorityScore;
  }

  if (sortBy === "due") {
    return (a, b) => {
      const left = timeOf(a.dueAt);
      const right = timeOf(b.dueAt);

      if (left === null && right === null) {
        return b.priorityScore - a.priorityScore;
      }

      if (left === null) {
        return 1;
      }

      if (right === null) {
        return -1;
      }

      return left - right;
    };
  }

  return (a, b) => b.priorityScore - a.priorityScore;
}

function buildRuleColumns(onEdit: (rule: ExecutiveRule) => void): Column<ExecutiveRule>[] {
  return [
    {
      id: "rule",
      header: "Rule",
      sortValue: (rule) => rule.ruleCode,
      cell: (rule) => (
        <div className="request-primary-cell">
          <strong>{rule.ruleCode}</strong>
          <span>{rule.title}</span>
        </div>
      ),
    },
    {
      id: "signal",
      header: "Signal",
      sortValue: (rule) => rule.signalType,
      cell: (rule) => readable(rule.signalType),
    },
    {
      id: "severity",
      header: "Default severity",
      sortValue: (rule) => RULE_SEVERITIES.indexOf(rule.defaultSeverity),
      firstSort: "desc",
      cell: (rule) => <StatusBadge value={rule.defaultSeverity} />,
    },
    {
      id: "threshold",
      header: "Threshold",
      align: "right",
      sortValue: (rule) => rule.thresholdValue,
      cell: (rule) => <span className="kit-num">{rule.thresholdValue}</span>,
    },
    {
      id: "lookahead",
      header: "Lookahead",
      align: "right",
      sortValue: (rule) => rule.lookaheadDays,
      cell: (rule) => <span className="kit-num">{rule.lookaheadDays}d</span>,
    },
    {
      id: "enabled",
      header: "State",
      sortValue: (rule) => (rule.enabled ? 0 : 1),
      cell: (rule) => (
        <StatusBadge
          value={rule.enabled ? "ACTIVE" : "INACTIVE"}
          label={rule.enabled ? "Enabled" : "Disabled"}
        />
      ),
    },
    {
      id: "edit",
      header: <span className="kit-sr-only">Actions</span>,
      align: "right",
      width: 80,
      cell: (rule) => (
        <button type="button" className="kit-row-button" onClick={() => onEdit(rule)}>
          Edit
        </button>
      ),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Rule editor                                                         */
/* ------------------------------------------------------------------ */

interface RuleModalProps {
  rule: ExecutiveRule;
  onClose: () => void;
  onSaved: () => void;
}

function RuleModal({ rule, onClose, onSaved }: RuleModalProps) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [threshold, setThreshold] = useState(String(rule.thresholdValue));
  const [lookahead, setLookahead] = useState(String(rule.lookaheadDays));
  const [severity, setSeverity] = useState<ExecutiveWarningSeverity>(rule.defaultSeverity);
  const [errors, setErrors] = useState<{ threshold?: string; lookahead?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const thresholdValue = Number(threshold);
    const lookaheadDays = Number(lookahead);
    const next: { threshold?: string; lookahead?: string } = {};

    if (threshold.trim() === "" || !Number.isFinite(thresholdValue) || thresholdValue < 0) {
      next.threshold = "Enter a threshold of 0 or more.";
    }

    if (
      lookahead.trim() === "" ||
      !Number.isInteger(lookaheadDays) ||
      lookaheadDays < 0 ||
      lookaheadDays > 1095
    ) {
      next.lookahead = "Enter whole days between 0 and 1095.";
    }

    setErrors(next);

    if (next.threshold || next.lookahead) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateExecutiveWarningRule(Number(rule.id), {
        enabled,
        thresholdValue,
        lookaheadDays,
        defaultSeverity: severity,
      });

      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update executive warning rule.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Early-warning rule"
      title={rule.ruleCode}
      description={rule.title}
      size="md"
      dismissible={!saving}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="executive-rule-form"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save rule"}
          </button>
        </>
      }
    >
      <div className="executive-rule-description">
        <p>{rule.description}</p>

        <span>
          Signal: {readable(rule.signalType)} · Nature: {rule.nature} · Priority:{" "}
          {rule.priority}
        </span>
      </div>

      <form id="executive-rule-form" onSubmit={handleSubmit} noValidate>
        <div className="kit-pair-grid">
          <Field
            label="Threshold"
            htmlFor="rule-threshold"
            error={errors.threshold}
          >
            <input
              id="rule-threshold"
              className="kit-field-input"
              type="number"
              min="0"
              step="0.01"
              value={threshold}
              aria-invalid={errors.threshold ? true : undefined}
              onChange={(event) => {
                setThreshold(event.target.value);
                setErrors((current) => ({ ...current, threshold: undefined }));
              }}
            />
          </Field>

          <Field
            label="Lookahead days"
            htmlFor="rule-lookahead"
            error={errors.lookahead}
          >
            <input
              id="rule-lookahead"
              className="kit-field-input"
              type="number"
              min="0"
              max="1095"
              step="1"
              value={lookahead}
              aria-invalid={errors.lookahead ? true : undefined}
              onChange={(event) => {
                setLookahead(event.target.value);
                setErrors((current) => ({ ...current, lookahead: undefined }));
              }}
            />
          </Field>

          <Field label="Default severity" htmlFor="rule-severity">
            <select
              id="rule-severity"
              className="kit-field-input"
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as ExecutiveWarningSeverity)
              }
            >
              {RULE_SEVERITIES.map((level) => (
                <option key={level} value={level}>
                  {readable(level)}
                </option>
              ))}
            </select>
          </Field>

          <div className="executive-rule-enabled" style={{ alignSelf: "end", height: 38 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />

              <span>Enabled</span>
            </label>
          </div>
        </div>

        {error ? (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ExecutiveCockpitPage() {
  const { user } = useAuth();
  const toast = useToast();

  const canAcknowledge = user !== null && ACK_ROLES.includes(user.role);
  const canConfigure = user !== null && CONFIG_ROLES.includes(user.role);

  const [currency, setCurrency] = useState("EUR");
  const [result, setResult] = useState<CockpitData | null>(null);
  const [query, setQuery] = useState("");
  const [signalFilter, setSignalFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [ack, setAck] = useState("OPEN");
  const [sortBy, setSortBy] = useState("priority");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<ExecutiveRule | null>(null);

  const ruleColumns = useMemo(() => buildRuleColumns(setEditingRule), []);
  const [expanded, setExpanded] = useState<{ key: string; extra: number }>({
    key: "",
    extra: 0,
  });
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const response = await getExecutiveCockpit(currency);

        if (active) {
          setResult({ currency, cockpit: response });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load executive procurement cockpit.",
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
  }, [currency, reloadKey]);

  // Figures are only shown once they belong to the selected currency.
  const data = result !== null && result.currency === currency ? result.cockpit : null;
  const summary = data?.summary ?? null;
  const warnings = data?.warnings ?? EMPTY_WARNINGS;
  const rules = data?.rules ?? EMPTY_RULES;
  const pending = data === null && error === null;

  const openCount = useMemo(
    () => warnings.filter((warning) => !warning.acknowledged).length,
    [warnings],
  );
  const acknowledgedCount = warnings.length - openCount;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return warnings
      .filter((warning) => !signalFilter || warning.signalType === signalFilter)
      .filter((warning) => !severityFilter || warning.severity === severityFilter)
      .filter(
        (warning) =>
          ack === "ALL" ||
          (ack === "ACKNOWLEDGED" ? warning.acknowledged : !warning.acknowledged),
      )
      .filter(
        (warning) =>
          !normalized ||
          [
            warning.title,
            warning.details,
            warning.recommendation,
            warning.referenceLabel ?? "",
            warning.referenceType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      )
      .sort(compareWarnings(sortBy));
  }, [warnings, query, signalFilter, severityFilter, ack, sortBy]);

  const filterKey = `${currency}|${query}|${signalFilter}|${severityFilter}|${ack}|${sortBy}`;
  const extra = expanded.key === filterKey ? expanded.extra : 0;
  const shown = filtered.slice(0, PAGE_SIZE + extra);

  const chips: FilterChip[] = [];

  if (query.trim()) {
    chips.push({
      key: "query",
      label: `Search: “${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  if (signalFilter) {
    chips.push({
      key: "signal",
      label: `Signal: ${readable(signalFilter)}`,
      onRemove: () => setSignalFilter(""),
    });
  }

  if (severityFilter) {
    chips.push({
      key: "severity",
      label: `Severity: ${readable(severityFilter)}`,
      onRemove: () => setSeverityFilter(""),
    });
  }

  const ackOptions: SegmentedOption[] = [
    { value: "OPEN", label: data ? `Open · ${openCount}` : "Open" },
    {
      value: "ACKNOWLEDGED",
      label: data ? `Acknowledged · ${acknowledgedCount}` : "Acknowledged",
    },
    { value: "ALL", label: "All" },
  ];

  function clearFilters() {
    setQuery("");
    setSignalFilter("");
    setSeverityFilter("");
  }

  function pickSignal(type: string) {
    const next = signalFilter === type ? "" : type;

    setSignalFilter(next);

    if (next) {
      document
        .getElementById("warning-queue")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleTileKey(event: KeyboardEvent<HTMLElement>, type: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pickSignal(type);
    }
  }

  async function acknowledge(warning: ExecutiveWarning) {
    const note = (notes[warning.warningKey] ?? "").trim();

    if (!note) {
      toast.warning("Add a note first", "An acknowledgement note is required.");
      return;
    }

    setBusyKey(warning.warningKey);

    try {
      await acknowledgeExecutiveWarning(warning.warningKey, currency, note);

      setNotes((current) => ({ ...current, [warning.warningKey]: "" }));
      toast.success("Warning acknowledged", warning.title);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not acknowledge the warning",
        caught instanceof Error ? caught.message : "Unable to acknowledge executive warning.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function reopen(warning: ExecutiveWarning) {
    setBusyKey(warning.warningKey);

    try {
      await unacknowledgeExecutiveWarning(warning.warningKey);

      toast.info("Warning reopened", warning.title);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(
        "Could not reopen the warning",
        caught instanceof Error ? caught.message : "Unable to reopen executive warning.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  function handleRuleSaved() {
    if (editingRule) {
      toast.success("Rule updated", editingRule.ruleCode);
    }

    setEditingRule(null);
    setReloadKey((key) => key + 1);
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-executive-warnings-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Severity",
        "Signal",
        "Nature",
        "Title",
        "Reference",
        "Priority score",
        "Currency",
        "Exposure",
        "Metric",
        "Due",
        "Details",
        "Recommendation",
        "Acknowledged",
        "Acknowledgement note",
        "Acknowledged by",
      ],
      filtered.map((warning) => [
        warning.severity,
        warning.signalType,
        warning.nature,
        warning.title,
        `${warning.referenceType} ${warning.referenceLabel ?? warning.referenceId}`,
        warning.priorityScore.toFixed(0),
        warning.currency ?? "",
        warning.exposureValue,
        warning.metricValue,
        warning.dueAt ?? "",
        warning.details,
        warning.recommendation,
        warning.acknowledged ? "Yes" : "No",
        warning.acknowledgementNote ?? "",
        warning.acknowledgedByName ?? "",
      ]),
    );

    toast.success(
      "Warnings exported",
      `${filtered.length} ${filtered.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const critical = summary?.criticalWarnings ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Critical warnings",
      icon: ShieldAlert,
      value: summary ? String(critical) : "—",
      note: `${summary?.unacknowledgedWarnings ?? 0} unacknowledged signals`,
      tone: critical > 0 ? "warning" : "default",
    },
    {
      label: "Risk exposure",
      icon: Coins,
      value: summary ? formatMoney(summary.riskExposure, currency, true) : "—",
      note: "Distinct active warning exposure.",
    },
    {
      label: "Value opportunity",
      icon: Target,
      value: summary ? formatMoney(summary.opportunityValue, currency, true) : "—",
      note: "Open consolidation savings signals.",
    },
    {
      label: "Process bottlenecks",
      icon: Gauge,
      value: summary ? String(summary.processBottlenecks) : "—",
      note: `${summary?.criticalSupplierSignals ?? 0} critical supplier signals`,
    },
  ];

  const stats: StatItem[] = [
    {
      label: "Overdue invoices",
      value: summary ? formatMoney(summary.overdueInvoiceExposure, currency, true) : "—",
    },
    {
      label: "Payment holds",
      value: summary ? formatMoney(summary.paymentHoldExposure, currency, true) : "—",
    },
    {
      label: "Commercial leakage",
      value: summary ? formatMoney(summary.commercialLeakageExposure, currency, true) : "—",
    },
    {
      label: "Demand savings",
      value: summary ? formatMoney(summary.demandSavingsOpportunity, currency, true) : "—",
    },
  ];

  let queueEmpty;

  if (warnings.length === 0) {
    queueEmpty = (
      <EmptyState
        icon={ShieldCheck}
        title="No early-warning signals"
        description="Nothing currently triggers an early-warning rule."
      />
    );
  } else if (chips.length > 0) {
    queueEmpty = (
      <EmptyState
        icon={SearchX}
        title="No warnings match these filters"
        description="Try a different search term, signal or severity, or clear the filters."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        }
      />
    );
  } else if (ack === "OPEN") {
    queueEmpty = (
      <EmptyState
        icon={ShieldCheck}
        title="No open warnings"
        description="Every early-warning signal has been acknowledged."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setAck("ALL")}
          >
            Show all warnings
          </button>
        }
      />
    );
  } else {
    queueEmpty = (
      <EmptyState
        icon={ShieldCheck}
        title="No acknowledged warnings"
        description="Acknowledged signals will be listed here."
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Executive intelligence</span>

          <h1>Procurement cockpit</h1>

          <p>
            Prioritize cross-functional procurement risks and value opportunities using
            explainable early-warning signals from operations, suppliers, contracts,
            invoices, negotiations and sourcing demand.
          </p>

          <span className="kit-meta-line">
            <RefreshCw size={13} />
            Snapshot {data ? formatDateTime(data.generatedAt) : "—"}
          </span>
        </div>

        <div className="page-heading__actions">
          <SelectField
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {error && data === null ? null : (
        <>
          <KpiGrid items={kpis} loading={pending} ariaLabel="Executive totals" />

          <StatStrip items={stats} loading={pending} />

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Portfolio radar</span>

                <h2>Cross-module signals</h2>
              </div>

              <Radar size={19} />
            </div>

            {pending ? <Skeleton height={130} /> : null}

            {data && data.portfolioSignals.length === 0 ? (
              <EmptyState
                compact
                icon={Radar}
                title="No cross-module signals"
                description="Signals appear as soon as a warning rule triggers."
              />
            ) : null}

            {data && data.portfolioSignals.length > 0 ? (
              <div className="executive-portfolio-grid">
                {data.portfolioSignals.map((signal) => (
                  <article
                    key={signal.signalType}
                    className="kit-clickable"
                    role="button"
                    tabIndex={0}
                    aria-pressed={signalFilter === signal.signalType}
                    title="Filter the warning queue by this signal"
                    onClick={() => pickSignal(signal.signalType)}
                    onKeyDown={(event) => handleTileKey(event, signal.signalType)}
                  >
                    <span>{readable(signal.signalType)}</span>

                    <strong>
                      {signal.warningCount} {signal.warningCount === 1 ? "signal" : "signals"}
                    </strong>

                    <div>
                      <span>Critical</span>

                      <strong>{signal.criticalCount}</strong>
                    </div>

                    <div>
                      <span>Risk</span>

                      <strong>{formatMoney(signal.riskExposure, currency, true)}</strong>
                    </div>

                    <div>
                      <span>Opportunity</span>

                      <strong>{formatMoney(signal.opportunityValue, currency, true)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="executive-grid-two">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Management focus</span>

                  <h2>Recommended actions</h2>
                </div>

                <Lightbulb size={19} />
              </div>

              {pending ? <Skeleton height={140} /> : null}

              {data && data.managementActions.length === 0 ? (
                <EmptyState
                  compact
                  icon={Lightbulb}
                  title="No recommended actions"
                  description="Management actions appear when warnings need a decision."
                />
              ) : null}

              {data && data.managementActions.length > 0 ? (
                <div className="executive-action-list">
                  {data.managementActions.map((action, index) => (
                    <article
                      key={`${action.title}-${index}`}
                      className={`executive-action executive-action--${action.priority.toLowerCase()}`}
                    >
                      <span>{action.priority}</span>

                      <div>
                        <strong>{action.title}</strong>

                        <p>{action.details}</p>
                      </div>

                      <strong>{action.warningCount}</strong>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Signal distribution</span>

                  <h2>Executive status</h2>
                </div>

                <Activity size={19} />
              </div>

              <div className="executive-status-grid">
                <article>
                  <span>Generated</span>

                  <strong>{summary?.generatedWarnings ?? 0}</strong>
                </article>

                <article>
                  <span>Open</span>

                  <strong>{summary?.unacknowledgedWarnings ?? 0}</strong>
                </article>

                <article>
                  <span>Critical</span>

                  <strong>{summary?.criticalWarnings ?? 0}</strong>
                </article>

                <article>
                  <span>High</span>

                  <strong>{summary?.highWarnings ?? 0}</strong>
                </article>
              </div>

              <div className="executive-model-note">
                <FileWarning size={17} />

                <p>
                  Early-warning signals are deterministic and explainable. They use
                  current ProcureIQ transaction, workflow and governance data rather
                  than an opaque external model.
                </p>
              </div>
            </section>
          </section>

          <section id="warning-queue" className="page-stack" style={{ scrollMarginTop: 80 }}>
            <div>
              <span className="eyebrow">Early-warning queue</span>

              <h2>Management warnings</h2>
            </div>

            <div className="kit-filters">
              <div className="kit-toolbar">
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search warnings, references or recommendations"
                  ariaLabel="Search warnings"
                  shortcut
                />

                <SelectField
                  label="Signal"
                  value={signalFilter}
                  onChange={setSignalFilter}
                  options={SIGNAL_OPTIONS}
                />

                <SelectField
                  label="Severity"
                  value={severityFilter}
                  onChange={setSeverityFilter}
                  options={SEVERITY_OPTIONS}
                />

                <SelectField
                  label="Sort by"
                  value={sortBy}
                  onChange={setSortBy}
                  options={SORT_OPTIONS}
                />

                <SegmentedFilter
                  options={ackOptions}
                  value={ack}
                  onChange={setAck}
                  ariaLabel="Filter by acknowledgement"
                />
              </div>

              <FilterChips chips={chips} onClearAll={clearFilters} />
            </div>

            <div className="executive-warning-list">
              {pending ? (
                <>
                  <Skeleton height={150} />
                  <Skeleton height={150} />
                  <Skeleton height={150} />
                </>
              ) : null}

              {data
                ? shown.map((warning) => {
                    const busy = busyKey === warning.warningKey;
                    const note = notes[warning.warningKey] ?? "";

                    return (
                      <article
                        key={warning.warningKey}
                        className={
                          warning.acknowledged
                            ? `executive-warning executive-warning--${warning.severity.toLowerCase()} executive-warning--acknowledged`
                            : `executive-warning executive-warning--${warning.severity.toLowerCase()}`
                        }
                      >
                        <div className="executive-warning-heading">
                          <div>
                            <div className="executive-warning-tags">
                              <StatusBadge value={warning.severity} />

                              <StatusBadge
                                value={warning.signalType}
                                label={readable(warning.signalType)}
                                tone="accent"
                                dot={false}
                              />

                              <StatusBadge
                                value={warning.nature}
                                tone={warning.nature === "OPPORTUNITY" ? "success" : "neutral"}
                                dot={false}
                              />
                            </div>

                            <strong>{warning.title}</strong>

                            <small>
                              {warning.referenceType} ·{" "}
                              {warning.referenceLabel ?? warning.referenceId.slice(0, 10)}
                            </small>
                          </div>

                          <div className="executive-priority-score">
                            <span>Priority</span>

                            <strong>{warning.priorityScore.toFixed(0)}</strong>
                          </div>
                        </div>

                        <p>{warning.details}</p>

                        <div className="executive-warning-meta">
                          {warning.exposureValue !== null ? (
                            <span>
                              Exposure:{" "}
                              <strong>
                                {warning.currency
                                  ? formatMoney(warning.exposureValue, warning.currency)
                                  : warning.exposureValue.toFixed(2)}
                              </strong>
                            </span>
                          ) : null}

                          {warning.metricValue !== null ? (
                            <span>
                              Metric: <strong>{warning.metricValue.toFixed(2)}</strong>
                            </span>
                          ) : null}

                          {warning.dueAt ? (
                            <span>
                              Date: <strong>{formatDate(warning.dueAt)}</strong>
                            </span>
                          ) : null}
                        </div>

                        <div className="executive-warning-recommendation">
                          <Lightbulb size={14} />

                          <span>{warning.recommendation}</span>
                        </div>

                        {warning.acknowledged ? (
                          <div className="executive-acknowledged">
                            <BadgeCheck size={15} />

                            <div>
                              <strong>Acknowledged</strong>

                              <span>
                                {warning.acknowledgementNote}
                                {warning.acknowledgedByName
                                  ? ` — ${warning.acknowledgedByName}`
                                  : ""}
                              </span>
                            </div>

                            {canAcknowledge ? (
                              <button
                                type="button"
                                disabled={busyKey !== null}
                                onClick={() => void reopen(warning)}
                              >
                                {busy ? "Reopening…" : "Reopen"}
                              </button>
                            ) : null}
                          </div>
                        ) : canAcknowledge ? (
                          <div className="executive-warning-controls">
                            <input
                              value={note}
                              aria-label="Acknowledgement note"
                              placeholder="Management acknowledgement / owner action"
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [warning.warningKey]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void acknowledge(warning);
                                }
                              }}
                            />

                            <button
                              type="button"
                              disabled={busyKey !== null || !note.trim()}
                              onClick={() => void acknowledge(warning)}
                            >
                              <BadgeCheck size={14} />
                              {busy ? "Saving…" : "Acknowledge"}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                : null}

              {data && filtered.length === 0 ? queueEmpty : null}
            </div>

            {filtered.length > shown.length ? (
              <div className="kit-load-more">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    setExpanded({ key: filterKey, extra: extra + PAGE_SIZE })
                  }
                >
                  Show more ({filtered.length - shown.length} remaining)
                </button>
              </div>
            ) : null}
          </section>

          {canConfigure ? (
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">Early-warning governance</span>

                  <h2>Rule configuration</h2>
                </div>

                <Settings2 size={19} />
              </div>

              <DataTable
                columns={ruleColumns}
                rows={rules}
                getRowId={(rule) => String(rule.id)}
                ariaLabel="Early-warning rules"
                loading={pending}
                busy={fetching}
                empty={
                  <EmptyState
                    icon={Settings2}
                    title="No early-warning rules"
                    description="Rules are provisioned with the platform."
                  />
                }
                persistKey="executive-rules"
              />
            </section>
          ) : null}
        </>
      )}

      {editingRule ? (
        <RuleModal
          key={String(editingRule.id)}
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={handleRuleSaved}
        />
      ) : null}
    </div>
  );
}
