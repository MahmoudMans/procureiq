"use client";

import {
  CircleAlert,
  Copy,
  KeyRound,
  ShieldCheck,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  getSupplierCollaborationContext,
  getSupplierPortalAccounts,
  inviteSupplierPortalAccount,
  reinstateSupplierPortalAccount,
  revokeSupplierPortalAccount,
  suspendSupplierPortalAccount,
} from "@/lib/api";

import type {
  CollaborationContext,
} from "@/types/supplier-collaboration";

import type {
  SupplierPortalAccount,
  SupplierPortalInvitation,
} from "@/types/supplier-portal";

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

export default function SupplierPortalAdminPage() {
  const {
    user,
  } = useAuth();

  const [
    accounts,
    setAccounts,
  ] =
    useState<
      SupplierPortalAccount[]
    >([]);

  const [
    context,
    setContext,
  ] =
    useState<
      CollaborationContext |
      null
    >(null);

  const [
    supplierId,
    setSupplierId,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    displayName,
    setDisplayName,
  ] =
    useState("");

  const [
    invitation,
    setInvitation,
  ] =
    useState<
      SupplierPortalInvitation |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    running,
    setRunning,
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

  const canAdminister =
    user?.role ===
      "ADMIN"
    ||
    user?.role ===
      "PROCUREMENT_MANAGER";

  useEffect(() => {
    let active = true;

    Promise.all([
      getSupplierPortalAccounts(),
      getSupplierCollaborationContext(),
    ])
      .then(
        ([
          accountsResponse,
          contextResponse,
        ]) => {
          if (!active) {
            return;
          }

          setAccounts(
            accountsResponse,
          );

          setContext(
            contextResponse,
          );

          if (
            contextResponse.suppliers[0]
          ) {
            setSupplierId(
              contextResponse.suppliers[0].id,
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
              : "Unable to load supplier portal administration.",
          );
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
  }, []);

  async function reload() {
    setAccounts(
      await getSupplierPortalAccounts(),
    );
  }

  async function invite(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);
      setInvitation(null);

      const result =
        await inviteSupplierPortalAccount({
          supplierId,
          email:
            email.trim(),
          displayName:
            displayName.trim(),
        });

      setInvitation(
        result,
      );

      setEmail("");
      setDisplayName("");

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to create supplier portal invitation.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function changeAccount(
    account:
      SupplierPortalAccount,
    action:
      "SUSPEND"
      |
      "REINSTATE"
      |
      "REVOKE",
  ) {
    try {
      setRunning(true);
      setError(null);

      if (
        action ===
        "SUSPEND"
      ) {
        await suspendSupplierPortalAccount(
          account.id,
        );
      } else if (
        action ===
        "REINSTATE"
      ) {
        await reinstateSupplierPortalAccount(
          account.id,
        );
      } else {
        await revokeSupplierPortalAccount(
          account.id,
        );
      }

      await reload();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to update supplier portal account.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function copyToken() {
    if (!invitation) {
      return;
    }

    await navigator.clipboard.writeText(
      invitation.invitationToken,
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            External supplier access
          </span>

          <h1>
            Supplier portal access
          </h1>

          <p>
            Invite supplier contacts,
            govern external access and
            revoke sessions without
            creating internal ProcureIQ
            users.
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

      {invitation ? (
        <section className="portal-invitation-banner">
          <KeyRound
            size={19}
          />

          <div>
            <strong>
              Invitation token — shown once
            </strong>

            <code>
              {invitation.invitationToken}
            </code>

            <span>
              Expires
              {" "}
              {new Date(
                invitation.invitationExpiresAt,
              )
                .toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={
              () =>
                void copyToken()
            }
          >
            <Copy
              size={14}
            />
            Copy
          </button>
        </section>
      ) : null}

      {canAdminister ? (
        <form
          className="panel"
          onSubmit={invite}
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">
                Invitation
              </span>

              <h2>
                Invite supplier contact
              </h2>
            </div>

            <UserPlus
              size={19}
            />
          </div>

          <div className="portal-admin-form-grid">
            <label className="request-field">
              <span>
                Supplier
              </span>

              <select
                required
                value={supplierId}
                onChange={
                  event =>
                    setSupplierId(
                      event.target.value,
                    )
                }
              >
                {context
                  ?.suppliers
                  .map(
                    supplier => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.supplierCode}
                        {" — "}
                        {supplier.supplierName}
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label className="request-field">
              <span>
                Contact name
              </span>

              <input
                required
                maxLength={220}
                value={displayName}
                onChange={
                  event =>
                    setDisplayName(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className="request-field">
              <span>
                Contact email
              </span>

              <input
                required
                type="email"
                maxLength={320}
                value={email}
                onChange={
                  event =>
                    setEmail(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>

          <div className="portal-form-actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                running
                ||
                !supplierId
                ||
                !email.trim()
                ||
                !displayName.trim()
              }
            >
              <UserPlus
                size={16}
              />
              Create invitation
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">
              External identities
            </span>

            <h2>
              Supplier portal accounts
            </h2>
          </div>

          <ShieldCheck
            size={19}
          />
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Status</th>
                <th>Activated</th>
                <th>Last login</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {!loading &&
                accounts.map(
                  account => (
                    <tr
                      key={account.id}
                    >
                      <td>
                        <div className="request-primary-cell">
                          <strong>
                            {account.supplierName}
                          </strong>

                          <span>
                            {account.supplierCode}
                          </span>
                        </div>
                      </td>

                      <td>
                        {account.displayName}
                      </td>

                      <td>
                        {account.email}
                      </td>

                      <td>
                        <span
                          className={
                            `portal-account-status portal-account-status--${account.status.toLowerCase()}`
                          }
                        >
                          {readable(
                            account.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {account.activatedAt
                          ? new Date(
                              account.activatedAt,
                            )
                              .toLocaleString()
                          : account.invitationExpiresAt
                            ? `Invitation expires ${new Date(
                                account.invitationExpiresAt,
                              ).toLocaleString()}`
                            : "—"}
                      </td>

                      <td>
                        {account.lastLoginAt
                          ? new Date(
                              account.lastLoginAt,
                            )
                              .toLocaleString()
                          : "—"}
                      </td>

                      <td>
                        {canAdminister ? (
                          <div className="portal-account-actions">
                            {account.status ===
                            "ACTIVE" ? (
                              <button
                                type="button"
                                disabled={running}
                                onClick={
                                  () =>
                                    void changeAccount(
                                      account,
                                      "SUSPEND",
                                    )
                                }
                              >
                                <UserRoundX
                                  size={13}
                                />
                                Suspend
                              </button>
                            ) : null}

                            {account.status ===
                            "SUSPENDED" ? (
                              <button
                                type="button"
                                disabled={running}
                                onClick={
                                  () =>
                                    void changeAccount(
                                      account,
                                      "REINSTATE",
                                    )
                                }
                              >
                                <UserRoundCheck
                                  size={13}
                                />
                                Reinstate
                              </button>
                            ) : null}

                            {account.status !==
                            "REVOKED" ? (
                              <button
                                type="button"
                                className="portal-danger-button"
                                disabled={running}
                                onClick={
                                  () =>
                                    void changeAccount(
                                      account,
                                      "REVOKE",
                                    )
                                }
                              >
                                Revoke
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              accounts.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="table-empty-state"
                  >
                    No supplier portal
                    accounts have been
                    created.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-security-note">
        <ShieldCheck
          size={18}
        />

        <div>
          <strong>
            Separate external identity boundary
          </strong>

          <p>
            Supplier contacts are not
            internal app users. Invitation
            and session secrets are stored
            only as hashes, and suspending
            or revoking an account
            immediately revokes its active
            supplier portal sessions.
          </p>
        </div>
      </section>
    </div>
  );
}
