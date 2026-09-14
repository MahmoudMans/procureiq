"use client";

import {
  CircleAlert,
  KeyRound,
  LogIn,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  type FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supplierPortalLogin,
} from "@/lib/api";

import {
  setSupplierPortalToken,
} from "@/lib/supplier-portal-session";

export default function SupplierPortalLoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

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

  async function login(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setRunning(true);
      setError(null);

      const result =
        await supplierPortalLogin(
          email.trim(),
          password,
        );

      setSupplierPortalToken(
        result.sessionToken,
      );

      router.push(
        "/supplier-portal/home",
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to sign in to the supplier portal.",
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

        <div className="supplier-portal-auth-heading">
          <h1>
            Supplier sign in
          </h1>

          <p>
            Access only the collaboration
            workspaces, messages and
            actions assigned to your
            supplier organization.
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
          onSubmit={login}
        >
          <label>
            <span>
              Email
            </span>

            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={
                event =>
                  setEmail(
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
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={
                event =>
                  setPassword(
                    event.target.value,
                  )
              }
            />
          </label>

          <button
            type="submit"
            disabled={running}
          >
            <LogIn
              size={16}
            />
            {running
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>

        <div className="supplier-portal-auth-links">
          <Link href="/supplier-portal/activate">
            <KeyRound
              size={14}
            />
            Activate invitation
          </Link>
        </div>
      </section>
    </main>
  );
}
