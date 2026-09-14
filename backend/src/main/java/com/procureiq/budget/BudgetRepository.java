package com.procureiq.budget;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class BudgetRepository {

    private final JdbcTemplate jdbcTemplate;

    public BudgetRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public void create(
            UUID id,
            BudgetAllocationInput input,
            UUID ownerUserId,
            String normalizedCategory,
            String currency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO budget_allocations (
                    id,
                    fiscal_year,
                    scope_type,
                    department_id,
                    category,
                    currency,
                    budget_amount,
                    warning_threshold_percent,
                    hard_limit,
                    status,
                    owner_user_id,
                    notes,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'ACTIVE',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                input.fiscalYear(),
                input.scopeType()
                        .name(),
                input.scopeType()
                        == BudgetScopeType.DEPARTMENT
                        ? input.departmentId()
                        : null,
                input.scopeType()
                        == BudgetScopeType.CATEGORY
                        ? normalizedCategory
                        : null,
                currency,
                input.budgetAmount(),
                input.warningThresholdPercent(),
                input.hardLimit(),
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void update(
            UUID id,
            BudgetAllocationInput input,
            UUID ownerUserId,
            String normalizedCategory,
            String currency
    ) {
        jdbcTemplate.update(
                """
                UPDATE budget_allocations
                SET
                    fiscal_year = ?,
                    scope_type = ?,
                    department_id = ?,
                    category = ?,
                    currency = ?,
                    budget_amount = ?,
                    warning_threshold_percent = ?,
                    hard_limit = ?,
                    owner_user_id = ?,
                    notes = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'ACTIVE'
                """,
                input.fiscalYear(),
                input.scopeType()
                        .name(),
                input.scopeType()
                        == BudgetScopeType.DEPARTMENT
                        ? input.departmentId()
                        : null,
                input.scopeType()
                        == BudgetScopeType.CATEGORY
                        ? normalizedCategory
                        : null,
                currency,
                input.budgetAmount(),
                input.warningThresholdPercent(),
                input.hardLimit(),
                ownerUserId,
                normalizeOptional(
                        input.notes()
                ),
                id
        );
    }

    public void archive(
            UUID id
    ) {
        jdbcTemplate.update(
                """
                UPDATE budget_allocations
                SET
                    status = 'ARCHIVED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'ACTIVE'
                """,
                id
        );
    }

    public BudgetAllocationRow findById(
            UUID id
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    budget.id,
                    budget.fiscal_year,
                    budget.scope_type,
                    budget.department_id,
                    department.name
                        AS department_name,
                    budget.category,
                    budget.currency,
                    budget.budget_amount,
                    budget.warning_threshold_percent,
                    budget.hard_limit,
                    budget.status,
                    budget.owner_user_id,
                    app_user.full_name
                        AS owner_name,
                    budget.notes,
                    budget.created_at,
                    budget.updated_at,
                    budget.version
                FROM budget_allocations budget
                LEFT JOIN departments department
                    ON department.id =
                       budget.department_id
                JOIN app_users app_user
                    ON app_user.id =
                       budget.owner_user_id
                WHERE budget.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAllocation(
                                resultSet
                        ),
                id
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<BudgetAllocationRow> findActive(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    budget.id,
                    budget.fiscal_year,
                    budget.scope_type,
                    budget.department_id,
                    department.name
                        AS department_name,
                    budget.category,
                    budget.currency,
                    budget.budget_amount,
                    budget.warning_threshold_percent,
                    budget.hard_limit,
                    budget.status,
                    budget.owner_user_id,
                    app_user.full_name
                        AS owner_name,
                    budget.notes,
                    budget.created_at,
                    budget.updated_at,
                    budget.version
                FROM budget_allocations budget
                LEFT JOIN departments department
                    ON department.id =
                       budget.department_id
                JOIN app_users app_user
                    ON app_user.id =
                       budget.owner_user_id
                WHERE budget.fiscal_year = ?
                AND budget.currency = ?
                AND budget.status =
                    'ACTIVE'
                ORDER BY
                    budget.scope_type,
                    COALESCE(
                        department.name,
                        budget.category
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAllocation(
                                resultSet
                        ),
                fiscalYear,
                currency
        );
    }

    public BudgetAllocationRow
    findDepartmentBudget(
            int fiscalYear,
            UUID departmentId,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    budget.id,
                    budget.fiscal_year,
                    budget.scope_type,
                    budget.department_id,
                    department.name
                        AS department_name,
                    budget.category,
                    budget.currency,
                    budget.budget_amount,
                    budget.warning_threshold_percent,
                    budget.hard_limit,
                    budget.status,
                    budget.owner_user_id,
                    app_user.full_name
                        AS owner_name,
                    budget.notes,
                    budget.created_at,
                    budget.updated_at,
                    budget.version
                FROM budget_allocations budget
                JOIN departments department
                    ON department.id =
                       budget.department_id
                JOIN app_users app_user
                    ON app_user.id =
                       budget.owner_user_id
                WHERE budget.fiscal_year = ?
                AND budget.scope_type =
                    'DEPARTMENT'
                AND budget.department_id = ?
                AND budget.currency = ?
                AND budget.status =
                    'ACTIVE'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAllocation(
                                resultSet
                        ),
                fiscalYear,
                departmentId,
                currency
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public BigDecimal committedSpend(
            BudgetAllocationRow allocation
    ) {
        if (
                allocation.scopeType()
                        == BudgetScopeType.DEPARTMENT
        ) {
            return decimal(
                    jdbcTemplate.queryForObject(
                            """
                            SELECT COALESCE(
                                SUM(
                                    purchase_order.total_amount
                                ),
                                0
                            )
                            FROM purchase_orders
                                purchase_order
                            JOIN rfqs rfq
                                ON rfq.id =
                                   purchase_order.rfq_id
                            JOIN purchase_requests
                                request
                                ON request.id =
                                   rfq.source_purchase_request_id
                            WHERE
                                request.department_id = ?
                            AND purchase_order.currency = ?
                            AND purchase_order.status IN (
                                'ISSUED',
                                'PARTIALLY_RECEIVED',
                                'RECEIVED'
                            )
                            AND EXTRACT(
                                YEAR FROM
                                COALESCE(
                                    purchase_order.issued_at,
                                    purchase_order.created_at
                                )
                            ) = ?
                            """,
                            BigDecimal.class,
                            allocation.departmentId(),
                            allocation.currency(),
                            allocation.fiscalYear()
                    )
            );
        }

        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                purchase_order_line.line_total
                            ),
                            0
                        )
                        FROM purchase_order_lines
                            purchase_order_line
                        JOIN purchase_orders
                            purchase_order
                            ON purchase_order.id =
                               purchase_order_line.purchase_order_id
                        WHERE LOWER(
                            purchase_order_line.category
                        ) = LOWER(?)
                        AND purchase_order.currency = ?
                        AND purchase_order.status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED',
                            'RECEIVED'
                        )
                        AND EXTRACT(
                            YEAR FROM
                            COALESCE(
                                purchase_order.issued_at,
                                purchase_order.created_at
                            )
                        ) = ?
                        """,
                        BigDecimal.class,
                        allocation.category(),
                        allocation.currency(),
                        allocation.fiscalYear()
                )
        );
    }

    public BigDecimal openRequestExposure(
            BudgetAllocationRow allocation,
            UUID excludedRequestId
    ) {
        if (
                allocation.scopeType()
                        != BudgetScopeType.DEPARTMENT
        ) {
            return BigDecimal.ZERO;
        }

        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                request.estimated_total_amount
                            ),
                            0
                        )
                        FROM purchase_requests request
                        WHERE request.department_id = ?
                        AND request.currency = ?
                        AND request.status IN (
                            'SUBMITTED',
                            'APPROVED'
                        )
                        AND EXTRACT(
                            YEAR FROM request.created_at
                        ) = ?
                        AND (
                            ?::UUID IS NULL
                            OR request.id <> ?::UUID
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM rfqs rfq
                            JOIN purchase_orders
                                purchase_order
                                ON purchase_order.rfq_id =
                                   rfq.id
                            WHERE
                                rfq.source_purchase_request_id =
                                    request.id
                            AND purchase_order.status
                                <> 'CANCELLED'
                        )
                        """,
                        BigDecimal.class,
                        allocation.departmentId(),
                        allocation.currency(),
                        allocation.fiscalYear(),
                        excludedRequestId,
                        excludedRequestId
                )
        );
    }

    public PurchaseRequestRow findPurchaseRequest(
            UUID requestId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    request.department_id,
                    department.name
                        AS department_name,
                    request.status,
                    request.currency,
                    request.estimated_total_amount,
                    request.created_at
                FROM purchase_requests request
                JOIN departments department
                    ON department.id =
                       request.department_id
                WHERE request.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new PurchaseRequestRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "request_number"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getObject(
                                    "department_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "department_name"
                            ),
                            resultSet.getString(
                                    "status"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            resultSet.getBigDecimal(
                                    "estimated_total_amount"
                            ),
                            created.toInstant()
                    );
                },
                requestId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<BudgetDepartmentOptionResponse>
    departments() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    name
                FROM departments
                ORDER BY name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BudgetDepartmentOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "name"
                                )
                        )
        );
    }

    public List<BudgetUserOptionResponse>
    users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active = TRUE
                ORDER BY full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BudgetUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                com.procureiq.user.ProcurementRole
                                        .valueOf(
                                                resultSet.getString(
                                                        "role"
                                                )
                                        )
                        )
        );
    }

    public List<BudgetRequestOptionResponse>
    purchaseRequests() {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    department.name
                        AS department_name,
                    request.status,
                    request.currency,
                    request.estimated_total_amount
                FROM purchase_requests request
                JOIN departments department
                    ON department.id =
                       request.department_id
                WHERE request.status IN (
                    'DRAFT',
                    'SUBMITTED',
                    'APPROVED'
                )
                ORDER BY
                    request.created_at DESC
                LIMIT 100
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BudgetRequestOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "request_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "department_name"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_total_amount"
                                )
                        )
        );
    }

    public List<String> categories() {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT category
                FROM (
                    SELECT category
                    FROM purchase_order_lines
                    WHERE category IS NOT NULL

                    UNION

                    SELECT category
                    FROM suppliers
                    WHERE category IS NOT NULL
                ) categories
                WHERE category <> ''
                ORDER BY category
                """,
                String.class
        );
    }

    private BudgetAllocationRow mapAllocation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new BudgetAllocationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                BudgetScopeType.valueOf(
                        resultSet.getString(
                                "scope_type"
                        )
                ),
                resultSet.getObject(
                        "department_id",
                        UUID.class
                ),
                resultSet.getString(
                        "department_name"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "budget_amount"
                ),
                resultSet.getBigDecimal(
                        "warning_threshold_percent"
                ),
                resultSet.getBoolean(
                        "hard_limit"
                ),
                BudgetStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "notes"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    public record BudgetAllocationRow(
            UUID id,
            int fiscalYear,
            BudgetScopeType scopeType,
            UUID departmentId,
            String departmentName,
            String category,
            String currency,
            BigDecimal budgetAmount,
            BigDecimal warningThresholdPercent,
            boolean hardLimit,
            BudgetStatus status,
            UUID ownerUserId,
            String ownerName,
            String notes,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record PurchaseRequestRow(
            UUID id,
            String requestNumber,
            String title,
            UUID departmentId,
            String departmentName,
            String status,
            String currency,
            BigDecimal estimatedTotal,
            Instant createdAt
    ) {
    }
}
