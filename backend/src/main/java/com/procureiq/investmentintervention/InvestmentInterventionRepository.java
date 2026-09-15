package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceCaseStatus;
import com.procureiq.investmentperformance.InvestmentPerformanceHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class InvestmentInterventionRepository {

    private final JdbcTemplate jdbcTemplate;

    public InvestmentInterventionRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_investment_intervention_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_investment_intervention_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<InvestmentInterventionUserOptionResponse> users() {
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
                        new InvestmentInterventionUserOptionResponse(
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

    public void createCase(
            UUID caseId,
            String interventionNumber,
            InvestmentInterventionCandidateResponse candidate,
            InvestmentInterventionCaseInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_intervention_cases (
                    id,
                    intervention_number,
                    performance_case_id,
                    performance_case_number,
                    funding_commitment_id,
                    funding_commitment_number,
                    value_case_id,
                    value_case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    fiscal_year,
                    intervention_owner_user_id,
                    intervention_owner_name_snapshot,
                    source_performance_status,
                    source_performance_health,
                    source_released_capital_amount,
                    source_remaining_commitment_amount,
                    source_baseline_roi_pct,
                    source_realized_roi_pct,
                    source_roi_variance_pct,
                    source_capital_efficiency_multiple,
                    source_value_variance_amount,
                    recommended_action,
                    recommended_affected_capital_amount,
                    intervention_rationale,
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
                    ?,
                    ?,
                    'OPEN',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                caseId,
                interventionNumber,
                candidate.performanceCaseId(),
                candidate.performanceCaseNumber(),
                candidate.fundingCommitmentId(),
                candidate.fundingCommitmentNumber(),
                candidate.valueCaseId(),
                candidate.valueCaseNumber(),
                candidate.initiativeNumber(),
                candidate.initiativeTitle(),
                candidate.currency(),
                candidate.fiscalYear(),
                input.interventionOwnerUserId(),
                ownerName,
                candidate.performanceStatus()
                        .name(),
                candidate.performanceHealth()
                        .name(),
                candidate.releasedCapitalAmount(),
                candidate.remainingCommitmentAmount(),
                candidate.baselineRoiPct(),
                candidate.realizedRoiPct(),
                candidate.roiVariancePct(),
                candidate.capitalEfficiencyMultiple(),
                candidate.valueVarianceAmount(),
                candidate.recommendation()
                        .name(),
                candidate.recommendedAffectedCapitalAmount(),
                input.interventionRationale()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow activeCaseForPerformance(
            UUID performanceCaseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE intervention_case.performance_case_id = ?
                        AND intervention_case.status <> 'CLOSED'

                        ORDER BY
                            intervention_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                performanceCaseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE intervention_case.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CaseRow> cases() {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        ORDER BY
                            CASE intervention_case.status
                                WHEN 'IN_REVIEW'
                                THEN 1
                                WHEN 'OPEN'
                                THEN 2
                                WHEN 'APPROVED'
                                THEN 3
                                ELSE 4
                            END,

                            intervention_case.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        )
        );
    }

    public void createProposal(
            UUID proposalId,
            UUID caseId,
            InvestmentInterventionProposalInput input,
            BigDecimal sourceRemainingCapitalSnapshot,
            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeTitle,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_intervention_proposals (
                    id,
                    intervention_case_id,
                    action_type,
                    source_remaining_capital_snapshot,
                    affected_capital_amount,
                    target_value_case_id,
                    target_value_case_number,
                    target_initiative_title,
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
                    CURRENT_TIMESTAMP
                )
                """,
                proposalId,
                caseId,
                input.actionType()
                        .name(),
                sourceRemainingCapitalSnapshot,
                input.affectedCapitalAmount(),
                targetValueCaseId,
                targetValueCaseNumber,
                targetInitiativeTitle,
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
                        WHERE intervention_proposal.id = ?
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

    public ProposalRow latestProposal(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                proposalSql()
                        + """
                        WHERE intervention_proposal.intervention_case_id = ?

                        ORDER BY
                            intervention_proposal.proposed_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProposal(
                                resultSet
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ProposalRow> proposals(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                proposalSql()
                        + """
                        WHERE intervention_proposal.intervention_case_id = ?

                        ORDER BY
                            intervention_proposal.proposed_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProposal(
                                resultSet
                        ),
                caseId
        );
    }

    public void createDecision(
            UUID decisionId,
            UUID caseId,
            UUID proposalId,
            InvestmentInterventionDecisionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_intervention_decisions (
                    id,
                    intervention_case_id,
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
                caseId,
                proposalId,
                input.decision()
                        .name(),
                input.decisionNote()
                        .trim(),
                currentUserId
        );
    }

    public DecisionRow findDecision(
            UUID proposalId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE intervention_decision.proposal_id = ?
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

    public List<DecisionRow> decisions(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE intervention_decision.intervention_case_id = ?

                        ORDER BY
                            intervention_decision.decided_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDecision(
                                resultSet
                        ),
                caseId
        );
    }

    public void markInReview(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_intervention_cases

                SET
                    status = 'IN_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'OPEN'
                """,
                caseId
        );
    }

    public void markApproved(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_intervention_cases

                SET
                    status = 'APPROVED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                caseId
        );
    }

    public void returnToOpen(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_intervention_cases

                SET
                    status = 'OPEN',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                caseId
        );
    }

    public void closeCase(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_intervention_cases

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'APPROVED'
                """,
                note.trim(),
                currentUserId,
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            InvestmentInterventionSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_intervention_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    open_case_count,
                    in_review_case_count,
                    approved_case_count,
                    underperforming_case_count,
                    total_remaining_capital_amount,
                    total_approved_affected_capital_amount,
                    total_approved_reallocation_amount,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                summary.caseCount(),
                summary.openCaseCount(),
                summary.inReviewCaseCount(),
                summary.approvedCaseCount(),
                summary.underperformingCaseCount(),
                summary.totalRemainingCapitalAmount(),
                summary.totalApprovedAffectedCapitalAmount(),
                summary.totalApprovedReallocationAmount(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            InvestmentInterventionCaseResponse interventionCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_intervention_snapshot_items (
                    id,
                    snapshot_id,
                    intervention_case_id,
                    intervention_number,
                    performance_case_number,
                    funding_commitment_number,
                    value_case_number,
                    initiative_title,
                    currency,
                    case_status,
                    current_performance_health,
                    current_released_capital_amount,
                    current_remaining_commitment_amount,
                    current_realized_roi_pct,
                    current_roi_variance_pct,
                    current_capital_efficiency_multiple,
                    current_value_variance_amount,
                    recommended_action,
                    approved_action,
                    approved_affected_capital_amount,
                    approved_target_value_case_number,
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
                interventionCase.id(),
                interventionCase.interventionNumber(),
                interventionCase.performanceCaseNumber(),
                interventionCase.fundingCommitmentNumber(),
                interventionCase.valueCaseNumber(),
                interventionCase.initiativeTitle(),
                interventionCase.currency(),
                interventionCase.status()
                        .name(),
                interventionCase.currentPerformanceHealth()
                        .name(),
                interventionCase.currentReleasedCapitalAmount(),
                interventionCase.currentRemainingCommitmentAmount(),
                interventionCase.currentRealizedRoiPct(),
                interventionCase.currentRoiVariancePct(),
                interventionCase.currentCapitalEfficiencyMultiple(),
                interventionCase.currentValueVarianceAmount(),
                interventionCase.currentRecommendation()
                        .name(),
                interventionCase.approvedAction() == null
                        ? null
                        : interventionCase.approvedAction()
                                .name(),
                interventionCase.approvedAffectedCapitalAmount(),
                interventionCase.approvedTargetValueCaseNumber()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE intervention_snapshot.id = ?
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
                            intervention_snapshot.captured_at DESC

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
                    intervention_case_id,
                    intervention_number,
                    performance_case_number,
                    funding_commitment_number,
                    value_case_number,
                    initiative_title,
                    currency,
                    case_status,
                    current_performance_health,
                    current_released_capital_amount,
                    current_remaining_commitment_amount,
                    current_realized_roi_pct,
                    current_roi_variance_pct,
                    current_capital_efficiency_multiple,
                    current_value_variance_amount,
                    recommended_action,
                    approved_action,
                    approved_affected_capital_amount,
                    approved_target_value_case_number

                FROM procurement_investment_intervention_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE current_performance_health
                        WHEN 'UNDERPERFORMING'
                        THEN 1
                        WHEN 'WATCH'
                        THEN 2
                        WHEN 'ON_TRACK'
                        THEN 3
                        WHEN 'OUTPERFORMING'
                        THEN 4
                        ELSE 5
                    END,

                    current_roi_variance_pct,
                    intervention_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "intervention_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "intervention_number"
                                ),
                                resultSet.getString(
                                        "performance_case_number"
                                ),
                                resultSet.getString(
                                        "funding_commitment_number"
                                ),
                                resultSet.getString(
                                        "value_case_number"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                InvestmentInterventionStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                InvestmentPerformanceHealth.valueOf(
                                        resultSet.getString(
                                                "current_performance_health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "current_released_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_remaining_commitment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_realized_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "current_roi_variance_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "current_capital_efficiency_multiple"
                                ),
                                resultSet.getBigDecimal(
                                        "current_value_variance_amount"
                                ),
                                InvestmentInterventionAction.valueOf(
                                        resultSet.getString(
                                                "recommended_action"
                                        )
                                ),
                                resultSet.getString(
                                        "approved_action"
                                ) == null
                                        ? null
                                        : InvestmentInterventionAction.valueOf(
                                                resultSet.getString(
                                                        "approved_action"
                                                )
                                        ),
                                resultSet.getBigDecimal(
                                        "approved_affected_capital_amount"
                                ),
                                resultSet.getString(
                                        "approved_target_value_case_number"
                                )
                        ),
                snapshotId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    intervention_case.id,
                    intervention_case.intervention_number,
                    intervention_case.performance_case_id,
                    intervention_case.performance_case_number,
                    intervention_case.funding_commitment_id,
                    intervention_case.funding_commitment_number,
                    intervention_case.value_case_id,
                    intervention_case.value_case_number,
                    intervention_case.initiative_number,
                    intervention_case.initiative_title,
                    intervention_case.currency,
                    intervention_case.fiscal_year,
                    intervention_case.intervention_owner_user_id,
                    intervention_case.intervention_owner_name_snapshot,
                    intervention_case.source_performance_status,
                    intervention_case.source_performance_health,
                    intervention_case.source_released_capital_amount,
                    intervention_case.source_remaining_commitment_amount,
                    intervention_case.source_baseline_roi_pct,
                    intervention_case.source_realized_roi_pct,
                    intervention_case.source_roi_variance_pct,
                    intervention_case.source_capital_efficiency_multiple,
                    intervention_case.source_value_variance_amount,
                    intervention_case.recommended_action,
                    intervention_case.recommended_affected_capital_amount,
                    intervention_case.intervention_rationale,
                    intervention_case.status,
                    intervention_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    intervention_case.closed_at,
                    intervention_case.created_at,
                    intervention_case.updated_at,
                    intervention_case.version

                FROM procurement_investment_intervention_cases
                    intervention_case

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       intervention_case.closed_by_user_id

                """;
    }

    private String proposalSql() {
        return """
                SELECT
                    intervention_proposal.id,
                    intervention_proposal.intervention_case_id,
                    intervention_proposal.action_type,
                    intervention_proposal.source_remaining_capital_snapshot,
                    intervention_proposal.affected_capital_amount,
                    intervention_proposal.target_value_case_id,
                    intervention_proposal.target_value_case_number,
                    intervention_proposal.target_initiative_title,
                    intervention_proposal.proposal_rationale,

                    proposer.full_name
                        AS proposed_by_name,

                    intervention_proposal.proposed_at

                FROM procurement_investment_intervention_proposals
                    intervention_proposal

                JOIN app_users
                    proposer
                    ON proposer.id =
                       intervention_proposal.proposed_by_user_id

                """;
    }

    private String decisionSql() {
        return """
                SELECT
                    intervention_decision.id,
                    intervention_decision.intervention_case_id,
                    intervention_decision.proposal_id,
                    intervention_decision.decision,
                    intervention_decision.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    intervention_decision.decided_at

                FROM procurement_investment_intervention_decisions
                    intervention_decision

                JOIN app_users
                    decider
                    ON decider.id =
                       intervention_decision.decided_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    intervention_snapshot.id,
                    intervention_snapshot.snapshot_number,
                    intervention_snapshot.case_count,
                    intervention_snapshot.open_case_count,
                    intervention_snapshot.in_review_case_count,
                    intervention_snapshot.approved_case_count,
                    intervention_snapshot.underperforming_case_count,
                    intervention_snapshot.total_remaining_capital_amount,
                    intervention_snapshot.total_approved_affected_capital_amount,
                    intervention_snapshot.total_approved_reallocation_amount,

                    user_account.full_name
                        AS captured_by_name,

                    intervention_snapshot.captured_at

                FROM procurement_investment_intervention_snapshots
                    intervention_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       intervention_snapshot.captured_by_user_id

                """;
    }

    private CaseRow mapCase(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CaseRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "intervention_number"
                ),
                resultSet.getObject(
                        "performance_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "performance_case_number"
                ),
                resultSet.getObject(
                        "funding_commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "funding_commitment_number"
                ),
                resultSet.getObject(
                        "value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "value_case_number"
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                resultSet.getString(
                        "initiative_title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getObject(
                        "intervention_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "intervention_owner_name_snapshot"
                ),
                InvestmentPerformanceCaseStatus.valueOf(
                        resultSet.getString(
                                "source_performance_status"
                        )
                ),
                InvestmentPerformanceHealth.valueOf(
                        resultSet.getString(
                                "source_performance_health"
                        )
                ),
                resultSet.getBigDecimal(
                        "source_released_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "source_remaining_commitment_amount"
                ),
                resultSet.getBigDecimal(
                        "source_baseline_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "source_realized_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "source_roi_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "source_capital_efficiency_multiple"
                ),
                resultSet.getBigDecimal(
                        "source_value_variance_amount"
                ),
                InvestmentInterventionAction.valueOf(
                        resultSet.getString(
                                "recommended_action"
                        )
                ),
                resultSet.getBigDecimal(
                        "recommended_affected_capital_amount"
                ),
                resultSet.getString(
                        "intervention_rationale"
                ),
                InvestmentInterventionStatus.valueOf(
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
                        "intervention_case_id",
                        UUID.class
                ),
                InvestmentInterventionAction.valueOf(
                        resultSet.getString(
                                "action_type"
                        )
                ),
                resultSet.getBigDecimal(
                        "source_remaining_capital_snapshot"
                ),
                resultSet.getBigDecimal(
                        "affected_capital_amount"
                ),
                resultSet.getObject(
                        "target_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "target_value_case_number"
                ),
                resultSet.getString(
                        "target_initiative_title"
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
                        "intervention_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "proposal_id",
                        UUID.class
                ),
                InvestmentInterventionDecision.valueOf(
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
                        "case_count"
                ),
                resultSet.getInt(
                        "open_case_count"
                ),
                resultSet.getInt(
                        "in_review_case_count"
                ),
                resultSet.getInt(
                        "approved_case_count"
                ),
                resultSet.getInt(
                        "underperforming_case_count"
                ),
                resultSet.getBigDecimal(
                        "total_remaining_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_approved_affected_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_approved_reallocation_amount"
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

    public record CaseRow(
            UUID id,
            String interventionNumber,
            UUID performanceCaseId,
            String performanceCaseNumber,
            UUID fundingCommitmentId,
            String fundingCommitmentNumber,
            UUID valueCaseId,
            String valueCaseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            UUID interventionOwnerUserId,
            String interventionOwnerName,
            InvestmentPerformanceCaseStatus sourcePerformanceStatus,
            InvestmentPerformanceHealth sourcePerformanceHealth,
            BigDecimal sourceReleasedCapitalAmount,
            BigDecimal sourceRemainingCommitmentAmount,
            BigDecimal sourceBaselineRoiPct,
            BigDecimal sourceRealizedRoiPct,
            BigDecimal sourceRoiVariancePct,
            BigDecimal sourceCapitalEfficiencyMultiple,
            BigDecimal sourceValueVarianceAmount,
            InvestmentInterventionAction recommendedAction,
            BigDecimal recommendedAffectedCapitalAmount,
            String interventionRationale,
            InvestmentInterventionStatus status,
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
            UUID interventionCaseId,
            InvestmentInterventionAction actionType,
            BigDecimal sourceRemainingCapitalSnapshot,
            BigDecimal affectedCapitalAmount,
            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeTitle,
            String proposalRationale,
            String proposedByName,
            Instant proposedAt
    ) {
    }

    public record DecisionRow(
            UUID id,
            UUID interventionCaseId,
            UUID proposalId,
            InvestmentInterventionDecision decision,
            String decisionNote,
            String decidedByName,
            Instant decidedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            int caseCount,
            int openCaseCount,
            int inReviewCaseCount,
            int approvedCaseCount,
            int underperformingCaseCount,
            BigDecimal totalRemainingCapitalAmount,
            BigDecimal totalApprovedAffectedCapitalAmount,
            BigDecimal totalApprovedReallocationAmount,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID interventionCaseId,
            String interventionNumber,
            String performanceCaseNumber,
            String fundingCommitmentNumber,
            String valueCaseNumber,
            String initiativeTitle,
            String currency,
            InvestmentInterventionStatus caseStatus,
            InvestmentPerformanceHealth currentPerformanceHealth,
            BigDecimal currentReleasedCapitalAmount,
            BigDecimal currentRemainingCommitmentAmount,
            BigDecimal currentRealizedRoiPct,
            BigDecimal currentRoiVariancePct,
            BigDecimal currentCapitalEfficiencyMultiple,
            BigDecimal currentValueVarianceAmount,
            InvestmentInterventionAction recommendedAction,
            InvestmentInterventionAction approvedAction,
            BigDecimal approvedAffectedCapitalAmount,
            String approvedTargetValueCaseNumber
    ) {
    }
}
