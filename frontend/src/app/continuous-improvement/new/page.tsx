"use client";

import {
  ArrowLeft,
  CircleAlert,
  Target,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  createImprovementInitiative,
  getContinuousImprovementContext,
} from "@/lib/api";

import type {
  ImprovementContext,
  ImprovementPriority,
  ImprovementScopeType,
} from "@/types/continuous-improvement";

function defaultTargetDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate()
      + 60,
  );

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function NewImprovementInitiativePage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const currency =
    (
      searchParams.get(
        "currency",
      )
      ??
      "EUR"
    )
      .toUpperCase();

  const initialSnapshotId =
    searchParams.get(
      "snapshotId",
    )
    ??
    "";

  const initialScopeType =
    (
      searchParams.get(
        "scopeType",
      )
      ??
      "OVERALL"
    ) as ImprovementScopeType;

  const initialScopeKey =
    searchParams.get(
      "scopeKey",
    )
    ??
    "";

  const [
    context,
    setContext,
  ] =
    useState<
      ImprovementContext |
      null
    >(null);

  const [
    snapshotId,
    setSnapshotId,
  ] =
    useState(
      initialSnapshotId,
    );

  const [
    scopeType,
    setScopeType,
  ] =
    useState<ImprovementScopeType>(
      initialScopeType,
    );

  const [
    scopeKey,
    setScopeKey,
  ] =
    useState(
      initialScopeKey,
    );

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState<ImprovementPriority>(
      "HIGH",
    );

  const [
    targetSla,
    setTargetSla,
  ] =
    useState(90);

  const [
    targetOverdueReduction,
    setTargetOverdueReduction,
  ] =
    useState(30);

  const [
    targetPersistentReduction,
    setTargetPersistentReduction,
  ] =
    useState(30);

  const [
    targetResolutionReduction,
    setTargetResolutionReduction,
  ] =
    useState(20);

  const [
    targetExposureReduction,
    setTargetExposureReduction,
  ] =
    useState(20);

  const [
    targetDate,
    setTargetDate,
  ] =
    useState(
      defaultTargetDate(),
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    saving,
    setSaving,
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

  useEffect(() => {
    let active = true;

    getContinuousImprovementContext(
      currency,
      snapshotId
      ||
      undefined,
    )
      .then(
        response => {
          if (!active) {
            return;
          }

          setContext(
            response,
          );

          if (
            !snapshotId
            &&
            response.selectedSnapshot
          ) {
            setSnapshotId(
              response.selectedSnapshot.id,
            );
          }

          const owner =
            response.users.find(
              candidate =>
                candidate.role !==
                  "REQUESTER",
            );

          if (
            owner
            &&
            !ownerUserId
          ) {
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
              : "Unable to load improvement context.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, [
    currency,
    snapshotId,
    ownerUserId,
  ]);

  const dimensions =
    useMemo(
      () =>
        context
          ?.dimensions
          .filter(
            dimension =>
              dimension.scopeType ===
                scopeType,
          )
        ??
        [],
      [
        context,
        scopeType,
      ],
    );

  const selectedDimension =
    dimensions.find(
      dimension =>
        dimension.scopeKey ===
          scopeKey,
    );

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!snapshotId) {
      setError(
        "A baseline operating snapshot is required.",
      );

      return;
    }

    if (
      scopeType !==
        "OVERALL"
      &&
      !scopeKey
    ) {
      setError(
        "Select a baseline dimension.",
      );

      return;
    }

    try {
      setSaving(true);
      setError(null);

      const result =
        await createImprovementInitiative({
          title:
            title.trim(),
          description:
            description.trim(),
          sourceSnapshotId:
            snapshotId,
          scopeType,
          scopeKey:
            scopeType ===
              "OVERALL"
              ? undefined
              : scopeKey,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          priority,
          targetSlaAttainmentPct:
            targetSla,
          targetSlaOverdueReductionPct:
            targetOverdueReduction,
          targetPersistentReductionPct:
            targetPersistentReduction,
          targetResolutionHoursReductionPct:
            targetResolutionReduction,
          targetExposureReductionPct:
            targetExposureReduction,
          targetDate,
          notes:
            notes.trim()
            ||
            undefined,
        });

      router.push(
        `/continuous-improvement/${result.initiative.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create improvement initiative.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/continuous-improvement"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Continuous improvement
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Governed improvement
          </span>

          <h1>
            New improvement initiative
          </h1>

          <p>
            Freeze an immutable operating
            baseline and define measurable
            targets before corrective work
            begins.
          </p>
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

      <form
        className="panel"
        onSubmit={submit}
      >
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Baseline + target
            </span>

            <h2>
              Initiative definition
            </h2>
          </div>

          <Target
            size={19}
          />
        </div>

        <div className="improvement-form-grid">
          <label className="request-field improvement-form-wide">
            <span>
              Initiative title
            </span>

            <input
              required
              value={title}
              onChange={
                event =>
                  setTitle(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Baseline snapshot
            </span>

            <select
              value={snapshotId}
              onChange={
                event => {
                  setSnapshotId(
                    event.target.value,
                  );

                  setScopeKey("");
                }
              }
            >
              <option value="">
                Select snapshot
              </option>

              {context
                ?.snapshots
                .map(
                  snapshot => (
                    <option
                      key={snapshot.id}
                      value={snapshot.id}
                    >
                      {snapshot.snapshotNumber}
                      {" · "}
                      {snapshot.periodStart}
                      {" → "}
                      {snapshot.periodEnd}
                    </option>
                  ),
                )}
            </select>
          </label>

          <label className="request-field">
            <span>
              Scope
            </span>

            <select
              value={scopeType}
              onChange={
                event => {
                  setScopeType(
                    event.target.value as
                      ImprovementScopeType,
                  );

                  setScopeKey("");
                }
              }
            >
              <option value="OVERALL">
                Overall operations
              </option>

              <option value="DOMAIN">
                Domain
              </option>

              <option value="OWNER">
                Owner
              </option>

              <option value="SEVERITY">
                Severity
              </option>

              <option value="EXCEPTION_TYPE">
                Exception type
              </option>
            </select>
          </label>

          {scopeType !==
          "OVERALL" ? (
            <label className="request-field improvement-form-wide">
              <span>
                Baseline dimension
              </span>

              <select
                required
                value={scopeKey}
                onChange={
                  event =>
                    setScopeKey(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select dimension
                </option>

                {dimensions.map(
                  dimension => (
                    <option
                      key={dimension.scopeKey}
                      value={dimension.scopeKey}
                    >
                      {dimension.scopeLabel}
                      {" · "}
                      {dimension.activeCount}
                      {" active · "}
                      {dimension.slaOverdueCount}
                      {" SLA overdue"}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : null}

          {selectedDimension ? (
            <div className="improvement-baseline-preview improvement-form-wide">
              <span>
                Active
                <strong>
                  {selectedDimension.activeCount}
                </strong>
              </span>

              <span>
                SLA overdue
                <strong>
                  {selectedDimension.slaOverdueCount}
                </strong>
              </span>

              <span>
                Persistent
                <strong>
                  {selectedDimension.persistentCount}
                </strong>
              </span>

              <span>
                SLA attainment
                <strong>
                  {selectedDimension.resolvedCount >
                  0
                    ? `${selectedDimension.slaAttainmentPct.toFixed(1)}%`
                    : "—"}
                </strong>
              </span>

              <span>
                Avg resolution
                <strong>
                  {selectedDimension.avgResolutionHours.toFixed(
                    1,
                  )}
                  h
                </strong>
              </span>
            </div>
          ) : null}

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
                      ImprovementPriority,
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
              Target SLA attainment %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetSla}
              onChange={
                event =>
                  setTargetSla(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              SLA overdue reduction %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetOverdueReduction}
              onChange={
                event =>
                  setTargetOverdueReduction(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Persistent reduction %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetPersistentReduction}
              onChange={
                event =>
                  setTargetPersistentReduction(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Resolution-time reduction %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetResolutionReduction}
              onChange={
                event =>
                  setTargetResolutionReduction(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Exposure reduction %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetExposureReduction}
              onChange={
                event =>
                  setTargetExposureReduction(
                    Number(
                      event.target.value,
                    ),
                  )
              }
            />
          </label>

          <label className="request-field">
            <span>
              Target date
            </span>

            <input
              required
              type="date"
              value={targetDate}
              onChange={
                event =>
                  setTargetDate(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field improvement-form-wide">
            <span>
              Improvement hypothesis / description
            </span>

            <textarea
              required
              rows={6}
              value={description}
              onChange={
                event =>
                  setDescription(
                    event.target.value,
                  )
              }
            />
          </label>

          <label className="request-field improvement-form-wide">
            <span>
              Notes
            </span>

            <textarea
              rows={4}
              value={notes}
              onChange={
                event =>
                  setNotes(
                    event.target.value,
                  )
              }
            />
          </label>
        </div>

        <div className="improvement-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={
              saving
              ||
              !snapshotId
              ||
              !title.trim()
              ||
              !description.trim()
            }
          >
            {saving
              ? "Creating..."
              : "Create initiative"}
          </button>
        </div>
      </form>
    </div>
  );
}
