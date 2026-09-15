"use client";

import {
  ArrowLeft,
  CircleAlert,
  Link2,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createStrategicAlignmentLink,
  deleteStrategicAlignmentLink,
  getObjectiveAlignment,
} from "@/lib/api";

import type {
  AlignmentRole,
  AlignmentSourceType,
  ObjectiveAlignmentDetail,
} from "@/types/strategic-alignment";

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

export default function ObjectiveAlignmentPage() {
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
      ObjectiveAlignmentDetail |
      null
    >(null);

  const [
    sourceType,
    setSourceType,
  ] =
    useState<AlignmentSourceType>(
      "CATEGORY_INITIATIVE",
    );

  const [
    sourceEntityId,
    setSourceEntityId,
  ] =
    useState("");

  const [
    role,
    setRole,
  ] =
    useState<AlignmentRole>(
      "PRIMARY",
    );

  const [
    allocation,
    setAllocation,
  ] =
    useState(100);

  const [
    rationale,
    setRationale,
  ] =
    useState("");

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(null);

  const canManage =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER"
    ||
    user?.role ===
      "BUYER";

  useEffect(() => {
    let active = true;

    getObjectiveAlignment(
      params.id,
    )
      .then(
        response => {
          if (active) {
            setDetail(
              response,
            );

            const first =
              response
                .candidateSources
                .find(
                  source =>
                    source.sourceType ===
                      sourceType,
                );

            if (first) {
              setSourceEntityId(
                first.sourceEntityId,
              );
            }
          }
        },
      )
      .catch(
        caughtError => {
          if (active) {
            setError(
              caughtError instanceof
                Error
                ? caughtError.message
                : "Unable to load objective alignment.",
            );
          }
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
    sourceType,
  ]);

  const candidates =
    useMemo(
      () =>
        detail
          ?.candidateSources
          .filter(
            source =>
              source.sourceType ===
                sourceType,
          )
          .filter(
            source =>
              !detail.links.some(
                link =>
                  link.sourceType ===
                    source.sourceType
                  &&
                  link.sourceEntityId ===
                    source.sourceEntityId,
              ),
          )
        ??
        [],
      [
        detail,
        sourceType,
      ],
    );

  async function reload() {
    setDetail(
      await getObjectiveAlignment(
        params.id,
      ),
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !sourceEntityId
      ||
      !rationale.trim()
    ) {
      setError(
        "Select a work item and provide an alignment rationale.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await createStrategicAlignmentLink(
        params.id,
        {
          sourceType,
          sourceEntityId,
          alignmentRole:
            role,
          allocationPct:
            allocation,
          rationale:
            rationale.trim(),
        },
      );

      setRationale("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create strategic alignment.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function remove(
    linkId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await deleteStrategicAlignmentLink(
        linkId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove strategic alignment.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading objective alignment...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/strategic-alignment"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Strategic alignment
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Objective alignment not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/strategic-alignment"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Strategic alignment
      </Link>

      <section className="alignment-detail-heading">
        <div>
          <span className="eyebrow">
            Objective execution map
          </span>

          <h1>
            {detail.objective.title}
          </h1>

          <p>
            {detail.objective.objectiveNumber}
            {" · "}
            {detail.objective.ownerName}
            {" · OKR "}
            {detail.objective.okrProgressPct.toFixed(
              1,
            )}
            %
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

      <section className="alignment-objective-kpis">
        <article>
          <span>
            Linked work
          </span>

          <strong>
            {detail.objective.linkedSourceCount}
          </strong>
        </article>

        <article>
          <span>
            OKR progress
          </span>

          <strong>
            {detail.objective.okrProgressPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            OKR health
          </span>

          <strong>
            {readable(
              detail.objective.okrHealth,
            )}
          </strong>
        </article>

        <article>
          <span>
            Deadline conflicts
          </span>

          <strong
            className={
              detail.objective.deadlineConflictCount >
              0
                ? "alignment-risk-text"
                : ""
            }
          >
            {detail.objective.deadlineConflictCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Existing commitments
            </span>

            <h2>
              Linked strategic work
            </h2>
          </div>

          <Link2
            size={19}
          />
        </div>

        <div className="alignment-link-list">
          {detail.links.map(
            link => (
              <article
                key={link.id}
              >
                <div>
                  <span>
                    {readable(
                      link.alignmentRole,
                    )}
                  </span>

                  <strong>
                    {link.sourceTitle}
                  </strong>

                  <small>
                    {link.sourceReference}
                    {" · "}
                    {readable(
                      link.sourceType,
                    )}
                    {" · "}
                    {link.allocationPct.toFixed(
                      0,
                    )}
                    %
                  </small>
                </div>

                <p>
                  {link.rationale}
                </p>

                {canManage ? (
                  <button
                    type="button"
                    className="alignment-danger-button"
                    disabled={running}
                    onClick={
                      () =>
                        void remove(
                          link.id,
                        )
                    }
                  >
                    <Trash2
                      size={13}
                    />
                    Remove
                  </button>
                ) : null}
              </article>
            ),
          )}

          {detail.links.length ===
          0 ? (
            <div className="alignment-empty">
              No strategic work has been
              linked to this objective.
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={submit}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Strategy-to-execution link
              </span>

              <h2>
                Align work item
              </h2>
            </div>

            <Link2
              size={19}
            />
          </div>

          <div className="alignment-form-grid">
            <label className="request-field">
              <span>
                Source type
              </span>

              <select
                value={sourceType}
                onChange={
                  event => {
                    const value =
                      event.target.value as
                        AlignmentSourceType;

                    setSourceType(
                      value,
                    );

                    setSourceEntityId("");
                  }
                }
              >
                <option value="CATEGORY_INITIATIVE">
                  Category / sourcing initiative
                </option>

                <option value="IMPROVEMENT_INITIATIVE">
                  Improvement initiative
                </option>

                <option value="EXECUTION_PORTFOLIO">
                  Benefits execution portfolio
                </option>

                <option value="RISK_ESCALATION">
                  Supplier-risk escalation
                </option>
              </select>
            </label>

            <label className="request-field alignment-form-wide">
              <span>
                Work item
              </span>

              <select
                required
                value={sourceEntityId}
                onChange={
                  event =>
                    setSourceEntityId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select work item
                </option>

                {candidates.map(
                  source => (
                    <option
                      key={source.sourceEntityId}
                      value={source.sourceEntityId}
                    >
                      {source.sourceReference}
                      {" — "}
                      {source.sourceTitle}
                      {" · "}
                      {source.directAllocationPct.toFixed(
                        0,
                      )}
                      % already allocated
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Alignment role
              </span>

              <select
                value={role}
                onChange={
                  event =>
                    setRole(
                      event.target.value as
                        AlignmentRole,
                    )
                }
              >
                <option value="PRIMARY">
                  Primary
                </option>

                <option value="ENABLER">
                  Enabler
                </option>

                <option value="VALUE_DELIVERY">
                  Value delivery
                </option>

                <option value="RISK_MITIGATION">
                  Risk mitigation
                </option>
              </select>
            </label>

            <label className="request-field">
              <span>
                Allocation %
              </span>

              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={allocation}
                onChange={
                  event =>
                    setAllocation(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field alignment-form-wide">
              <span>
                Strategic rationale
              </span>

              <textarea
                required
                rows={5}
                value={rationale}
                onChange={
                  event =>
                    setRationale(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="alignment-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !sourceEntityId
                ||
                !rationale.trim()
              }
            >
              Align work item
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
