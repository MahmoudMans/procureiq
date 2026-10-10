"use client";

import {
  Building2,
  CircleAlert,
  Download,
  RefreshCw,
  SearchX,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  type BadgeTone,
  type Column,
  DataTable,
  EmptyState,
  KpiGrid,
  type KpiItem,
  SearchField,
  SelectField,
  type SelectOption,
  StatusBadge,
  downloadCsv,
  initialsOf,
  useToast,
} from "@/components/kit";
import { getDepartments, getUsers } from "@/lib/api";
import type { AuthUser, Department } from "@/types/auth";

/* ------------------------------------------------------------------ */
/* Constants & columns                                                 */
/* ------------------------------------------------------------------ */

const ADMIN_ROLES = ["ADMIN", "PROCUREMENT_MANAGER"];

const ROLE_ORDER: AuthUser["role"][] = [
  "ADMIN",
  "PROCUREMENT_MANAGER",
  "BUYER",
  "REQUESTER",
  "APPROVER",
];

const ROLE_LABELS: Record<AuthUser["role"], string> = {
  ADMIN: "Administrator",
  PROCUREMENT_MANAGER: "Procurement Manager",
  BUYER: "Buyer",
  REQUESTER: "Requester",
  APPROVER: "Approver",
};

const ROLE_TONES: Record<AuthUser["role"], BadgeTone> = {
  ADMIN: "accent",
  PROCUREMENT_MANAGER: "info",
  BUYER: "success",
  REQUESTER: "neutral",
  APPROVER: "warning",
};

const EMPTY_USERS: AuthUser[] = [];
const EMPTY_DEPARTMENTS: Department[] = [];
const integer = new Intl.NumberFormat("en-US");

const COLUMNS: Column<AuthUser>[] = [
  {
    id: "user",
    header: "User",
    sortValue: (member) => member.fullName.toLowerCase(),
    cell: (member) => (
      <div className="supplier-cell">
        <div className="company-avatar">{initialsOf(member.fullName)}</div>

        <div>
          <strong>{member.fullName}</strong>

          <span>{member.email}</span>
        </div>
      </div>
    ),
  },
  {
    id: "role",
    header: "Role",
    sortValue: (member) => ROLE_ORDER.indexOf(member.role),
    cell: (member) => (
      <StatusBadge
        value={member.role}
        label={ROLE_LABELS[member.role]}
        tone={ROLE_TONES[member.role]}
        dot={false}
      />
    ),
  },
  {
    id: "department",
    header: "Department",
    sortValue: (member) => member.departmentName.toLowerCase(),
    cell: (member) => member.departmentName,
  },
  {
    id: "jobTitle",
    header: "Job title",
    sortValue: (member) => member.jobTitle.toLowerCase(),
    cell: (member) => member.jobTitle,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (member) => (member.active ? 0 : 1),
    cell: (member) => <StatusBadge value={member.active ? "ACTIVE" : "INACTIVE"} />,
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const allowed = currentUser !== null && ADMIN_ROLES.includes(currentUser.role);

  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setFetching(true);
      setError(null);

      const [userResult, departmentResult] = await Promise.allSettled([
        getUsers(),
        getDepartments(),
      ]);

      if (!active) {
        return;
      }

      if (userResult.status === "fulfilled") {
        setUsers(userResult.value);
      }

      if (departmentResult.status === "fulfilled") {
        setDepartments(departmentResult.value);
      }

      const failure =
        userResult.status === "rejected"
          ? userResult.reason
          : departmentResult.status === "rejected"
            ? departmentResult.reason
            : null;

      if (failure !== null) {
        setError(
          failure instanceof Error ? failure.message : "Unable to load team information.",
        );
      }

      setFetching(false);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [allowed, reloadKey]);

  const all = users ?? EMPTY_USERS;
  const departmentList = departments ?? EMPTY_DEPARTMENTS;

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const member of all) {
      counts[member.role] = (counts[member.role] ?? 0) + 1;
    }

    return counts;
  }, [all]);

  const roleOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All" },
      ...ROLE_ORDER.map((value) => ({
        value,
        label: `${ROLE_LABELS[value]} · ${roleCounts[value] ?? 0}`,
      })),
    ],
    [roleCounts],
  );

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return all
      .filter((member) => !role || member.role === role)
      .filter(
        (member) =>
          !normalized ||
          [
            member.fullName,
            member.email,
            member.departmentName,
            member.jobTitle,
            ROLE_LABELS[member.role],
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
  }, [all, query, role]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Access management</span>

            <h1>Team &amp; access</h1>
          </div>
        </section>

        <section className="panel">
          <EmptyState
            icon={ShieldCheck}
            title="Access restricted"
            description="Your current role cannot access procurement team administration."
          />
        </section>
      </div>
    );
  }

  const initialLoad = users === null && error === null;
  const hasFilters = query.trim() !== "" || role !== "";

  function clearFilters() {
    setQuery("");
    setRole("");
  }

  function exportCsv() {
    downloadCsv(
      `procureiq-team-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Email", "Role", "Department", "Job title", "Status"],
      rows.map((member) => [
        member.fullName,
        member.email,
        ROLE_LABELS[member.role],
        member.departmentName,
        member.jobTitle,
        member.active ? "Active" : "Inactive",
      ]),
    );

    toast.success(
      "Team exported",
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} saved as CSV.`,
    );
  }

  const buyingUsers =
    (roleCounts.ADMIN ?? 0) + (roleCounts.PROCUREMENT_MANAGER ?? 0) + (roleCounts.BUYER ?? 0);

  const kpis: KpiItem[] = [
    {
      label: "Platform users",
      icon: Users,
      value: users ? integer.format(users.length) : "—",
      note: "Active procurement identities configured locally.",
    },
    {
      label: "Departments",
      icon: Building2,
      value: departments ? integer.format(departments.length) : "—",
      note: "Organizational units available for procurement workflows.",
    },
    {
      label: "Security roles",
      icon: ShieldCheck,
      value: String(ROLE_ORDER.length),
      note: "Administration, management, buyer, requester and approver.",
    },
    {
      label: "Buying users",
      icon: UserCheck,
      value: users ? integer.format(buyingUsers) : "—",
      note: "Users authorized to participate in supplier management.",
    },
  ];

  const emptyNode = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title="No team members match these filters"
      description="Try a different name, email or role, or clear the filters."
      action={
        <button
          type="button"
          className="button button--secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      }
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No users found"
      description="No ProcureIQ identities are configured yet."
    />
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Access management</span>

          <h1>Team &amp; access</h1>

          <p>
            Review ProcureIQ users, procurement roles and organizational departments.
          </p>
        </div>

        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? "kit-spin" : undefined} />
            Refresh
          </button>

          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </section>

      <KpiGrid
        items={kpis}
        loading={users === null && departments === null && error === null}
        ariaLabel="Team totals"
      />

      <div className="kit-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, department or job title"
          ariaLabel="Search team members"
          shortcut
        />

        <SelectField label="Role" value={role} onChange={setRole} options={roleOptions} />
      </div>

      {error ? (
        <div className="error-banner">
          <CircleAlert size={18} />

          <span>{error}</span>

          <button
            type="button"
            className="kit-banner-action"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {error && users === null ? null : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={(member) => member.id}
          ariaLabel="Procurement team"
          loading={initialLoad}
          busy={fetching}
          empty={emptyNode}
          defaultSort={{ id: "role", dir: "asc" }}
          persistKey="team"
          resetKey={`${query}|${role}`}
        />
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Organization</span>

            <h2>Departments</h2>
          </div>

          <span className="kit-count-pill">{departmentList.length}</span>
        </div>

        {departments !== null && departmentList.length === 0 ? (
          <EmptyState
            compact
            icon={Building2}
            title="No departments"
            description="No organizational units are configured yet."
          />
        ) : (
          <div className="department-grid">
            {departmentList.map((department) => (
              <article key={department.id} className="department-card">
                <div className="department-card__icon">
                  <Building2 size={18} />
                </div>

                <div>
                  <span>{department.code}</span>

                  <strong>{department.name}</strong>

                  {department.description ? <p>{department.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
