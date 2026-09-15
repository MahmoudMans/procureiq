package com.procureiq.capitalrecycling;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.strategicvalue.StrategicValueHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CapitalRecyclingRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapitalRecyclingRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSourceSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_recycling_source_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_recycling_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CapitalRecyclingUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active = TRUE
                AND role <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CapitalRecyclingUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                resultSet.getString(
                                        "role"
                                )
                        )
        );
    }

    public void createSource(
            UUID sourceId,
            String sourceNumber,
            CapitalRecyclingCandidateResponse candidate,
            CapitalRecyclingSourceInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_recycling_sources (
                    id,
                    source_number,
                    execution_case_id,
                    execution_number,
                    intervention_case_id,
                    intervention_number,
                    funding_commitment_id,
                    funding_commitment_number,
                    source_value_case_id,
                    source_value_case_number,
                    source_initiative_number,
                    source_initiative_title,
                    source_action,
                    currency,
                    fiscal_year,
                    verified_implemented_capital_amount,
                    recyclable_capital_amount,
                    funding_remaining_snapshot,
                    preferred_target_value_case_id,
                    preferred_target_value_case_number,
                    preferred_target_initiative_title,
                    source_owner_user_id,
                    source_owner_name_snapshot,
                    recycling_objective,
                    status,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'OPEN',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                sourceId,
                sourceNumber,
                candidate.executionCaseId(),
                candidate.executionNumber(),
                candidate.interventionCaseId(),
                candidate.interventionNumber(),
                candidate.fundingCommitmentId(),
                candidate.fundingCommitmentNumber(),
                candidate.sourceValueCaseId(),
                candidate.sourceValueCaseNumber(),
                candidate.sourceInitiativeNumber(),
                candidate.sourceInitiativeTitle(),
                candidate.sourceAction()
                        .name(),
                candidate.currency(),
                candidate.fiscalYear(),
                candidate.verifiedImplementedCapitalAmount(),
                candidate.recyclableCapitalAmount(),
                candidate.currentFundingRemainingAmount(),
                candidate.preferredTargetValueCaseId(),
                candidate.preferredTargetValueCaseNumber(),
                candidate.preferredTargetInitiativeTitle(),
                input.sourceOwnerUserId(),
                ownerName,
                input.recyclingObjective()
                        .trim(),
                currentUserId
        );
    }

    public SourceRow findSource(
            UUID sourceId
    ) {
        return jdbcTemplate.query(
                sourceSql()
                        + """
                        WHERE recycling_source.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSource(
                                resultSet
                        ),
                sourceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public SourceRow sourceForExecution(
            UUID executionCaseId
    ) {
        return jdbcTemplate.query(
                sourceSql()
                        + """
                        WHERE recycling_source.execution_case_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSource(
                                resultSet
                        ),
                executionCaseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SourceRow> sources() {
        return jdbcTemplate.query(
                sourceSql()
                        + """
                        ORDER BY
                            CASE recycling_source.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'FULLY_ALLOCATED'
                                THEN 2
                                ELSE 3
                            END,
                            recycling_source.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSource(
                                resultSet
                        )
        );
    }

    public void createProposal(
            UUID proposalId,
            UUID sourceId,
            CapitalReinvestmentProposalInput input,
            CapitalReinvestmentTargetResponse target,
            BigDecimal sourceAvailableCapitalSnapshot,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_reinvestment_proposals (
                    id,
                    recycling_source_id,
                    target_value_case_id,
                    target_value_case_number,
                    target_initiative_number,
                    target_initiative_title,
                    source_available_capital_snapshot,
                    requested_reinvestment_amount,
                    target_roi_pct_snapshot,
                    target_persistence_pct_snapshot,
                    target_net_value_snapshot,
                    target_value_health_snapshot,
                    proposal_rationale,
                    proposed_by_user_id,
                    proposed_at
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
                    CURRENT_TIMESTAMP
                )
                """,
                proposalId,
                sourceId,
                target.valueCaseId(),
                target.valueCaseNumber(),
                target.initiativeNumber(),
                target.initiativeTitle(),
                sourceAvailableCapitalSnapshot,
                input.requestedReinvestmentAmount(),
                target.roiPct(),
                target.persistencePct(),
                target.netValueAmount(),
                target.valueHealth()
                        .name(),
                input.proposalRationale()
                        .trim(),
                currentUserId
        );
    }

    public ProposalRow findProposal(
            UUID proposalId
    ) {
        return jdbcTemplate.query(
                proposalSql()
                        + """
                        WHERE reinvestment_proposal.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProposal(
                                resultSet
                        ),
                proposalId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ProposalRow> proposals(
            UUID sourceId
    ) {
        return jdbcTemplate.query(
                proposalSql()
                        + """
                        WHERE reinvestment_proposal.recycling_source_id = ?

                        ORDER BY
                            reinvestment_proposal.proposed_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProposal(
                                resultSet
                        ),
                sourceId
        );
    }

    public void createDecision(
            UUID decisionId,
            UUID sourceId,
            UUID proposalId,
            CapitalReinvestmentDecisionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_reinvestment_decisions (
                    id,
                    recycling_source_id,
                    proposal_id,
                    decision,
                    decision_note,
                    decided_by_user_id,
                    decided_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                decisionId,
                sourceId,
                proposalId,
                input.decision()
                        .name(),
                input.decisionNote()
                        .trim(),
                currentUserId
        );
    }

    public DecisionRow decision(
            UUID proposalId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE reinvestment_decision.proposal_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDecision(
                                resultSet
                        ),
                proposalId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markFullyAllocated(
            UUID sourceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_recycling_sources

                SET
                    status = 'FULLY_ALLOCATED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'OPEN'
                """,
                sourceId
        );
    }

    public void closeSource(
            UUID sourceId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_recycling_sources

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'FULLY_ALLOCATED'
                """,
                note.trim(),
                currentUserId,
                sourceId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            CapitalRecyclingSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_recycling_snapshots (
                    id,
                    snapshot_number,
                    source_count,
                    open_source_count,
                    fully_allocated_source_count,
                    total_recyclable_capital_amount,
                    total_approved_reinvestment_amount,
                    total_available_capital_amount,
                    average_utilization_pct,
                    captured_by_user_id,
                    captured_at
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                summary.sourceCount(),
                summary.openSourceCount(),
                summary.fullyAllocatedSourceCount(),
                summary.totalRecyclableCapitalAmount(),
                summary.totalApprovedReinvestmentAmount(),
                summary.totalAvailableCapitalAmount(),
                summary.averageUtilizationPct(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            CapitalRecyclingSourceResponse source
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_recycling_snapshot_items (
                    id,
                    snapshot_id,
                    recycling_source_id,
                    source_number,
                    execution_number,
                    source_initiative_title,
                    source_action,
                    currency,
                    source_status,
                    recyclable_capital_amount,
                    approved_reinvestment_amount,
                    pending_reinvestment_amount,
                    available_capital_amount,
                    utilization_pct,
                    current_funding_remaining_amount,
                    preferred_target_value_case_number,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                source.id(),
                source.sourceNumber(),
                source.executionNumber(),
                source.sourceInitiativeTitle(),
                source.sourceAction()
                        .name(),
                source.currency(),
                source.status()
                        .name(),
                source.recyclableCapitalAmount(),
                source.approvedReinvestmentAmount(),
                source.pendingReinvestmentAmount(),
                source.availableCapitalAmount(),
                source.utilizationPct(),
                source.currentFundingRemainingAmount(),
                source.preferredTargetValueCaseNumber()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE recycling_snapshot.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                snapshotId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SnapshotRow> snapshots() {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        ORDER BY
                            recycling_snapshot.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        )
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    recycling_source_id,
                    source_number,
                    execution_number,
                    source_initiative_title,
                    source_action,
                    currency,
                    source_status,
                    recyclable_capital_amount,
                    approved_reinvestment_amount,
                    pending_reinvestment_amount,
                    available_capital_amount,
                    utilization_pct,
                    current_funding_remaining_amount,
                    preferred_target_value_case_number

                FROM procurement_capital_recycling_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    available_capital_amount DESC,
                    source_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "recycling_source_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_number"
                                ),
                                resultSet.getString(
                                        "execution_number"
                                ),
                                resultSet.getString(
                                        "source_initiative_title"
                                ),
                                InvestmentInterventionAction.valueOf(
                                        resultSet.getString(
                                                "source_action"
                                        )
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                CapitalRecyclingSourceStatus.valueOf(
                                        resultSet.getString(
                                                "source_status"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "recyclable_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "approved_reinvestment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "pending_reinvestment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "available_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "utilization_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "current_funding_remaining_amount"
                                ),
                                resultSet.getString(
                                        "preferred_target_value_case_number"
                                )
                        ),
                snapshotId
        );
    }

    private String sourceSql() {
        return """
                SELECT
                    recycling_source.id,
                    recycling_source.source_number,
                    recycling_source.execution_case_id,
                    recycling_source.execution_number,
                    recycling_source.intervention_case_id,
                    recycling_source.intervention_number,
                    recycling_source.funding_commitment_id,
                    recycling_source.funding_commitment_number,
                    recycling_source.source_value_case_id,
                    recycling_source.source_value_case_number,
                    recycling_source.source_initiative_number,
                    recycling_source.source_initiative_title,
                    recycling_source.source_action,
                    recycling_source.currency,
                    recycling_source.fiscal_year,
                    recycling_source.verified_implemented_capital_amount,
                    recycling_source.recyclable_capital_amount,
                    recycling_source.funding_remaining_snapshot,
                    recycling_source.preferred_target_value_case_id,
                    recycling_source.preferred_target_value_case_number,
                    recycling_source.preferred_target_initiative_title,
                    recycling_source.source_owner_user_id,
                    recycling_source.source_owner_name_snapshot,
                    recycling_source.recycling_objective,
                    recycling_source.status,
                    recycling_source.close_note,

                    closer.full_name
                        AS closed_by_name,

                    recycling_source.closed_at,
                    recycling_source.created_at,
                    recycling_source.updated_at,
                    recycling_source.version

                FROM procurement_capital_recycling_sources
                    recycling_source

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       recycling_source.closed_by_user_id

                """;
    }

    private String proposalSql() {
        return """
                SELECT
                    reinvestment_proposal.id,
                    reinvestment_proposal.recycling_source_id,
                    reinvestment_proposal.target_value_case_id,
                    reinvestment_proposal.target_value_case_number,
                    reinvestment_proposal.target_initiative_number,
                    reinvestment_proposal.target_initiative_title,
                    reinvestment_proposal.source_available_capital_snapshot,
                    reinvestment_proposal.requested_reinvestment_amount,
                    reinvestment_proposal.target_roi_pct_snapshot,
                    reinvestment_proposal.target_persistence_pct_snapshot,
                    reinvestment_proposal.target_net_value_snapshot,
                    reinvestment_proposal.target_value_health_snapshot,
                    reinvestment_proposal.proposal_rationale,

                    proposer.full_name
                        AS proposed_by_name,

                    reinvestment_proposal.proposed_at

                FROM procurement_capital_reinvestment_proposals
                    reinvestment_proposal

                JOIN app_users
                    proposer
                    ON proposer.id =
                       reinvestment_proposal.proposed_by_user_id

                """;
    }

    private String decisionSql() {
        return """
                SELECT
                    reinvestment_decision.id,
                    reinvestment_decision.recycling_source_id,
                    reinvestment_decision.proposal_id,
                    reinvestment_decision.decision,
                    reinvestment_decision.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    reinvestment_decision.decided_at

                FROM procurement_capital_reinvestment_decisions
                    reinvestment_decision

                JOIN app_users
                    decider
                    ON decider.id =
                       reinvestment_decision.decided_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    recycling_snapshot.id,
                    recycling_snapshot.snapshot_number,
                    recycling_snapshot.source_count,
                    recycling_snapshot.open_source_count,
                    recycling_snapshot.fully_allocated_source_count,
                    recycling_snapshot.total_recyclable_capital_amount,
                    recycling_snapshot.total_approved_reinvestment_amount,
                    recycling_snapshot.total_available_capital_amount,
                    recycling_snapshot.average_utilization_pct,

                    user_account.full_name
                        AS captured_by_name,

                    recycling_snapshot.captured_at

                FROM procurement_capital_recycling_snapshots
                    recycling_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       recycling_snapshot.captured_by_user_id

                """;
    }

    private SourceRow mapSource(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new SourceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_number"
                ),
                resultSet.getObject(
                        "execution_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "execution_number"
                ),
                resultSet.getObject(
                        "intervention_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "intervention_number"
                ),
                resultSet.getObject(
                        "funding_commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "funding_commitment_number"
                ),
                resultSet.getObject(
                        "source_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_value_case_number"
                ),
                resultSet.getString(
                        "source_initiative_number"
                ),
                resultSet.getString(
                        "source_initiative_title"
                ),
                InvestmentInterventionAction.valueOf(
                        resultSet.getString(
                                "source_action"
                        )
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "verified_implemented_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "recyclable_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "funding_remaining_snapshot"
                ),
                resultSet.getObject(
                        "preferred_target_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "preferred_target_value_case_number"
                ),
                resultSet.getString(
                        "preferred_target_initiative_title"
                ),
                resultSet.getObject(
                        "source_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_owner_name_snapshot"
                ),
                resultSet.getString(
                        "recycling_objective"
                ),
                CapitalRecyclingSourceStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "close_note"
                ),
                resultSet.getString(
                        "closed_by_name"
                ),
                instant(
                        resultSet,
                        "closed_at"
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ProposalRow mapProposal(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ProposalRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "recycling_source_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "target_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "target_value_case_number"
                ),
                resultSet.getString(
                        "target_initiative_number"
                ),
                resultSet.getString(
                        "target_initiative_title"
                ),
                resultSet.getBigDecimal(
                        "source_available_capital_snapshot"
                ),
                resultSet.getBigDecimal(
                        "requested_reinvestment_amount"
                ),
                resultSet.getBigDecimal(
                        "target_roi_pct_snapshot"
                ),
                resultSet.getBigDecimal(
                        "target_persistence_pct_snapshot"
                ),
                resultSet.getBigDecimal(
                        "target_net_value_snapshot"
                ),
                StrategicValueHealth.valueOf(
                        resultSet.getString(
                                "target_value_health_snapshot"
                        )
                ),
                resultSet.getString(
                        "proposal_rationale"
                ),
                resultSet.getString(
                        "proposed_by_name"
                ),
                resultSet.getTimestamp(
                        "proposed_at"
                )
                        .toInstant()
        );
    }

    private DecisionRow mapDecision(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DecisionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "recycling_source_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "proposal_id",
                        UUID.class
                ),
                CapitalReinvestmentDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getTimestamp(
                        "decided_at"
                )
                        .toInstant()
        );
    }

    private SnapshotRow mapSnapshot(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new SnapshotRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "snapshot_number"
                ),
                resultSet.getInt(
                        "source_count"
                ),
                resultSet.getInt(
                        "open_source_count"
                ),
                resultSet.getInt(
                        "fully_allocated_source_count"
                ),
                resultSet.getBigDecimal(
                        "total_recyclable_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_approved_reinvestment_amount"
                ),
                resultSet.getBigDecimal(
                        "total_available_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "average_utilization_pct"
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                )
                        .toInstant()
        );
    }

    private Instant instant(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        Timestamp value =
                resultSet.getTimestamp(
                        column
                );

        return value == null
                ? null
                : value.toInstant();
    }

    public record SourceRow(
            UUID id,
            String sourceNumber,
            UUID executionCaseId,
            String executionNumber,
            UUID interventionCaseId,
            String interventionNumber,
            UUID fundingCommitmentId,
            String fundingCommitmentNumber,
            UUID sourceValueCaseId,
            String sourceValueCaseNumber,
            String sourceInitiativeNumber,
            String sourceInitiativeTitle,
            InvestmentInterventionAction sourceAction,
            String currency,
            int fiscalYear,
            BigDecimal verifiedImplementedCapitalAmount,
            BigDecimal recyclableCapitalAmount,
            BigDecimal fundingRemainingSnapshot,
            UUID preferredTargetValueCaseId,
            String preferredTargetValueCaseNumber,
            String preferredTargetInitiativeTitle,
            UUID sourceOwnerUserId,
            String sourceOwnerName,
            String recyclingObjective,
            CapitalRecyclingSourceStatus status,
            String closeNote,
            String closedByName,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ProposalRow(
            UUID id,
            UUID recyclingSourceId,
            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeNumber,
            String targetInitiativeTitle,
            BigDecimal sourceAvailableCapitalSnapshot,
            BigDecimal requestedReinvestmentAmount,
            BigDecimal targetRoiPctSnapshot,
            BigDecimal targetPersistencePctSnapshot,
            BigDecimal targetNetValueSnapshot,
            StrategicValueHealth targetValueHealthSnapshot,
            String proposalRationale,
            String proposedByName,
            Instant proposedAt
    ) {
    }

    public record DecisionRow(
            UUID id,
            UUID recyclingSourceId,
            UUID proposalId,
            CapitalReinvestmentDecision decision,
            String decisionNote,
            String decidedByName,
            Instant decidedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            int sourceCount,
            int openSourceCount,
            int fullyAllocatedSourceCount,
            BigDecimal totalRecyclableCapitalAmount,
            BigDecimal totalApprovedReinvestmentAmount,
            BigDecimal totalAvailableCapitalAmount,
            BigDecimal averageUtilizationPct,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID recyclingSourceId,
            String sourceNumber,
            String executionNumber,
            String sourceInitiativeTitle,
            InvestmentInterventionAction sourceAction,
            String currency,
            CapitalRecyclingSourceStatus sourceStatus,
            BigDecimal recyclableCapitalAmount,
            BigDecimal approvedReinvestmentAmount,
            BigDecimal pendingReinvestmentAmount,
            BigDecimal availableCapitalAmount,
            BigDecimal utilizationPct,
            BigDecimal currentFundingRemainingAmount,
            String preferredTargetValueCaseNumber
    ) {
    }
}
