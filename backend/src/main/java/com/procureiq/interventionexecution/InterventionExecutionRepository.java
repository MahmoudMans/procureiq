package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class InterventionExecutionRepository {

    private final JdbcTemplate jdbcTemplate;

    public InterventionExecutionRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_intervention_execution_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_intervention_execution_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<InterventionExecutionUserOptionResponse> users() {
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
                        new InterventionExecutionUserOptionResponse(
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
            UUID executionCaseId,
            String executionNumber,
            InterventionExecutionCandidateResponse candidate,
            InterventionExecutionCaseInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_cases (
                    id,
                    execution_number,
                    intervention_case_id,
                    intervention_number,
                    performance_case_id,
                    performance_case_number,
                    funding_commitment_id,
                    funding_commitment_number,
                    source_value_case_id,
                    source_value_case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    fiscal_year,
                    approved_action,
                    approved_affected_capital_amount,
                    approved_target_value_case_id,
                    approved_target_value_case_number,
                    approved_target_initiative_title,
                    source_released_capital_snapshot,
                    source_remaining_commitment_snapshot,
                    execution_owner_user_id,
                    execution_owner_name_snapshot,
                    execution_objective,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                executionCaseId,
                executionNumber,
                candidate.interventionCaseId(),
                candidate.interventionNumber(),
                candidate.performanceCaseId(),
                candidate.performanceCaseNumber(),
                candidate.fundingCommitmentId(),
                candidate.fundingCommitmentNumber(),
                candidate.sourceValueCaseId(),
                candidate.sourceValueCaseNumber(),
                candidate.initiativeNumber(),
                candidate.initiativeTitle(),
                candidate.currency(),
                candidate.fiscalYear(),
                candidate.approvedAction()
                        .name(),
                candidate.approvedAffectedCapitalAmount(),
                candidate.approvedTargetValueCaseId(),
                candidate.approvedTargetValueCaseNumber(),
                candidate.approvedTargetInitiativeTitle(),
                candidate.currentReleasedCapitalAmount(),
                candidate.currentRemainingCommitmentAmount(),
                input.executionOwnerUserId(),
                ownerName,
                input.executionObjective()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow activeCaseForIntervention(
            UUID interventionCaseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE execution_case.intervention_case_id = ?
                        AND execution_case.status <> 'CLOSED'

                        ORDER BY
                            execution_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                interventionCaseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public CaseRow findCase(
            UUID executionCaseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE execution_case.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                executionCaseId
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
                            CASE execution_case.status
                                WHEN 'READY_FOR_VERIFICATION'
                                THEN 1
                                WHEN 'REMEDIATION_REQUIRED'
                                THEN 2
                                WHEN 'ACTIVE'
                                THEN 3
                                WHEN 'PLANNED'
                                THEN 4
                                WHEN 'VERIFIED'
                                THEN 5
                                ELSE 6
                            END,

                            execution_case.created_at DESC
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

    public void createAcknowledgement(
            UUID acknowledgementId,
            UUID executionCaseId,
            InterventionExecutionAcknowledgementInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_acknowledgements (
                    id,
                    execution_case_id,
                    acknowledgement_note,
                    acknowledged_by_user_id,
                    acknowledged_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                acknowledgementId,
                executionCaseId,
                input.acknowledgementNote()
                        .trim(),
                currentUserId
        );
    }

    public AcknowledgementRow acknowledgement(
            UUID executionCaseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    acknowledgement.id,
                    acknowledgement.execution_case_id,
                    acknowledgement.acknowledgement_note,

                    user_account.full_name
                        AS acknowledged_by_name,

                    acknowledgement.acknowledged_at

                FROM procurement_intervention_execution_acknowledgements
                    acknowledgement

                JOIN app_users
                    user_account
                    ON user_account.id =
                       acknowledgement.acknowledged_by_user_id

                WHERE acknowledgement.execution_case_id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AcknowledgementRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "execution_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "acknowledgement_note"
                                ),
                                resultSet.getString(
                                        "acknowledged_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "acknowledged_at"
                                )
                                        .toInstant()
                        ),
                executionCaseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markActive(
            UUID executionCaseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_intervention_execution_cases

                SET
                    status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'PLANNED'
                """,
                executionCaseId
        );
    }

    public void createEvidence(
            UUID evidenceId,
            UUID executionCaseId,
            InterventionExecutionEvidenceInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_evidence (
                    id,
                    execution_case_id,
                    implemented_on,
                    implemented_capital_amount,
                    evidence_note,
                    reference_text,
                    recorded_by_user_id,
                    recorded_at
                )
                VALUES (
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
                evidenceId,
                executionCaseId,
                input.implementedOn(),
                input.implementedCapitalAmount(),
                input.evidenceNote()
                        .trim(),
                input.referenceText()
                        .trim(),
                currentUserId
        );
    }

    public List<EvidenceRow> evidence(
            UUID executionCaseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    evidence.id,
                    evidence.execution_case_id,
                    evidence.implemented_on,
                    evidence.implemented_capital_amount,
                    evidence.evidence_note,
                    evidence.reference_text,

                    user_account.full_name
                        AS recorded_by_name,

                    evidence.recorded_at

                FROM procurement_intervention_execution_evidence
                    evidence

                JOIN app_users
                    user_account
                    ON user_account.id =
                       evidence.recorded_by_user_id

                WHERE evidence.execution_case_id = ?

                ORDER BY
                    evidence.implemented_on,
                    evidence.recorded_at
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new EvidenceRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "execution_case_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "implemented_on",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "implemented_capital_amount"
                                ),
                                resultSet.getString(
                                        "evidence_note"
                                ),
                                resultSet.getString(
                                        "reference_text"
                                ),
                                resultSet.getString(
                                        "recorded_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "recorded_at"
                                )
                                        .toInstant()
                        ),
                executionCaseId
        );
    }

    public void markReadyForVerification(
            UUID executionCaseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_intervention_execution_cases

                SET
                    status = 'READY_FOR_VERIFICATION',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status IN (
                    'ACTIVE',
                    'REMEDIATION_REQUIRED'
                )
                """,
                executionCaseId
        );
    }

    public void createVerification(
            UUID verificationId,
            UUID executionCaseId,
            InterventionExecutionVerificationInput input,
            InvestmentInterventionAction approvedAction,
            InterventionExecutionMetricResult metric,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_verifications (
                    id,
                    execution_case_id,
                    decision,
                    approved_action,
                    approved_affected_capital_amount,
                    implemented_capital_amount,
                    remaining_implementation_amount,
                    implementation_pct,
                    implementation_variance_amount,
                    verification_note,
                    verified_by_user_id,
                    verified_at
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
                verificationId,
                executionCaseId,
                input.decision()
                        .name(),
                approvedAction.name(),
                metric.approvedAffectedCapitalAmount(),
                metric.implementedCapitalAmount(),
                metric.remainingImplementationAmount(),
                metric.implementationPct(),
                metric.implementationVarianceAmount(),
                input.verificationNote()
                        .trim(),
                currentUserId
        );
    }

    public List<VerificationRow> verifications(
            UUID executionCaseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    verification.id,
                    verification.execution_case_id,
                    verification.decision,
                    verification.approved_action,
                    verification.approved_affected_capital_amount,
                    verification.implemented_capital_amount,
                    verification.remaining_implementation_amount,
                    verification.implementation_pct,
                    verification.implementation_variance_amount,
                    verification.verification_note,

                    user_account.full_name
                        AS verified_by_name,

                    verification.verified_at

                FROM procurement_intervention_execution_verifications
                    verification

                JOIN app_users
                    user_account
                    ON user_account.id =
                       verification.verified_by_user_id

                WHERE verification.execution_case_id = ?

                ORDER BY
                    verification.verified_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new VerificationRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "execution_case_id",
                                        UUID.class
                                ),
                                InterventionExecutionVerificationDecision.valueOf(
                                        resultSet.getString(
                                                "decision"
                                        )
                                ),
                                InvestmentInterventionAction.valueOf(
                                        resultSet.getString(
                                                "approved_action"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "approved_affected_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "implemented_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "remaining_implementation_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "implementation_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "implementation_variance_amount"
                                ),
                                resultSet.getString(
                                        "verification_note"
                                ),
                                resultSet.getString(
                                        "verified_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "verified_at"
                                )
                                        .toInstant()
                        ),
                executionCaseId
        );
    }

    public void markVerified(
            UUID executionCaseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_intervention_execution_cases

                SET
                    status = 'VERIFIED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_VERIFICATION'
                """,
                executionCaseId
        );
    }

    public void markRemediationRequired(
            UUID executionCaseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_intervention_execution_cases

                SET
                    status = 'REMEDIATION_REQUIRED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_VERIFICATION'
                """,
                executionCaseId
        );
    }

    public void closeCase(
            UUID executionCaseId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_intervention_execution_cases

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'VERIFIED'
                """,
                note.trim(),
                currentUserId,
                executionCaseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            InterventionExecutionSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    planned_case_count,
                    active_case_count,
                    ready_case_count,
                    verified_case_count,
                    remediation_case_count,
                    total_approved_affected_capital_amount,
                    total_implemented_capital_amount,
                    total_remaining_implementation_amount,
                    average_implementation_pct,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                summary.caseCount(),
                summary.plannedCaseCount(),
                summary.activeCaseCount(),
                summary.readyCaseCount(),
                summary.verifiedCaseCount(),
                summary.remediationCaseCount(),
                summary.totalApprovedAffectedCapitalAmount(),
                summary.totalImplementedCapitalAmount(),
                summary.totalRemainingImplementationAmount(),
                summary.averageImplementationPct(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            InterventionExecutionCaseResponse executionCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_intervention_execution_snapshot_items (
                    id,
                    snapshot_id,
                    execution_case_id,
                    execution_number,
                    intervention_number,
                    initiative_title,
                    currency,
                    case_status,
                    approved_action,
                    approved_affected_capital_amount,
                    implemented_capital_amount,
                    remaining_implementation_amount,
                    implementation_pct,
                    implementation_variance_amount,
                    execution_health,
                    current_released_capital_amount,
                    current_remaining_commitment_amount,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                executionCase.id(),
                executionCase.executionNumber(),
                executionCase.interventionNumber(),
                executionCase.initiativeTitle(),
                executionCase.currency(),
                executionCase.status()
                        .name(),
                executionCase.approvedAction()
                        .name(),
                executionCase.approvedAffectedCapitalAmount(),
                executionCase.implementedCapitalAmount(),
                executionCase.remainingImplementationAmount(),
                executionCase.implementationPct(),
                executionCase.implementationVarianceAmount(),
                executionCase.executionHealth()
                        .name(),
                executionCase.currentReleasedCapitalAmount(),
                executionCase.currentRemainingCommitmentAmount(),
                executionCase.approvedTargetValueCaseNumber()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE execution_snapshot.id = ?
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
                            execution_snapshot.captured_at DESC

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
                    execution_case_id,
                    execution_number,
                    intervention_number,
                    initiative_title,
                    currency,
                    case_status,
                    approved_action,
                    approved_affected_capital_amount,
                    implemented_capital_amount,
                    remaining_implementation_amount,
                    implementation_pct,
                    implementation_variance_amount,
                    execution_health,
                    current_released_capital_amount,
                    current_remaining_commitment_amount,
                    approved_target_value_case_number

                FROM procurement_intervention_execution_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE execution_health
                        WHEN 'REMEDIATION_REQUIRED'
                        THEN 1
                        WHEN 'VARIANCE'
                        THEN 2
                        WHEN 'IN_PROGRESS'
                        THEN 3
                        WHEN 'NOT_STARTED'
                        THEN 4
                        ELSE 5
                    END,

                    implementation_pct,
                    execution_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "execution_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "execution_number"
                                ),
                                resultSet.getString(
                                        "intervention_number"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                InterventionExecutionStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                InvestmentInterventionAction.valueOf(
                                        resultSet.getString(
                                                "approved_action"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "approved_affected_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "implemented_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "remaining_implementation_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "implementation_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "implementation_variance_amount"
                                ),
                                InterventionExecutionHealth.valueOf(
                                        resultSet.getString(
                                                "execution_health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "current_released_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_remaining_commitment_amount"
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
                    execution_case.id,
                    execution_case.execution_number,
                    execution_case.intervention_case_id,
                    execution_case.intervention_number,
                    execution_case.performance_case_id,
                    execution_case.performance_case_number,
                    execution_case.funding_commitment_id,
                    execution_case.funding_commitment_number,
                    execution_case.source_value_case_id,
                    execution_case.source_value_case_number,
                    execution_case.initiative_number,
                    execution_case.initiative_title,
                    execution_case.currency,
                    execution_case.fiscal_year,
                    execution_case.approved_action,
                    execution_case.approved_affected_capital_amount,
                    execution_case.approved_target_value_case_id,
                    execution_case.approved_target_value_case_number,
                    execution_case.approved_target_initiative_title,
                    execution_case.source_released_capital_snapshot,
                    execution_case.source_remaining_commitment_snapshot,
                    execution_case.execution_owner_user_id,
                    execution_case.execution_owner_name_snapshot,
                    execution_case.execution_objective,
                    execution_case.status,
                    execution_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    execution_case.closed_at,
                    execution_case.created_at,
                    execution_case.updated_at,
                    execution_case.version

                FROM procurement_intervention_execution_cases
                    execution_case

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       execution_case.closed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    execution_snapshot.id,
                    execution_snapshot.snapshot_number,
                    execution_snapshot.case_count,
                    execution_snapshot.planned_case_count,
                    execution_snapshot.active_case_count,
                    execution_snapshot.ready_case_count,
                    execution_snapshot.verified_case_count,
                    execution_snapshot.remediation_case_count,
                    execution_snapshot.total_approved_affected_capital_amount,
                    execution_snapshot.total_implemented_capital_amount,
                    execution_snapshot.total_remaining_implementation_amount,
                    execution_snapshot.average_implementation_pct,

                    user_account.full_name
                        AS captured_by_name,

                    execution_snapshot.captured_at

                FROM procurement_intervention_execution_snapshots
                    execution_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       execution_snapshot.captured_by_user_id

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
                        "source_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_value_case_number"
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
                InvestmentInterventionAction.valueOf(
                        resultSet.getString(
                                "approved_action"
                        )
                ),
                resultSet.getBigDecimal(
                        "approved_affected_capital_amount"
                ),
                resultSet.getObject(
                        "approved_target_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "approved_target_value_case_number"
                ),
                resultSet.getString(
                        "approved_target_initiative_title"
                ),
                resultSet.getBigDecimal(
                        "source_released_capital_snapshot"
                ),
                resultSet.getBigDecimal(
                        "source_remaining_commitment_snapshot"
                ),
                resultSet.getObject(
                        "execution_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "execution_owner_name_snapshot"
                ),
                resultSet.getString(
                        "execution_objective"
                ),
                InterventionExecutionStatus.valueOf(
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
                        "planned_case_count"
                ),
                resultSet.getInt(
                        "active_case_count"
                ),
                resultSet.getInt(
                        "ready_case_count"
                ),
                resultSet.getInt(
                        "verified_case_count"
                ),
                resultSet.getInt(
                        "remediation_case_count"
                ),
                resultSet.getBigDecimal(
                        "total_approved_affected_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_implemented_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_remaining_implementation_amount"
                ),
                resultSet.getBigDecimal(
                        "average_implementation_pct"
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
            String executionNumber,
            UUID interventionCaseId,
            String interventionNumber,
            UUID performanceCaseId,
            String performanceCaseNumber,
            UUID fundingCommitmentId,
            String fundingCommitmentNumber,
            UUID sourceValueCaseId,
            String sourceValueCaseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            InvestmentInterventionAction approvedAction,
            BigDecimal approvedAffectedCapitalAmount,
            UUID approvedTargetValueCaseId,
            String approvedTargetValueCaseNumber,
            String approvedTargetInitiativeTitle,
            BigDecimal sourceReleasedCapitalSnapshot,
            BigDecimal sourceRemainingCommitmentSnapshot,
            UUID executionOwnerUserId,
            String executionOwnerName,
            String executionObjective,
            InterventionExecutionStatus status,
            String closeNote,
            String closedByName,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record AcknowledgementRow(
            UUID id,
            UUID executionCaseId,
            String acknowledgementNote,
            String acknowledgedByName,
            Instant acknowledgedAt
    ) {
    }

    public record EvidenceRow(
            UUID id,
            UUID executionCaseId,
            LocalDate implementedOn,
            BigDecimal implementedCapitalAmount,
            String evidenceNote,
            String referenceText,
            String recordedByName,
            Instant recordedAt
    ) {
    }

    public record VerificationRow(
            UUID id,
            UUID executionCaseId,
            InterventionExecutionVerificationDecision decision,
            InvestmentInterventionAction approvedAction,
            BigDecimal approvedAffectedCapitalAmount,
            BigDecimal implementedCapitalAmount,
            BigDecimal remainingImplementationAmount,
            BigDecimal implementationPct,
            BigDecimal implementationVarianceAmount,
            String verificationNote,
            String verifiedByName,
            Instant verifiedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            int caseCount,
            int plannedCaseCount,
            int activeCaseCount,
            int readyCaseCount,
            int verifiedCaseCount,
            int remediationCaseCount,
            BigDecimal totalApprovedAffectedCapitalAmount,
            BigDecimal totalImplementedCapitalAmount,
            BigDecimal totalRemainingImplementationAmount,
            BigDecimal averageImplementationPct,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID executionCaseId,
            String executionNumber,
            String interventionNumber,
            String initiativeTitle,
            String currency,
            InterventionExecutionStatus caseStatus,
            InvestmentInterventionAction approvedAction,
            BigDecimal approvedAffectedCapitalAmount,
            BigDecimal implementedCapitalAmount,
            BigDecimal remainingImplementationAmount,
            BigDecimal implementationPct,
            BigDecimal implementationVarianceAmount,
            InterventionExecutionHealth executionHealth,
            BigDecimal currentReleasedCapitalAmount,
            BigDecimal currentRemainingCommitmentAmount,
            String approvedTargetValueCaseNumber
    ) {
    }
}
