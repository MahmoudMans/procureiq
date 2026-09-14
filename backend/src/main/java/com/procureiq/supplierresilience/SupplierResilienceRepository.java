package com.procureiq.supplierresilience;

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
public class SupplierResilienceRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierResilienceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<SupplierMetricRow> supplierMetrics(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH supplier_spend AS (
                    SELECT
                        purchase_order.supplier_id,
                        SUM(
                            purchase_order.total_amount
                        ) AS supplier_spend
                    FROM purchase_orders purchase_order
                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?
                    GROUP BY
                        purchase_order.supplier_id
                ),

                total_spend AS (
                    SELECT
                        COALESCE(
                            SUM(
                                purchase_order.total_amount
                            ),
                            0
                        ) AS total_spend
                    FROM purchase_orders purchase_order
                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?
                ),

                category_spend AS (
                    SELECT
                        LOWER(
                            COALESCE(
                                supplier.category,
                                'uncategorized'
                            )
                        ) AS category_key,

                        SUM(
                            purchase_order.total_amount
                        ) AS category_spend

                    FROM purchase_orders purchase_order

                    JOIN suppliers supplier
                        ON supplier.id =
                           purchase_order.supplier_id

                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?

                    GROUP BY
                        LOWER(
                            COALESCE(
                                supplier.category,
                                'uncategorized'
                            )
                        )
                ),

                country_spend AS (
                    SELECT
                        LOWER(
                            COALESCE(
                                supplier.country,
                                'unknown'
                            )
                        ) AS country_key,

                        SUM(
                            purchase_order.total_amount
                        ) AS country_spend

                    FROM purchase_orders purchase_order

                    JOIN suppliers supplier
                        ON supplier.id =
                           purchase_order.supplier_id

                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?

                    GROUP BY
                        LOWER(
                            COALESCE(
                                supplier.country,
                                'unknown'
                            )
                        )
                )

                SELECT
                    supplier.id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category,
                    supplier.country,
                    supplier.rating,
                    supplier.risk_level,

                    profile.id
                        AS profile_id,
                    profile.status
                        AS profile_status,
                    profile.criticality,
                    profile.capacity_status,
                    profile.dependency_tolerance_pct,
                    profile.minimum_alternates,
                    profile.business_impact,
                    profile.capacity_notes,
                    profile.notes
                        AS profile_notes,
                    profile.owner_user_id
                        AS profile_owner_user_id,

                    profile_owner.full_name
                        AS profile_owner_name,

                    COALESCE(
                        supplier_spend.supplier_spend,
                        0
                    ) AS supplier_spend,

                    total_spend.total_spend,

                    COALESCE(
                        category_spend.category_spend,
                        0
                    ) AS category_spend,

                    COALESCE(
                        country_spend.country_spend,
                        0
                    ) AS country_spend,

                    (
                        SELECT COUNT(*)
                        FROM suppliers alternate
                        WHERE alternate.id
                            <> supplier.id
                        AND alternate.status =
                            'ACTIVE'
                        AND LOWER(
                            COALESCE(
                                alternate.category,
                                ''
                            )
                        ) =
                            LOWER(
                                COALESCE(
                                    supplier.category,
                                    ''
                                )
                            )
                    )
                        AS alternate_supplier_count,

                    (
                        SELECT review.weighted_score
                        FROM supplier_performance_reviews
                            review
                        WHERE review.supplier_id =
                            supplier.id
                        AND review.status =
                            'APPROVED'
                        ORDER BY
                            review.period_end DESC,
                            review.updated_at DESC
                        LIMIT 1
                    )
                        AS latest_performance_score,

                    (
                        SELECT COUNT(*)
                        FROM supplier_corrective_actions
                            corrective_action

                        JOIN supplier_performance_reviews
                            performance_review
                            ON performance_review.id =
                               corrective_action.review_id

                        WHERE performance_review.supplier_id =
                            supplier.id

                        AND corrective_action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_corrective_actions,

                    EXISTS (
                        SELECT 1
                        FROM supplier_contracts contract
                        WHERE contract.supplier_id =
                            supplier.id
                        AND contract.status =
                            'ACTIVE'
                        AND contract.end_date
                            >= CURRENT_DATE
                    )
                        AS active_contract_coverage,

                    (
                        SELECT COUNT(*)
                        FROM supplier_resilience_actions
                            resilience_action
                        WHERE
                            resilience_action.profile_id =
                                profile.id
                        AND resilience_action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_mitigation_actions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_resilience_actions
                            resilience_action
                        WHERE
                            resilience_action.profile_id =
                                profile.id
                        AND resilience_action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND resilience_action.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_mitigation_actions

                FROM suppliers supplier

                LEFT JOIN supplier_spend
                    ON supplier_spend.supplier_id =
                       supplier.id

                CROSS JOIN total_spend

                LEFT JOIN category_spend
                    ON category_spend.category_key =
                       LOWER(
                           COALESCE(
                               supplier.category,
                               'uncategorized'
                           )
                       )

                LEFT JOIN country_spend
                    ON country_spend.country_key =
                       LOWER(
                           COALESCE(
                               supplier.country,
                               'unknown'
                           )
                       )

                LEFT JOIN supplier_resilience_profiles
                    profile
                    ON profile.supplier_id =
                       supplier.id

                LEFT JOIN app_users profile_owner
                    ON profile_owner.id =
                       profile.owner_user_id

                WHERE supplier.status =
                    'ACTIVE'

                ORDER BY
                    COALESCE(
                        supplier_spend.supplier_spend,
                        0
                    ) DESC,
                    supplier.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSupplierMetric(
                                resultSet
                        ),
                currency,
                currency,
                currency,
                currency
        );
    }

    public SupplierMetricRow supplierMetric(
            UUID supplierId,
            String currency
    ) {
        return supplierMetrics(
                currency
        )
                .stream()
                .filter(
                        row ->
                                row.supplierId()
                                        .equals(
                                                supplierId
                                        )
                )
                .findFirst()
                .orElse(null);
    }

    public List<CountrySpendRow> countryConcentrations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH country_rollup AS (
                    SELECT
                        COALESCE(
                            supplier.country,
                            'Unknown'
                        ) AS country,

                        COUNT(
                            DISTINCT supplier.id
                        ) AS supplier_count,

                        SUM(
                            purchase_order.total_amount
                        ) AS country_spend

                    FROM purchase_orders purchase_order

                    JOIN suppliers supplier
                        ON supplier.id =
                           purchase_order.supplier_id

                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?

                    GROUP BY
                        COALESCE(
                            supplier.country,
                            'Unknown'
                        )
                ),

                total_spend AS (
                    SELECT
                        COALESCE(
                            SUM(
                                purchase_order.total_amount
                            ),
                            0
                        ) AS total_spend

                    FROM purchase_orders purchase_order

                    WHERE purchase_order.status
                        <> 'CANCELLED'
                    AND purchase_order.currency = ?
                )

                SELECT
                    country_rollup.country,
                    country_rollup.supplier_count,
                    country_rollup.country_spend,
                    total_spend.total_spend

                FROM country_rollup
                CROSS JOIN total_spend

                ORDER BY
                    country_rollup.country_spend DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CountrySpendRow(
                                resultSet.getString(
                                        "country"
                                ),
                                resultSet.getLong(
                                        "supplier_count"
                                ),
                                resultSet.getBigDecimal(
                                        "country_spend"
                                ),
                                resultSet.getBigDecimal(
                                        "total_spend"
                                )
                        ),
                currency,
                currency
        );
    }

    public void upsertProfile(
            UUID id,
            UUID supplierId,
            SupplierResilienceProfileInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_resilience_profiles (
                    id,
                    supplier_id,
                    status,
                    criticality,
                    capacity_status,
                    dependency_tolerance_pct,
                    minimum_alternates,
                    business_impact,
                    capacity_notes,
                    notes,
                    owner_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    'ACTIVE',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    supplier_id
                )

                DO UPDATE SET
                    status =
                        'ACTIVE',
                    criticality =
                        EXCLUDED.criticality,
                    capacity_status =
                        EXCLUDED.capacity_status,
                    dependency_tolerance_pct =
                        EXCLUDED.dependency_tolerance_pct,
                    minimum_alternates =
                        EXCLUDED.minimum_alternates,
                    business_impact =
                        EXCLUDED.business_impact,
                    capacity_notes =
                        EXCLUDED.capacity_notes,
                    notes =
                        EXCLUDED.notes,
                    owner_user_id =
                        EXCLUDED.owner_user_id,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        supplier_resilience_profiles.version
                        + 1
                """,
                id,
                supplierId,
                input.criticality()
                        .name(),
                input.capacityStatus()
                        .name(),
                input.dependencyTolerancePct(),
                input.minimumAlternates(),
                normalizeOptional(
                        input.businessImpact()
                ),
                normalizeOptional(
                        input.capacityNotes()
                ),
                normalizeOptional(
                        input.notes()
                ),
                ownerUserId
        );
    }

    public ProfileRow findProfileBySupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                profileSql()
                        + """
                        WHERE profile.supplier_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProfile(
                                resultSet
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public ProfileRow findProfile(
            UUID profileId
    ) {
        return jdbcTemplate.query(
                profileSql()
                        + """
                        WHERE profile.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProfile(
                                resultSet
                        ),
                profileId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void setProfileActive(
            UUID profileId,
            boolean active
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_resilience_profiles
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                active
                        ? "ACTIVE"
                        : "INACTIVE",
                profileId
        );
    }

    public void createAction(
            UUID id,
            UUID profileId,
            ResilienceActionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_resilience_actions (
                    id,
                    profile_id,
                    action_type,
                    title,
                    description,
                    owner_user_id,
                    due_date,
                    status,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                profileId,
                input.actionType()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                ownerUserId,
                input.dueDate()
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_resilience_actions
                SET
                    status =
                        'IN_PROGRESS',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                actionId
        );
    }

    public void completeAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_resilience_actions
                SET
                    status =
                        'COMPLETED',
                    completion_note = ?,
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void cancelAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_resilience_actions
                SET
                    status =
                        'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'COMPLETED'
                """,
                actionId
        );
    }

    public ActionRow findAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ActionRow> findActions(
            UUID profileId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.profile_id = ?
                        ORDER BY
                            CASE action.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,
                            action.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                profileId
        );
    }

    public List<AlternativeRow> alternatives(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    alternative.id,
                    alternative.supplier_code,
                    alternative.legal_name,
                    alternative.country,
                    alternative.rating,
                    alternative.risk_level,

                    (
                        SELECT review.weighted_score
                        FROM supplier_performance_reviews
                            review
                        WHERE review.supplier_id =
                            alternative.id
                        AND review.status =
                            'APPROVED'
                        ORDER BY
                            review.period_end DESC,
                            review.updated_at DESC
                        LIMIT 1
                    )
                        AS latest_performance_score

                FROM suppliers alternative

                WHERE alternative.id
                    <> ?

                AND alternative.status =
                    'ACTIVE'

                AND LOWER(
                    COALESCE(
                        alternative.category,
                        ''
                    )
                ) =
                    LOWER(
                        COALESCE(
                            (
                                SELECT category
                                FROM suppliers
                                WHERE id = ?
                            ),
                            ''
                        )
                    )

                ORDER BY
                    CASE alternative.risk_level
                        WHEN 'LOW'
                        THEN 1
                        WHEN 'MEDIUM'
                        THEN 2
                        WHEN 'HIGH'
                        THEN 3
                        WHEN 'CRITICAL'
                        THEN 4
                        ELSE 5
                    END,
                    alternative.rating DESC,
                    alternative.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AlternativeRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_code"
                                ),
                                resultSet.getString(
                                        "legal_name"
                                ),
                                resultSet.getString(
                                        "country"
                                ),
                                resultSet.getBigDecimal(
                                        "rating"
                                ),
                                resultSet.getString(
                                        "risk_level"
                                ),
                                resultSet.getBigDecimal(
                                        "latest_performance_score"
                                )
                        ),
                supplierId,
                supplierId
        );
    }

    public List<ResilienceUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active = TRUE
                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ResilienceUserOptionResponse(
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

    private String profileSql() {
        return """
                SELECT
                    profile.id,
                    profile.supplier_id,
                    profile.status,
                    profile.criticality,
                    profile.capacity_status,
                    profile.dependency_tolerance_pct,
                    profile.minimum_alternates,
                    profile.business_impact,
                    profile.capacity_notes,
                    profile.notes,
                    profile.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    profile.created_at,
                    profile.updated_at,
                    profile.version

                FROM supplier_resilience_profiles
                    profile

                JOIN app_users owner
                    ON owner.id =
                       profile.owner_user_id

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    action.id,
                    action.profile_id,
                    action.action_type,
                    action.title,
                    action.description,
                    action.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    action.due_date,
                    action.status,
                    action.completion_note,
                    action.completed_at,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM supplier_resilience_actions
                    action

                JOIN app_users owner
                    ON owner.id =
                       action.owner_user_id

                """;
    }

    private SupplierMetricRow mapSupplierMetric(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        String profileStatus =
                resultSet.getString(
                        "profile_status"
                );

        String criticality =
                resultSet.getString(
                        "criticality"
                );

        String capacity =
                resultSet.getString(
                        "capacity_status"
                );

        Integer minimumAlternates =
                (
                        Integer
                ) resultSet.getObject(
                        "minimum_alternates"
                );

        return new SupplierMetricRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_code"
                ),
                resultSet.getString(
                        "legal_name"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "country"
                ),
                resultSet.getBigDecimal(
                        "rating"
                ),
                resultSet.getString(
                        "risk_level"
                ),
                resultSet.getObject(
                        "profile_id",
                        UUID.class
                ),
                profileStatus == null
                        ? null
                        : SupplierResilienceProfileStatus
                                .valueOf(
                                        profileStatus
                                ),
                criticality == null
                        ? null
                        : SupplierCriticality
                                .valueOf(
                                        criticality
                                ),
                capacity == null
                        ? null
                        : SupplierCapacityStatus
                                .valueOf(
                                        capacity
                                ),
                resultSet.getBigDecimal(
                        "dependency_tolerance_pct"
                ),
                minimumAlternates,
                resultSet.getString(
                        "business_impact"
                ),
                resultSet.getString(
                        "capacity_notes"
                ),
                resultSet.getString(
                        "profile_notes"
                ),
                resultSet.getObject(
                        "profile_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "profile_owner_name"
                ),
                resultSet.getBigDecimal(
                        "supplier_spend"
                ),
                resultSet.getBigDecimal(
                        "total_spend"
                ),
                resultSet.getBigDecimal(
                        "category_spend"
                ),
                resultSet.getBigDecimal(
                        "country_spend"
                ),
                resultSet.getInt(
                        "alternate_supplier_count"
                ),
                resultSet.getBigDecimal(
                        "latest_performance_score"
                ),
                resultSet.getLong(
                        "open_corrective_actions"
                ),
                resultSet.getBoolean(
                        "active_contract_coverage"
                ),
                resultSet.getLong(
                        "open_mitigation_actions"
                ),
                resultSet.getLong(
                        "overdue_mitigation_actions"
                )
        );
    }

    private ProfileRow mapProfile(
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

        return new ProfileRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                SupplierResilienceProfileStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                SupplierCriticality
                        .valueOf(
                                resultSet.getString(
                                        "criticality"
                                )
                        ),
                SupplierCapacityStatus
                        .valueOf(
                                resultSet.getString(
                                        "capacity_status"
                                )
                        ),
                resultSet.getBigDecimal(
                        "dependency_tolerance_pct"
                ),
                resultSet.getInt(
                        "minimum_alternates"
                ),
                resultSet.getString(
                        "business_impact"
                ),
                resultSet.getString(
                        "capacity_notes"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ActionRow mapAction(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp completed =
                resultSet.getTimestamp(
                        "completed_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "profile_id",
                        UUID.class
                ),
                ResilienceActionType
                        .valueOf(
                                resultSet.getString(
                                        "action_type"
                                )
                        ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                ResilienceActionStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getString(
                        "completion_note"
                ),
                completed == null
                        ? null
                        : completed.toInstant(),
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

    public record SupplierMetricRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            BigDecimal supplierRating,
            String supplierRiskLevel,

            UUID profileId,
            SupplierResilienceProfileStatus profileStatus,
            SupplierCriticality criticality,
            SupplierCapacityStatus capacityStatus,
            BigDecimal dependencyTolerancePct,
            Integer minimumAlternates,
            String businessImpact,
            String capacityNotes,
            String profileNotes,
            UUID profileOwnerUserId,
            String profileOwnerName,

            BigDecimal supplierSpend,
            BigDecimal portfolioSpend,
            BigDecimal categorySpend,
            BigDecimal countrySpend,

            int alternateSupplierCount,

            BigDecimal latestPerformanceScore,
            long openCorrectiveActions,
            boolean activeContractCoverage,

            long openMitigationActions,
            long overdueMitigationActions
    ) {
    }

    public record CountrySpendRow(
            String country,
            long supplierCount,
            BigDecimal spend,
            BigDecimal totalSpend
    ) {
    }

    public record ProfileRow(
            UUID id,
            UUID supplierId,
            SupplierResilienceProfileStatus status,
            SupplierCriticality criticality,
            SupplierCapacityStatus capacityStatus,
            BigDecimal dependencyTolerancePct,
            int minimumAlternates,
            String businessImpact,
            String capacityNotes,
            String notes,
            UUID ownerUserId,
            String ownerName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ActionRow(
            UUID id,
            UUID profileId,
            ResilienceActionType actionType,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            ResilienceActionStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record AlternativeRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String country,
            BigDecimal rating,
            String riskLevel,
            BigDecimal latestPerformanceScore
    ) {
    }
}
