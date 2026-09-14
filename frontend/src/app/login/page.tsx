"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/auth/auth-provider";

const DEMO_PASSWORD =
  "ProcureIQ!Demo2026";

const demoAccounts = [
  {
    label: "Administrator",
    email:
      "admin@procureiq.local",
    icon: ShieldCheck,
  },
  {
    label:
      "Procurement Manager",
    email:
      "manager@procureiq.local",
    icon: Building2,
  },
  {
    label: "Buyer",
    email:
      "buyer@procureiq.local",
    icon: UserRound,
  },
];

export default function LoginPage() {
  const router =
    useRouter();

  const {
    user,
    loading,
    login,
  } = useAuth();

  const [
    email,
    setEmail,
  ] =
    useState(
      "admin@procureiq.local",
    );

  const [
    password,
    setPassword,
  ] =
    useState(
      DEMO_PASSWORD,
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    if (
      !loading &&
      user
    ) {
      router.replace("/");
    }
  }, [
    user,
    loading,
    router,
  ]);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      await login(
        email.trim(),
        password,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function selectDemo(
    accountEmail: string,
  ) {
    setEmail(accountEmail);
    setPassword(
      DEMO_PASSWORD,
    );
    setError(null);
  }

  return (
    <main className="login-page">

      <section
        className={
          "login-page__brand-panel"
        }
      >
        <div
          className={
            "login-page__brand-content"
          }
        >

          <div className="login-brand">

            <div
              className={
                "login-brand__mark"
              }
            >
              <PackageCheck
                size={27}
              />
            </div>

            <div>
              <strong>
                ProcureIQ
              </strong>

              <span>
                Procurement Intelligence
              </span>
            </div>

          </div>

          <div
            className={
              "login-page__headline"
            }
          >
            <span className="eyebrow">
              Enterprise procurement
            </span>

            <h1>
              Control spend.
              <br />
              Strengthen suppliers.
              <br />
              Make better decisions.
            </h1>

            <p>
              A unified procurement workspace
              for sourcing, supplier risk,
              purchasing governance and
              performance intelligence.
            </p>
          </div>

          <div
            className={
              "login-capabilities"
            }
          >
            <div>
              <CheckCircle2
                size={17}
              />

              <span>
                Supplier intelligence
              </span>
            </div>

            <div>
              <CheckCircle2
                size={17}
              />

              <span>
                Role-based access
              </span>
            </div>

            <div>
              <CheckCircle2
                size={17}
              />

              <span>
                Procurement governance
              </span>
            </div>
          </div>

        </div>
      </section>

      <section
        className={
          "login-page__form-panel"
        }
      >

        <div className="login-card">

          <div
            className={
              "login-card__heading"
            }
          >
            <div
              className={
                "login-card__security"
              }
            >
              <LockKeyhole
                size={19}
              />
            </div>

            <span className="eyebrow">
              Secure workspace
            </span>

            <h2>
              Sign in to ProcureIQ
            </h2>

            <p>
              Use one of the local demo
              procurement identities.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={
              handleSubmit
            }
          >

            <label>
              <span>
                Email address
              </span>

              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={
                  event =>
                    setEmail(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            <label>
              <span>
                Password
              </span>

              <input
                type="password"
                required
                autoComplete={
                  "current-password"
                }
                value={password}
                onChange={
                  event =>
                    setPassword(
                      event
                        .target
                        .value,
                    )
                }
              />
            </label>

            {error ? (
              <div
                className={
                  "error-banner"
                }
              >
                <CircleAlert
                  size={18}
                />

                <span>
                  {error}
                </span>
              </div>
            ) : null}

            <button
              type="submit"
              className={
                "button button--primary login-submit"
              }
              disabled={
                submitting ||
                loading
              }
            >
              {submitting
                ? "Signing in..."
                : "Sign in"}

              {!submitting ? (
                <ArrowRight
                  size={17}
                />
              ) : null}
            </button>

          </form>

          <div
            className={
              "demo-account-section"
            }
          >
            <div
              className={
                "demo-account-section__header"
              }
            >
              <span>
                Demo identities
              </span>

              <small>
                Password:
                {" "}
                {DEMO_PASSWORD}
              </small>
            </div>

            <div
              className={
                "demo-account-grid"
              }
            >
              {demoAccounts.map(
                account => {
                  const Icon =
                    account.icon;

                  return (
                    <button
                      key={
                        account.email
                      }
                      type="button"
                      className={
                        `demo-account ${
                          email ===
                          account.email
                            ? "demo-account--selected"
                            : ""
                        }`
                      }
                      onClick={
                        () =>
                          selectDemo(
                            account.email,
                          )
                      }
                    >
                      <Icon
                        size={16}
                      />

                      <div>
                        <strong>
                          {
                            account
                              .label
                          }
                        </strong>

                        <span>
                          {
                            account
                              .email
                          }
                        </span>
                      </div>
                    </button>
                  );
                },
              )}
            </div>

          </div>

        </div>

      </section>

    </main>
  );
}
