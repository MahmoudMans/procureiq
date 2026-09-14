"use client";

import {
  Building2,
  CircleAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getDepartments,
  getUsers,
} from "@/lib/api";

import type {
  AuthUser,
  Department,
} from "@/types/auth";

function roleLabel(
  role: AuthUser["role"],
): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";

    case "PROCUREMENT_MANAGER":
      return "Procurement Manager";

    case "BUYER":
      return "Buyer";

    case "REQUESTER":
      return "Requester";

    case "APPROVER":
      return "Approver";
  }
}

function initials(
  fullName: string,
): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      value => value[0],
    )
    .join("")
    .toUpperCase();
}

export default function TeamPage() {
  const {
    user: currentUser,
  } = useAuth();

  const [
    users,
    setUsers,
  ] =
    useState<AuthUser[]>([]);

  const [
    departments,
    setDepartments,
  ] =
    useState<Department[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const allowed =
    currentUser?.role ===
      "ADMIN" ||
    currentUser?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const [
          userResponse,
          departmentResponse,
        ] =
          await Promise.all([
            getUsers(),
            getDepartments(),
          ]);

        if (!mounted) {
          return;
        }

        setUsers(
          userResponse,
        );

        setDepartments(
          departmentResponse,
        );
      } catch (caughtError) {
        if (!mounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load team information.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [allowed]);

  const roleCounts =
    useMemo(() => {
      return users.reduce<
        Record<string, number>
      >(
        (
          accumulator,
          member,
        ) => {
          accumulator[
            member.role
          ] =
            (
              accumulator[
                member.role
              ] ?? 0
            ) + 1;

          return accumulator;
        },
        {},
      );
    }, [users]);

  if (!allowed) {
    return (
      <div className="page-stack">

        <section
          className={
            "page-heading"
          }
        >
          <div>
            <span className="eyebrow">
              Access management
            </span>

            <h1>
              Team & access
            </h1>
          </div>
        </section>

        <div className="error-banner">
          <ShieldCheck
            size={18}
          />

          <span>
            Your current role cannot
            access procurement team
            administration.
          </span>
        </div>

      </div>
    );
  }

  return (
    <div className="page-stack">

      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span className="eyebrow">
            Access management
          </span>

          <h1>
            Team & access
          </h1>

          <p>
            Review ProcureIQ users,
            procurement roles and
            organizational departments.
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

      <section
        className={
          "team-kpi-grid"
        }
      >

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Users size={20} />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Platform users
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {loading
              ? "—"
              : users.length}
          </strong>

          <p>
            Active procurement identities
            configured locally.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <Building2
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Departments
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {loading
              ? "—"
              : departments.length}
          </strong>

          <p>
            Organizational units available
            for procurement workflows.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <ShieldCheck
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Security roles
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            5
          </strong>

          <p>
            Administration, management,
            buyer, requester and approver.
          </p>
        </article>

        <article
          className={
            "kpi-card"
          }
        >
          <div
            className={
              "kpi-card__topline"
            }
          >
            <div
              className={
                "kpi-card__icon"
              }
            >
              <UserCheck
                size={20}
              />
            </div>
          </div>

          <span
            className={
              "kpi-card__label"
            }
          >
            Buying users
          </span>

          <strong
            className={
              "kpi-card__value"
            }
          >
            {
              (
                roleCounts.ADMIN ??
                0
              ) +
              (
                roleCounts
                  .PROCUREMENT_MANAGER ??
                0
              ) +
              (
                roleCounts.BUYER ??
                0
              )
            }
          </strong>

          <p>
            Users authorized to participate
            in supplier management.
          </p>
        </article>

      </section>

      <section className="panel">

        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span className="eyebrow">
              Identity directory
            </span>

            <h2>
              Procurement team
            </h2>
          </div>
        </div>

        <div className="table-scroll">

          <table
            className={
              "data-table team-table"
            }
          >

            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              {users.map(
                member => (
                  <tr
                    key={
                      member.id
                    }
                  >

                    <td>
                      <div
                        className={
                          "supplier-cell"
                        }
                      >

                        <div
                          className={
                            "company-avatar"
                          }
                        >
                          {initials(
                            member
                              .fullName,
                          )}
                        </div>

                        <div>
                          <strong>
                            {
                              member
                                .fullName
                            }
                          </strong>

                          <span>
                            {
                              member
                                .email
                            }
                          </span>
                        </div>

                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          `role-badge role-badge--${
                            member.role
                              .toLowerCase()
                              .replaceAll(
                                "_",
                                "-",
                              )
                          }`
                        }
                      >
                        {
                          roleLabel(
                            member.role,
                          )
                        }
                      </span>
                    </td>

                    <td>
                      {
                        member
                          .departmentName
                      }
                    </td>

                    <td>
                      {
                        member
                          .jobTitle
                      }
                    </td>

                    <td>
                      <span
                        className={
                          member.active
                            ? "badge badge--status-active"
                            : "badge badge--status-inactive"
                        }
                      >
                        {
                          member.active
                            ? "ACTIVE"
                            : "INACTIVE"
                        }
                      </span>
                    </td>

                  </tr>
                ),
              )}

            </tbody>

          </table>

        </div>

      </section>

      <section className="panel">

        <div
          className={
            "panel__header"
          }
        >
          <div>
            <span className="eyebrow">
              Organization
            </span>

            <h2>
              Departments
            </h2>
          </div>
        </div>

        <div
          className={
            "department-grid"
          }
        >
          {departments.map(
            department => (
              <article
                key={
                  department.id
                }
                className={
                  "department-card"
                }
              >
                <div
                  className={
                    "department-card__icon"
                  }
                >
                  <Building2
                    size={18}
                  />
                </div>

                <div>
                  <span>
                    {
                      department.code
                    }
                  </span>

                  <strong>
                    {
                      department.name
                    }
                  </strong>

                  <p>
                    {
                      department.description
                    }
                  </p>
                </div>
              </article>
            ),
          )}
        </div>

      </section>

    </div>
  );
}
