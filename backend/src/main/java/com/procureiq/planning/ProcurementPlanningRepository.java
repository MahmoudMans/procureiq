package com.procureiq.planning;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class ProcurementPlanningRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProcurementPlanningRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextPlanSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_plan_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createPlan(
            UUID id,
            String planNumber,
            ProcurementPlanInput input,
            UUID ownerUserId,
            String currency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_plans (
                    id,
                    plan_number,
                    name,
                    fiscal_year,
                    currency,
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
                    'DRAFT',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                planNumber,
                input.name().trim(),
                input.fiscalYear(),
                currency,
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void activatePlan(
            UUID planId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_plans
                SET
                    status = 'ACTIVE',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'DRAFT'
                """,
                planId
        );
    }

    public void closePlan(
            UUID planId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_plans
                SET
                    status = 'CLOSED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'ACTIVE'
                )
                """,
                planId
        );
    }

    public void createItem(
            UUID id,
            UUID planId,
            ProcurementPlanItemInput input
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_plan_items (
                    id,
                    plan_id,
                    title,
                    description,
                    department_id,
                    category,
                    planned_value,
                    target_sourcing_date,
                    priority,
                    status,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                planId,
                input.title().trim(),
                normalizeOptional(
                        input.description()
                ),
                input.departmentId(),
                input.category().trim(),
                input.plannedValue(),
                input.targetSourcingDate(),
                input.priority().name(),
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void linkRequest(
            UUID itemId,
            UUID requestId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_plan_items
                SET
                    linked_purchase_request_id = ?,
                    status = 'CONVERTED',
                    converted_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'READY',
                    'CONVERTED'
                )
                """,
                requestId,
                itemId
        );
    }

    public void updateItemStatus(
            UUID itemId,
            ProcurementPlanItemStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_plan_items
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                itemId
        );
    }

    public PlanRow findPlan(
            UUID planId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    plan.id,
                    plan.plan_number,
                    plan.name,
                    plan.fiscal_year,
                    plan.currency,
                    plan.status,
                    plan.owner_user_id,
                    app_user.full_name
                        AS owner_name,
                    plan.notes,
                    plan.created_at,
                    plan.updated_at,
                    plan.version,

                    COUNT(item.id)
                        AS total_items,

                    COUNT(item.id)
                        FILTER (
                            WHERE item.status IN (
                                'CONVERTED',
                                'COMPLETED'
                            )
                        )
                        AS converted_items,

                    COUNT(item.id)
                        FILTER (
                            WHERE item.status =
                                'COMPLETED'
                        )
                        AS completed_items,

                    COALESCE(
                        SUM(
                            item.planned_value
                        )
                        FILTER (
                            WHERE item.status
                                <> 'CANCELLED'
                        ),
                        0
                    ) AS planned_value,

                    COALESCE(
                        SUM(
                            request.estimated_total_amount
                        )
                        FILTER (
                            WHERE item.status
                                <> 'CANCELLED'
                            AND request.id
                                IS NOT NULL
                        ),
                        0
                    ) AS actual_value

                FROM procurement_plans plan

                JOIN app_users app_user
                    ON app_user.id =
                       plan.owner_user_id

                LEFT JOIN procurement_plan_items item
                    ON item.plan_id =
                       plan.id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       item.linked_purchase_request_id

                WHERE plan.id = ?

                GROUP BY
                    plan.id,
                    app_user.full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPlan(
                                resultSet
                        ),
                planId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PlanRow> findPlans(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    plan.id,
                    plan.plan_number,
                    plan.name,
                    plan.fiscal_year,
                    plan.currency,
                    plan.status,
                    plan.owner_user_id,
                    app_user.full_name
                        AS owner_name,
                    plan.notes,
                    plan.created_at,
                    plan.updated_at,
                    plan.version,

                    COUNT(item.id)
                        AS total_items,

                    COUNT(item.id)
                        FILTER (
                            WHERE item.status IN (
                                'CONVERTED',
                                'COMPLETED'
                            )
                        )
                        AS converted_items,

                    COUNT(item.id)
                        FILTER (
                            WHERE item.status =
                                'COMPLETED'
                        )
                        AS completed_items,

                    COALESCE(
                        SUM(
                            item.planned_value
                        )
                        FILTER (
                            WHERE item.status
                                <> 'CANCELLED'
                        ),
                        0
                    ) AS planned_value,

                    COALESCE(
                        SUM(
                            request.estimated_total_amount
                        )
                        FILTER (
                            WHERE item.status
                                <> 'CANCELLED'
                            AND request.id
                                IS NOT NULL
                        ),
                        0
                    ) AS actual_value

                FROM procurement_plans plan

                JOIN app_users app_user
                    ON app_user.id =
                       plan.owner_user_id

                LEFT JOIN procurement_plan_items item
                    ON item.plan_id =
                       plan.id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       item.linked_purchase_request_id

                WHERE plan.fiscal_year = ?
                AND plan.currency = ?
                AND plan.status
                    <> 'ARCHIVED'

                GROUP BY
                    plan.id,
                    app_user.full_name

                ORDER BY
                    plan.updated_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPlan(
                                resultSet
                        ),
                fiscalYear,
                currency
        );
    }

    public ItemRow findItem(
            UUID itemId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE item.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                itemId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ItemRow> findItems(
            UUID planId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE item.plan_id = ?
                        ORDER BY
                            item.target_sourcing_date,
                            item.created_at
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                planId
        );
    }

    public List<MonthlyRow> monthlyForecast(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    TO_CHAR(
                        DATE_TRUNC(
                            'month',
                            item.target_sourcing_date
                        ),
                        'YYYY-MM'
                    ) AS month_key,

                    COALESCE(
                        SUM(
                            item.planned_value
                        ),
                        0
                    ) AS planned_value,

                    COALESCE(
                        SUM(
                            request.estimated_total_amount
                        ),
                        0
                    ) AS actual_value,

                    COUNT(*)
                        AS initiative_count

                FROM procurement_plan_items item

                JOIN procurement_plans plan
                    ON plan.id =
                       item.plan_id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       item.linked_purchase_request_id

                WHERE plan.fiscal_year = ?
                AND plan.currency = ?
                AND plan.status
                    <> 'ARCHIVED'
                AND item.status
                    <> 'CANCELLED'

                GROUP BY
                    DATE_TRUNC(
                        'month',
                        item.target_sourcing_date
                    )

                ORDER BY
                    DATE_TRUNC(
                        'month',
                        item.target_sourcing_date
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new MonthlyRow(
                                resultSet.getString(
                                        "month_key"
                                ),
                                resultSet.getBigDecimal(
                                        "planned_value"
                                ),
                                resultSet.getBigDecimal(
                                        "actual_value"
                                ),
                                resultSet.getLong(
                                        "initiative_count"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<CategoryRow> categoryVariance(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    item.category,

                    COALESCE(
                        SUM(
                            item.planned_value
                        ),
                        0
                    ) AS planned_value,

                    COALESCE(
                        SUM(
                            request.estimated_total_amount
                        ),
                        0
                    ) AS actual_value,

                    COUNT(*)
                        AS initiative_count

                FROM procurement_plan_items item

                JOIN procurement_plans plan
                    ON plan.id =
                       item.plan_id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       item.linked_purchase_request_id

                WHERE plan.fiscal_year = ?
                AND plan.currency = ?
                AND plan.status
                    <> 'ARCHIVED'
                AND item.status
                    <> 'CANCELLED'

                GROUP BY
                    item.category

                ORDER BY
                    planned_value DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CategoryRow(
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getBigDecimal(
                                        "planned_value"
                                ),
                                resultSet.getBigDecimal(
                                        "actual_value"
                                ),
                                resultSet.getLong(
                                        "initiative_count"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<UpcomingRow> upcomingDemand(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    item.id,
                    plan.id
                        AS plan_id,
                    plan.plan_number,
                    item.title,
                    department.name
                        AS department_name,
                    item.category,
                    item.priority,
                    item.status,
                    item.planned_value,
                    item.target_sourcing_date,

                    (
                        item.target_sourcing_date
                        - CURRENT_DATE
                    ) AS days_until_target

                FROM procurement_plan_items item

                JOIN procurement_plans plan
                    ON plan.id =
                       item.plan_id

                JOIN departments department
                    ON department.id =
                       item.department_id

                WHERE plan.fiscal_year = ?
                AND plan.currency = ?
                AND plan.status IN (
                    'DRAFT',
                    'ACTIVE'
                )
                AND item.status IN (
                    'PLANNED',
                    'READY'
                )

                ORDER BY
                    item.target_sourcing_date

                LIMIT 30
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new UpcomingRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "plan_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "plan_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "department_name"
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                ProcurementPlanPriority
                                        .valueOf(
                                                resultSet.getString(
                                                        "priority"
                                                )
                                        ),
                                ProcurementPlanItemStatus
                                        .valueOf(
                                                resultSet.getString(
                                                        "status"
                                                )
                                        ),
                                resultSet.getBigDecimal(
                                        "planned_value"
                                ),
                                resultSet.getObject(
                                        "target_sourcing_date",
                                        LocalDate.class
                                ),
                                resultSet.getLong(
                                        "days_until_target"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<PlanningDepartmentOptionResponse>
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
                        new PlanningDepartmentOptionResponse(
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

    public List<PlanningUserOptionResponse>
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
                        new PlanningUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                ProcurementRole.valueOf(
                                        resultSet.getString(
                                                "role"
                                        )
                                )
                        )
        );
    }

    public List<PlanningRequestOptionResponse>
    purchaseRequests() {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    request.department_id,
                    department.name
                        AS department_name,
                    request.currency,
                    request.status,
                    request.estimated_total_amount
                FROM purchase_requests request
                JOIN departments department
                    ON department.id =
                       request.department_id
                WHERE request.status
                    <> 'CANCELLED'
                AND NOT EXISTS (
                    SELECT 1
                    FROM procurement_plan_items item
                    WHERE
                        item.linked_purchase_request_id =
                            request.id
                )
                ORDER BY
                    request.created_at DESC
                LIMIT 150
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PlanningRequestOptionResponse(
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
                                        "currency"
                                ),
                                resultSet.getString(
                                        "status"
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
                    FROM procurement_plan_items

                    UNION

                    SELECT category
                    FROM purchase_order_lines

                    UNION

                    SELECT category
                    FROM suppliers
                ) categories
                WHERE category IS NOT NULL
                AND category <> ''
                ORDER BY category
                """,
                String.class
        );
    }

    private String itemSql() {
        return """
                SELECT
                    item.id,
                    item.plan_id,
                    item.title,
                    item.description,
                    item.department_id,
                    department.name
                        AS department_name,
                    item.category,
                    item.planned_value,
                    item.target_sourcing_date,
                    item.priority,
                    item.status,

                    item.linked_purchase_request_id,

                    request.request_number
                        AS linked_request_number,

                    request.status
                        AS linked_request_status,

                    request.estimated_total_amount
                        AS linked_request_value,

                    item.converted_at,
                    item.notes,
                    item.created_at,
                    item.updated_at,
                    item.version

                FROM procurement_plan_items item

                JOIN departments department
                    ON department.id =
                       item.department_id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       item.linked_purchase_request_id

                """;
    }

    private PlanRow mapPlan(
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

        return new PlanRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "plan_number"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getString(
                        "currency"
                ),
                ProcurementPlanStatus.valueOf(
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
                resultSet.getLong(
                        "total_items"
                ),
                resultSet.getLong(
                        "converted_items"
                ),
                resultSet.getLong(
                        "completed_items"
                ),
                resultSet.getBigDecimal(
                        "planned_value"
                ),
                resultSet.getBigDecimal(
                        "actual_value"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ItemRow mapItem(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp converted =
                resultSet.getTimestamp(
                        "converted_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ItemRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "plan_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
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
                resultSet.getBigDecimal(
                        "planned_value"
                ),
                resultSet.getObject(
                        "target_sourcing_date",
                        LocalDate.class
                ),
                ProcurementPlanPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                ProcurementPlanItemStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "linked_purchase_request_id",
                        UUID.class
                ),
                resultSet.getString(
                        "linked_request_number"
                ),
                resultSet.getString(
                        "linked_request_status"
                ),
                resultSet.getBigDecimal(
                        "linked_request_value"
                ),
                resultSet.getString(
                        "notes"
                ),
                converted == null
                        ? null
                        : converted.toInstant(),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
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

    public record PlanRow(
            UUID id,
            String planNumber,
            String name,
            int fiscalYear,
            String currency,
            ProcurementPlanStatus status,
            UUID ownerUserId,
            String ownerName,
            String notes,
            long totalItems,
            long convertedItems,
            long completedItems,
            BigDecimal plannedValue,
            BigDecimal actualValue,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ItemRow(
            UUID id,
            UUID planId,
            String title,
            String description,
            UUID departmentId,
            String departmentName,
            String category,
            BigDecimal plannedValue,
            LocalDate targetSourcingDate,
            ProcurementPlanPriority priority,
            ProcurementPlanItemStatus status,
            UUID linkedPurchaseRequestId,
            String linkedRequestNumber,
            String linkedRequestStatus,
            BigDecimal linkedRequestValue,
            String notes,
            Instant convertedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record MonthlyRow(
            String month,
            BigDecimal plannedValue,
            BigDecimal actualValue,
            long initiativeCount
    ) {
    }

    public record CategoryRow(
            String category,
            BigDecimal plannedValue,
            BigDecimal actualValue,
            long initiativeCount
    ) {
    }

    public record UpcomingRow(
            UUID itemId,
            UUID planId,
            String planNumber,
            String title,
            String departmentName,
            String category,
            ProcurementPlanPriority priority,
            ProcurementPlanItemStatus status,
            BigDecimal plannedValue,
            LocalDate targetSourcingDate,
            long daysUntilTarget
    ) {
    }
}
