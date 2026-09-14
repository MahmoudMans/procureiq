package com.procureiq.commandcenter;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Repository
public class ProcurementCommandCenterRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProcurementCommandCenterRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<CommandCenterActionResponse>
    pendingRequests(
            LocalDate today
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    request.estimated_total_amount,
                    request.currency,
                    request.submitted_at
                FROM purchase_requests request
                WHERE request.status =
                    'SUBMITTED'
                ORDER BY
                    request.submitted_at
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp submittedTimestamp =
                            resultSet.getTimestamp(
                                    "submitted_at"
                            );

                    LocalDate submittedDate =
                            submittedTimestamp == null
                                    ? today
                                    : submittedTimestamp
                                            .toInstant()
                                            .atZone(
                                                    ZoneOffset.UTC
                                            )
                                            .toLocalDate();

                    long waitingDays =
                            ChronoUnit.DAYS.between(
                                    submittedDate,
                                    today
                            );

                    CommandCenterSeverity severity =
                            waitingDays >= 7
                                    ? CommandCenterSeverity.HIGH
                                    : CommandCenterSeverity.MEDIUM;

                    String requestNumber =
                            resultSet.getString(
                                    "request_number"
                            );

                    return new CommandCenterActionResponse(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            CommandCenterActionType.PENDING_REQUEST,
                            severity,
                            "Purchase request awaiting approval",
                            requestNumber
                                    + " · "
                                    + resultSet.getString(
                                            "title"
                                    )
                                    + " · waiting "
                                    + waitingDays
                                    + " day(s)",
                            requestNumber,
                            null,
                            null,
                            false,
                            resultSet.getBigDecimal(
                                    "estimated_total_amount"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            null,
                            "/approvals"
                    );
                }
        );
    }

    public List<CommandCenterActionResponse>
    rfqDeadlines(
            LocalDate today,
            int horizonDays
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    rfq.id,
                    rfq.rfq_number,
                    rfq.title,
                    rfq.currency,
                    rfq.response_deadline
                FROM rfqs rfq
                WHERE rfq.status =
                    'PUBLISHED'
                AND rfq.response_deadline
                    IS NOT NULL
                AND rfq.response_deadline::date
                    <= CURRENT_DATE + ?
                ORDER BY
                    rfq.response_deadline
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    LocalDate dueDate =
                            resultSet
                                    .getTimestamp(
                                            "response_deadline"
                                    )
                                    .toInstant()
                                    .atZone(
                                            ZoneOffset.UTC
                                    )
                                    .toLocalDate();

                    long days =
                            ChronoUnit.DAYS.between(
                                    today,
                                    dueDate
                            );

                    CommandCenterSeverity severity;

                    if (days < 0) {
                        severity =
                                CommandCenterSeverity.CRITICAL;
                    } else if (days <= 3) {
                        severity =
                                CommandCenterSeverity.CRITICAL;
                    } else if (days <= 7) {
                        severity =
                                CommandCenterSeverity.HIGH;
                    } else {
                        severity =
                                CommandCenterSeverity.MEDIUM;
                    }

                    String rfqNumber =
                            resultSet.getString(
                                    "rfq_number"
                            );

                    return new CommandCenterActionResponse(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            CommandCenterActionType.RFQ_DEADLINE,
                            severity,
                            days < 0
                                    ? "RFQ response deadline overdue"
                                    : "RFQ response deadline approaching",
                            rfqNumber
                                    + " · "
                                    + resultSet.getString(
                                            "title"
                                    ),
                            rfqNumber,
                            dueDate,
                            days,
                            days < 0,
                            null,
                            resultSet.getString(
                                    "currency"
                            ),
                            null,
                            "/rfqs/"
                                    + resultSet.getObject(
                                            "id",
                                            UUID.class
                                    )
                    );
                },
                horizonDays
        );
    }

    public List<CommandCenterActionResponse>
    overduePurchaseOrders(
            LocalDate today
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number,
                    purchase_order.expected_delivery_date,
                    purchase_order.total_amount,
                    purchase_order.currency,
                    supplier.legal_name
                        AS supplier_name
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED'
                )
                AND purchase_order.expected_delivery_date
                    < CURRENT_DATE
                ORDER BY
                    purchase_order.expected_delivery_date
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    LocalDate dueDate =
                            resultSet.getObject(
                                    "expected_delivery_date",
                                    LocalDate.class
                            );

                    long days =
                            ChronoUnit.DAYS.between(
                                    today,
                                    dueDate
                            );

                    long overdueDays =
                            Math.abs(days);

                    CommandCenterSeverity severity =
                            overdueDays >= 14
                                    ? CommandCenterSeverity.CRITICAL
                                    : CommandCenterSeverity.HIGH;

                    UUID id =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    String poNumber =
                            resultSet.getString(
                                    "po_number"
                            );

                    return new CommandCenterActionResponse(
                            id,
                            CommandCenterActionType.OVERDUE_PURCHASE_ORDER,
                            severity,
                            "Purchase order delivery overdue",
                            poNumber
                                    + " · "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " · "
                                    + overdueDays
                                    + " day(s) overdue",
                            poNumber,
                            dueDate,
                            days,
                            true,
                            resultSet.getBigDecimal(
                                    "total_amount"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            null,
                            "/purchase-orders/"
                                    + id
                    );
                }
        );
    }

    public List<CommandCenterActionResponse>
    contractExpiries(
            LocalDate today,
            int horizonDays
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    contract.id,
                    contract.contract_number,
                    contract.title,
                    contract.end_date,
                    supplier.legal_name
                        AS supplier_name
                FROM supplier_contracts contract
                JOIN suppliers supplier
                    ON supplier.id =
                       contract.supplier_id
                WHERE contract.status
                    <> 'TERMINATED'
                AND contract.end_date
                    <= CURRENT_DATE + ?
                ORDER BY
                    contract.end_date
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    LocalDate dueDate =
                            resultSet.getObject(
                                    "end_date",
                                    LocalDate.class
                            );

                    long days =
                            ChronoUnit.DAYS.between(
                                    today,
                                    dueDate
                            );

                    CommandCenterSeverity severity;

                    if (days < 0) {
                        severity =
                                CommandCenterSeverity.CRITICAL;
                    } else if (days <= 14) {
                        severity =
                                CommandCenterSeverity.HIGH;
                    } else {
                        severity =
                                CommandCenterSeverity.MEDIUM;
                    }

                    UUID id =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    String contractNumber =
                            resultSet.getString(
                                    "contract_number"
                            );

                    return new CommandCenterActionResponse(
                            id,
                            CommandCenterActionType.CONTRACT_EXPIRY,
                            severity,
                            days < 0
                                    ? "Supplier contract expired"
                                    : "Supplier contract expiring",
                            contractNumber
                                    + " · "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " · "
                                    + resultSet.getString(
                                            "title"
                                    ),
                            contractNumber,
                            dueDate,
                            days,
                            days < 0,
                            null,
                            null,
                            null,
                            "/contracts/"
                                    + id
                    );
                },
                horizonDays
        );
    }

    public List<CommandCenterActionResponse>
    complianceExpiries(
            LocalDate today,
            int horizonDays
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    document.id,
                    document.document_name,
                    document.expiry_date,
                    supplier.id
                        AS supplier_id,
                    supplier.legal_name
                        AS supplier_name
                FROM supplier_compliance_documents
                    document
                JOIN suppliers supplier
                    ON supplier.id =
                       document.supplier_id
                WHERE document.required = TRUE
                AND document.expiry_date
                    IS NOT NULL
                AND document.expiry_date
                    <= CURRENT_DATE + ?
                ORDER BY
                    document.expiry_date
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    LocalDate dueDate =
                            resultSet.getObject(
                                    "expiry_date",
                                    LocalDate.class
                            );

                    long days =
                            ChronoUnit.DAYS.between(
                                    today,
                                    dueDate
                            );

                    CommandCenterSeverity severity;

                    if (days < 0) {
                        severity =
                                CommandCenterSeverity.CRITICAL;
                    } else if (days <= 14) {
                        severity =
                                CommandCenterSeverity.HIGH;
                    } else {
                        severity =
                                CommandCenterSeverity.MEDIUM;
                    }

                    UUID supplierId =
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            );

                    return new CommandCenterActionResponse(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            CommandCenterActionType.COMPLIANCE_EXPIRY,
                            severity,
                            days < 0
                                    ? "Required compliance document expired"
                                    : "Compliance document expiring",
                            resultSet.getString(
                                    "supplier_name"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "document_name"
                                    ),
                            resultSet.getString(
                                    "document_name"
                            ),
                            dueDate,
                            days,
                            days < 0,
                            null,
                            null,
                            null,
                            "/suppliers/"
                                    + supplierId
                    );
                },
                horizonDays
        );
    }

    public List<CommandCenterActionResponse>
    procurementRisks(
            LocalDate today
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    risk.id,
                    risk.risk_number,
                    risk.title,
                    risk.description,
                    risk.severity,
                    risk.due_date,
                    app_user.full_name
                        AS owner_name
                FROM procurement_risk_cases risk
                JOIN app_users app_user
                    ON app_user.id =
                       risk.owner_user_id
                WHERE risk.status IN (
                    'OPEN',
                    'IN_MITIGATION'
                )
                ORDER BY
                    CASE risk.severity
                        WHEN 'CRITICAL' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'MEDIUM' THEN 3
                        ELSE 4
                    END,
                    risk.due_date NULLS LAST
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    String sourceSeverity =
                            resultSet.getString(
                                    "severity"
                            );

                    CommandCenterSeverity severity =
                            switch (
                                    sourceSeverity
                            ) {
                                case "CRITICAL" ->
                                        CommandCenterSeverity.CRITICAL;
                                case "HIGH" ->
                                        CommandCenterSeverity.HIGH;
                                case "MEDIUM" ->
                                        CommandCenterSeverity.MEDIUM;
                                default ->
                                        CommandCenterSeverity.INFO;
                            };

                    LocalDate dueDate =
                            resultSet.getObject(
                                    "due_date",
                                    LocalDate.class
                            );

                    Long days =
                            dueDate == null
                                    ? null
                                    : ChronoUnit.DAYS
                                            .between(
                                                    today,
                                                    dueDate
                                            );

                    UUID id =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    return new CommandCenterActionResponse(
                            id,
                            CommandCenterActionType.PROCUREMENT_RISK,
                            severity,
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "description"
                            ),
                            resultSet.getString(
                                    "risk_number"
                            ),
                            dueDate,
                            days,
                            days != null
                                    &&
                                    days < 0,
                            null,
                            null,
                            resultSet.getString(
                                    "owner_name"
                            ),
                            "/risks/"
                                    + id
                    );
                }
        );
    }

    public List<CommandCenterActionResponse>
    upcomingDemand(
            LocalDate today,
            int horizonDays
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    item.id,
                    item.title,
                    item.category,
                    item.planned_value,
                    item.target_sourcing_date,
                    item.priority,
                    plan.currency,
                    plan.plan_number,
                    department.name
                        AS department_name,
                    plan.id
                        AS plan_id
                FROM procurement_plan_items item
                JOIN procurement_plans plan
                    ON plan.id =
                       item.plan_id
                JOIN departments department
                    ON department.id =
                       item.department_id
                WHERE plan.status IN (
                    'DRAFT',
                    'ACTIVE'
                )
                AND item.status IN (
                    'PLANNED',
                    'READY'
                )
                AND item.target_sourcing_date
                    <= CURRENT_DATE + ?
                ORDER BY
                    item.target_sourcing_date
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    LocalDate targetDate =
                            resultSet.getObject(
                                    "target_sourcing_date",
                                    LocalDate.class
                            );

                    long days =
                            ChronoUnit.DAYS.between(
                                    today,
                                    targetDate
                            );

                    String priority =
                            resultSet.getString(
                                    "priority"
                            );

                    CommandCenterSeverity severity;

                    if (days < 0) {
                        severity =
                                CommandCenterSeverity.HIGH;
                    } else if (
                            "CRITICAL".equals(
                                    priority
                            )
                    ) {
                        severity =
                                CommandCenterSeverity.HIGH;
                    } else if (
                            days <= 14
                    ) {
                        severity =
                                CommandCenterSeverity.MEDIUM;
                    } else {
                        severity =
                                CommandCenterSeverity.INFO;
                    }

                    UUID planId =
                            resultSet.getObject(
                                    "plan_id",
                                    UUID.class
                            );

                    return new CommandCenterActionResponse(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            CommandCenterActionType.PLANNING_DEMAND,
                            severity,
                            days < 0
                                    ? "Planned sourcing initiative overdue"
                                    : "Upcoming sourcing demand",
                            resultSet.getString(
                                    "title"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "department_name"
                                    )
                                    + " · "
                                    + resultSet.getString(
                                            "category"
                                    ),
                            resultSet.getString(
                                    "plan_number"
                            ),
                            targetDate,
                            days,
                            days < 0,
                            resultSet.getBigDecimal(
                                    "planned_value"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            null,
                            "/planning/"
                                    + planId
                    );
                },
                horizonDays
        );
    }

    public List<CommandCenterActionResponse>
    savingsActions(
            LocalDate today,
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative.id,
                    initiative.savings_number,
                    initiative.title,
                    initiative.status,
                    initiative.target_savings,
                    initiative.realized_savings,
                    initiative.currency,
                    initiative.updated_at,
                    app_user.full_name
                        AS owner_name
                FROM procurement_savings_initiatives
                    initiative
                JOIN app_users app_user
                    ON app_user.id =
                       initiative.owner_user_id
                WHERE initiative.fiscal_year = ?
                AND initiative.currency = ?
                AND (
                    initiative.status =
                        'SUBMITTED'
                    OR (
                        initiative.status =
                            'VALIDATED'
                        AND initiative.realized_savings
                            < initiative.target_savings
                    )
                )
                ORDER BY
                    CASE
                        WHEN initiative.status =
                            'SUBMITTED'
                        THEN 1
                        ELSE 2
                    END,
                    initiative.updated_at
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    String status =
                            resultSet.getString(
                                    "status"
                            );

                    UUID id =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    if (
                            "SUBMITTED".equals(
                                    status
                            )
                    ) {
                        return new CommandCenterActionResponse(
                                id,
                                CommandCenterActionType.SAVINGS_VALIDATION,
                                CommandCenterSeverity.HIGH,
                                "Savings initiative awaiting validation",
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "savings_number"
                                ),
                                null,
                                null,
                                false,
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "owner_name"
                                ),
                                "/savings/"
                                        + id
                        );
                    }

                    BigDecimal remaining =
                            resultSet.getBigDecimal(
                                    "target_savings"
                            )
                                    .subtract(
                                            resultSet.getBigDecimal(
                                                    "realized_savings"
                                            )
                                    );

                    return new CommandCenterActionResponse(
                            id,
                            CommandCenterActionType.SAVINGS_REALIZATION,
                            CommandCenterSeverity.MEDIUM,
                            "Validated savings awaiting realization",
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "savings_number"
                            ),
                            null,
                            null,
                            false,
                            remaining,
                            resultSet.getString(
                                    "currency"
                            ),
                            resultSet.getString(
                                    "owner_name"
                            ),
                            "/savings/"
                                    + id
                    );
                },
                fiscalYear,
                currency
        );
    }

    public BigDecimal realizedSavings(
            int fiscalYear,
            String currency
    ) {
        BigDecimal value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                initiative.realized_savings
                            ),
                            0
                        )
                        FROM procurement_savings_initiatives
                            initiative
                        WHERE initiative.fiscal_year = ?
                        AND initiative.currency = ?
                        AND initiative.status IN (
                            'VALIDATED',
                            'CLOSED'
                        )
                        """,
                        BigDecimal.class,
                        fiscalYear,
                        currency
                );

        return value == null
                ? BigDecimal.ZERO
                : value;
    }
}
