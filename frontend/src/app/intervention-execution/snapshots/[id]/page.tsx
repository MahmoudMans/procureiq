"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getInterventionExecutionSnapshot,
} from "@/lib/api";

import type {
  InterventionExecutionSnapshotDetail,
} from "@/types/intervention-execution";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

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

function money(
  value: number,
  currency = "",
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}${currency ? ` ${currency}` : ""}`;
}

export default function InterventionExecutionSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      InterventionExecutionSnapshotDetail |
      null
    >(null);

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

  useEffect(() => {
    let active = true;

    getInterventionExecutionSnapshot(
      params.id,
    )
      .then(
        response => {
          if (active) {
            setDetail(
              response,
            );
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
                : "Unable to load execution snapshot.",
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
  ]);

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading execution snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/intervention-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Intervention execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Execution snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/intervention-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Intervention execution
      </Link>

      <section className="execution-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable implementation portfolio
          </span>

          <h1>
            {detail.snapshot.snapshotNumber}
          </h1>

          <p>
            Captured by
            {" "}
            {detail.snapshot.capturedByName}
            {" · "}
            {new Date(
              detail.snapshot.capturedAt,
            )
              .toLocaleString()}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="execution-score-grid">
        <article>
          <span>
            Cases
          </span>

          <strong>
            {detail.snapshot.caseCount}
          </strong>
        </article>

        <article>
          <span>
            Ready
          </span>

          <strong>
            {detail.snapshot.readyCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Verified
          </span>

          <strong>
            {detail.snapshot.verifiedCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Remediation
          </span>

          <strong>
            {detail.snapshot.remediationCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Implemented
          </span>

          <strong>
            {money(
              detail.snapshot.totalImplementedCapitalAmount,
            )}
          </strong>
        </article>

        <article className="execution-score-card">
          <span>
            Average completion
          </span>

          <strong>
            {detail.snapshot.averageImplementationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen implementation state
            </span>

            <h2>
              Approved vs implemented
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Health</th>
                <th>Action</th>
                <th>Approved</th>
                <th>Implemented</th>
                <th>Remaining</th>
                <th>%</th>
                <th>Variance</th>
                <th>Current released</th>
                <th>Current remaining</th>
                <th>Target</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.executionCaseId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.executionNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.caseStatus,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.executionHealth,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.approvedAction,
                      )}
                    </td>

                    <td>
                      {money(
                        item.approvedAffectedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.implementedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.remainingImplementationAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.implementationPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.implementationVarianceAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.currentReleasedCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.currentRemainingCommitmentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.approvedTargetValueCaseNumber ??
                        "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="execution-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable execution reconciliation evidence
          </strong>

          <p>
            This snapshot freezes approved
            intervention amounts,
            documented implementation,
            variance and current source
            funding state without changing
            any Step 57–60 historical
            authority.
          </p>
        </div>
      </section>
    </div>
  );
}
