"use client";

import {
  ArrowLeft,
  Camera,
  CircleAlert,
} from "lucide-react";

import Link from "next/link";

import {
  getFundingSnapshot,
} from "@/lib/api";

import type {
  FundingSnapshotDetail,
} from "@/types/funding-execution";

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

export default function FundingSnapshotPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const [
    detail,
    setDetail,
  ] =
    useState<
      FundingSnapshotDetail |
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

    getFundingSnapshot(
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
                : "Unable to load funding snapshot.",
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
        Loading funding snapshot...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-stack">
        <Link
          href="/funding-execution"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Funding execution
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Funding snapshot not found."}
        </div>
      </div>
    );
  }

  const snapshot =
    detail.snapshot;

  return (
    <div className="page-stack">
      <Link
        href="/funding-execution"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Funding execution
      </Link>

      <section className="funding-detail-heading">
        <div>
          <span className="eyebrow">
            Immutable funding snapshot
          </span>

          <h1>
            {snapshot.snapshotNumber}
          </h1>

          <p>
            {snapshot.commitmentNumber}
            {" · "}
            {snapshot.initiativeTitle}
          </p>
        </div>

        <Camera
          size={24}
        />
      </section>

      <section className="funding-detail-grid">
        <article>
          <span>
            Authorized
          </span>

          <strong>
            {money(
              snapshot.authorizedCapitalAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article className="funding-score-card">
          <span>
            Committed
          </span>

          <strong>
            {money(
              snapshot.committedCapitalAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Planned
          </span>

          <strong>
            {money(
              snapshot.plannedReleaseAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Released
          </span>

          <strong>
            {money(
              snapshot.releasedAmount,
              snapshot.currency,
            )}
          </strong>
        </article>

        <article>
          <span>
            Release %
          </span>

          <strong>
            {snapshot.releasePct.toFixed(
              1,
            )}
            %
          </strong>
        </article>

        <article>
          <span>
            Remaining
          </span>

          <strong>
            {money(
              snapshot.remainingCommitmentAmount,
              snapshot.currency,
            )}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Frozen release plan
            </span>

            <h2>
              Tranches at capture time
            </h2>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tranche</th>
                <th>Status</th>
                <th>Planned</th>
                <th>Released</th>
                <th>Gates</th>
                <th>Resolved</th>
                <th>Authorizations</th>
              </tr>
            </thead>

            <tbody>
              {detail.items.map(
                item => (
                  <tr
                    key={item.trancheId}
                  >
                    <td>
                      {item.sequenceNo}
                    </td>

                    <td>
                      <div className="request-primary-cell">
                        <strong>
                          {item.title}
                        </strong>

                        <span>
                          {item.trancheNumber}
                        </span>
                      </div>
                    </td>

                    <td>
                      {readable(
                        item.status,
                      )}
                    </td>

                    <td>
                      {money(
                        item.plannedReleaseAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {money(
                        item.releasedAmount,
                        snapshot.currency,
                      )}
                    </td>

                    <td>
                      {item.gateCount}
                    </td>

                    <td>
                      {item.resolvedGateCount}
                    </td>

                    <td>
                      {item.authorizationCount}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="funding-method-note">
        <Camera
          size={18}
        />

        <div>
          <strong>
            Immutable capital-execution evidence
          </strong>

          <p>
            This snapshot freezes capital
            ceilings, commitment, tranche
            state, gate resolution,
            authorization history and
            releases at capture time.
          </p>
        </div>
      </section>
    </div>
  );
}
