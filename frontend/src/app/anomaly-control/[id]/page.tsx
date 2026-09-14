"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  FilePlus2,
  FileWarning,
  Play,
  SearchCheck,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  addAnomalyInvestigationEvidence,
  cancelAnomalyInvestigation,
  closeAnomalyInvestigation,
  createAnomalyInvestigation,
  getAnomalyControlContext,
  getAnomalyControlFinding,
  startAnomalyInvestigation,
} from "@/lib/api";

import type {
  AnomalyContext,
  AnomalyFindingDetail,
  Investigation,
  InvestigationDisposition,
  InvestigationEvidenceType,
  InvestigationPriority,
} from "@/types/anomaly-control";

function readable(
  value: string,
): string {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase(),
    );
}

function defaultDueDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 14,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export default function AnomalyFindingPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
  } = useAuth();

  const [
    detail,
    setDetail,
  ] =
    useState<
      AnomalyFindingDetail |
      null
    >(null);

  const [
    context,
    setContext,
  ] =
    useState<
      AnomalyContext |
      null
    >(null);

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState<InvestigationPriority>(
      "HIGH",
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      defaultDueDate(),
    );

  const [
    evidenceTypes,
    setEvidenceTypes,
  ] =
    useState<
      Record<
        string,
        InvestigationEvidenceType
      >
    >({});

  const [
    evidenceTexts,
    setEvidenceTexts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    closeDisposition,
    setCloseDisposition,
  ] =
    useState<
      Record<
        string,
        InvestigationDisposition
      >
    >({});

  const [
    closeNotes,
    setCloseNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canInvestigate =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  const canDispose =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getAnomalyControlFinding(
        params.id,
      ),
      getAnomalyControlContext(),
    ])
      .then(
        ([
          findingResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setDetail(
            findingResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (owner) {
            setOwnerUserId(
              owner.id,
            );
          }

          setError(null);
        },
      )
      .catch(
        caughtError => {
          if (!active) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load anomaly finding.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(false);
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    params.id,
  ]);

  async function reload() {
    setDetail(
      await getAnomalyControlFinding(
        params.id,
      ),
    );
  }

  async function createInvestigation(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      await createAnomalyInvestigation(
        params.id,
        {
          ownerUserId:
            ownerUserId
            ||
            undefined,
          priority,
          dueDate,
        },
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create investigation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function startInvestigation(
    investigation:
      Investigation,
  ) {
    try {
      setRunning(true);
      setError(null);

      await startAnomalyInvestigation(
        investigation.id,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to start investigation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function addEvidence(
    investigation:
      Investigation,
  ) {
    const referenceText =
      evidenceTexts[
        investigation.id
      ]
      ??
      "";

    const evidenceType =
      evidenceTypes[
        investigation.id
      ]
      ??
      "NOTE";

    if (!referenceText.trim()) {
      setError(
        "Investigation evidence text is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await addAnomalyInvestigationEvidence(
        investigation.id,
        {
          evidenceType,
          referenceText,
        },
      );

      setEvidenceTexts(
        current => ({
          ...current,
          [investigation.id]:
            "",
        }),
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to add investigation evidence.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function closeInvestigation(
    investigation:
      Investigation,
  ) {
    const note =
      closeNotes[
        investigation.id
      ]
      ??
      "";

    const disposition =
      closeDisposition[
        investigation.id
      ]
      ??
      "RESOLVED";

    if (!note.trim()) {
      setError(
        "Investigation conclusion is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await closeAnomalyInvestigation(
        investigation.id,
        {
          disposition,
          note,
        },
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to close investigation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function cancelInvestigation(
    investigation:
      Investigation,
  ) {
    const note =
      closeNotes[
        investigation.id
      ]
      ??
      "";

    if (!note.trim()) {
      setError(
        "Cancellation rationale is required.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await cancelAnomalyInvestigation(
        investigation.id,
        note,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to cancel investigation.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading anomaly finding...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/anomaly-control"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Anomaly control
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Anomaly finding not found."}
        </div>
      </div>
    );
  }

  const {
    finding,
    investigations,
  } = detail;

  const activeInvestigation =
    investigations.find(
      investigation =>
        investigation.status ===
          "OPEN"
        ||
        investigation.status ===
          "IN_PROGRESS",
    );

  return (
    <div className="page-stack">
      <Link
        href="/anomaly-control"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Anomaly control
      </Link>

      <section className="anomaly-detail-heading">
        <div>
          <div className="request-detail-heading__meta">
            <span>
              {finding.ruleCode}
            </span>

            <span
              className={
                `anomaly-severity anomaly-severity--${finding.severity.toLowerCase()}`
              }
            >
              {finding.severity}
            </span>

            <span
              className={
                `anomaly-status anomaly-status--${finding.status.toLowerCase().replaceAll("_", "-")}`
              }
            >
              {readable(
                finding.status,
              )}
            </span>
          </div>

          <h1>
            {finding.ruleTitle}
          </h1>

          <p>
            {readable(
              finding.signalType,
            )}
            {" · "}
            {finding.entityReference ??
              finding.entityId}
          </p>
        </div>

        <div className="anomaly-score-card">
          <span>
            Anomaly score
          </span>

          <strong>
            {finding.anomalyScore.toFixed(
              0,
            )}
          </strong>
        </div>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="anomaly-detail-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Control evidence
              </span>

              <h2>
                Detection details
              </h2>
            </div>

            <SearchCheck
              size={19}
            />
          </div>

          <div className="anomaly-evidence-grid">
            <div>
              <span>
                Entity type
              </span>

              <strong>
                {readable(
                  finding.entityType,
                )}
              </strong>
            </div>

            <div>
              <span>
                Reference
              </span>

              <strong>
                {finding.entityReference ??
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                Metric
              </span>

              <strong>
                {finding.metricValue !==
                null
                  ? finding.metricValue.toFixed(
                      2,
                    )
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                Exposure
              </span>

              <strong>
                {finding.exposureValue !==
                null
                  ? finding.currency
                    ? money(
                        finding.exposureValue,
                        finding.currency,
                      )
                    : finding.exposureValue.toFixed(
                        2,
                      )
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                First detected
              </span>

              <strong>
                {new Date(
                  finding.detectedAt,
                )
                  .toLocaleString()}
              </strong>
            </div>

            <div>
              <span>
                Last detected
              </span>

              <strong>
                {new Date(
                  finding.lastSeenAt,
                )
                  .toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="anomaly-details-text">
            {finding.details}
          </div>

          <div className="anomaly-not-proof">
            <ShieldAlert
              size={15}
            />

            <span>
              This anomaly is a control
              indicator, not a conclusion
              of fraud or misconduct.
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Disposition
              </span>

              <h2>
                Control status
              </h2>
            </div>

            <FileWarning
              size={19}
            />
          </div>

          <div className="anomaly-disposition-card">
            <span>
              {readable(
                finding.status,
              )}
            </span>

            {finding.dispositionNote ? (
              <>
                <strong>
                  {finding.dispositionNote}
                </strong>

                <small>
                  {finding.disposedByName ??
                    "Automated control engine"}
                  {finding.disposedAt
                    ? ` · ${new Date(
                        finding.disposedAt,
                      ).toLocaleString()}`
                    : ""}
                </small>
              </>
            ) : (
              <p>
                The finding remains open
                until automatically
                resolved by a future scan
                or explicitly investigated
                and disposed.
              </p>
            )}
          </div>
        </section>
      </section>

      {canInvestigate &&
      finding.status ===
        "OPEN" &&
      !activeInvestigation ? (
        <form
          className="panel"
          onSubmit={createInvestigation}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Investigation workflow
              </span>

              <h2>
                Open investigation
              </h2>
            </div>

            <FilePlus2
              size={19}
            />
          </div>

          <div className="anomaly-investigation-form">
            <label className="request-field">
              <span>
                Owner
              </span>

              <select
                value={ownerUserId}
                onChange={
                  event =>
                    setOwnerUserId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.users
                  .filter(
                    candidate =>
                      candidate.role !==
                      "REQUESTER",
                  )
                  .map(
                    candidate => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.fullName}
                        {" — "}
                        {candidate.role}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Priority
              </span>

              <select
                value={priority}
                onChange={
                  event =>
                    setPriority(
                      event.target.value as
                        InvestigationPriority,
                    )
                }
              >
                <option value="LOW">
                  Low
                </option>

                <option value="MEDIUM">
                  Medium
                </option>

                <option value="HIGH">
                  High
                </option>

                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Due date
              </span>

              <input
                required
                type="date"
                value={dueDate}
                onChange={
                  event =>
                    setDueDate(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="anomaly-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={running}
            >
              <SearchCheck
                size={16}
              />
              Open investigation
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Case management
            </span>

            <h2>
              Investigations
            </h2>
          </div>

          <SearchCheck
            size={19}
          />
        </div>

        {investigations.length ===
        0 ? (
          <div className="anomaly-empty">
            No investigation has been
            opened for this signal.
          </div>
        ) : (
          <div className="anomaly-investigation-list">
            {investigations.map(
              investigation => (
                <article
                  key={investigation.id}
                  className={
                    investigation.overdue
                      ? "anomaly-investigation anomaly-investigation--overdue"
                      : "anomaly-investigation"
                  }
                >
                  <div className="anomaly-investigation-heading">
                    <div>
                      <span
                        className={
                          `anomaly-investigation-status anomaly-investigation-status--${investigation.status.toLowerCase().replaceAll("_", "-")}`
                        }
                      >
                        {readable(
                          investigation.status,
                        )}
                      </span>

                      <strong>
                        {investigation.caseNumber}
                      </strong>

                      <small>
                        Owner:
                        {" "}
                        {investigation.ownerName}
                        {" · Priority: "}
                        {investigation.priority}
                      </small>
                    </div>

                    <div>
                      <span>
                        Due
                      </span>

                      <strong
                        className={
                          investigation.overdue
                            ? "anomaly-overdue"
                            : ""
                        }
                      >
                        {new Date(
                          `${investigation.dueDate}T00:00:00`,
                        )
                          .toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {investigation.conclusion ? (
                    <div className="anomaly-conclusion">
                      {investigation.conclusion}
                    </div>
                  ) : null}

                  <div className="anomaly-evidence-list">
                    {investigation.evidence.map(
                      evidence => (
                        <div
                          key={evidence.id}
                        >
                          <span>
                            {readable(
                              evidence.evidenceType,
                            )}
                          </span>

                          <strong>
                            {evidence.referenceText}
                          </strong>

                          <small>
                            {evidence.addedByName}
                            {" · "}
                            {new Date(
                              evidence.createdAt,
                            )
                              .toLocaleString()}
                          </small>
                        </div>
                      ),
                    )}
                  </div>

                  {canInvestigate &&
                  (
                    investigation.status ===
                      "OPEN"
                    ||
                    investigation.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="anomaly-investigation-controls">
                      {investigation.status ===
                      "OPEN" ? (
                        <button
                          type="button"
                          disabled={running}
                          onClick={
                            () =>
                              void startInvestigation(
                                investigation,
                              )
                          }
                        >
                          <Play
                            size={14}
                          />
                          Start
                        </button>
                      ) : null}

                      <select
                        value={
                          evidenceTypes[
                            investigation.id
                          ]
                          ??
                          "NOTE"
                        }
                        onChange={
                          event =>
                            setEvidenceTypes(
                              current => ({
                                ...current,
                                [investigation.id]:
                                  event.target.value as
                                    InvestigationEvidenceType,
                              }),
                            )
                        }
                      >
                        <option value="NOTE">
                          Note
                        </option>

                        <option value="TRANSACTION_REFERENCE">
                          Transaction reference
                        </option>

                        <option value="DOCUMENT_REFERENCE">
                          Document reference
                        </option>

                        <option value="CONTROL_TEST">
                          Control test
                        </option>
                      </select>

                      <input
                        value={
                          evidenceTexts[
                            investigation.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Investigation evidence"
                        }
                        onChange={
                          event =>
                            setEvidenceTexts(
                              current => ({
                                ...current,
                                [investigation.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          running
                          ||
                          !(
                            evidenceTexts[
                              investigation.id
                            ]
                            ??
                            ""
                          )
                            .trim()
                        }
                        onClick={
                          () =>
                            void addEvidence(
                              investigation,
                            )
                        }
                      >
                        <FilePlus2
                          size={14}
                        />
                        Add evidence
                      </button>
                    </div>
                  ) : null}

                  {canDispose &&
                  (
                    investigation.status ===
                      "OPEN"
                    ||
                    investigation.status ===
                      "IN_PROGRESS"
                  ) ? (
                    <div className="anomaly-disposition-controls">
                      <select
                        value={
                          closeDisposition[
                            investigation.id
                          ]
                          ??
                          "RESOLVED"
                        }
                        onChange={
                          event =>
                            setCloseDisposition(
                              current => ({
                                ...current,
                                [investigation.id]:
                                  event.target.value as
                                    InvestigationDisposition,
                              }),
                            )
                        }
                      >
                        <option value="CONFIRMED">
                          Confirm anomaly
                        </option>

                        <option value="DISMISSED">
                          Dismiss signal
                        </option>

                        <option value="RESOLVED">
                          Resolved control issue
                        </option>
                      </select>

                      <textarea
                        rows={3}
                        value={
                          closeNotes[
                            investigation.id
                          ]
                          ??
                          ""
                        }
                        placeholder={
                          "Investigation conclusion / rationale"
                        }
                        onChange={
                          event =>
                            setCloseNotes(
                              current => ({
                                ...current,
                                [investigation.id]:
                                  event.target.value,
                              }),
                            )
                        }
                      />

                      <div>
                        <button
                          type="button"
                          className="button button--secondary"
                          disabled={
                            running
                            ||
                            !(
                              closeNotes[
                                investigation.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void cancelInvestigation(
                                investigation,
                              )
                          }
                        >
                          <XCircle
                            size={16}
                          />
                          Cancel case
                        </button>

                        <button
                          type="button"
                          className="button button--primary"
                          disabled={
                            running
                            ||
                            !(
                              closeNotes[
                                investigation.id
                              ]
                              ??
                              ""
                            )
                              .trim()
                          }
                          onClick={
                            () =>
                              void closeInvestigation(
                                investigation,
                              )
                          }
                        >
                          <BadgeCheck
                            size={16}
                          />
                          Close & dispose
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section className="anomaly-control-note">
        <AlertTriangle
          size={18}
        />

        <div>
          <strong>
            Governed interpretation
          </strong>

          <p>
            A deterministic anomaly
            score is a prioritization
            signal. Confirmation requires
            an explicit investigation,
            supporting evidence and a
            controlled disposition.
          </p>
        </div>
      </section>
    </div>
  );
}
