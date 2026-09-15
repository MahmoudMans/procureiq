package com.procureiq.fundingexecution;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FundingExecutionRepository {

    private final JdbcTemplate jdbcTemplate;

    public FundingExecutionRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCommitmentSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_funding_commitment_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextTrancheSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_funding_tranche_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_funding_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FundingUserOptionResponse> users() {
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
                        new FundingUserOptionResponse(
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

    public void createCommitment(
            UUID commitmentId,
            String commitmentNumber,
            FundingCandidateResponse candidate,
            FundingCommitmentInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_commitments (
                    id,
                    commitment_number,
                    allocation_cycle_id,
                    allocation_cycle_number,
                    allocation_cycle_title,
                    allocation_item_id,
                    value_case_id,
                    case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    fiscal_year,
                    authorized_capital_amount,
                    committed_capital_amount,
                    funding_owner_user_id,
                    funding_owner_name_snapshot,
                    objective,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                commitmentId,
                commitmentNumber,
                candidate.allocationCycleId(),
                candidate.allocationCycleNumber(),
                candidate.allocationCycleTitle(),
                candidate.allocationItemId(),
                candidate.valueCaseId(),
                candidate.caseNumber(),
                candidate.initiativeNumber(),
                candidate.initiativeTitle(),
                candidate.currency(),
                candidate.fiscalYear(),
                candidate.authorizedCapitalAmount(),
                input.committedCapitalAmount(),
                input.fundingOwnerUserId(),
                ownerName,
                input.objective()
                        .trim(),
                currentUserId
        );
    }

    public CommitmentRow findCommitment(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        WHERE funding_commitment.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        ),
                commitmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public CommitmentRow findCommitmentByAllocationItem(
            UUID allocationItemId
    ) {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        WHERE funding_commitment.allocation_item_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        ),
                allocationItemId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CommitmentRow> commitments() {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        ORDER BY
                            CASE funding_commitment.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'FULLY_RELEASED'
                                THEN 3
                                ELSE 4
                            END,
                            funding_commitment.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        )
        );
    }

    public void activateCommitment(
            UUID commitmentId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_commitments

                SET
                    status = 'ACTIVE',
                    activated_by_user_id = ?,
                    activated_at = CURRENT_TIMESTAMP,
                    activation_note = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'PLANNED'
                """,
                currentUserId,
                note.trim(),
                commitmentId
        );
    }

    public void markFullyReleased(
            UUID commitmentId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_commitments

                SET
                    status = 'FULLY_RELEASED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'ACTIVE'
                """,
                commitmentId
        );
    }

    public void closeCommitment(
            UUID commitmentId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_commitments

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'FULLY_RELEASED'
                """,
                currentUserId,
                note.trim(),
                commitmentId
        );
    }

    public void createTranche(
            UUID trancheId,
            String trancheNumber,
            UUID commitmentId,
            FundingTrancheInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_tranches (
                    id,
                    commitment_id,
                    tranche_number,
                    sequence_no,
                    title,
                    planned_release_amount,
                    target_date,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                trancheId,
                commitmentId,
                trancheNumber,
                input.sequenceNo(),
                input.title()
                        .trim(),
                input.plannedReleaseAmount(),
                input.targetDate(),
                currentUserId
        );
    }

    public TrancheRow findTranche(
            UUID trancheId
    ) {
        return jdbcTemplate.query(
                trancheSql()
                        + """
                        WHERE funding_tranche.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapTranche(
                                resultSet
                        ),
                trancheId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<TrancheRow> tranches(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                trancheSql()
                        + """
                        WHERE funding_tranche.commitment_id = ?

                        ORDER BY
                            funding_tranche.sequence_no,
                            funding_tranche.created_at
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapTranche(
                                resultSet
                        ),
                commitmentId
        );
    }

    public void requestAuthorization(
            UUID trancheId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_tranches

                SET
                    status = 'READY_FOR_AUTHORIZATION',
                    request_note = ?,
                    requested_by_user_id = ?,
                    requested_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'PLANNED'
                """,
                note.trim(),
                currentUserId,
                trancheId
        );
    }

    public void markTrancheAuthorized(
            UUID trancheId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_tranches

                SET
                    status = 'AUTHORIZED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_AUTHORIZATION'
                """,
                trancheId
        );
    }

    public void returnTrancheToPlanned(
            UUID trancheId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_tranches

                SET
                    status = 'PLANNED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_AUTHORIZATION'
                """,
                trancheId
        );
    }

    public void markTrancheReleased(
            UUID trancheId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_tranches

                SET
                    status = 'RELEASED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'AUTHORIZED'
                """,
                trancheId
        );
    }

    public void createGate(
            UUID gateId,
            UUID trancheId,
            FundingGateInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_gates (
                    id,
                    tranche_id,
                    title,
                    requirement,
                    status,
                    created_by_user_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                gateId,
                trancheId,
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
                        WHERE funding_gate.id = ?
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
            UUID trancheId
    ) {
        return jdbcTemplate.query(
                gateSql()
                        + """
                        WHERE funding_gate.tranche_id = ?

                        ORDER BY
                            funding_gate.created_at,
                            funding_gate.title
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGate(
                                resultSet
                        ),
                trancheId
        );
    }

    public void decideGate(
            UUID gateId,
            FundingGateDecisionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_funding_gates

                SET
                    status = ?,
                    evidence_note = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP

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

    public void createAuthorization(
            UUID authorizationId,
            UUID trancheId,
            UUID commitmentId,
            BigDecimal authorizedAmount,
            FundingAuthorizationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_authorizations (
                    id,
                    tranche_id,
                    commitment_id,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                authorizationId,
                trancheId,
                commitmentId,
                input.decision()
                        .name(),
                authorizedAmount,
                input.note()
                        .trim(),
                currentUserId
        );
    }

    public List<AuthorizationRow> authorizations(
            UUID trancheId
    ) {
        return jdbcTemplate.query(
                authorizationSql()
                        + """
                        WHERE funding_authorization.tranche_id = ?

                        ORDER BY
                            funding_authorization.authorized_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAuthorization(
                                resultSet
                        ),
                trancheId
        );
    }

    public AuthorizationRow latestApprovedAuthorization(
            UUID trancheId
    ) {
        return jdbcTemplate.query(
                authorizationSql()
                        + """
                        WHERE funding_authorization.tranche_id = ?
                        AND funding_authorization.decision = 'APPROVED'

                        ORDER BY
                            funding_authorization.authorized_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAuthorization(
                                resultSet
                        ),
                trancheId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createRelease(
            UUID releaseId,
            UUID trancheId,
            UUID commitmentId,
            UUID authorizationId,
            BigDecimal releasedAmount,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_releases (
                    id,
                    tranche_id,
                    commitment_id,
                    authorization_id,
                    released_amount,
                    release_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                releaseId,
                trancheId,
                commitmentId,
                authorizationId,
                releasedAmount,
                note.trim(),
                currentUserId
        );
    }

    public ReleaseRow release(
            UUID trancheId
    ) {
        return jdbcTemplate.query(
                releaseSql()
                        + """
                        WHERE funding_release.tranche_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRelease(
                                resultSet
                        ),
                trancheId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FundingCommitmentResponse commitment,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_snapshots (
                    id,
                    snapshot_number,
                    commitment_id,
                    commitment_number,
                    allocation_cycle_number,
                    case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    fiscal_year,
                    commitment_status,
                    authorized_capital_amount,
                    committed_capital_amount,
                    planned_release_amount,
                    released_amount,
                    remaining_commitment_amount,
                    remaining_authorization_amount,
                    release_pct,
                    tranche_count,
                    released_tranche_count,
                    pending_gate_count,
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
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.allocationCycleNumber(),
                commitment.caseNumber(),
                commitment.initiativeNumber(),
                commitment.initiativeTitle(),
                commitment.currency(),
                commitment.fiscalYear(),
                commitment.status()
                        .name(),
                commitment.authorizedCapitalAmount(),
                commitment.committedCapitalAmount(),
                commitment.plannedReleaseAmount(),
                commitment.releasedAmount(),
                commitment.remainingCommitmentAmount(),
                commitment.remainingAuthorizationAmount(),
                commitment.releasePct(),
                commitment.trancheCount(),
                commitment.releasedTrancheCount(),
                commitment.pendingGateCount(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FundingTrancheResponse tranche
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_funding_snapshot_items (
                    id,
                    snapshot_id,
                    tranche_id,
                    tranche_number,
                    sequence_no,
                    title,
                    planned_release_amount,
                    released_amount,
                    status,
                    gate_count,
                    resolved_gate_count,
                    authorization_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                tranche.id(),
                tranche.trancheNumber(),
                tranche.sequenceNo(),
                tranche.title(),
                tranche.plannedReleaseAmount(),
                tranche.release() == null
                        ? BigDecimal.ZERO
                        : tranche.release()
                                .releasedAmount(),
                tranche.status()
                        .name(),
                tranche.gateCount(),
                tranche.resolvedGateCount(),
                tranche.authorizations()
                        .size()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE funding_snapshot.id = ?
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
                            funding_snapshot.captured_at DESC

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
                    tranche_id,
                    tranche_number,
                    sequence_no,
                    title,
                    planned_release_amount,
                    released_amount,
                    status,
                    gate_count,
                    resolved_gate_count,
                    authorization_count

                FROM procurement_funding_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    sequence_no,
                    tranche_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "tranche_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "tranche_number"
                                ),
                                resultSet.getInt(
                                        "sequence_no"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getBigDecimal(
                                        "planned_release_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "released_amount"
                                ),
                                FundingTrancheStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                resultSet.getInt(
                                        "gate_count"
                                ),
                                resultSet.getInt(
                                        "resolved_gate_count"
                                ),
                                resultSet.getInt(
                                        "authorization_count"
                                )
                        ),
                snapshotId
        );
    }

    private String commitmentSql() {
        return """
                SELECT
                    funding_commitment.id,
                    funding_commitment.commitment_number,
                    funding_commitment.allocation_cycle_id,
                    funding_commitment.allocation_cycle_number,
                    funding_commitment.allocation_cycle_title,
                    funding_commitment.allocation_item_id,
                    funding_commitment.value_case_id,
                    funding_commitment.case_number,
                    funding_commitment.initiative_number,
                    funding_commitment.initiative_title,
                    funding_commitment.currency,
                    funding_commitment.fiscal_year,
                    funding_commitment.authorized_capital_amount,
                    funding_commitment.committed_capital_amount,
                    funding_commitment.funding_owner_user_id,
                    funding_commitment.funding_owner_name_snapshot,
                    funding_commitment.objective,
                    funding_commitment.status,

                    activator.full_name
                        AS activated_by_name,

                    funding_commitment.activated_at,
                    funding_commitment.activation_note,

                    closer.full_name
                        AS closed_by_name,

                    funding_commitment.closed_at,
                    funding_commitment.close_note,
                    funding_commitment.created_at,
                    funding_commitment.updated_at,
                    funding_commitment.version

                FROM procurement_funding_commitments
                    funding_commitment

                LEFT JOIN app_users
                    activator
                    ON activator.id =
                       funding_commitment.activated_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       funding_commitment.closed_by_user_id

                """;
    }

    private String trancheSql() {
        return """
                SELECT
                    funding_tranche.id,
                    funding_tranche.commitment_id,
                    funding_tranche.tranche_number,
                    funding_tranche.sequence_no,
                    funding_tranche.title,
                    funding_tranche.planned_release_amount,
                    funding_tranche.target_date,
                    funding_tranche.status,
                    funding_tranche.request_note,

                    requester.full_name
                        AS requested_by_name,

                    funding_tranche.requested_at,
                    funding_tranche.created_at,
                    funding_tranche.updated_at,
                    funding_tranche.version

                FROM procurement_funding_tranches
                    funding_tranche

                LEFT JOIN app_users
                    requester
                    ON requester.id =
                       funding_tranche.requested_by_user_id

                """;
    }

    private String gateSql() {
        return """
                SELECT
                    funding_gate.id,
                    funding_gate.tranche_id,
                    funding_gate.title,
                    funding_gate.requirement,
                    funding_gate.status,
                    funding_gate.evidence_note,
                    funding_gate.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    funding_gate.decided_at,
                    funding_gate.created_at

                FROM procurement_funding_gates
                    funding_gate

                LEFT JOIN app_users
                    decider
                    ON decider.id =
                       funding_gate.decided_by_user_id

                """;
    }

    private String authorizationSql() {
        return """
                SELECT
                    funding_authorization.id,
                    funding_authorization.tranche_id,
                    funding_authorization.commitment_id,
                    funding_authorization.decision,
                    funding_authorization.authorized_amount,
                    funding_authorization.authorization_note,

                    user_account.full_name
                        AS authorized_by_name,

                    funding_authorization.authorized_at

                FROM procurement_funding_authorizations
                    funding_authorization

                JOIN app_users
                    user_account
                    ON user_account.id =
                       funding_authorization.authorized_by_user_id

                """;
    }

    private String releaseSql() {
        return """
                SELECT
                    funding_release.id,
                    funding_release.tranche_id,
                    funding_release.commitment_id,
                    funding_release.authorization_id,
                    funding_release.released_amount,
                    funding_release.release_note,

                    user_account.full_name
                        AS released_by_name,

                    funding_release.released_at

                FROM procurement_funding_releases
                    funding_release

                JOIN app_users
                    user_account
                    ON user_account.id =
                       funding_release.released_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    funding_snapshot.id,
                    funding_snapshot.snapshot_number,
                    funding_snapshot.commitment_id,
                    funding_snapshot.commitment_number,
                    funding_snapshot.allocation_cycle_number,
                    funding_snapshot.case_number,
                    funding_snapshot.initiative_number,
                    funding_snapshot.initiative_title,
                    funding_snapshot.currency,
                    funding_snapshot.fiscal_year,
                    funding_snapshot.commitment_status,
                    funding_snapshot.authorized_capital_amount,
                    funding_snapshot.committed_capital_amount,
                    funding_snapshot.planned_release_amount,
                    funding_snapshot.released_amount,
                    funding_snapshot.remaining_commitment_amount,
                    funding_snapshot.remaining_authorization_amount,
                    funding_snapshot.release_pct,
                    funding_snapshot.tranche_count,
                    funding_snapshot.released_tranche_count,
                    funding_snapshot.pending_gate_count,

                    user_account.full_name
                        AS captured_by_name,

                    funding_snapshot.captured_at

                FROM procurement_funding_snapshots
                    funding_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       funding_snapshot.captured_by_user_id

                """;
    }

    private CommitmentRow mapCommitment(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CommitmentRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "commitment_number"
                ),
                resultSet.getObject(
                        "allocation_cycle_id",
                        UUID.class
                ),
                resultSet.getString(
                        "allocation_cycle_number"
                ),
                resultSet.getString(
                        "allocation_cycle_title"
                ),
                resultSet.getObject(
                        "allocation_item_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "case_number"
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
                resultSet.getBigDecimal(
                        "authorized_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "committed_capital_amount"
                ),
                resultSet.getObject(
                        "funding_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "funding_owner_name_snapshot"
                ),
                resultSet.getString(
                        "objective"
                ),
                FundingCommitmentStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "activated_by_name"
                ),
                instant(
                        resultSet,
                        "activated_at"
                ),
                resultSet.getString(
                        "activation_note"
                ),
                resultSet.getString(
                        "closed_by_name"
                ),
                instant(
                        resultSet,
                        "closed_at"
                ),
                resultSet.getString(
                        "close_note"
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

    private TrancheRow mapTranche(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new TrancheRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "tranche_number"
                ),
                resultSet.getInt(
                        "sequence_no"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getBigDecimal(
                        "planned_release_amount"
                ),
                resultSet.getObject(
                        "target_date",
                        LocalDate.class
                ),
                FundingTrancheStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "request_note"
                ),
                resultSet.getString(
                        "requested_by_name"
                ),
                instant(
                        resultSet,
                        "requested_at"
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
                        "tranche_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "requirement"
                ),
                FundingGateStatus.valueOf(
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
                        "tranche_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                FundingAuthorizationDecision.valueOf(
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
                        "tranche_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "authorization_id",
                        UUID.class
                ),
                resultSet.getBigDecimal(
                        "released_amount"
                ),
                resultSet.getString(
                        "release_note"
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
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "commitment_number"
                ),
                resultSet.getString(
                        "allocation_cycle_number"
                ),
                resultSet.getString(
                        "case_number"
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
                FundingCommitmentStatus.valueOf(
                        resultSet.getString(
                                "commitment_status"
                        )
                ),
                resultSet.getBigDecimal(
                        "authorized_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "committed_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "planned_release_amount"
                ),
                resultSet.getBigDecimal(
                        "released_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_commitment_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_authorization_amount"
                ),
                resultSet.getBigDecimal(
                        "release_pct"
                ),
                resultSet.getInt(
                        "tranche_count"
                ),
                resultSet.getInt(
                        "released_tranche_count"
                ),
                resultSet.getInt(
                        "pending_gate_count"
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

    public record CommitmentRow(
            UUID id,
            String commitmentNumber,
            UUID allocationCycleId,
            String allocationCycleNumber,
            String allocationCycleTitle,
            UUID allocationItemId,
            UUID valueCaseId,
            String caseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            BigDecimal authorizedCapitalAmount,
            BigDecimal committedCapitalAmount,
            UUID fundingOwnerUserId,
            String fundingOwnerName,
            String objective,
            FundingCommitmentStatus status,
            String activatedByName,
            Instant activatedAt,
            String activationNote,
            String closedByName,
            Instant closedAt,
            String closeNote,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record TrancheRow(
            UUID id,
            UUID commitmentId,
            String trancheNumber,
            int sequenceNo,
            String title,
            BigDecimal plannedReleaseAmount,
            LocalDate targetDate,
            FundingTrancheStatus status,
            String requestNote,
            String requestedByName,
            Instant requestedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record GateRow(
            UUID id,
            UUID trancheId,
            String title,
            String requirement,
            FundingGateStatus status,
            String evidenceNote,
            String decisionNote,
            String decidedByName,
            Instant decidedAt,
            Instant createdAt
    ) {
    }

    public record AuthorizationRow(
            UUID id,
            UUID trancheId,
            UUID commitmentId,
            FundingAuthorizationDecision decision,
            BigDecimal authorizedAmount,
            String authorizationNote,
            String authorizedByName,
            Instant authorizedAt
    ) {
    }

    public record ReleaseRow(
            UUID id,
            UUID trancheId,
            UUID commitmentId,
            UUID authorizationId,
            BigDecimal releasedAmount,
            String releaseNote,
            String releasedByName,
            Instant releasedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            UUID commitmentId,
            String commitmentNumber,
            String allocationCycleNumber,
            String caseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            FundingCommitmentStatus commitmentStatus,
            BigDecimal authorizedCapitalAmount,
            BigDecimal committedCapitalAmount,
            BigDecimal plannedReleaseAmount,
            BigDecimal releasedAmount,
            BigDecimal remainingCommitmentAmount,
            BigDecimal remainingAuthorizationAmount,
            BigDecimal releasePct,
            int trancheCount,
            int releasedTrancheCount,
            int pendingGateCount,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID trancheId,
            String trancheNumber,
            int sequenceNo,
            String title,
            BigDecimal plannedReleaseAmount,
            BigDecimal releasedAmount,
            FundingTrancheStatus status,
            int gateCount,
            int resolvedGateCount,
            int authorizationCount
    ) {
    }
}
