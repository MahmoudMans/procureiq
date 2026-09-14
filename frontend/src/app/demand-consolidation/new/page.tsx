"use client";

import {
  ArrowLeft,
  Building2,
  CircleAlert,
  Coins,
  Layers3,
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
} from "next/navigation";

import {
  createDemandConsolidationBundle,
  getDemandConsolidationCandidates,
  getDemandConsolidationContext,
} from "@/lib/api";

import type {
  DemandConsolidationCandidate,
  DemandConsolidationContext,
} from "@/types/demand-consolidation";

function defaultTargetDate(): string {
  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() + 30,
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
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export default function NewDemandBundlePage() {
  const router =
    useRouter();

  const [
    candidates,
    setCandidates,
  ] =
    useState<
      DemandConsolidationCandidate[]
    >([]);

  const [
    context,
    setContext,
  ] =
    useState<
      DemandConsolidationContext |
      null
    >(null);

  const [
    candidateKey,
    setCandidateKey,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    selectedIntakeIds,
    setSelectedIntakeIds,
  ] =
    useState<string[]>(
      [],
    );

  const [
    ownerUserId,
    setOwnerUserId,
  ] =
    useState("");

  const [
    targetSourcingDate,
    setTargetSourcingDate,
  ] =
    useState(
      defaultTargetDate(),
    );

  const [
    rationale,
    setRationale,
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

    Promise.all([
      getDemandConsolidationCandidates(),
      getDemandConsolidationContext(),
    ])
      .then(
        ([
          candidateResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setCandidates(
            candidateResponse,
          );

          setContext(
            contextResponse,
          );

          const owner =
            contextResponse.users.find(
              user =>
                user.role !==
                "REQUESTER",
            );

          if (owner) {
            setOwnerUserId(
              owner.id,
            );
          }

          const firstCandidate =
            candidateResponse[0];

          if (firstCandidate) {
            setCandidateKey(
              firstCandidate.candidateKey,
            );

            setTitle(
              `${firstCandidate.category} consolidated sourcing bundle`,
            );

            setSelectedIntakeIds(
              firstCandidate.intakes.map(
                intake =>
                  intake.id,
              ),
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
              : "Unable to load consolidation candidates.",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const candidate =
    candidates.find(
      item =>
        item.candidateKey ===
        candidateKey,
    )
    ??
    null;

  const selectedIntakes =
    useMemo(
      () =>
        candidate
          ?.intakes
          .filter(
            intake =>
              selectedIntakeIds.includes(
                intake.id,
              ),
          )
          ??
        [],
      [
        candidate,
        selectedIntakeIds,
      ],
    );

  const selectedDepartments =
    useMemo(
      () =>
        new Set(
          selectedIntakes.map(
            intake =>
              intake.departmentId,
          ),
        )
          .size,
      [
        selectedIntakes,
      ],
    );

  const selectedValue =
    useMemo(
      () =>
        selectedIntakes.reduce(
          (
            total,
            intake,
          ) =>
            total +
            intake.estimatedAmount,
          0,
        ),
      [
        selectedIntakes,
      ],
    );

  function chooseCandidate(
    key: string,
  ) {
    setCandidateKey(
      key,
    );

    const selected =
      candidates.find(
        item =>
          item.candidateKey ===
          key,
      );

    if (!selected) {
      setSelectedIntakeIds(
        [],
      );

      return;
    }

    setTitle(
      `${selected.category} consolidated sourcing bundle`,
    );

    setSelectedIntakeIds(
      selected.intakes.map(
        intake =>
          intake.id,
      ),
    );
  }

  function toggleIntake(
    intakeId: string,
  ) {
    setSelectedIntakeIds(
      current =>
        current.includes(
          intakeId,
        )
          ? current.filter(
              id =>
                id !==
                intakeId,
            )
          : [
              ...current,
              intakeId,
            ],
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!candidate) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const bundle =
        await createDemandConsolidationBundle({
          title:
            title.trim(),
          category:
            candidate.category,
          currency:
            candidate.currency,
          intakeIds:
            selectedIntakeIds,
          ownerUserId:
            ownerUserId
            ||
            undefined,
          targetSourcingDate,
          rationale:
            rationale.trim()
            ||
            undefined,
        });

      router.push(
        `/demand-consolidation/${bundle.id}`,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create demand-consolidation bundle.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <Link
        href="/demand-consolidation"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Demand consolidation
      </Link>

      <section className="page-heading">
        <div>
          <span className="eyebrow">
            Strategic sourcing
          </span>

          <h1>
            Build demand bundle
          </h1>

          <p>
            Select a detected
            cross-department demand
            group, choose the intakes to
            consolidate and prepare it
            for sourcing governance.
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

      {candidates.length ===
      0 ? (
        <section className="panel">
          <div className="demand-empty">
            There are currently no
            eligible demand groups with
            at least two intakes across
            two departments.
          </div>
        </section>
      ) : (
        <form
          className="demand-create-layout"
          onSubmit={handleSubmit}
        >
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">
                  Consolidation scope
                </span>

                <h2>
                  Candidate demand
                </h2>
              </div>

              <Layers3
                size={19}
              />
            </div>

            <div className="demand-form-grid">
              <label className="request-field demand-form-wide">
                <span>
                  Consolidation group
                </span>

                <select
                  value={candidateKey}
                  onChange={
                    event =>
                      chooseCandidate(
                        event.target.value,
                      )
                  }
                >
                  {candidates.map(
                    item => (
                      <option
                        key={
                          item.candidateKey
                        }
                        value={
                          item.candidateKey
                        }
                      >
                        {item.category}
                        {" — "}
                        {item.currency}
                        {" — "}
                        {item.departmentCount}
                        {" departments — "}
                        {item.intakeCount}
                        {" intakes"}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="request-field demand-form-wide">
                <span>
                  Bundle title
                </span>

                <input
                  required
                  maxLength={220}
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
                  Bundle owner
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
                      user =>
                        user.role !==
                        "REQUESTER",
                    )
                    .map(
                      user => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.fullName}
                          {" — "}
                          {user.role}
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label className="request-field">
                <span>
                  Target sourcing date
                </span>

                <input
                  required
                  type="date"
                  value={
                    targetSourcingDate
                  }
                  onChange={
                    event =>
                      setTargetSourcingDate(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label className="request-field demand-form-wide">
                <span>
                  Consolidation rationale
                </span>

                <textarea
                  rows={4}
                  maxLength={3000}
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

            <div className="demand-intake-selection">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Included demand
                  </span>

                  <h2>
                    Select intakes
                  </h2>
                </div>
              </div>

              {candidate
                ?.intakes
                .map(
                  intake => (
                    <label
                      key={intake.id}
                      className={
                        selectedIntakeIds.includes(
                          intake.id,
                        )
                          ? "demand-intake-option demand-intake-option--selected"
                          : "demand-intake-option"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedIntakeIds.includes(
                            intake.id,
                          )
                        }
                        onChange={
                          () =>
                            toggleIntake(
                              intake.id,
                            )
                        }
                      />

                      <div>
                        <strong>
                          {intake.intakeNumber}
                          {" · "}
                          {intake.title}
                        </strong>

                        <span>
                          {intake.departmentName}
                          {" · "}
                          {money(
                            intake.estimatedAmount,
                            intake.currency,
                          )}
                        </span>
                      </div>
                    </label>
                  ),
                )}
            </div>

            <div className="demand-form-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saving
                  ||
                  selectedIntakeIds.length <
                    2
                  ||
                  selectedDepartments <
                    2
                  ||
                  !title.trim()
                }
              >
                <Layers3
                  size={16}
                />

                {saving
                  ? "Building..."
                  : "Create bundle"}
              </button>
            </div>
          </section>

          <aside className="demand-create-side">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Bundle economics
                  </span>

                  <h2>
                    Leverage preview
                  </h2>
                </div>

                <Coins
                  size={19}
                />
              </div>

              <div className="demand-preview-grid">
                <div>
                  <span>
                    Selected demand
                  </span>

                  <strong>
                    {candidate
                      ? money(
                          selectedValue,
                          candidate.currency,
                        )
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Intakes
                  </span>

                  <strong>
                    {selectedIntakes.length}
                  </strong>
                </div>

                <div>
                  <span>
                    Departments
                  </span>

                  <strong>
                    {selectedDepartments}
                  </strong>
                </div>

                <div>
                  <span>
                    Candidate leverage
                  </span>

                  <strong>
                    {candidate
                      ? `${candidate.expectedLeveragePct.toFixed(1)}%`
                      : "—"}
                  </strong>
                </div>

                <div className="demand-preview-wide">
                  <span>
                    Candidate expected savings
                  </span>

                  <strong className="demand-preview-savings">
                    {candidate
                      ? money(
                          candidate.expectedSavings,
                          candidate.currency,
                        )
                      : "—"}
                  </strong>
                </div>
              </div>

              <p className="demand-preview-note">
                The final leverage and
                expected savings are
                recalculated by the
                backend from the selected
                intakes when the bundle
                is created.
              </p>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <span className="eyebrow">
                    Participation
                  </span>

                  <h2>
                    Departments
                  </h2>
                </div>

                <Building2
                  size={19}
                />
              </div>

              <div className="demand-department-list">
                {Array.from(
                  new Set(
                    selectedIntakes.map(
                      intake =>
                        intake.departmentName,
                    ),
                  ),
                )
                  .map(
                    department => (
                      <span
                        key={department}
                      >
                        {department}
                      </span>
                    ),
                  )}
              </div>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
