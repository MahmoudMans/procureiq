"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getCapitalAllocationSnapshot,
} from "@/lib/api";

import type {
  CapitalAllocationSnapshotDetail,
} from "@/types/capital-allocation";

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
  currency: string,
): string {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${currency}`;
}

export default function CapitalAllocationSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapitalAllocationSnapshotDetail |
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

    getCapitalAllocationSnapshot(
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
                : "Unable to load allocation snapshot.",
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
        Loading allocation snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-allocation"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital allocation
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Allocation snapshot not found."}
        </div>
      </div>
    );
  }

  const snapshot =
    detail.snapshot;

  return (
    <div className="page-stack">
      <Link
        href="/capital-allocation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital allocation
      </Link>

      <section className="allocation-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable investment-committee snapshot
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.cycleNumber}
            {" · "}
            {snapshot.cycleTitle}
            {" · "}
            {snapshot.currency}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="allocation-detail-grid">
        <article className="allocation-budget-card">
          <span>
            Budget
          </span>

          <strong>
            {money(
              snapshot.budgetAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Funded
          </span>

          <strong>
            {money(
              snapshot.fundedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              snapshot.remainingBudgetAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Utilization
          </span>

          <strong>
            {snapshot.budgetUtilizationPct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Funded net value
          </span>

          <strong>
            {money(
              snapshot.fundedNetValueAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Opportunity cost
          </span>

          <strong>
            {money(
              snapshot.opportunityCostAmount,
              snapshot.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen committee portfolio
            </span>

            <h2>
              Investment decisions at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Request</th>
                <th>Priority</th>
                <th>Advisory</th>
                <th>Decision</th>
                <th>ROI</th>
                <th>Persistence</th>
                <th>Net value</th>
                <th>Rationale</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                (
                  item,
                  index,
                ) => (
                  <tr
                    key={item.allocationItemId}
                  >
                    <td>
                      {index + 1}
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.initiativeTitle}
                        </strong>

                        <span>
                          {item.caseNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {money(
                        item.requestedCapitalAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {item.priorityScore.toFixed(
                        1,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.recommendation,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.decision,
                      )}
                    </td>

                    <td>
                      {item.roiPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {item.persistencePct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.netValueAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {item.decisionNote ??
                        "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="allocation-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable investment-committee evidence
          </strong>

          <p>
            This snapshot freezes the
            governed budget, ranking,
            recommendations, explicit
            committee decisions and
            opportunity-cost proxy as they
            existed at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
