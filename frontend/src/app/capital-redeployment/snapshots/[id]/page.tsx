"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getCapitalRedeploymentSnapshot,
} from "@/lib/api";

import type {
  CapitalRedeploymentSnapshotDetail,
} from "@/types/capital-redeployment";

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

export default function CapitalRedeploymentSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapitalRedeploymentSnapshotDetail |
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

    getCapitalRedeploymentSnapshot(
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
                : "Unable to load redeployment snapshot.",
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
        Loading redeployment snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-redeployment"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital redeployment
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-redeployment snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/capital-redeployment"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital redeployment
      </Link>

      <section className="redeployment-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable redeployment portfolio
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

      <section className="redeployment-score-grid">
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
            Authorization queue
          </span>

          <strong>
            {detail.snapshot.authorizationPendingCaseCount}
          </strong>
        </article>

        <article>
          <span>
            Active
          </span>

          <strong>
            {detail.snapshot.activeCaseCount}
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
            Released
          </span>

          <strong>
            {money(
              detail.snapshot.totalReleasedRedeploymentAmount,
            )}
          </strong>
        </article>

        <article className="redeployment-score-card">
          <span>
            Average completion
          </span>

          <strong>
            {detail.snapshot.averageRedeploymentPct.toFixed(
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
              Frozen redeployment state
            </span>

            <h2>
              Approved vs released capital
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
                <th>Target</th>
                <th>Approved</th>
                <th>Released</th>
                <th>Remaining</th>
                <th>%</th>
                <th>Variance</th>
                <th>Source funding remaining</th>
                <th>Gates</th>
                <th>Authorizations</th>
                <th>Releases</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.redeploymentCaseId}
                  >
                    <td>
                      <strong>
                        {item.redeploymentNumber}
                      </strong>
                    </td>

                    <td>
                      {readable(
                        item.caseStatus,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.redeploymentHealth,
                      )}
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.targetInitiativeTitle}
                        </strong>

                        <span>
                          {item.targetValueCaseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {money(
                        item.approvedRedeploymentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.releasedRedeploymentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.remainingRedeploymentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.redeploymentPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.redeploymentVarianceAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.currentSourceFundingRemainingAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.resolvedGateCount}
                      {" / "}
                      {item.gateCount}
                    </td>

                    <td>
                      {item.authorizationCount}
                    </td>

                    <td>
                      {item.releaseCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="redeployment-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable redeployment evidence
          </strong>

          <p>
            This snapshot freezes approved
            recycled capital, actual
            redeployment, remaining
            authority, release controls and
            source-capital safety context
            without mutating Steps 56–62.
          </p>
        </div>
      </section>
    </div>
  );
}
