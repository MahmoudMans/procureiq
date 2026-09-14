package com.procureiq.demandconsolidation;

import com.procureiq.guidedbuying.GuidedBuyingIntakeStatus;
import com.procureiq.guidedbuying.GuidedBuyingRoute;
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
public class DemandConsolidationRepository {

    private final JdbcTemplate jdbcTemplate;

    public DemandConsolidationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextBundleSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'demand_consolidation_bundle_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<EligibleIntakeRow> eligibleIntakes() {
        return jdbcTemplate.query(
                """
                SELECT
                    intake.id,
                    intake.intake_number,
                    intake.title,
                    intake.department_id,

                    department.name
                        AS department_name,

                    intake.category,
                    intake.currency,
                    intake.estimated_amount,
                    intake.status,
                    intake.guidance_route,
                    intake.created_at

                FROM guided_buying_intakes
                    intake

                JOIN departments department
                    ON department.id =
                       intake.department_id

                WHERE intake.status IN (
                    'DRAFT',
                    'READY'
                )

                AND NOT EXISTS (
                    SELECT 1
                    FROM demand_consolidation_bundle_items
                        bundle_item

                    JOIN demand_consolidation_bundles
                        bundle
                        ON bundle.id =
                           bundle_item.bundle_id

                    WHERE
                        bundle_item.guided_buying_intake_id =
                            intake.id

                    AND bundle.status
                        <> 'CANCELLED'
                )

                ORDER BY
                    LOWER(
                        intake.category
                    ),
                    intake.currency,
                    intake.created_at
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new EligibleIntakeRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "intake_number"
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
                                    "category"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            resultSet.getBigDecimal(
                                    "estimated_amount"
                            ),
                            GuidedBuyingIntakeStatus
                                    .valueOf(
                                            resultSet.getString(
                                                    "status"
                                            )
                                    ),
                            GuidedBuyingRoute
                                    .valueOf(
                                            resultSet.getString(
                                                    "guidance_route"
                                            )
                                    ),
                            created.toInstant()
                    );
                }
        );
    }

    public void createBundle(
            UUID bundleId,
            String bundleNumber,
            DemandBundleInput input,
            UUID ownerUserId,
            BigDecimal consolidatedValue,
            BigDecimal expectedLeveragePct,
            BigDecimal expectedSavings,
            int intakeCount,
            int departmentCount,
            String normalizedCurrency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO demand_consolidation_bundles (
                    id,
                    bundle_number,
                    title,
                    category,
                    currency,
                    status,
                    target_sourcing_date,
                    consolidated_value,
                    expected_leverage_pct,
                    expected_savings,
                    intake_count,
                    department_count,
                    owner_user_id,
                    rationale,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                bundleId,
                bundleNumber,
                input.title()
                        .trim(),
                input.category()
                        .trim(),
                normalizedCurrency,
                input.targetSourcingDate(),
                consolidatedValue,
                expectedLeveragePct,
                expectedSavings,
                intakeCount,
                departmentCount,
                ownerUserId,
                normalizeOptional(
                        input.rationale()
                )
        );
    }

    public void createBundleItem(
            UUID bundleId,
            EligibleIntakeRow intake
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO demand_consolidation_bundle_items (
                    id,
                    bundle_id,
                    guided_buying_intake_id,
                    department_id,
                    estimated_amount,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                bundleId,
                intake.id(),
                intake.departmentId(),
                intake.estimatedAmount()
        );
    }

    public BundleRow findBundle(
            UUID bundleId
    ) {
        return jdbcTemplate.query(
                bundleSql()
                        + """
                        WHERE bundle.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapBundle(
                                resultSet
                        ),
                bundleId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<BundleRow> findBundles() {
        return jdbcTemplate.query(
                bundleSql()
                        + """
                        ORDER BY
                            CASE bundle.status
                                WHEN 'UNDER_REVIEW'
                                THEN 1
                                WHEN 'APPROVED'
                                THEN 2
                                WHEN 'SOURCING'
                                THEN 3
                                WHEN 'DRAFT'
                                THEN 4
                                WHEN 'CLOSED'
                                THEN 5
                                ELSE 6
                            END,
                            bundle.target_sourcing_date,
                            bundle.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapBundle(
                                resultSet
                        )
        );
    }

    public List<BundleItemRow> findBundleItems(
            UUID bundleId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    bundle_item.id,

                    bundle_item.guided_buying_intake_id
                        AS intake_id,

                    intake.intake_number,
                    intake.title,

                    bundle_item.department_id,
                    department.name
                        AS department_name,

                    bundle_item.estimated_amount,

                    intake.status
                        AS intake_status,

                    intake.guidance_route

                FROM demand_consolidation_bundle_items
                    bundle_item

                JOIN guided_buying_intakes intake
                    ON intake.id =
                       bundle_item.guided_buying_intake_id

                JOIN departments department
                    ON department.id =
                       bundle_item.department_id

                WHERE bundle_item.bundle_id = ?

                ORDER BY
                    department.name,
                    intake.intake_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BundleItemRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "intake_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "intake_number"
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
                                resultSet.getBigDecimal(
                                        "estimated_amount"
                                ),
                                GuidedBuyingIntakeStatus
                                        .valueOf(
                                                resultSet.getString(
                                                        "intake_status"
                                                )
                                        ),
                                GuidedBuyingRoute
                                        .valueOf(
                                                resultSet.getString(
                                                        "guidance_route"
                                                )
                                        )
                        ),
                bundleId
        );
    }

    public void submitBundle(
            UUID bundleId
    ) {
        jdbcTemplate.update(
                """
                UPDATE demand_consolidation_bundles
                SET
                    status = 'UNDER_REVIEW',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'DRAFT'
                """,
                bundleId
        );
    }

    public void approveBundle(
            UUID bundleId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE demand_consolidation_bundles
                SET
                    status = 'APPROVED',
                    decided_by_user_id = ?,
                    decision_note = ?,
                    decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'UNDER_REVIEW'
                """,
                currentUserId,
                note.trim(),
                bundleId
        );
    }

    public void cancelBundle(
            UUID bundleId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE demand_consolidation_bundles
                SET
                    status = 'CANCELLED',
                    decided_by_user_id = ?,
                    decision_note = ?,
                    decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'UNDER_REVIEW',
                    'APPROVED'
                )
                """,
                currentUserId,
                note.trim(),
                bundleId
        );
    }

    public RfqRow findRfq(
            UUID rfqId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    rfq_number,
                    title,
                    currency,
                    status
                FROM rfqs
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new RfqRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        ),
                rfqId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void linkRfq(
            UUID bundleId,
            UUID rfqId
    ) {
        jdbcTemplate.update(
                """
                UPDATE demand_consolidation_bundles
                SET
                    linked_rfq_id = ?,
                    status = 'SOURCING',
                    sourcing_started_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'APPROVED'
                """,
                rfqId,
                bundleId
        );
    }

    public void closeBundle(
            UUID bundleId
    ) {
        jdbcTemplate.update(
                """
                UPDATE demand_consolidation_bundles
                SET
                    status = 'CLOSED',
                    closed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'SOURCING'
                """,
                bundleId
        );
    }

    public List<DemandConsolidationUserOptionResponse> users() {
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
                        new DemandConsolidationUserOptionResponse(
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

    public List<DemandConsolidationRfqOptionResponse> rfqs() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    rfq_number,
                    title,
                    currency,
                    status
                FROM rfqs
                WHERE status
                    <> 'CANCELLED'
                ORDER BY
                    created_at DESC
                LIMIT 150
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DemandConsolidationRfqOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        )
        );
    }

    private String bundleSql() {
        return """
                SELECT
                    bundle.id,
                    bundle.bundle_number,
                    bundle.title,
                    bundle.category,
                    bundle.currency,
                    bundle.status,
                    bundle.target_sourcing_date,

                    bundle.consolidated_value,
                    bundle.expected_leverage_pct,
                    bundle.expected_savings,

                    bundle.intake_count,
                    bundle.department_count,

                    bundle.owner_user_id,
                    owner.full_name
                        AS owner_name,

                    bundle.rationale,

                    bundle.decision_note,
                    bundle.decided_at,

                    decider.full_name
                        AS decided_by_name,

                    bundle.linked_rfq_id,
                    rfq.rfq_number
                        AS linked_rfq_number,
                    rfq.title
                        AS linked_rfq_title,
                    rfq.status
                        AS linked_rfq_status,

                    bundle.sourcing_started_at,
                    bundle.closed_at,

                    bundle.created_at,
                    bundle.updated_at,
                    bundle.version

                FROM demand_consolidation_bundles
                    bundle

                JOIN app_users owner
                    ON owner.id =
                       bundle.owner_user_id

                LEFT JOIN app_users decider
                    ON decider.id =
                       bundle.decided_by_user_id

                LEFT JOIN rfqs rfq
                    ON rfq.id =
                       bundle.linked_rfq_id

                """;
    }

    private BundleRow mapBundle(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp decided =
                resultSet.getTimestamp(
                        "decided_at"
                );

        Timestamp sourcing =
                resultSet.getTimestamp(
                        "sourcing_started_at"
                );

        Timestamp closed =
                resultSet.getTimestamp(
                        "closed_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new BundleRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "bundle_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "currency"
                ),
                DemandBundleStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "target_sourcing_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "consolidated_value"
                ),
                resultSet.getBigDecimal(
                        "expected_leverage_pct"
                ),
                resultSet.getBigDecimal(
                        "expected_savings"
                ),
                resultSet.getInt(
                        "intake_count"
                ),
                resultSet.getInt(
                        "department_count"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "rationale"
                ),
                resultSet.getString(
                        "decision_note"
                ),
                decided == null
                        ? null
                        : decided.toInstant(),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getObject(
                        "linked_rfq_id",
                        UUID.class
                ),
                resultSet.getString(
                        "linked_rfq_number"
                ),
                resultSet.getString(
                        "linked_rfq_title"
                ),
                resultSet.getString(
                        "linked_rfq_status"
                ),
                sourcing == null
                        ? null
                        : sourcing.toInstant(),
                closed == null
                        ? null
                        : closed.toInstant(),
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

    public record EligibleIntakeRow(
            UUID id,
            String intakeNumber,
            String title,
            UUID departmentId,
            String departmentName,
            String category,
            String currency,
            BigDecimal estimatedAmount,
            GuidedBuyingIntakeStatus status,
            GuidedBuyingRoute guidanceRoute,
            Instant createdAt
    ) {
    }

    public record BundleRow(
            UUID id,
            String bundleNumber,
            String title,
            String category,
            String currency,
            DemandBundleStatus status,
            LocalDate targetSourcingDate,
            BigDecimal consolidatedValue,
            BigDecimal expectedLeveragePct,
            BigDecimal expectedSavings,
            int intakeCount,
            int departmentCount,
            UUID ownerUserId,
            String ownerName,
            String rationale,
            String decisionNote,
            Instant decidedAt,
            String decidedByName,
            UUID linkedRfqId,
            String linkedRfqNumber,
            String linkedRfqTitle,
            String linkedRfqStatus,
            Instant sourcingStartedAt,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record BundleItemRow(
            UUID id,
            UUID intakeId,
            String intakeNumber,
            String title,
            UUID departmentId,
            String departmentName,
            BigDecimal estimatedAmount,
            GuidedBuyingIntakeStatus intakeStatus,
            GuidedBuyingRoute guidanceRoute
    ) {
    }

    public record RfqRow(
            UUID id,
            String rfqNumber,
            String title,
            String currency,
            String status
    ) {
    }
}
