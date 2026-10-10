"use client";

import { SmartTable } from "@/components/kit/smart-table";

import {
  Archive,
  Banknote,
  Building2,
  CircleAlert,
  Clock3,
  Download,
  FileSpreadsheet,
  PackageCheck,
  Save,
  Sparkles,
  TrendingDown,
  Truck,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import {
  createReportSnapshot,
  downloadReportCsv,
  getExecutiveReport,
  getReportSnapshots,
} from "@/lib/api";

import type {
  ExecutiveReport,
  ReportBreakdown,
  ReportSnapshot,
  ReportType,
} from "@/types/reporting";

const EXPORT_OPTIONS:
Array<{
  type: ReportType;
  label: string;
}> = [
  {
    type: "EXECUTIVE",
    label: "Executive KPIs",
  },
  {
    type: "SUPPLIER_SPEND",
    label: "Supplier spend",
  },
  {
    type: "CATEGORY_SPEND",
    label: "Category spend",
  },
  {
    type: "SOURCING_SAVINGS",
    label: "Sourcing savings",
  },
  {
    type: "PURCHASE_ORDERS",
    label: "Purchase orders",
  },
  {
    type: "DELIVERIES",
    label: "Deliveries",
  },
];

function money(
  value: number,
): string {
  return new Intl
    .NumberFormat(
      "en-US",
      {
        style:
          "currency",
        currency:
          "EUR",
        maximumFractionDigits:
          0,
      },
    )
    .format(value);
}

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

export default function ReportsPage() {
  const {
    user,
  } = useAuth();

  const [
    report,
    setReport,
  ] =
    useState<
      ExecutiveReport |
      null
    >(null);

  const [
    snapshots,
    setSnapshots,
  ] =
    useState<
      ReportSnapshot[]
    >([]);

  const [
    from,
    setFrom,
  ] =
    useState("");

  const [
    to,
    setTo,
  ] =
    useState("");

  const [
    snapshotLabel,
    setSnapshotLabel,
  ] =
    useState(
      "Executive procurement report",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    applying,
    setApplying,
  ] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] =
    useState<
      ReportType |
      null
    >(null);

  const [
    savingSnapshot,
    setSavingSnapshot,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const allowed =
    user?.role ===
      "ADMIN" ||
    user?.role ===
      "PROCUREMENT_MANAGER" ||
    user?.role ===
      "BUYER" ||
    user?.role ===
      "APPROVER";

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    Promise.all([
      getExecutiveReport(),
      getReportSnapshots(),
    ])
      .then(
        ([
          reportResponse,
          snapshotResponse,
        ]) => {
          if (!active) {
            return;
          }

          setReport(
            reportResponse,
          );

          setSnapshots(
            snapshotResponse,
          );

          setFrom(
            reportResponse
              .periodStart,
          );

          setTo(
            reportResponse
              .periodEnd,
          );

          setError(
            null,
          );
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
              ? caughtError
                  .message
              : "Unable to load procurement reports.",
          );
        },
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false,
            );
          }
        },
      );

    return () => {
      active = false;
    };
  }, [
    allowed,
  ]);

  const maxSupplierSpend =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            report
              ?.spendBySupplier
              .map(
                item =>
                  item.amount,
              ) ??
            []
          ),
        ),
      [report],
    );

  async function applyPeriod(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setApplying(
        true,
      );

      setError(
        null,
      );

      const response =
        await getExecutiveReport(
          from ||
            undefined,
          to ||
            undefined,
        );

      setReport(
        response,
      );

      setFrom(
        response.periodStart,
      );

      setTo(
        response.periodEnd,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to apply report period.",
      );
    } finally {
      setApplying(
        false,
      );
    }
  }

  async function exportCsv(
    type: ReportType,
  ) {
    try {
      setExporting(
        type,
      );

      setError(
        null,
      );

      const blob =
        await downloadReportCsv(
          type,
          from ||
            undefined,
          to ||
            undefined,
        );

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        url;

      anchor.download =
        `procureiq-${type
          .toLowerCase()
          .replaceAll(
            "_",
            "-",
          )}.csv`;

      document.body
        .appendChild(
          anchor,
        );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(
        url,
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to export report.",
      );
    } finally {
      setExporting(
        null,
      );
    }
  }

  async function saveSnapshot() {
    if (
      !snapshotLabel
        .trim()
    ) {
      setError(
        "Snapshot label is required.",
      );

      return;
    }

    try {
      setSavingSnapshot(
        true,
      );

      setError(
        null,
      );

      const created =
        await createReportSnapshot({
          reportType:
            "EXECUTIVE",

          periodStart:
            from ||
            undefined,

          periodEnd:
            to ||
            undefined,

          label:
            snapshotLabel
              .trim(),
        });

      setSnapshots(
        current => [
          created,
          ...current,
        ],
      );
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError
              .message
          : "Unable to save report snapshot.",
      );
    } finally {
      setSavingSnapshot(
        false,
      );
    }
  }

  if (!allowed) {
    return (
      <div
        className={
          "page-stack"
        }
      >
        <div
          className={
            "error-banner"
          }
        >
          Your ProcureIQ role
          cannot access reports.
        </div>
      </div>
    );
  }

  if (
    loading &&
    !report
  ) {
    return (
      <div
        className={
          "reports-loading"
        }
      >
        Building procurement
        reports...
      </div>
    );
  }

  return (
    <div
      className={
        "page-stack"
      }
    >
      <section
        className={
          "page-heading"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            Management reporting
          </span>

          <h1>
            Procurement reports
          </h1>

          <p>
            Build date-range executive
            reports, export procurement
            datasets and preserve
            management snapshots.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className={
            "error-banner"
          }
        >
          <CircleAlert
            size={18}
          />
          {error}
        </div>
      ) : null}

      <form
        className={
          "reports-period-panel"
        }
        onSubmit={
          applyPeriod
        }
      >
        <label>
          <span>
            Period start
          </span>

          <input
            type="date"
            value={from}
            onChange={
              event =>
                setFrom(
                  event
                    .target
                    .value,
                )
            }
          />
        </label>

        <label>
          <span>
            Period end
          </span>

          <input
            type="date"
            value={to}
            onChange={
              event =>
                setTo(
                  event
                    .target
                    .value,
                )
            }
          />
        </label>

        <button
          type="submit"
          className={
            "button button--primary"
          }
          disabled={
            applying
          }
        >
          <FileSpreadsheet
            size={16}
          />

          {applying
            ? "Applying..."
            : "Apply period"}
        </button>
      </form>

      {report ? (
        <>
          <section
            className={
              "reports-kpi-grid"
            }
          >
            <ReportKpi
              icon={Banknote}
              label={
                "Committed spend"
              }
              value={
                money(
                  report.summary
                    .committedSpend,
                )
              }
              note={
                `${report.summary.purchaseOrderCount} purchase orders`
              }
            />

            <ReportKpi
              icon={
                TrendingDown
              }
              label={
                "Sourcing savings"
              }
              value={
                money(
                  report.summary
                    .sourcingSavings,
                )
              }
              note={
                "Savings versus highest submitted quotations"
              }
            />

            <ReportKpi
              icon={Building2}
              label={
                "Suppliers"
              }
              value={
                String(
                  report.summary
                    .supplierCount,
                )
              }
              note={
                "Suppliers represented in committed spend"
              }
            />

            <ReportKpi
              icon={Clock3}
              label={
                "Average cycle"
              }
              value={
                `${report.summary.averageCycleDays.toFixed(1)}d`
              }
              note={
                "Purchase-request submission to award"
              }
            />

            <ReportKpi
              icon={
                PackageCheck
              }
              label={
                "Average PO"
              }
              value={
                money(
                  report.summary
                    .averageOrderValue,
                )
              }
              note={
                "Average committed purchase-order value"
              }
            />

            <ReportKpi
              icon={Truck}
              label={
                "Overdue orders"
              }
              value={
                String(
                  report.summary
                    .overdueOrderCount,
                )
              }
              note={
                "Open deliveries past expected date"
              }
            />
          </section>

          <section
            className={
              "panel reports-export-panel"
            }
          >
            <div
              className={
                "panel__header"
              }
            >
              <div>
                <span
                  className={
                    "eyebrow"
                  }
                >
                  Data exports
                </span>

                <h2>
                  CSV report library
                </h2>
              </div>

              <Download
                size={19}
              />
            </div>

            <div
              className={
                "reports-export-grid"
              }
            >
              {EXPORT_OPTIONS.map(
                option => (
                  <button
                    key={
                      option.type
                    }
                    type="button"
                    className={
                      "reports-export-card"
                    }
                    disabled={
                      exporting !==
                      null
                    }
                    onClick={
                      () =>
                        void exportCsv(
                          option.type,
                        )
                    }
                  >
                    <div>
                      <FileSpreadsheet
                        size={18}
                      />

                      <strong>
                        {
                          option.label
                        }
                      </strong>
                    </div>

                    <span>
                      {exporting ===
                      option.type
                        ? "Preparing..."
                        : "Download CSV"}
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          <section
            className={
              "reports-two-column"
            }
          >
            <BreakdownReport
              title={
                "Supplier spend"
              }
              eyebrow={
                "Spend concentration"
              }
              items={
                report
                  .spendBySupplier
              }
              maximum={
                maxSupplierSpend
              }
            />

            <BreakdownReport
              title={
                "Category spend"
              }
              eyebrow={
                "Category distribution"
              }
              items={
                report
                  .spendByCategory
              }
            />
          </section>

          <section
            className={
              "panel"
            }
          >
            <div
              className={
                "panel__header"
              }
            >
              <div>
                <span
                  className={
                    "eyebrow"
                  }
                >
                  Sourcing performance
                </span>

                <h2>
                  Award savings
                </h2>
              </div>

              <Sparkles
                size={19}
              />
            </div>

            <div
              className={
                "table-scroll"
              }
            >
              <SmartTable
                className={
                  "data-table"
                }
              >
                <thead>
                  <tr>
                    <th>RFQ</th>
                    <th>
                      Supplier
                    </th>
                    <th>
                      Selected
                    </th>
                    <th>
                      Highest offer
                    </th>
                    <th>
                      Savings
                    </th>
                    <th>
                      Award date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report
                    .sourcingSavings
                    .map(
                      row => (
                        <tr
                          key={
                            `${row.rfqNumber}-${row.supplierName}`
                          }
                        >
                          <td>
                            <strong>
                              {
                                row.rfqNumber
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              row.supplierName
                            }
                          </td>

                          <td>
                            {
                              money(
                                row.selectedTotal,
                              )
                            }
                          </td>

                          <td>
                            {
                              money(
                                row.highestSubmittedTotal,
                              )
                            }
                          </td>

                          <td>
                            <strong
                              className={
                                "reports-savings-value"
                              }
                            >
                              {
                                money(
                                  row.savings,
                                )
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              new Date(
                                `${row.awardDate}T00:00:00`,
                              )
                                .toLocaleDateString()
                            }
                          </td>
                        </tr>
                      ),
                    )}

                  {report
                    .sourcingSavings
                    .length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className={
                          "table-empty-state"
                        }
                      >
                        No sourcing
                        awards exist
                        in this period.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </SmartTable>
            </div>
          </section>

          <section
            className={
              "panel"
            }
          >
            <div
              className={
                "panel__header"
              }
            >
              <div>
                <span
                  className={
                    "eyebrow"
                  }
                >
                  Order register
                </span>

                <h2>
                  Purchase orders
                </h2>
              </div>

              <PackageCheck
                size={19}
              />
            </div>

            <div
              className={
                "table-scroll"
              }
            >
              <SmartTable
                className={
                  "data-table"
                }
              >
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>
                      Supplier
                    </th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>
                      Delivery
                    </th>
                    <th>
                      Issued
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report
                    .purchaseOrders
                    .map(
                      row => (
                        <tr
                          key={
                            row.poNumber
                          }
                        >
                          <td>
                            <strong>
                              {
                                row.poNumber
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              row.supplierName
                            }
                          </td>

                          <td>
                            {
                              readable(
                                row.status,
                              )
                            }
                          </td>

                          <td>
                            {
                              money(
                                row.totalAmount,
                              )
                            }
                          </td>

                          <td>
                            {
                              new Date(
                                `${row.expectedDeliveryDate}T00:00:00`,
                              )
                                .toLocaleDateString()
                            }
                          </td>

                          <td>
                            {row.issuedAt
                              ? new Date(
                                  row.issuedAt,
                                )
                                  .toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </SmartTable>
            </div>
          </section>

          <section
            className={
              "panel"
            }
          >
            <div
              className={
                "panel__header"
              }
            >
              <div>
                <span
                  className={
                    "eyebrow"
                  }
                >
                  Fulfillment report
                </span>

                <h2>
                  Deliveries
                </h2>
              </div>

              <Truck size={19} />
            </div>

            <div
              className={
                "table-scroll"
              }
            >
              <SmartTable
                className={
                  "data-table"
                }
              >
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>
                      Supplier
                    </th>
                    <th>
                      Expected
                    </th>
                    <th>
                      Last receipt
                    </th>
                    <th>
                      Fulfillment
                    </th>
                    <th>
                      Timing
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report
                    .deliveries
                    .map(
                      row => (
                        <tr
                          key={
                            row.poNumber
                          }
                        >
                          <td>
                            <strong>
                              {
                                row.poNumber
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              row.supplierName
                            }
                          </td>

                          <td>
                            {
                              new Date(
                                `${row.expectedDeliveryDate}T00:00:00`,
                              )
                                .toLocaleDateString()
                            }
                          </td>

                          <td>
                            {row.lastReceiptDate
                              ? new Date(
                                  `${row.lastReceiptDate}T00:00:00`,
                                )
                                  .toLocaleDateString()
                              : "—"}
                          </td>

                          <td>
                            <strong>
                              {
                                row.fulfillmentRate
                                  .toFixed(
                                    1,
                                  )
                              }
                              %
                            </strong>
                          </td>

                          <td>
                            <span
                              className={
                                row.late
                                  ? "reports-late"
                                  : "reports-ontime"
                              }
                            >
                              {row.late
                                ? "Late"
                                : "On time"}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </SmartTable>
            </div>
          </section>

          <section
            className={
              "panel"
            }
          >
            <div
              className={
                "panel__header"
              }
            >
              <div>
                <span
                  className={
                    "eyebrow"
                  }
                >
                  Management archive
                </span>

                <h2>
                  Report snapshots
                </h2>
              </div>

              <Archive
                size={19}
              />
            </div>

            <div
              className={
                "reports-snapshot-create"
              }
            >
              <label
                className={
                  "request-field"
                }
              >
                <span>
                  Snapshot label
                </span>

                <input
                  maxLength={200}
                  value={
                    snapshotLabel
                  }
                  onChange={
                    event =>
                      setSnapshotLabel(
                        event
                          .target
                          .value,
                      )
                  }
                />
              </label>

              <button
                type="button"
                className={
                  "button button--primary"
                }
                disabled={
                  savingSnapshot
                }
                onClick={
                  () =>
                    void saveSnapshot()
                }
              >
                <Save
                  size={16}
                />

                {savingSnapshot
                  ? "Saving..."
                  : "Save executive snapshot"}
              </button>
            </div>

            {snapshots.length ===
            0 ? (
              <div
                className={
                  "reports-empty"
                }
              >
                No report snapshots
                have been saved yet.
              </div>
            ) : (
              <div
                className={
                  "reports-snapshot-list"
                }
              >
                {snapshots.map(
                  snapshot => (
                    <article
                      key={
                        snapshot.id
                      }
                      className={
                        "reports-snapshot-card"
                      }
                    >
                      <div>
                        <strong>
                          {
                            snapshot.label
                          }
                        </strong>

                        <span>
                          {
                            readable(
                              snapshot
                                .reportType,
                            )
                          }
                        </span>
                      </div>

                      <div>
                        <span>
                          Period
                        </span>

                        <strong>
                          {
                            snapshot
                              .periodStart
                          }
                          {" → "}
                          {
                            snapshot
                              .periodEnd
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Created by
                        </span>

                        <strong>
                          {
                            snapshot
                              .createdByName
                          }
                        </strong>
                      </div>

                      <time>
                        {
                          new Date(
                            snapshot
                              .createdAt,
                          )
                            .toLocaleString()
                        }
                      </time>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

interface ReportKpiProps {
  icon:
    React.ComponentType<{
      size?: number;
    }>;
  label: string;
  value: string;
  note: string;
}

function ReportKpi({
  icon: Icon,
  label,
  value,
  note,
}: ReportKpiProps) {
  return (
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
          <Icon size={20} />
        </div>
      </div>

      <span
        className={
          "kpi-card__label"
        }
      >
        {label}
      </span>

      <strong
        className={
          "kpi-card__value reports-kpi-value"
        }
      >
        {value}
      </strong>

      <p>{note}</p>
    </article>
  );
}

interface BreakdownReportProps {
  title: string;
  eyebrow: string;
  items:
    ReportBreakdown[];
  maximum?: number;
}

function BreakdownReport({
  title,
  eyebrow,
  items,
  maximum,
}: BreakdownReportProps) {
  const max =
    maximum ??
    Math.max(
      1,
      ...items.map(
        item =>
          item.amount,
      ),
    );

  return (
    <section
      className={
        "panel"
      }
    >
      <div
        className={
          "panel__header"
        }
      >
        <div>
          <span
            className={
              "eyebrow"
            }
          >
            {eyebrow}
          </span>

          <h2>
            {title}
          </h2>
        </div>
      </div>

      {items.length ===
      0 ? (
        <div
          className={
            "reports-empty"
          }
        >
          No data exists for the
          selected period.
        </div>
      ) : (
        <div
          className={
            "reports-breakdown-list"
          }
        >
          {items.map(
            item => (
              <article
                key={
                  item.label
                }
                className={
                  "reports-breakdown-row"
                }
              >
                <div>
                  <strong>
                    {
                      item.label
                    }
                  </strong>

                  <span>
                    {
                      item.count
                    }
                    {" records · "}
                    {
                      item.sharePercent
                        .toFixed(
                          1,
                        )
                    }
                    %
                  </span>
                </div>

                <div
                  className={
                    "reports-breakdown-track"
                  }
                >
                  <div
                    style={{
                      width:
                        `${
                          Math.max(
                            2,
                            (
                              item.amount /
                              max
                            ) *
                              100,
                          )
                        }%`,
                    }}
                  />
                </div>

                <strong>
                  {
                    money(
                      item.amount,
                    )
                  }
                </strong>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
