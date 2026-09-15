package com.procureiq.capacityplanning;

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
public class CapacityPlanningRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapacityPlanningRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capacity_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CapacityUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active =
                    TRUE

                AND role
                    <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CapacityUserOptionResponse(
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

    public void upsertProfile(
            UUID profileId,
            UUID userId,
            int fiscalYear,
            CapacityProfileInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_profiles (
                    id,
                    user_id,
                    fiscal_year,
                    annual_capacity_hours,
                    reserved_operational_pct,
                    notes,
                    created_by_user_id,
                    updated_by_user_id,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    user_id,
                    fiscal_year
                )

                DO UPDATE
                SET
                    annual_capacity_hours =
                        EXCLUDED.annual_capacity_hours,

                    reserved_operational_pct =
                        EXCLUDED.reserved_operational_pct,

                    notes =
                        EXCLUDED.notes,

                    updated_by_user_id =
                        EXCLUDED.updated_by_user_id,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        procurement_capacity_profiles.version + 1
                """,
                profileId,
                userId,
                fiscalYear,
                input.annualCapacityHours(),
                input.reservedOperationalPct(),
                normalizeOptional(
                        input.notes()
                ),
                currentUserId,
                currentUserId
        );
    }

    public ProfileRow findProfile(
            UUID userId,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                profileSql()
                        + """
                        WHERE profile.user_id = ?
                        AND profile.fiscal_year = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProfile(
                                resultSet
                        ),
                userId,
                fiscalYear
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ProfileRow> profiles(
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                profileSql()
                        + """
                        WHERE profile.fiscal_year = ?

                        ORDER BY
                            user_account.full_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProfile(
                                resultSet
                        ),
                fiscalYear
        );
    }

    public EstimateRow findEstimate(
            UUID estimateId
    ) {
        return jdbcTemplate.query(
                estimateSql()
                        + """
                        WHERE estimate.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEstimate(
                                resultSet
                        ),
                estimateId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public EstimateRow findEstimateBySource(
            String currency,
            int fiscalYear,
            CapacitySourceType sourceType,
            UUID sourceEntityId
    ) {
        return jdbcTemplate.query(
                estimateSql()
                        + """
                        WHERE estimate.currency = ?
                        AND estimate.fiscal_year = ?
                        AND estimate.source_type = ?
                        AND estimate.source_entity_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEstimate(
                                resultSet
                        ),
                currency,
                fiscalYear,
                sourceType.name(),
                sourceEntityId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<EstimateRow> estimates(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                estimateSql()
                        + """
                        WHERE estimate.currency = ?
                        AND estimate.fiscal_year = ?

                        ORDER BY
                            estimate.risk_score_snapshot DESC,
                            estimate.due_date_snapshot NULLS LAST,
                            estimate.source_reference_snapshot
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEstimate(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public void createEstimate(
            UUID estimateId,
            CapacityWorkEstimateInput input,
            String currency,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            LocalDate dueDate,
            BigDecimal strategicValue,
            BigDecimal riskExposure,
            BigDecimal riskScore,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_work_estimates (
                    id,
                    currency,
                    fiscal_year,
                    source_type,
                    source_entity_id,
                    source_reference_snapshot,
                    source_title_snapshot,
                    source_status_snapshot,
                    due_date_snapshot,
                    strategic_value_snapshot,
                    risk_exposure_snapshot,
                    risk_score_snapshot,
                    estimated_effort_hours,
                    created_by_user_id,
                    updated_by_user_id,
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
                estimateId,
                currency,
                input.fiscalYear(),
                input.sourceType()
                        .name(),
                input.sourceEntityId(),
                sourceReference,
                sourceTitle,
                sourceStatus,
                dueDate,
                strategicValue,
                riskExposure,
                riskScore,
                input.estimatedEffortHours(),
                currentUserId,
                currentUserId
        );
    }

    public void updateEstimate(
            UUID estimateId,
            CapacityWorkEstimateUpdateInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capacity_work_estimates

                SET
                    estimated_effort_hours = ?,
                    updated_by_user_id = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1

                WHERE id = ?
                """,
                input.estimatedEffortHours(),
                currentUserId,
                estimateId
        );
    }

    public AssignmentRow findAssignment(
            UUID assignmentId
    ) {
        return jdbcTemplate.query(
                assignmentSql()
                        + """
                        WHERE assignment.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssignment(
                                resultSet
                        ),
                assignmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public AssignmentRow findAssignmentByUser(
            UUID estimateId,
            UUID userId
    ) {
        return jdbcTemplate.query(
                assignmentSql()
                        + """
                        WHERE assignment.work_estimate_id = ?
                        AND assignment.user_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssignment(
                                resultSet
                        ),
                estimateId,
                userId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<AssignmentRow> assignments(
            UUID estimateId
    ) {
        return jdbcTemplate.query(
                assignmentSql()
                        + """
                        WHERE assignment.work_estimate_id = ?

                        ORDER BY
                            user_account.full_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssignment(
                                resultSet
                        ),
                estimateId
        );
    }

    public List<AssignmentRow> assignmentsForScope(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                assignmentSql()
                        + """
                        JOIN procurement_capacity_work_estimates
                            estimate_scope
                            ON estimate_scope.id =
                               assignment.work_estimate_id

                        WHERE estimate_scope.currency = ?
                        AND estimate_scope.fiscal_year = ?

                        ORDER BY
                            user_account.full_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssignment(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public BigDecimal assignmentTotal(
            UUID estimateId
    ) {
        BigDecimal total =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                allocation_pct
                            ),
                            0
                        )

                        FROM procurement_capacity_assignments

                        WHERE work_estimate_id = ?
                        """,
                        BigDecimal.class,
                        estimateId
                );

        return total == null
                ? BigDecimal.ZERO
                : total;
    }

    public void createAssignment(
            UUID assignmentId,
            UUID estimateId,
            CapacityAssignmentInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_assignments (
                    id,
                    work_estimate_id,
                    user_id,
                    allocation_pct,
                    created_by_user_id,
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
                assignmentId,
                estimateId,
                input.userId(),
                input.allocationPct(),
                currentUserId
        );
    }

    public void deleteAssignment(
            UUID assignmentId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_capacity_assignments
                WHERE id = ?
                """,
                assignmentId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            String currency,
            int fiscalYear,
            CapacitySummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_snapshots (
                    id,
                    snapshot_number,
                    currency,
                    fiscal_year,
                    strategic_source_count,
                    estimated_source_count,
                    fully_assigned_source_count,
                    unassigned_source_count,
                    profile_count,
                    effective_capacity_hours,
                    estimated_demand_hours,
                    assigned_demand_hours,
                    unassigned_demand_hours,
                    capacity_gap_hours,
                    estimation_coverage_pct,
                    assignment_coverage_pct,
                    capacity_coverage_pct,
                    deadline_health_pct,
                    capacity_score,
                    portfolio_health,
                    overloaded_member_count,
                    critical_member_count,
                    deadline_pressure_count,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                currency,
                fiscalYear,
                summary.strategicSourceCount(),
                summary.estimatedSourceCount(),
                summary.fullyAssignedSourceCount(),
                summary.unassignedSourceCount(),
                summary.profileCount(),
                summary.effectiveCapacityHours(),
                summary.estimatedDemandHours(),
                summary.assignedDemandHours(),
                summary.unassignedDemandHours(),
                summary.capacityGapHours(),
                summary.estimationCoveragePct(),
                summary.assignmentCoveragePct(),
                summary.capacityCoveragePct(),
                summary.deadlineHealthPct(),
                summary.capacityScore(),
                summary.portfolioHealth()
                        .name(),
                summary.overloadedMemberCount(),
                summary.criticalMemberCount(),
                summary.deadlinePressureCount(),
                currentUserId
        );
    }

    public void createSnapshotMember(
            UUID snapshotId,
            CapacityMemberResponse member
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_snapshot_members (
                    id,
                    snapshot_id,
                    user_id,
                    user_name,
                    role,
                    annual_capacity_hours,
                    reserved_operational_pct,
                    effective_capacity_hours,
                    assigned_effort_hours,
                    remaining_capacity_hours,
                    utilization_pct,
                    health,
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
                member.userId(),
                member.userName(),
                member.role(),
                member.annualCapacityHours(),
                member.reservedOperationalPct(),
                member.effectiveCapacityHours(),
                member.assignedEffortHours(),
                member.remainingCapacityHours(),
                member.utilizationPct(),
                member.health()
                        .name()
        );
    }

    public void createSnapshotWorkItem(
            UUID snapshotId,
            CapacityWorkItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capacity_snapshot_work_items (
                    id,
                    snapshot_id,
                    source_type,
                    source_entity_id,
                    source_reference,
                    source_title,
                    source_status,
                    due_date,
                    strategic_value,
                    risk_exposure,
                    risk_score,
                    estimated_effort_hours,
                    assigned_effort_hours,
                    unassigned_effort_hours,
                    allocation_pct,
                    assignment_count,
                    planning_status,
                    deadline_pressure,
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
                item.sourceType()
                        .name(),
                item.sourceEntityId(),
                item.sourceReference(),
                item.sourceTitle(),
                item.sourceStatus(),
                item.dueDate(),
                item.strategicValue(),
                item.riskExposure(),
                item.riskScore(),
                item.estimatedEffortHours(),
                item.assignedEffortHours(),
                item.unassignedEffortHours(),
                item.allocationPct(),
                item.assignmentCount(),
                item.planningStatus()
                        .name(),
                item.deadlinePressure()
        );
    }

    public List<SnapshotRow> snapshots(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.currency = ?
                        AND snapshot.fiscal_year = ?

                        ORDER BY
                            snapshot.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.id = ?
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

    public List<SnapshotMemberRow> snapshotMembers(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    user_id,
                    user_name,
                    role,
                    annual_capacity_hours,
                    reserved_operational_pct,
                    effective_capacity_hours,
                    assigned_effort_hours,
                    remaining_capacity_hours,
                    utilization_pct,
                    health

                FROM procurement_capacity_snapshot_members

                WHERE snapshot_id = ?

                ORDER BY
                    utilization_pct DESC,
                    user_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotMemberRow(
                                resultSet.getObject(
                                        "user_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "user_name"
                                ),
                                resultSet.getString(
                                        "role"
                                ),
                                resultSet.getBigDecimal(
                                        "annual_capacity_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "reserved_operational_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "effective_capacity_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "assigned_effort_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "remaining_capacity_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "utilization_pct"
                                ),
                                CapacityHealth.valueOf(
                                        resultSet.getString(
                                                "health"
                                        )
                                )
                        ),
                snapshotId
        );
    }

    public List<SnapshotWorkRow> snapshotWorkItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    source_type,
                    source_entity_id,
                    source_reference,
                    source_title,
                    source_status,
                    due_date,
                    strategic_value,
                    risk_exposure,
                    risk_score,
                    estimated_effort_hours,
                    assigned_effort_hours,
                    unassigned_effort_hours,
                    allocation_pct,
                    assignment_count,
                    planning_status,
                    deadline_pressure

                FROM procurement_capacity_snapshot_work_items

                WHERE snapshot_id = ?

                ORDER BY
                    deadline_pressure DESC,
                    risk_score DESC,
                    source_reference
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotWorkRow(
                                CapacitySourceType.valueOf(
                                        resultSet.getString(
                                                "source_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "source_entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getString(
                                        "source_title"
                                ),
                                resultSet.getString(
                                        "source_status"
                                ),
                                resultSet.getObject(
                                        "due_date",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_exposure"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_score"
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_effort_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "assigned_effort_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "unassigned_effort_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "allocation_pct"
                                ),
                                resultSet.getInt(
                                        "assignment_count"
                                ),
                                CapacityWorkStatus.valueOf(
                                        resultSet.getString(
                                                "planning_status"
                                        )
                                ),
                                resultSet.getBoolean(
                                        "deadline_pressure"
                                )
                        ),
                snapshotId
        );
    }

    private String profileSql() {
        return """
                SELECT
                    profile.id,
                    profile.user_id,
                    user_account.full_name
                        AS user_name,
                    user_account.role,
                    profile.fiscal_year,
                    profile.annual_capacity_hours,
                    profile.reserved_operational_pct,
                    profile.notes,
                    profile.created_at,
                    profile.updated_at,
                    profile.version

                FROM procurement_capacity_profiles
                    profile

                JOIN app_users
                    user_account
                    ON user_account.id =
                       profile.user_id

                """;
    }

    private String estimateSql() {
        return """
                SELECT
                    estimate.id,
                    estimate.currency,
                    estimate.fiscal_year,
                    estimate.source_type,
                    estimate.source_entity_id,
                    estimate.source_reference_snapshot,
                    estimate.source_title_snapshot,
                    estimate.source_status_snapshot,
                    estimate.due_date_snapshot,
                    estimate.strategic_value_snapshot,
                    estimate.risk_exposure_snapshot,
                    estimate.risk_score_snapshot,
                    estimate.estimated_effort_hours,
                    estimate.created_at,
                    estimate.updated_at,
                    estimate.version

                FROM procurement_capacity_work_estimates
                    estimate

                """;
    }

    private String assignmentSql() {
        return """
                SELECT
                    assignment.id,
                    assignment.work_estimate_id,
                    assignment.user_id,
                    user_account.full_name
                        AS user_name,
                    user_account.role,
                    assignment.allocation_pct,
                    creator.full_name
                        AS created_by_name,
                    assignment.created_at

                FROM procurement_capacity_assignments
                    assignment

                JOIN app_users
                    user_account
                    ON user_account.id =
                       assignment.user_id

                JOIN app_users
                    creator
                    ON creator.id =
                       assignment.created_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.currency,
                    snapshot.fiscal_year,
                    snapshot.strategic_source_count,
                    snapshot.estimated_source_count,
                    snapshot.fully_assigned_source_count,
                    snapshot.unassigned_source_count,
                    snapshot.profile_count,
                    snapshot.effective_capacity_hours,
                    snapshot.estimated_demand_hours,
                    snapshot.assigned_demand_hours,
                    snapshot.unassigned_demand_hours,
                    snapshot.capacity_gap_hours,
                    snapshot.estimation_coverage_pct,
                    snapshot.assignment_coverage_pct,
                    snapshot.capacity_coverage_pct,
                    snapshot.deadline_health_pct,
                    snapshot.capacity_score,
                    snapshot.portfolio_health,
                    snapshot.overloaded_member_count,
                    snapshot.critical_member_count,
                    snapshot.deadline_pressure_count,
                    user_account.full_name
                        AS captured_by_name,
                    snapshot.captured_at

                FROM procurement_capacity_snapshots
                    snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

                """;
    }

    private ProfileRow mapProfile(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ProfileRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "user_name"
                ),
                resultSet.getString(
                        "role"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "annual_capacity_hours"
                ),
                resultSet.getBigDecimal(
                        "reserved_operational_pct"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private EstimateRow mapEstimate(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new EstimateRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                CapacitySourceType.valueOf(
                        resultSet.getString(
                                "source_type"
                        )
                ),
                resultSet.getObject(
                        "source_entity_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_reference_snapshot"
                ),
                resultSet.getString(
                        "source_title_snapshot"
                ),
                resultSet.getString(
                        "source_status_snapshot"
                ),
                resultSet.getObject(
                        "due_date_snapshot",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "strategic_value_snapshot"
                ),
                resultSet.getBigDecimal(
                        "risk_exposure_snapshot"
                ),
                resultSet.getBigDecimal(
                        "risk_score_snapshot"
                ),
                resultSet.getBigDecimal(
                        "estimated_effort_hours"
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

    private AssignmentRow mapAssignment(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new AssignmentRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "work_estimate_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "user_name"
                ),
                resultSet.getString(
                        "role"
                ),
                resultSet.getBigDecimal(
                        "allocation_pct"
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getTimestamp(
                        "created_at"
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
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getInt(
                        "strategic_source_count"
                ),
                resultSet.getInt(
                        "estimated_source_count"
                ),
                resultSet.getInt(
                        "fully_assigned_source_count"
                ),
                resultSet.getInt(
                        "unassigned_source_count"
                ),
                resultSet.getInt(
                        "profile_count"
                ),
                resultSet.getBigDecimal(
                        "effective_capacity_hours"
                ),
                resultSet.getBigDecimal(
                        "estimated_demand_hours"
                ),
                resultSet.getBigDecimal(
                        "assigned_demand_hours"
                ),
                resultSet.getBigDecimal(
                        "unassigned_demand_hours"
                ),
                resultSet.getBigDecimal(
                        "capacity_gap_hours"
                ),
                resultSet.getBigDecimal(
                        "estimation_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "assignment_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "capacity_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "deadline_health_pct"
                ),
                resultSet.getBigDecimal(
                        "capacity_score"
                ),
                CapacityHealth.valueOf(
                        resultSet.getString(
                                "portfolio_health"
                        )
                ),
                resultSet.getInt(
                        "overloaded_member_count"
                ),
                resultSet.getInt(
                        "critical_member_count"
                ),
                resultSet.getInt(
                        "deadline_pressure_count"
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

    public record ProfileRow(
            UUID id,
            UUID userId,
            String userName,
            String role,
            int fiscalYear,
            BigDecimal annualCapacityHours,
            BigDecimal reservedOperationalPct,
            String notes,
            long version
    ) {
    }

    public record EstimateRow(
            UUID id,
            String currency,
            int fiscalYear,
            CapacitySourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            LocalDate dueDate,
            BigDecimal strategicValue,
            BigDecimal riskExposure,
            BigDecimal riskScore,
            BigDecimal estimatedEffortHours,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record AssignmentRow(
            UUID id,
            UUID workEstimateId,
            UUID userId,
            String userName,
            String role,
            BigDecimal allocationPct,
            String createdByName,
            Instant createdAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            String currency,
            int fiscalYear,
            int strategicSourceCount,
            int estimatedSourceCount,
            int fullyAssignedSourceCount,
            int unassignedSourceCount,
            int profileCount,
            BigDecimal effectiveCapacityHours,
            BigDecimal estimatedDemandHours,
            BigDecimal assignedDemandHours,
            BigDecimal unassignedDemandHours,
            BigDecimal capacityGapHours,
            BigDecimal estimationCoveragePct,
            BigDecimal assignmentCoveragePct,
            BigDecimal capacityCoveragePct,
            BigDecimal deadlineHealthPct,
            BigDecimal capacityScore,
            CapacityHealth portfolioHealth,
            int overloadedMemberCount,
            int criticalMemberCount,
            int deadlinePressureCount,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotMemberRow(
            UUID userId,
            String userName,
            String role,
            BigDecimal annualCapacityHours,
            BigDecimal reservedOperationalPct,
            BigDecimal effectiveCapacityHours,
            BigDecimal assignedEffortHours,
            BigDecimal remainingCapacityHours,
            BigDecimal utilizationPct,
            CapacityHealth health
    ) {
    }

    public record SnapshotWorkRow(
            CapacitySourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            LocalDate dueDate,
            BigDecimal strategicValue,
            BigDecimal riskExposure,
            BigDecimal riskScore,
            BigDecimal estimatedEffortHours,
            BigDecimal assignedEffortHours,
            BigDecimal unassignedEffortHours,
            BigDecimal allocationPct,
            int assignmentCount,
            CapacityWorkStatus planningStatus,
            boolean deadlinePressure
    ) {
    }
}
