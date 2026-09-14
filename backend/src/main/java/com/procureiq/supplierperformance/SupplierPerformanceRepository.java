package com.procureiq.supplierperformance;

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
public class SupplierPerformanceRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPerformanceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'supplier_performance_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public SupplierSnapshotRow supplierSnapshot(
            UUID supplierId,
            LocalDate periodStart,
            LocalDate periodEnd
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category,
                    supplier.country,
                    supplier.rating,
                    supplier.risk_level,

                    COUNT(
                        purchase_order.id
                    )
                        AS po_count,

                    COALESCE(
                        SUM(
                            purchase_order.total_amount
                        ),
                        0
                    )
                        AS po_value,

                    COUNT(
                        purchase_order.id
                    )
                    FILTER (
                        WHERE
                            purchase_order.status IN (
                                'ISSUED',
                                'PARTIALLY_RECEIVED'
                            )
                        AND
                            purchase_order.expected_delivery_date
                            < CURRENT_DATE
                    )
                        AS overdue_po_count

                FROM suppliers supplier

                LEFT JOIN purchase_orders
                    purchase_order
                    ON purchase_order.supplier_id =
                       supplier.id
                    AND purchase_order.created_at::date
                        BETWEEN ? AND ?

                WHERE supplier.id = ?

                GROUP BY
                    supplier.id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category,
                    supplier.country,
                    supplier.rating,
                    supplier.risk_level
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierSnapshotRow(
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
                                resultSet.getLong(
                                        "po_count"
                                ),
                                resultSet.getBigDecimal(
                                        "po_value"
                                ),
                                resultSet.getLong(
                                        "overdue_po_count"
                                )
                        ),
                periodStart,
                periodEnd,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createReview(
            UUID id,
            String reviewNumber,
            SupplierPerformanceReviewInput input,
            UUID ownerUserId,
            BigDecimal weightedScore,
            SupplierPerformanceBand band,
            SupplierSnapshotRow snapshot
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_performance_reviews (
                    id,
                    review_number,
                    supplier_id,
                    period_start,
                    period_end,
                    status,
                    quality_score,
                    delivery_score,
                    commercial_score,
                    service_score,
                    compliance_score,
                    weighted_score,
                    performance_band,
                    supplier_rating_snapshot,
                    supplier_risk_snapshot,
                    po_count_snapshot,
                    po_value_snapshot,
                    overdue_po_count_snapshot,
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
                    ?,
                    ?,
                    ?,
                    ?,
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
                """,
                id,
                reviewNumber,
                input.supplierId(),
                input.periodStart(),
                input.periodEnd(),
                input.qualityScore(),
                input.deliveryScore(),
                input.commercialScore(),
                input.serviceScore(),
                input.complianceScore(),
                weightedScore,
                band.name(),
                snapshot.rating(),
                snapshot.riskLevel(),
                snapshot.purchaseOrderCount(),
                snapshot.purchaseOrderValue(),
                snapshot.overduePurchaseOrderCount(),
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void submitReview(
            UUID reviewId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_performance_reviews
                SET
                    status = 'SUBMITTED',
                    submitted_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'DRAFT'
                """,
                reviewId
        );
    }

    public void decideReview(
            UUID reviewId,
            SupplierPerformanceReviewStatus status,
            UUID decidedByUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_performance_reviews
                SET
                    status = ?,
                    decided_by_user_id = ?,
                    decision_note = ?,
                    decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'SUBMITTED'
                """,
                status.name(),
                decidedByUserId,
                note.trim(),
                reviewId
        );
    }

    public ReviewRow findReview(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE review.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                reviewId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ReviewRow> findReviews() {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        ORDER BY
                            review.period_end DESC,
                            review.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        )
        );
    }

    public List<ReviewRow> findSupplierReviews(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE review.supplier_id = ?
                        ORDER BY
                            review.period_end DESC,
                            review.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                supplierId
        );
    }

    public void createCorrectiveAction(
            UUID id,
            UUID reviewId,
            CorrectiveActionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_corrective_actions (
                    id,
                    review_id,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                reviewId,
                input.title().trim(),
                normalizeOptional(
                        input.description()
                ),
                ownerUserId,
                input.dueDate()
        );
    }

    public void startCorrectiveAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_corrective_actions
                SET
                    status = 'IN_PROGRESS',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'OPEN'
                """,
                actionId
        );
    }

    public void completeCorrectiveAction(
            UUID actionId,
            String completionNote
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_corrective_actions
                SET
                    status = 'COMPLETED',
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
                completionNote.trim(),
                actionId
        );
    }

    public void cancelCorrectiveAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_corrective_actions
                SET
                    status = 'CANCELLED',
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

    public CorrectiveActionRow findCorrectiveAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                correctiveActionSql()
                        + """
                        WHERE action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCorrectiveAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CorrectiveActionRow> findCorrectiveActions(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                correctiveActionSql()
                        + """
                        WHERE action.review_id = ?
                        ORDER BY
                            CASE action.status
                                WHEN 'OPEN' THEN 1
                                WHEN 'IN_PROGRESS' THEN 2
                                WHEN 'COMPLETED' THEN 3
                                ELSE 4
                            END,
                            action.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCorrectiveAction(
                                resultSet
                        ),
                reviewId
        );
    }

    public List<CorrectiveActionRow> findOpenCorrectiveActions() {
        return jdbcTemplate.query(
                correctiveActionSql()
                        + """
                        WHERE action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        ORDER BY
                            action.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCorrectiveAction(
                                resultSet
                        )
        );
    }

    public List<PerformanceSupplierOptionResponse> suppliers() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    category,
                    country,
                    rating,
                    risk_level
                FROM suppliers
                WHERE status = 'ACTIVE'
                ORDER BY
                    legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PerformanceSupplierOptionResponse(
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
                                )
                        )
        );
    }

    public List<PerformanceUserOptionResponse> users() {
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
                        new PerformanceUserOptionResponse(
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

    private String reviewSql() {
        return """
                SELECT
                    review.id,
                    review.review_number,

                    review.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category
                        AS supplier_category,

                    review.period_start,
                    review.period_end,
                    review.status,

                    review.quality_score,
                    review.delivery_score,
                    review.commercial_score,
                    review.service_score,
                    review.compliance_score,

                    review.weighted_score,
                    review.performance_band,

                    review.supplier_rating_snapshot,
                    review.supplier_risk_snapshot,

                    review.po_count_snapshot,
                    review.po_value_snapshot,
                    review.overdue_po_count_snapshot,

                    review.owner_user_id,
                    owner.full_name
                        AS owner_name,

                    review.submitted_at,

                    review.decision_note,
                    review.decided_at,

                    decider.full_name
                        AS decided_by_name,

                    review.notes,

                    (
                        SELECT COUNT(*)
                        FROM supplier_corrective_actions
                            corrective
                        WHERE
                            corrective.review_id =
                                review.id
                        AND corrective.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_corrective_actions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_corrective_actions
                            corrective
                        WHERE
                            corrective.review_id =
                                review.id
                        AND corrective.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND corrective.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_corrective_actions,

                    review.created_at,
                    review.updated_at,
                    review.version

                FROM supplier_performance_reviews
                    review

                JOIN suppliers supplier
                    ON supplier.id =
                       review.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       review.owner_user_id

                LEFT JOIN app_users decider
                    ON decider.id =
                       review.decided_by_user_id

                """;
    }

    private String correctiveActionSql() {
        return """
                SELECT
                    action.id,
                    action.review_id,
                    action.title,
                    action.description,
                    action.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    action.due_date,
                    action.status,
                    action.completed_at,
                    action.completion_note,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM supplier_corrective_actions
                    action

                JOIN app_users owner
                    ON owner.id =
                       action.owner_user_id

                """;
    }

    private ReviewRow mapReview(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp submitted =
                resultSet.getTimestamp(
                        "submitted_at"
                );

        Timestamp decided =
                resultSet.getTimestamp(
                        "decided_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ReviewRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "review_number"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_code"
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getString(
                        "supplier_category"
                ),
                resultSet.getObject(
                        "period_start",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "period_end",
                        LocalDate.class
                ),
                SupplierPerformanceReviewStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getBigDecimal(
                        "quality_score"
                ),
                resultSet.getBigDecimal(
                        "delivery_score"
                ),
                resultSet.getBigDecimal(
                        "commercial_score"
                ),
                resultSet.getBigDecimal(
                        "service_score"
                ),
                resultSet.getBigDecimal(
                        "compliance_score"
                ),
                resultSet.getBigDecimal(
                        "weighted_score"
                ),
                SupplierPerformanceBand.valueOf(
                        resultSet.getString(
                                "performance_band"
                        )
                ),
                resultSet.getBigDecimal(
                        "supplier_rating_snapshot"
                ),
                resultSet.getString(
                        "supplier_risk_snapshot"
                ),
                resultSet.getLong(
                        "po_count_snapshot"
                ),
                resultSet.getBigDecimal(
                        "po_value_snapshot"
                ),
                resultSet.getLong(
                        "overdue_po_count_snapshot"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                submitted == null
                        ? null
                        : submitted.toInstant(),
                resultSet.getString(
                        "decision_note"
                ),
                decided == null
                        ? null
                        : decided.toInstant(),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "open_corrective_actions"
                ),
                resultSet.getLong(
                        "overdue_corrective_actions"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private CorrectiveActionRow mapCorrectiveAction(
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

        return new CorrectiveActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "review_id",
                        UUID.class
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
                CorrectiveActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                completed == null
                        ? null
                        : completed.toInstant(),
                resultSet.getString(
                        "completion_note"
                ),
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

    public record SupplierSnapshotRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            BigDecimal rating,
            String riskLevel,
            long purchaseOrderCount,
            BigDecimal purchaseOrderValue,
            long overduePurchaseOrderCount
    ) {
    }

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String supplierCategory,
            LocalDate periodStart,
            LocalDate periodEnd,
            SupplierPerformanceReviewStatus status,
            BigDecimal qualityScore,
            BigDecimal deliveryScore,
            BigDecimal commercialScore,
            BigDecimal serviceScore,
            BigDecimal complianceScore,
            BigDecimal weightedScore,
            SupplierPerformanceBand performanceBand,
            BigDecimal supplierRatingSnapshot,
            String supplierRiskSnapshot,
            long purchaseOrderCountSnapshot,
            BigDecimal purchaseOrderValueSnapshot,
            long overduePurchaseOrderCountSnapshot,
            UUID ownerUserId,
            String ownerName,
            Instant submittedAt,
            String decisionNote,
            Instant decidedAt,
            String decidedByName,
            String notes,
            long openCorrectiveActions,
            long overdueCorrectiveActions,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record CorrectiveActionRow(
            UUID id,
            UUID reviewId,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            CorrectiveActionStatus status,
            Instant completedAt,
            String completionNote,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }
}
