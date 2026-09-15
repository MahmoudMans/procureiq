package com.procureiq.capitalredeployment;

import com.procureiq.capitalrecycling.CapitalRecyclingSourceStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class CapitalRedeploymentRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapitalRedeploymentRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_redeployment_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextGateSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_redeployment_gate_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_redeployment_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CapitalRedeploymentUserOptionResponse> users() {
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
                        new CapitalRedeploymentUserOptionResponse(
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
            String redeploymentNumber,
            CapitalRedeploymentCandidateResponse candidate,
            CapitalRedeploymentCaseInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_cases (
                    id,
                    redeployment_number,
                    recycling_source_id,
                    recycling_source_number,
                    reinvestment_proposal_id,
                    source_funding_commitment_id,
                    source_funding_commitment_number,
                    source_value_case_id,
                    source_value_case_number,
                    target_value_case_id,
                    target_value_case_number,
                    target_initiative_number,
                    target_initiative_title,
                    currency,
                    fiscal_year,
                    approved_redeployment_amount,
                    source_recyclable_capital_snapshot,
                    source_funding_remaining_snapshot,
                    target_roi_pct_snapshot,
                    target_persistence_pct_snapshot,
                    target_net_value_snapshot,
                    target_value_health_snapshot,
                    redeployment_owner_user_id,
                    redeployment_owner_name_snapshot,
                    redeployment_objective,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                caseId,
                redeploymentNumber,
                candidate.recyclingSourceId(),
                candidate.recyclingSourceNumber(),
                candidate.reinvestmentProposalId(),
                candidate.sourceFundingCommitmentId(),
                candidate.sourceFundingCommitmentNumber(),
                candidate.sourceValueCaseId(),
                candidate.sourceValueCaseNumber(),
                candidate.targetValueCaseId(),
                candidate.targetValueCaseNumber(),
                candidate.targetInitiativeNumber(),
                candidate.targetInitiativeTitle(),
                candidate.currency(),
                candidate.fiscalYear(),
                candidate.approvedRedeploymentAmount(),
                candidate.sourceRecyclableCapitalAmount(),
                candidate.currentSourceFundingRemainingAmount(),
                candidate.targetRoiPctSnapshot(),
                candidate.targetPersistencePctSnapshot(),
                candidate.targetNetValueSnapshot(),
                candidate.targetValueHealthSnapshot()
                        .name(),
                input.redeploymentOwnerUserId(),
                ownerName,
                input.redeploymentObjective()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow caseForProposal(
            UUID proposalId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE redeployment_case.reinvestment_proposal_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                proposalId
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
                        WHERE redeployment_case.id = ?
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
                            CASE redeployment_case.status
                                WHEN 'READY_FOR_AUTHORIZATION'
                                THEN 1
                                WHEN 'READY_FOR_VERIFICATION'
                                THEN 2
                                WHEN 'REMEDIATION_REQUIRED'
                                THEN 3
                                WHEN 'AUTHORIZED'
                                THEN 4
                                WHEN 'ACTIVE'
                                THEN 5
                                WHEN 'PLANNED'
                                THEN 6
                                WHEN 'VERIFIED'
                                THEN 7
                                ELSE 8
                            END,

                            redeployment_case.created_at DESC
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

    public void createGate(
            UUID gateId,
            String gateNumber,
            UUID caseId,
            CapitalRedeploymentGateInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_gates (
                    id,
                    redeployment_case_id,
                    gate_number,
                    title,
                    requirement,
                    status,
                    created_by_user_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                gateId,
                caseId,
                gateNumber,
                input.title()
                        .trim(),
                input.requirement()
                        .trim(),
                currentUserId
        );
    }

    public GateRow findGate(
            UUID gateId
    ) {
        return jdbcTemplate.query(
                gateSql()
                        + """
                        WHERE redeployment_gate.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGate(
                                resultSet
                        ),
                gateId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<GateRow> gates(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                gateSql()
                        + """
                        WHERE redeployment_gate.redeployment_case_id = ?

                        ORDER BY
                            redeployment_gate.created_at,
                            redeployment_gate.gate_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGate(
                                resultSet
                        ),
                caseId
        );
    }

    public void decideGate(
            UUID gateId,
            CapitalRedeploymentGateDecisionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_gates

                SET
                    status = ?,
                    evidence_note = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at = CURRENT_TIMESTAMP

                WHERE id = ?
                AND status = 'PENDING'
                """,
                input.decision()
                        .name(),
                input.evidenceNote()
                        .trim(),
                input.decisionNote()
                        .trim(),
                currentUserId,
                gateId
        );
    }

    public void markReadyForAuthorization(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'READY_FOR_AUTHORIZATION',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'PLANNED'
                """,
                caseId
        );
    }

    public void createAuthorization(
            UUID authorizationId,
            UUID caseId,
            BigDecimal authorizedAmount,
            CapitalRedeploymentAuthorizationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_authorizations (
                    id,
                    redeployment_case_id,
                    decision,
                    authorized_amount,
                    authorization_note,
                    authorized_by_user_id,
                    authorized_at
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
                authorizationId,
                caseId,
                input.decision()
                        .name(),
                authorizedAmount,
                input.authorizationNote()
                        .trim(),
                currentUserId
        );
    }

    public List<AuthorizationRow> authorizations(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                authorizationSql()
                        + """
                        WHERE redeployment_authorization.redeployment_case_id = ?

                        ORDER BY
                            redeployment_authorization.authorized_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAuthorization(
                                resultSet
                        ),
                caseId
        );
    }

    public AuthorizationRow latestApprovedAuthorization(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                authorizationSql()
                        + """
                        WHERE redeployment_authorization.redeployment_case_id = ?
                        AND redeployment_authorization.decision = 'APPROVED'

                        ORDER BY
                            redeployment_authorization.authorized_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAuthorization(
                                resultSet
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markAuthorized(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'AUTHORIZED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_AUTHORIZATION'
                """,
                caseId
        );
    }

    public void returnToPlanned(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'PLANNED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_AUTHORIZATION'
                """,
                caseId
        );
    }

    public void markActive(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'AUTHORIZED'
                """,
                caseId
        );
    }

    public void createRelease(
            UUID releaseId,
            UUID caseId,
            UUID authorizationId,
            CapitalRedeploymentReleaseInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_releases (
                    id,
                    redeployment_case_id,
                    authorization_id,
                    released_on,
                    released_amount,
                    evidence_note,
                    reference_text,
                    released_by_user_id,
                    released_at
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
                    CURRENT_TIMESTAMP
                )
                """,
                releaseId,
                caseId,
                authorizationId,
                input.releasedOn(),
                input.releasedAmount(),
                input.evidenceNote()
                        .trim(),
                input.referenceText()
                        .trim(),
                currentUserId
        );
    }

    public List<ReleaseRow> releases(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                releaseSql()
                        + """
                        WHERE redeployment_release.redeployment_case_id = ?

                        ORDER BY
                            redeployment_release.released_on,
                            redeployment_release.released_at
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRelease(
                                resultSet
                        ),
                caseId
        );
    }

    public void markReadyForVerification(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

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
                caseId
        );
    }

    public void createVerification(
            UUID verificationId,
            UUID caseId,
            CapitalRedeploymentVerificationInput input,
            CapitalRedeploymentMetricResult metric,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_verifications (
                    id,
                    redeployment_case_id,
                    decision,
                    approved_redeployment_amount,
                    released_redeployment_amount,
                    remaining_redeployment_amount,
                    redeployment_pct,
                    redeployment_variance_amount,
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
                    CURRENT_TIMESTAMP
                )
                """,
                verificationId,
                caseId,
                input.decision()
                        .name(),
                metric.approvedRedeploymentAmount(),
                metric.releasedRedeploymentAmount(),
                metric.remainingRedeploymentAmount(),
                metric.redeploymentPct(),
                metric.redeploymentVarianceAmount(),
                input.verificationNote()
                        .trim(),
                currentUserId
        );
    }

    public List<VerificationRow> verifications(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                verificationSql()
                        + """
                        WHERE redeployment_verification.redeployment_case_id = ?

                        ORDER BY
                            redeployment_verification.verified_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapVerification(
                                resultSet
                        ),
                caseId
        );
    }

    public void markVerified(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'VERIFIED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_VERIFICATION'
                """,
                caseId
        );
    }

    public void markRemediationRequired(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_redeployment_cases

                SET
                    status = 'REMEDIATION_REQUIRED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_VERIFICATION'
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
                UPDATE procurement_capital_redeployment_cases

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
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            CapitalRedeploymentSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    planned_case_count,
                    authorization_pending_case_count,
                    active_case_count,
                    ready_case_count,
                    verified_case_count,
                    remediation_case_count,
                    total_approved_redeployment_amount,
                    total_released_redeployment_amount,
                    total_remaining_redeployment_amount,
                    average_redeployment_pct,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                summary.caseCount(),
                summary.plannedCaseCount(),
                summary.authorizationPendingCaseCount(),
                summary.activeCaseCount(),
                summary.readyCaseCount(),
                summary.verifiedCaseCount(),
                summary.remediationCaseCount(),
                summary.totalApprovedRedeploymentAmount(),
                summary.totalReleasedRedeploymentAmount(),
                summary.totalRemainingRedeploymentAmount(),
                summary.averageRedeploymentPct(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            CapitalRedeploymentCaseResponse redeploymentCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_redeployment_snapshot_items (
                    id,
                    snapshot_id,
                    redeployment_case_id,
                    redeployment_number,
                    recycling_source_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    approved_redeployment_amount,
                    released_redeployment_amount,
                    remaining_redeployment_amount,
                    redeployment_pct,
                    redeployment_variance_amount,
                    redeployment_health,
                    current_source_funding_remaining_amount,
                    gate_count,
                    resolved_gate_count,
                    authorization_count,
                    release_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                redeploymentCase.id(),
                redeploymentCase.redeploymentNumber(),
                redeploymentCase.recyclingSourceNumber(),
                redeploymentCase.targetValueCaseNumber(),
                redeploymentCase.targetInitiativeTitle(),
                redeploymentCase.currency(),
                redeploymentCase.status()
                        .name(),
                redeploymentCase.approvedRedeploymentAmount(),
                redeploymentCase.releasedRedeploymentAmount(),
                redeploymentCase.remainingRedeploymentAmount(),
                redeploymentCase.redeploymentPct(),
                redeploymentCase.redeploymentVarianceAmount(),
                redeploymentCase.redeploymentHealth()
                        .name(),
                redeploymentCase.currentSourceFundingRemainingAmount(),
                redeploymentCase.gateCount(),
                redeploymentCase.resolvedGateCount(),
                redeploymentCase.authorizationCount(),
                redeploymentCase.releaseCount()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE redeployment_snapshot.id = ?
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
                            redeployment_snapshot.captured_at DESC

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
                    redeployment_case_id,
                    redeployment_number,
                    recycling_source_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    approved_redeployment_amount,
                    released_redeployment_amount,
                    remaining_redeployment_amount,
                    redeployment_pct,
                    redeployment_variance_amount,
                    redeployment_health,
                    current_source_funding_remaining_amount,
                    gate_count,
                    resolved_gate_count,
                    authorization_count,
                    release_count

                FROM procurement_capital_redeployment_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE redeployment_health
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
                    redeployment_pct,
                    redeployment_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "redeployment_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "redeployment_number"
                                ),
                                resultSet.getString(
                                        "recycling_source_number"
                                ),
                                resultSet.getString(
                                        "target_value_case_number"
                                ),
                                resultSet.getString(
                                        "target_initiative_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                CapitalRedeploymentStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "approved_redeployment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "released_redeployment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "remaining_redeployment_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "redeployment_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "redeployment_variance_amount"
                                ),
                                CapitalRedeploymentHealth.valueOf(
                                        resultSet.getString(
                                                "redeployment_health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "current_source_funding_remaining_amount"
                                ),
                                resultSet.getInt(
                                        "gate_count"
                                ),
                                resultSet.getInt(
                                        "resolved_gate_count"
                                ),
                                resultSet.getInt(
                                        "authorization_count"
                                ),
                                resultSet.getInt(
                                        "release_count"
                                )
                        ),
                snapshotId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    redeployment_case.id,
                    redeployment_case.redeployment_number,
                    redeployment_case.recycling_source_id,
                    redeployment_case.recycling_source_number,
                    redeployment_case.reinvestment_proposal_id,
                    redeployment_case.source_funding_commitment_id,
                    redeployment_case.source_funding_commitment_number,
                    redeployment_case.source_value_case_id,
                    redeployment_case.source_value_case_number,
                    redeployment_case.target_value_case_id,
                    redeployment_case.target_value_case_number,
                    redeployment_case.target_initiative_number,
                    redeployment_case.target_initiative_title,
                    redeployment_case.currency,
                    redeployment_case.fiscal_year,
                    redeployment_case.approved_redeployment_amount,
                    redeployment_case.source_recyclable_capital_snapshot,
                    redeployment_case.source_funding_remaining_snapshot,
                    redeployment_case.target_roi_pct_snapshot,
                    redeployment_case.target_persistence_pct_snapshot,
                    redeployment_case.target_net_value_snapshot,
                    redeployment_case.target_value_health_snapshot,
                    redeployment_case.redeployment_owner_user_id,
                    redeployment_case.redeployment_owner_name_snapshot,
                    redeployment_case.redeployment_objective,
                    redeployment_case.status,
                    redeployment_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    redeployment_case.closed_at,
                    redeployment_case.created_at,
                    redeployment_case.updated_at,
                    redeployment_case.version

                FROM procurement_capital_redeployment_cases
                    redeployment_case

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       redeployment_case.closed_by_user_id

                """;
    }

    private String gateSql() {
        return """
                SELECT
                    redeployment_gate.id,
                    redeployment_gate.redeployment_case_id,
                    redeployment_gate.gate_number,
                    redeployment_gate.title,
                    redeployment_gate.requirement,
                    redeployment_gate.status,
                    redeployment_gate.evidence_note,
                    redeployment_gate.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    redeployment_gate.decided_at,
                    redeployment_gate.created_at

                FROM procurement_capital_redeployment_gates
                    redeployment_gate

                LEFT JOIN app_users
                    decider
                    ON decider.id =
                       redeployment_gate.decided_by_user_id

                """;
    }

    private String authorizationSql() {
        return """
                SELECT
                    redeployment_authorization.id,
                    redeployment_authorization.redeployment_case_id,
                    redeployment_authorization.decision,
                    redeployment_authorization.authorized_amount,
                    redeployment_authorization.authorization_note,

                    authorizer.full_name
                        AS authorized_by_name,

                    redeployment_authorization.authorized_at

                FROM procurement_capital_redeployment_authorizations
                    redeployment_authorization

                JOIN app_users
                    authorizer
                    ON authorizer.id =
                       redeployment_authorization.authorized_by_user_id

                """;
    }

    private String releaseSql() {
        return """
                SELECT
                    redeployment_release.id,
                    redeployment_release.redeployment_case_id,
                    redeployment_release.authorization_id,
                    redeployment_release.released_on,
                    redeployment_release.released_amount,
                    redeployment_release.evidence_note,
                    redeployment_release.reference_text,

                    releaser.full_name
                        AS released_by_name,

                    redeployment_release.released_at

                FROM procurement_capital_redeployment_releases
                    redeployment_release

                JOIN app_users
                    releaser
                    ON releaser.id =
                       redeployment_release.released_by_user_id

                """;
    }

    private String verificationSql() {
        return """
                SELECT
                    redeployment_verification.id,
                    redeployment_verification.redeployment_case_id,
                    redeployment_verification.decision,
                    redeployment_verification.approved_redeployment_amount,
                    redeployment_verification.released_redeployment_amount,
                    redeployment_verification.remaining_redeployment_amount,
                    redeployment_verification.redeployment_pct,
                    redeployment_verification.redeployment_variance_amount,
                    redeployment_verification.verification_note,

                    verifier.full_name
                        AS verified_by_name,

                    redeployment_verification.verified_at

                FROM procurement_capital_redeployment_verifications
                    redeployment_verification

                JOIN app_users
                    verifier
                    ON verifier.id =
                       redeployment_verification.verified_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    redeployment_snapshot.id,
                    redeployment_snapshot.snapshot_number,
                    redeployment_snapshot.case_count,
                    redeployment_snapshot.planned_case_count,
                    redeployment_snapshot.authorization_pending_case_count,
                    redeployment_snapshot.active_case_count,
                    redeployment_snapshot.ready_case_count,
                    redeployment_snapshot.verified_case_count,
                    redeployment_snapshot.remediation_case_count,
                    redeployment_snapshot.total_approved_redeployment_amount,
                    redeployment_snapshot.total_released_redeployment_amount,
                    redeployment_snapshot.total_remaining_redeployment_amount,
                    redeployment_snapshot.average_redeployment_pct,

                    user_account.full_name
                        AS captured_by_name,

                    redeployment_snapshot.captured_at

                FROM procurement_capital_redeployment_snapshots
                    redeployment_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       redeployment_snapshot.captured_by_user_id

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
                        "redeployment_number"
                ),
                resultSet.getObject(
                        "recycling_source_id",
                        UUID.class
                ),
                resultSet.getString(
                        "recycling_source_number"
                ),
                resultSet.getObject(
                        "reinvestment_proposal_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "source_funding_commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_funding_commitment_number"
                ),
                resultSet.getObject(
                        "source_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_value_case_number"
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
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "approved_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "source_recyclable_capital_snapshot"
                ),
                resultSet.getBigDecimal(
                        "source_funding_remaining_snapshot"
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
                resultSet.getObject(
                        "redeployment_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "redeployment_owner_name_snapshot"
                ),
                resultSet.getString(
                        "redeployment_objective"
                ),
                CapitalRedeploymentStatus.valueOf(
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

    private GateRow mapGate(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new GateRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "redeployment_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "gate_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "requirement"
                ),
                CapitalRedeploymentGateStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "evidence_note"
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                instant(
                        resultSet,
                        "decided_at"
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant()
        );
    }

    private AuthorizationRow mapAuthorization(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new AuthorizationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "redeployment_case_id",
                        UUID.class
                ),
                CapitalRedeploymentAuthorizationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getBigDecimal(
                        "authorized_amount"
                ),
                resultSet.getString(
                        "authorization_note"
                ),
                resultSet.getString(
                        "authorized_by_name"
                ),
                resultSet.getTimestamp(
                        "authorized_at"
                )
                        .toInstant()
        );
    }

    private ReleaseRow mapRelease(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ReleaseRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "redeployment_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "authorization_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "released_on",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "released_amount"
                ),
                resultSet.getString(
                        "evidence_note"
                ),
                resultSet.getString(
                        "reference_text"
                ),
                resultSet.getString(
                        "released_by_name"
                ),
                resultSet.getTimestamp(
                        "released_at"
                )
                        .toInstant()
        );
    }

    private VerificationRow mapVerification(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new VerificationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "redeployment_case_id",
                        UUID.class
                ),
                CapitalRedeploymentVerificationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getBigDecimal(
                        "approved_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "released_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "redeployment_pct"
                ),
                resultSet.getBigDecimal(
                        "redeployment_variance_amount"
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
                        "authorization_pending_case_count"
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
                        "total_approved_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "total_released_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "total_remaining_redeployment_amount"
                ),
                resultSet.getBigDecimal(
                        "average_redeployment_pct"
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
            String redeploymentNumber,
            UUID recyclingSourceId,
            String recyclingSourceNumber,
            UUID reinvestmentProposalId,
            UUID sourceFundingCommitmentId,
            String sourceFundingCommitmentNumber,
            UUID sourceValueCaseId,
            String sourceValueCaseNumber,
            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeNumber,
            String targetInitiativeTitle,
            String currency,
            int fiscalYear,
            BigDecimal approvedRedeploymentAmount,
            BigDecimal sourceRecyclableCapitalSnapshot,
            BigDecimal sourceFundingRemainingSnapshot,
            BigDecimal targetRoiPctSnapshot,
            BigDecimal targetPersistencePctSnapshot,
            BigDecimal targetNetValueSnapshot,
            StrategicValueHealth targetValueHealthSnapshot,
            UUID redeploymentOwnerUserId,
            String redeploymentOwnerName,
            String redeploymentObjective,
            CapitalRedeploymentStatus status,
            String closeNote,
            String closedByName,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record GateRow(
            UUID id,
            UUID redeploymentCaseId,
            String gateNumber,
            String title,
            String requirement,
            CapitalRedeploymentGateStatus status,
            String evidenceNote,
            String decisionNote,
            String decidedByName,
            Instant decidedAt,
            Instant createdAt
    ) {
    }

    public record AuthorizationRow(
            UUID id,
            UUID redeploymentCaseId,
            CapitalRedeploymentAuthorizationDecision decision,
            BigDecimal authorizedAmount,
            String authorizationNote,
            String authorizedByName,
            Instant authorizedAt
    ) {
    }

    public record ReleaseRow(
            UUID id,
            UUID redeploymentCaseId,
            UUID authorizationId,
            LocalDate releasedOn,
            BigDecimal releasedAmount,
            String evidenceNote,
            String referenceText,
            String releasedByName,
            Instant releasedAt
    ) {
    }

    public record VerificationRow(
            UUID id,
            UUID redeploymentCaseId,
            CapitalRedeploymentVerificationDecision decision,
            BigDecimal approvedRedeploymentAmount,
            BigDecimal releasedRedeploymentAmount,
            BigDecimal remainingRedeploymentAmount,
            BigDecimal redeploymentPct,
            BigDecimal redeploymentVarianceAmount,
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
            int authorizationPendingCaseCount,
            int activeCaseCount,
            int readyCaseCount,
            int verifiedCaseCount,
            int remediationCaseCount,
            BigDecimal totalApprovedRedeploymentAmount,
            BigDecimal totalReleasedRedeploymentAmount,
            BigDecimal totalRemainingRedeploymentAmount,
            BigDecimal averageRedeploymentPct,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID redeploymentCaseId,
            String redeploymentNumber,
            String recyclingSourceNumber,
            String targetValueCaseNumber,
            String targetInitiativeTitle,
            String currency,
            CapitalRedeploymentStatus caseStatus,
            BigDecimal approvedRedeploymentAmount,
            BigDecimal releasedRedeploymentAmount,
            BigDecimal remainingRedeploymentAmount,
            BigDecimal redeploymentPct,
            BigDecimal redeploymentVarianceAmount,
            CapitalRedeploymentHealth redeploymentHealth,
            BigDecimal currentSourceFundingRemainingAmount,
            int gateCount,
            int resolvedGateCount,
            int authorizationCount,
            int releaseCount
    ) {
    }
}
