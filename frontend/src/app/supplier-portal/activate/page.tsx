"use client";

import {
  BadgeCheck,
  CircleAlert,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useState,
} from "react";

import {
  activateSupplierPortalAccount,
} from "@/lib/api";

export default function SupplierPortalActivatePage() {
  const [
    invitationToken,
    setInvitationToken,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    activated,
    setActivated,
  ] =
    useState(false);

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

  async function activate(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match.",
      );

      return;
    }

    try {
      setRunning(true);
      setError(null);

      await activateSupplierPortalAccount(
        invitationToken.trim(),
        password,
      );

      setActivated(
        true,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to activate supplier portal account.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="supplier-portal-auth-page">
      <section className="supplier-portal-auth-card">
        <div className="supplier-portal-brand">
          <ShieldCheck
            size={28}
          />

          <div>
            <span>
              ProcureIQ
            </span>

            <strong>
              Supplier Portal
            </strong>
          </div>
        </div>

        {activated ? (
          <div className="portal-activation-success">
            <BadgeCheck
              size={28}
            />

            <h1>
              Account activated
            </h1>

            <p>
              Your supplier portal
              identity is active. You can
              now sign in with your email
              and password.
            </p>

            <Link href="/supplier-portal/login">
              Continue to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="supplier-portal-auth-heading">
              <h1>
                Activate invitation
              </h1>

              <p>
                Use the one-time
                invitation token provided
                by your procurement
                contact and create a
                password of at least 12
                characters.
              </p>
            </div>

            {error ? (
              <div className="portal-auth-error">
                <CircleAlert
                  size={17}
                />
                {error}
              </div>
            ) : null}

            <form
              className="supplier-portal-auth-form"
              onSubmit={activate}
            >
              <label>
                <span>
                  Invitation token
                </span>

                <textarea
                  required
                  rows={3}
                  value={invitationToken}
                  onChange={
                    event =>
                      setInvitationToken(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label>
                <span>
                  Password
                </span>

                <input
                  required
                  minLength={12}
                  maxLength={128}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={
                    event =>
                      setPassword(
                        event.target.value,
                      )
                  }
                />
              </label>

              <label>
                <span>
                  Confirm password
                </span>

                <input
                  required
                  minLength={12}
                  maxLength={128}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={
                    event =>
                      setConfirmPassword(
                        event.target.value,
                      )
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  running
                  ||
                  !invitationToken.trim()
                }
              >
                <KeyRound
                  size={16}
                />
                {running
                  ? "Activating..."
                  : "Activate account"}
              </button>
            </form>

            <div className="supplier-portal-auth-links">
              <Link href="/supplier-portal/login">
                Already activated? Sign in
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
