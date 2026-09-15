"use client";

import {
  ArrowLeft,
  BrainCircuit,
  CircleAlert,
  Plus,
  Trash2,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useSearchParams,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createWorkCapabilityRequirement,
  deleteWorkCapabilityRequirement,
  getCapabilityPlanningDashboard,
  getCapabilityWorkItem,
} from "@/lib/api";

import type {
  CapabilityPlanningDashboard,
  CapabilitySourceType,
  CapabilityWorkItem,
} from "@/types/capability-planning";

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

export default function CapabilityWorkPage() {
  const params =
    useParams<{
      sourceType: string;
      sourceEntityId: string;
    }>();

  const searchParams =
    useSearchParams();

  const {
    user,
  } = useAuth();

  const currency =
    (
      searchParams.get(
        "currency",
      )
      ??
      "EUR"
    )
      .toUpperCase();

  const fiscalYear =
    Number(
      searchParams.get(
        "fiscalYear",
      )
      ??
      new Date()
        .getUTCFullYear(),
    );

  const sourceType =
    params.sourceType as
      CapabilitySourceType;

  const [
    item,
    setItem,
  ] =
    useState<
      CapabilityWorkItem |
      null
    >(null);

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      CapabilityPlanningDashboard |
      null
    >(null);

  const [
    skillId,
    setSkillId,
  ] =
    useState("");

  const [
    requiredLevel,
    setRequiredLevel,
  ] =
    useState(3);

  const [
    weight,
    setWeight,
  ] =
    useState(25);

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

    Promise.all([
      getCapabilityWorkItem(
        currency,
        fiscalYear,
        sourceType,
        params.sourceEntityId,
      ),
      getCapabilityPlanningDashboard(
        currency,
        fiscalYear,
      ),
    ])
      .then(
        ([
          work,
          context,
        ]) => {
          if (!active) {
            return;
          }

          setItem(
            work,
          );

          setDashboard(
            context,
          );

          const candidate =
            context.skills.find(
              skill =>
                !work.requirements.some(
                  requirement =>
                    requirement.skillId ===
                      skill.id,
                ),
            );

          if (candidate) {
            setSkillId(
              candidate.id,
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
                : "Unable to load capability requirements.",
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
    currency,
    fiscalYear,
    params.sourceEntityId,
    sourceType,
  ]);

  async function reload() {
    setItem(
      await getCapabilityWorkItem(
        currency,
        fiscalYear,
        sourceType,
        params.sourceEntityId,
      ),
    );
  }

  async function addRequirement(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!skillId) {
      setError(
        "Select a skill requirement.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      setItem(
        await createWorkCapabilityRequirement(
          currency,
          fiscalYear,
          sourceType,
          params.sourceEntityId,
          {
            skillId,
            requiredProficiency:
              requiredLevel,
            importanceWeightPct:
              weight,
          },
        ),
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create work capability requirement.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function removeRequirement(
    requirementId: string,
  ) {
    try {
      setRunning(true);
      setError(null);

      await deleteWorkCapabilityRequirement(
        requirementId,
      );

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to remove capability requirement.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="request-detail-loading">
        Loading capability requirements...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-stack">
        <Link
          href="/capability-planning"
          className="request-back-link"
        >
          <ArrowLeft
            size={16}
          />
          Capability planning
        </Link>

        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error ??
            "Capability work item not found."}
        </div>
      </div>
    );
  }

  const availableSkills =
    dashboard
      ?.skills
      .filter(
        skill =>
          !item.requirements.some(
            requirement =>
              requirement.skillId ===
                skill.id,
          ),
      )
    ??
    [];

  return (
    <div className="page-stack">
      <Link
        href="/capability-planning"
        className="request-back-link"
      >
        <ArrowLeft
          size={16}
        />
        Capability planning
      </Link>

      <section className="capability-detail-heading">
        <div>
          <span className="eyebrow">
            Strategic work suitability
          </span>

          <h1>
            {item.sourceTitle}
          </h1>

          <p>
            {item.sourceReference}
            {" · "}
            {readable(
              item.sourceType,
            )}
            {" · "}
            {readable(
              item.sourceStatus,
            )}
          </p>
        </div>

        <span
          className={
            `capability-readiness capability-readiness--${item.readiness.toLowerCase()}`
          }
        >
          {readable(
            item.readiness,
          )}
        </span>
      </section>

      {error ? (
        <div className="error-banner">
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <section className="capability-detail-grid">
        <article>
          <span>
            Requirements
          </span>

          <strong>
            {item.requirementCount}
          </strong>
        </article>

        <article>
          <span>
            Assigned members
          </span>

          <strong>
            {item.assignedMemberCount}
          </strong>
        </article>

        <article>
          <span>
            Assigned fit
          </span>

          <strong>
            {item.requirementCount >
            0
              ? `${item.assignedFitPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Bench fit
          </span>

          <strong>
            {item.requirementCount >
            0
              ? `${item.benchFitPct.toFixed(1)}%`
              : "—"}
          </strong>
        </article>

        <article>
          <span>
            Bench-ready members
          </span>

          <strong>
            {item.benchReadyMemberCount}
          </strong>
        </article>

        <article>
          <span>
            Critical gaps
          </span>

          <strong className="capability-risk-text">
            {item.criticalGapCount}
          </strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              Capability specification
            </span>

            <h2>
              Skill requirements
            </h2>
          </div>

          <BrainCircuit
            size={19}
          />
        </div>

        <div className="capability-requirement-list">
          {item.requirements.map(
            requirement => (
              <article
                key={requirement.id}
              >
                <div>
                  <strong>
                    {requirement.skillCode}
                    {" — "}
                    {requirement.skillName}
                  </strong>

                  <span>
                    {requirement.skillCategory}
                    {" · Required L"}
                    {requirement.requiredProficiency}
                    {" · Weight "}
                    {requirement.importanceWeightPct.toFixed(
                      1,
                    )}
                    %
                  </span>
                </div>

                {canManage ? (
                  <button
                    type="button"
                    className="capability-danger-button"
                    disabled={running}
                    onClick={
                      () =>
                        void removeRequirement(
                          requirement.id,
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

          {item.requirements.length ===
          0 ? (
            <div className="capability-empty">
              No governed skill
              requirements are defined
              for this work item.
            </div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <form
          className="panel"
          onSubmit={addRequirement}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Requirement governance
              </span>

              <h2>
                Add required skill
              </h2>
            </div>

            <Plus
              size={19}
            />
          </div>

          <div className="capability-requirement-form">
            <label className="request-field capability-requirement-wide">
              <span>
                Skill
              </span>

              <select
                value={skillId}
                onChange={
                  event =>
                    setSkillId(
                      event.target.value,
                    )
                }
              >
                <option value="">
                  Select skill
                </option>

                {availableSkills.map(
                  skill => (
                    <option
                      key={skill.id}
                      value={skill.id}
                    >
                      {skill.code}
                      {" — "}
                      {skill.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Required level
              </span>

              <input
                type="number"
                min="1"
                max="5"
                step="1"
                value={requiredLevel}
                onChange={
                  event =>
                    setRequiredLevel(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Importance weight %
              </span>

              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={weight}
                onChange={
                  event =>
                    setWeight(
                      Number(
                        event.target.value,
                      ),
                    )
                }
              />
            </label>
          </div>

          <div className="capability-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !skillId
              }
            >
              Add requirement
            </button>
          </div>
        </form>
      ) : null}

      <section className="capability-method-note">
        <BrainCircuit
          size={18}
        />

        <div>
          <strong>
            Suitability is evidence-based
          </strong>

          <p>
            Assigned fit uses only
            recorded assessments for the
            people currently assigned in
            Step 47. Bench fit uses
            assessed members with
            capacity profiles. Missing
            assessments count as zero;
            skills are never inferred.
          </p>
        </div>
      </section>
    </div>
  );
}
