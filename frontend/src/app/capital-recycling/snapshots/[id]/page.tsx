"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getCapitalRecyclingSnapshot,
} from "@/lib/api";

import type {
  CapitalRecyclingSnapshotDetail,
} from "@/types/capital-recycling";

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

export default function CapitalRecyclingSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      CapitalRecyclingSnapshotDetail |
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

    getCapitalRecyclingSnapshot(
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
                : "Unable to load recycling snapshot.",
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
        Loading recycling snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/capital-recycling"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capital recycling
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capital-recycling snapshot not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <Link
        href="/capital-recycling"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capital recycling
      </Link>

      <section className="recycling-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable recycling portfolio
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

      <section className="recycling-score-grid">
        <article>
          <span>
            Sources
          </span>

          <strong>
            {detail.snapshot.sourceCount}
          </strong>
        </article>

        <article>
          <span>
            Open
          </span>

          <strong>
            {detail.snapshot.openSourceCount}
          </strong>
        </article>

        <article>
          <span>
            Fully allocated
          </span>

          <strong>
            {detail.snapshot.fullyAllocatedSourceCount}
          </strong>
        </article>

        <article>
          <span>
            Recyclable
          </span>

          <strong>
            {money(
              detail.snapshot.totalRecyclableCapitalAmount,
            )}
          </strong>
        </article>

        <article>
          <span>
            Approved
          </span>

          <strong>
            {money(
              detail.snapshot.totalApprovedReinvestmentAmount,
            )}
          </strong>
        </article>

        <article className="recycling-score-card">
          <span>
            Available
          </span>

          <strong>
            {money(
              detail.snapshot.totalAvailableCapitalAmount,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen recycling state
            </span>

            <h2>
              Source utilization at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Action</th>
                <th>Recyclable</th>
                <th>Approved</th>
                <th>Pending</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Funding remaining</th>
                <th>Preferred target</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.recyclingSourceId}
                  >
                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.sourceInitiativeTitle}
                        </strong>

                        <span>
                          {item.sourceNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.sourceStatus,
                      )}
                    </td>

                    <td>
                      {readable(
                        item.sourceAction,
                      )}
                    </td>

                    <td>
                      {money(
                        item.recyclableCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.approvedReinvestmentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.pendingReinvestmentAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.availableCapitalAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.utilizationPct.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {money(
                        item.currentFundingRemainingAmount,
                        item.currency,
                      )}
                    </td>

                    <td>
                      {item.preferredTargetValueCaseNumber ??
                        "—"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="recycling-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable capital-recycling evidence
          </strong>

          <p>
            This snapshot freezes verified
            recyclable capital, approved
            reinvestment, pending
            proposals, available balance
            and current Step 58 funding
            safety context.
          </p>
        </div>
      </section>
    </div>
  );
}
