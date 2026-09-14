package com.procureiq.negotiation;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class NegotiationRepository {

    private final JdbcTemplate jdbcTemplate;

    public NegotiationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextNegotiationSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_negotiation_number_seq'
                )
                """,
                Long.class
        );
    }

    public QuotationRow findQuotation(
            UUID quotationId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    quotation.id,

                    quotation.id::text
                        AS quotation_reference,

                    quotation.rfq_id,
                    rfq.rfq_number,
                    rfq.title
                        AS rfq_title,
                    rfq.currency,

                    quotation.supplier_id,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.risk_level
                        AS supplier_risk_level,

                    quotation.total_amount,
                    quotation.status

                FROM quotations quotation

                JOIN rfqs rfq
                    ON rfq.id =
                       quotation.rfq_id

                JOIN suppliers supplier
                    ON supplier.id =
                       quotation.supplier_id

                WHERE quotation.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new QuotationRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "quotation_reference"
                                ),
                                resultSet.getObject(
                                        "rfq_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "rfq_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getString(
                                        "supplier_risk_level"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        ),
                quotationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<NegotiationQuotationOptionResponse> quotations() {
        return jdbcTemplate.query(
                """
                SELECT
                    quotation.id,

                    quotation.id::text
                        AS quotation_reference,

                    quotation.rfq_id,
                    rfq.rfq_number,
                    rfq.title
                        AS rfq_title,
                    rfq.currency,

                    quotation.supplier_id,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.risk_level
                        AS supplier_risk_level,

                    quotation.total_amount,
                    quotation.status

                FROM quotations quotation

                JOIN rfqs rfq
                    ON rfq.id =
                       quotation.rfq_id

                JOIN suppliers supplier
                    ON supplier.id =
                       quotation.supplier_id

                WHERE quotation.status =
                    'SUBMITTED'

                AND rfq.status IN (
                    'PUBLISHED',
                    'CLOSED',
                    'AWARDED'
                )

                AND NOT EXISTS (
                    SELECT 1
                    FROM procurement_negotiation_workspaces
                        workspace
                    WHERE
                        workspace.rfq_id =
                            quotation.rfq_id
                    AND workspace.supplier_id =
                            quotation.supplier_id
                )

                ORDER BY
                    rfq.created_at DESC,
                    supplier.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new NegotiationQuotationOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "quotation_reference"
                                ),
                                resultSet.getObject(
                                        "rfq_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "rfq_title"
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getString(
                                        "supplier_risk_level"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        )
        );
    }

    public void createWorkspace(
            UUID id,
            String negotiationNumber,
            QuotationRow quotation,
            UUID ownerUserId,
            String notes
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_negotiation_workspaces (
                    id,
                    negotiation_number,
                    rfq_id,
                    supplier_id,
                    baseline_quotation_id,
                    status,
                    currency,
                    baseline_value,
                    target_savings,
                    agreed_savings,
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
                    0,
                    0,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                negotiationNumber,
                quotation.rfqId(),
                quotation.supplierId(),
                quotation.id(),
                quotation.currency(),
                quotation.totalAmount(),
                ownerUserId,
                normalizeOptional(
                        notes
                )
        );
    }

    public void updateWorkspaceStatus(
            UUID workspaceId,
            NegotiationWorkspaceStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_workspaces
                SET
                    status = ?,
                    closed_at =
                        CASE
                            WHEN ? =
                                'CLOSED'
                            THEN CURRENT_TIMESTAMP
                            ELSE closed_at
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                status.name(),
                workspaceId
        );
    }

    public WorkspaceRow findWorkspace(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                workspaceSql()
                        + """
                        WHERE workspace.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWorkspace(
                                resultSet
                        ),
                workspaceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<WorkspaceRow> findWorkspaces() {
        return jdbcTemplate.query(
                workspaceSql()
                        + """
                        ORDER BY
                            CASE workspace.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'DRAFT'
                                THEN 2
                                WHEN 'AGREED'
                                THEN 3
                                WHEN 'CLOSED'
                                THEN 4
                                ELSE 5
                            END,
                            workspace.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWorkspace(
                                resultSet
                        )
        );
    }

    public void clearPreferredScenarios(
            UUID workspaceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_scenarios
                SET
                    preferred = FALSE,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE workspace_id = ?
                AND preferred = TRUE
                """,
                workspaceId
        );
    }

    public void createScenario(
            UUID id,
            UUID workspaceId,
            NegotiationScenarioInput input,
            BigDecimal priceSavings,
            BigDecimal savingsPct,
            BigDecimal score,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_negotiation_scenarios (
                    id,
                    workspace_id,
                    name,
                    scenario_type,
                    total_value,
                    payment_terms_days,
                    lead_time_days,
                    warranty_months,
                    volume_commitment,
                    price_savings,
                    savings_pct,
                    scenario_score,
                    preferred,
                    notes,
                    created_by_user_id,
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
                workspaceId,
                input.name()
                        .trim(),
                input.scenarioType()
                        .name(),
                input.totalValue(),
                input.paymentTermsDays(),
                input.leadTimeDays(),
                input.warrantyMonths(),
                input.volumeCommitment(),
                priceSavings,
                savingsPct,
                score,
                input.preferred(),
                normalizeOptional(
                        input.notes()
                ),
                currentUserId
        );
    }

    public void updateTarget(
            UUID workspaceId,
            BigDecimal targetValue,
            BigDecimal targetSavings
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_workspaces
                SET
                    target_value = ?,
                    target_savings = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                targetValue,
                targetSavings,
                workspaceId
        );
    }

    public void updateWalkAway(
            UUID workspaceId,
            BigDecimal walkAwayValue
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_workspaces
                SET
                    walk_away_value = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                walkAwayValue,
                workspaceId
        );
    }

    public ScenarioRow findScenario(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                scenarioSql()
                        + """
                        WHERE scenario.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapScenario(
                                resultSet
                        ),
                scenarioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ScenarioRow> findScenarios(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                scenarioSql()
                        + """
                        WHERE scenario.workspace_id = ?
                        ORDER BY
                            scenario.preferred DESC,
                            scenario.scenario_score DESC,
                            scenario.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapScenario(
                                resultSet
                        ),
                workspaceId
        );
    }

    public Integer nextRoundNumber(
            UUID workspaceId
    ) {
        Integer value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT
                            COALESCE(
                                MAX(round_number),
                                0
                            ) + 1
                        FROM procurement_negotiation_rounds
                        WHERE workspace_id = ?
                        """,
                        Integer.class,
                        workspaceId
                );

        return value == null
                ? 1
                : value;
    }

    public void createRound(
            UUID id,
            UUID workspaceId,
            int roundNumber,
            NegotiationRoundInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_negotiation_rounds (
                    id,
                    workspace_id,
                    round_number,
                    actor_side,
                    offer_value,
                    payment_terms_days,
                    lead_time_days,
                    warranty_months,
                    volume_commitment,
                    notes,
                    created_by_user_id,
                    round_at,
                    created_at
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                workspaceId,
                roundNumber,
                input.actorSide()
                        .name(),
                input.offerValue(),
                input.paymentTermsDays(),
                input.leadTimeDays(),
                input.warrantyMonths(),
                input.volumeCommitment(),
                normalizeOptional(
                        input.notes()
                ),
                currentUserId
        );
    }

    public List<RoundRow> findRounds(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    round.id,
                    round.workspace_id,
                    round.round_number,
                    round.actor_side,
                    round.offer_value,
                    round.payment_terms_days,
                    round.lead_time_days,
                    round.warranty_months,
                    round.volume_commitment,
                    round.notes,
                    round.created_by_user_id,

                    creator.full_name
                        AS created_by_name,

                    round.round_at,
                    round.created_at

                FROM procurement_negotiation_rounds round

                JOIN app_users creator
                    ON creator.id =
                       round.created_by_user_id

                WHERE round.workspace_id = ?

                ORDER BY
                    round.round_number
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp roundAt =
                            resultSet.getTimestamp(
                                    "round_at"
                            );

                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new RoundRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "workspace_id",
                                    UUID.class
                            ),
                            resultSet.getInt(
                                    "round_number"
                            ),
                            NegotiationRoundSide
                                    .valueOf(
                                            resultSet.getString(
                                                    "actor_side"
                                            )
                                    ),
                            resultSet.getBigDecimal(
                                    "offer_value"
                            ),
                            resultSet.getInt(
                                    "payment_terms_days"
                            ),
                            resultSet.getInt(
                                    "lead_time_days"
                            ),
                            resultSet.getInt(
                                    "warranty_months"
                            ),
                            (
                                    Integer
                            ) resultSet.getObject(
                                    "volume_commitment"
                            ),
                            resultSet.getString(
                                    "notes"
                            ),
                            resultSet.getObject(
                                    "created_by_user_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "created_by_name"
                            ),
                            roundAt.toInstant(),
                            created.toInstant()
                    );
                },
                workspaceId
        );
    }

    public void agreeScenario(
            UUID workspaceId,
            UUID scenarioId,
            BigDecimal agreedValue,
            BigDecimal agreedSavings
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_workspaces
                SET
                    status = 'AGREED',
                    agreed_value = ?,
                    agreed_savings = ?,
                    agreed_scenario_id = ?,
                    agreed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'ACTIVE'
                """,
                agreedValue,
                agreedSavings,
                scenarioId,
                workspaceId
        );

        jdbcTemplate.update(
                """
                UPDATE procurement_negotiation_scenarios
                SET
                    preferred =
                        CASE
                            WHEN id = ?
                            THEN TRUE
                            ELSE FALSE
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE workspace_id = ?
                """,
                scenarioId,
                workspaceId
        );
    }

    public AwardOutcomeRow awardOutcome(
            UUID rfqId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    selected_quotation.id
                        AS quotation_id,

                    selected_quotation.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    selected_quotation.total_amount
                        AS award_value

                FROM award_decisions award

                JOIN quotations selected_quotation
                    ON selected_quotation.id =
                       award.selected_quotation_id

                JOIN suppliers supplier
                    ON supplier.id =
                       selected_quotation.supplier_id

                WHERE award.rfq_id = ?

                ORDER BY
                    award.decided_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AwardOutcomeRow(
                                resultSet.getObject(
                                        "quotation_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getBigDecimal(
                                        "award_value"
                                )
                        ),
                rfqId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<NegotiationUserOptionResponse> users() {
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
                        new NegotiationUserOptionResponse(
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

    private String workspaceSql() {
        return """
                SELECT
                    workspace.id,
                    workspace.negotiation_number,

                    workspace.rfq_id,
                    rfq.rfq_number,
                    rfq.title
                        AS rfq_title,

                    workspace.supplier_id,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.risk_level
                        AS supplier_risk_level,

                    workspace.baseline_quotation_id,

                    workspace.baseline_quotation_id::text
                        AS baseline_quotation_reference,

                    workspace.status,
                    workspace.currency,
                    workspace.baseline_value,
                    workspace.target_value,
                    workspace.walk_away_value,
                    workspace.agreed_value,
                    workspace.target_savings,
                    workspace.agreed_savings,
                    workspace.agreed_scenario_id,

                    workspace.owner_user_id,
                    owner.full_name
                        AS owner_name,

                    workspace.notes,
                    workspace.agreed_at,
                    workspace.closed_at,
                    workspace.created_at,
                    workspace.updated_at,
                    workspace.version

                FROM procurement_negotiation_workspaces
                    workspace

                JOIN rfqs rfq
                    ON rfq.id =
                       workspace.rfq_id

                JOIN suppliers supplier
                    ON supplier.id =
                       workspace.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       workspace.owner_user_id

                """;
    }

    private String scenarioSql() {
        return """
                SELECT
                    scenario.id,
                    scenario.workspace_id,
                    scenario.name,
                    scenario.scenario_type,
                    scenario.total_value,
                    scenario.payment_terms_days,
                    scenario.lead_time_days,
                    scenario.warranty_months,
                    scenario.volume_commitment,
                    scenario.price_savings,
                    scenario.savings_pct,
                    scenario.scenario_score,
                    scenario.preferred,
                    scenario.notes,
                    scenario.created_by_user_id,

                    creator.full_name
                        AS created_by_name,

                    scenario.created_at,
                    scenario.updated_at,
                    scenario.version

                FROM procurement_negotiation_scenarios
                    scenario

                JOIN app_users creator
                    ON creator.id =
                       scenario.created_by_user_id

                """;
    }

    private WorkspaceRow mapWorkspace(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp agreed =
                resultSet.getTimestamp(
                        "agreed_at"
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

        return new WorkspaceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "negotiation_number"
                ),
                resultSet.getObject(
                        "rfq_id",
                        UUID.class
                ),
                resultSet.getString(
                        "rfq_number"
                ),
                resultSet.getString(
                        "rfq_title"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getString(
                        "supplier_risk_level"
                ),
                resultSet.getObject(
                        "baseline_quotation_id",
                        UUID.class
                ),
                resultSet.getString(
                        "baseline_quotation_reference"
                ),
                NegotiationWorkspaceStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "baseline_value"
                ),
                resultSet.getBigDecimal(
                        "target_value"
                ),
                resultSet.getBigDecimal(
                        "walk_away_value"
                ),
                resultSet.getBigDecimal(
                        "agreed_value"
                ),
                resultSet.getBigDecimal(
                        "target_savings"
                ),
                resultSet.getBigDecimal(
                        "agreed_savings"
                ),
                resultSet.getObject(
                        "agreed_scenario_id",
                        UUID.class
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
                agreed == null
                        ? null
                        : agreed.toInstant(),
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

    private ScenarioRow mapScenario(
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

        return new ScenarioRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "workspace_id",
                        UUID.class
                ),
                resultSet.getString(
                        "name"
                ),
                NegotiationScenarioType
                        .valueOf(
                                resultSet.getString(
                                        "scenario_type"
                                )
                        ),
                resultSet.getBigDecimal(
                        "total_value"
                ),
                resultSet.getInt(
                        "payment_terms_days"
                ),
                resultSet.getInt(
                        "lead_time_days"
                ),
                resultSet.getInt(
                        "warranty_months"
                ),
                (
                        Integer
                ) resultSet.getObject(
                        "volume_commitment"
                ),
                resultSet.getBigDecimal(
                        "price_savings"
                ),
                resultSet.getBigDecimal(
                        "savings_pct"
                ),
                resultSet.getBigDecimal(
                        "scenario_score"
                ),
                resultSet.getBoolean(
                        "preferred"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "created_by_name"
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

    public record QuotationRow(
            UUID id,
            String quotationReference,
            UUID rfqId,
            String rfqNumber,
            String rfqTitle,
            String currency,
            UUID supplierId,
            String supplierName,
            String supplierRiskLevel,
            BigDecimal totalAmount,
            String status
    ) {
    }

    public record WorkspaceRow(
            UUID id,
            String negotiationNumber,
            UUID rfqId,
            String rfqNumber,
            String rfqTitle,
            UUID supplierId,
            String supplierName,
            String supplierRiskLevel,
            UUID baselineQuotationId,
            String baselineQuotationReference,
            NegotiationWorkspaceStatus status,
            String currency,
            BigDecimal baselineValue,
            BigDecimal targetValue,
            BigDecimal walkAwayValue,
            BigDecimal agreedValue,
            BigDecimal targetSavings,
            BigDecimal agreedSavings,
            UUID agreedScenarioId,
            UUID ownerUserId,
            String ownerName,
            String notes,
            Instant agreedAt,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ScenarioRow(
            UUID id,
            UUID workspaceId,
            String name,
            NegotiationScenarioType scenarioType,
            BigDecimal totalValue,
            int paymentTermsDays,
            int leadTimeDays,
            int warrantyMonths,
            Integer volumeCommitment,
            BigDecimal priceSavings,
            BigDecimal savingsPct,
            BigDecimal scenarioScore,
            boolean preferred,
            String notes,
            UUID createdByUserId,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record RoundRow(
            UUID id,
            UUID workspaceId,
            int roundNumber,
            NegotiationRoundSide actorSide,
            BigDecimal offerValue,
            int paymentTermsDays,
            int leadTimeDays,
            int warrantyMonths,
            Integer volumeCommitment,
            String notes,
            UUID createdByUserId,
            String createdByName,
            Instant roundAt,
            Instant createdAt
    ) {
    }

    public record AwardOutcomeRow(
            UUID quotationId,
            UUID supplierId,
            String supplierName,
            BigDecimal awardValue
    ) {
    }
}
