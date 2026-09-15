package com.procureiq.capabilityplanning;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Repository
public class CapabilityPlanningRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapabilityPlanningRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capability_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createSkill(
            UUID skillId,
            CapabilitySkillInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capability_skills (
                    id,
                    code,
                    name,
                    category,
                    description,
                    active,
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
                    TRUE,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                skillId,
                input.code()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        ),
                input.name()
                        .trim(),
                input.category()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                currentUserId
        );
    }

    public SkillRow findSkill(
            UUID skillId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    code,
                    name,
                    category,
                    description,
                    active

                FROM procurement_capability_skills

                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SkillRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "code"
                                ),
                                resultSet.getString(
                                        "name"
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                resultSet.getBoolean(
                                        "active"
                                )
                        ),
                skillId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SkillRow> skills() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    code,
                    name,
                    category,
                    description,
                    active

                FROM procurement_capability_skills

                WHERE active =
                    TRUE

                ORDER BY
                    category,
                    name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SkillRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "code"
                                ),
                                resultSet.getString(
                                        "name"
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                resultSet.getBoolean(
                                        "active"
                                )
                        )
        );
    }

    public void upsertUserCapability(
            UUID capabilityId,
            UUID userId,
            UUID skillId,
            UserCapabilityInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_user_capabilities (
                    id,
                    user_id,
                    skill_id,
                    proficiency_level,
                    evidence_note,
                    assessed_by_user_id,
                    assessed_at,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    user_id,
                    skill_id
                )

                DO UPDATE
                SET
                    proficiency_level =
                        EXCLUDED.proficiency_level,

                    evidence_note =
                        EXCLUDED.evidence_note,

                    assessed_by_user_id =
                        EXCLUDED.assessed_by_user_id,

                    assessed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        procurement_user_capabilities.version + 1
                """,
                capabilityId,
                userId,
                skillId,
                input.proficiencyLevel(),
                input.evidenceNote()
                        .trim(),
                currentUserId
        );
    }

    public List<UserCapabilityRow> capabilities() {
        return jdbcTemplate.query(
                """
                SELECT
                    capability.id,
                    capability.user_id,

                    user_account.full_name
                        AS user_name,

                    user_account.role,

                    capability.skill_id,
                    skill.code
                        AS skill_code,

                    skill.name
                        AS skill_name,

                    skill.category
                        AS skill_category,

                    capability.proficiency_level,
                    capability.evidence_note,

                    assessor.full_name
                        AS assessed_by_name,

                    capability.assessed_at,
                    capability.version

                FROM procurement_user_capabilities
                    capability

                JOIN app_users
                    user_account
                    ON user_account.id =
                       capability.user_id

                JOIN procurement_capability_skills
                    skill
                    ON skill.id =
                       capability.skill_id

                JOIN app_users
                    assessor
                    ON assessor.id =
                       capability.assessed_by_user_id

                WHERE skill.active =
                    TRUE

                ORDER BY
                    user_account.full_name,
                    skill.category,
                    skill.name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new UserCapabilityRow(
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
                                resultSet.getObject(
                                        "skill_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "skill_code"
                                ),
                                resultSet.getString(
                                        "skill_name"
                                ),
                                resultSet.getString(
                                        "skill_category"
                                ),
                                resultSet.getInt(
                                        "proficiency_level"
                                ),
                                resultSet.getString(
                                        "evidence_note"
                                ),
                                resultSet.getString(
                                        "assessed_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "assessed_at"
                                )
                                        .toInstant(),
                                resultSet.getLong(
                                        "version"
                                )
                        )
        );
    }

    public void createRequirement(
            UUID requirementId,
            String currency,
            int fiscalYear,
            CapabilitySourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            WorkCapabilityRequirementInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_work_capability_requirements (
                    id,
                    currency,
                    fiscal_year,
                    source_type,
                    source_entity_id,
                    source_reference_snapshot,
                    source_title_snapshot,
                    source_status_snapshot,
                    skill_id,
                    required_proficiency,
                    importance_weight_pct,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                requirementId,
                currency,
                fiscalYear,
                sourceType.name(),
                sourceEntityId,
                sourceReference,
                sourceTitle,
                sourceStatus,
                input.skillId(),
                input.requiredProficiency(),
                input.importanceWeightPct(),
                currentUserId
        );
    }

    public RequirementRow findRequirement(
            UUID requirementId
    ) {
        return jdbcTemplate.query(
                requirementSql()
                        + """
                        WHERE requirement.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        ),
                requirementId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<RequirementRow> requirements(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                requirementSql()
                        + """
                        WHERE requirement.currency = ?
                        AND requirement.fiscal_year = ?

                        ORDER BY
                            requirement.source_reference_snapshot,
                            requirement.importance_weight_pct DESC,
                            skill.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public List<RequirementRow> requirementsForSource(
            String currency,
            int fiscalYear,
            CapabilitySourceType sourceType,
            UUID sourceEntityId
    ) {
        return jdbcTemplate.query(
                requirementSql()
                        + """
                        WHERE requirement.currency = ?
                        AND requirement.fiscal_year = ?
                        AND requirement.source_type = ?
                        AND requirement.source_entity_id = ?

                        ORDER BY
                            requirement.importance_weight_pct DESC,
                            skill.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        ),
                currency,
                fiscalYear,
                sourceType.name(),
                sourceEntityId
        );
    }

    public void deleteRequirement(
            UUID requirementId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_work_capability_requirements
                WHERE id = ?
                """,
                requirementId
        );
    }

    public void createDevelopmentAction(
            UUID actionId,
            int fiscalYear,
            CapabilityDevelopmentActionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capability_development_actions (
                    id,
                    user_id,
                    skill_id,
                    fiscal_year,
                    action_type,
                    title,
                    description,
                    target_proficiency,
                    due_date,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                input.userId(),
                input.skillId(),
                fiscalYear,
                input.actionType()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.targetProficiency(),
                input.dueDate(),
                currentUserId
        );
    }

    public DevelopmentActionRow findDevelopmentAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                developmentActionSql()
                        + """
                        WHERE action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDevelopmentAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<DevelopmentActionRow> developmentActions(
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                developmentActionSql()
                        + """
                        WHERE action.fiscal_year = ?

                        ORDER BY
                            CASE action.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,
                            action.due_date,
                            user_account.full_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDevelopmentAction(
                                resultSet
                        ),
                fiscalYear
        );
    }

    public void startDevelopmentAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capability_development_actions

                SET
                    status =
                        'IN_PROGRESS',

                    started_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                actionId
        );
    }

    public void completeDevelopmentAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capability_development_actions

                SET
                    status =
                        'COMPLETED',

                    evidence_note = ?,

                    completed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void cancelDevelopmentAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capability_development_actions

                SET
                    status =
                        'CANCELLED',

                    evidence_note = ?,

                    cancelled_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            String currency,
            int fiscalYear,
            CapabilitySummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capability_snapshots (
                    id,
                    snapshot_number,
                    currency,
                    fiscal_year,
                    active_skill_count,
                    assessed_member_count,
                    strategic_work_count,
                    work_with_requirements_count,
                    ready_work_count,
                    watch_work_count,
                    gap_work_count,
                    critical_work_count,
                    critical_gap_count,
                    open_development_action_count,
                    requirement_coverage_pct,
                    average_assigned_fit_pct,
                    average_bench_fit_pct,
                    capability_score,
                    capability_health,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                currency,
                fiscalYear,
                summary.activeSkillCount(),
                summary.assessedMemberCount(),
                summary.strategicWorkCount(),
                summary.workWithRequirementsCount(),
                summary.readyWorkCount(),
                summary.watchWorkCount(),
                summary.gapWorkCount(),
                summary.criticalWorkCount(),
                summary.criticalGapCount(),
                summary.openDevelopmentActionCount(),
                summary.requirementCoveragePct(),
                summary.averageAssignedFitPct(),
                summary.averageBenchFitPct(),
                summary.capabilityScore(),
                summary.capabilityHealth()
                        .name(),
                currentUserId
        );
    }

    public void createSnapshotMember(
            UUID snapshotId,
            CapabilityMemberResponse member
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capability_snapshot_members (
                    id,
                    snapshot_id,
                    user_id,
                    user_name,
                    role,
                    assessed_skill_count,
                    average_proficiency,
                    assigned_work_item_count,
                    capability_gap_count,
                    open_development_action_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                member.userId(),
                member.userName(),
                member.role(),
                member.assessedSkillCount(),
                member.averageProficiency(),
                member.assignedWorkItemCount(),
                member.capabilityGapCount(),
                member.openDevelopmentActionCount()
        );
    }

    public void createSnapshotWorkItem(
            UUID snapshotId,
            CapabilityWorkItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capability_snapshot_work_items (
                    id,
                    snapshot_id,
                    source_type,
                    source_entity_id,
                    source_reference,
                    source_title,
                    source_status,
                    assigned_member_count,
                    requirement_count,
                    critical_gap_count,
                    assigned_fit_pct,
                    bench_fit_pct,
                    bench_ready_member_count,
                    readiness,
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
                item.assignedMemberCount(),
                item.requirementCount(),
                item.criticalGapCount(),
                item.assignedFitPct(),
                item.benchFitPct(),
                item.benchReadyMemberCount(),
                item.readiness()
                        .name()
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
                    assessed_skill_count,
                    average_proficiency,
                    assigned_work_item_count,
                    capability_gap_count,
                    open_development_action_count

                FROM procurement_capability_snapshot_members

                WHERE snapshot_id = ?

                ORDER BY
                    capability_gap_count DESC,
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
                                resultSet.getInt(
                                        "assessed_skill_count"
                                ),
                                resultSet.getBigDecimal(
                                        "average_proficiency"
                                ),
                                resultSet.getInt(
                                        "assigned_work_item_count"
                                ),
                                resultSet.getInt(
                                        "capability_gap_count"
                                ),
                                resultSet.getInt(
                                        "open_development_action_count"
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
                    assigned_member_count,
                    requirement_count,
                    critical_gap_count,
                    assigned_fit_pct,
                    bench_fit_pct,
                    bench_ready_member_count,
                    readiness

                FROM procurement_capability_snapshot_work_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE readiness
                        WHEN 'CRITICAL'
                        THEN 1
                        WHEN 'GAP'
                        THEN 2
                        WHEN 'WATCH'
                        THEN 3
                        WHEN 'READY'
                        THEN 4
                        ELSE 5
                    END,
                    source_reference
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotWorkRow(
                                CapabilitySourceType.valueOf(
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
                                resultSet.getInt(
                                        "assigned_member_count"
                                ),
                                resultSet.getInt(
                                        "requirement_count"
                                ),
                                resultSet.getInt(
                                        "critical_gap_count"
                                ),
                                resultSet.getBigDecimal(
                                        "assigned_fit_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "bench_fit_pct"
                                ),
                                resultSet.getInt(
                                        "bench_ready_member_count"
                                ),
                                CapabilityReadiness.valueOf(
                                        resultSet.getString(
                                                "readiness"
                                        )
                                )
                        ),
                snapshotId
        );
    }

    private String requirementSql() {
        return """
                SELECT
                    requirement.id,
                    requirement.currency,
                    requirement.fiscal_year,
                    requirement.source_type,
                    requirement.source_entity_id,
                    requirement.source_reference_snapshot,
                    requirement.source_title_snapshot,
                    requirement.source_status_snapshot,
                    requirement.skill_id,

                    skill.code
                        AS skill_code,

                    skill.name
                        AS skill_name,

                    skill.category
                        AS skill_category,

                    requirement.required_proficiency,
                    requirement.importance_weight_pct,
                    requirement.version

                FROM procurement_work_capability_requirements
                    requirement

                JOIN procurement_capability_skills
                    skill
                    ON skill.id =
                       requirement.skill_id

                """;
    }

    private String developmentActionSql() {
        return """
                SELECT
                    action.id,
                    action.user_id,

                    user_account.full_name
                        AS user_name,

                    action.skill_id,

                    skill.code
                        AS skill_code,

                    skill.name
                        AS skill_name,

                    action.fiscal_year,
                    action.action_type,
                    action.title,
                    action.description,
                    action.target_proficiency,
                    action.due_date,
                    action.status,
                    action.evidence_note,
                    action.started_at,
                    action.completed_at,
                    action.cancelled_at,
                    action.created_at,
                    action.version

                FROM procurement_capability_development_actions
                    action

                JOIN app_users
                    user_account
                    ON user_account.id =
                       action.user_id

                JOIN procurement_capability_skills
                    skill
                    ON skill.id =
                       action.skill_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.currency,
                    snapshot.fiscal_year,
                    snapshot.active_skill_count,
                    snapshot.assessed_member_count,
                    snapshot.strategic_work_count,
                    snapshot.work_with_requirements_count,
                    snapshot.ready_work_count,
                    snapshot.watch_work_count,
                    snapshot.gap_work_count,
                    snapshot.critical_work_count,
                    snapshot.critical_gap_count,
                    snapshot.open_development_action_count,
                    snapshot.requirement_coverage_pct,
                    snapshot.average_assigned_fit_pct,
                    snapshot.average_bench_fit_pct,
                    snapshot.capability_score,
                    snapshot.capability_health,

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.captured_at

                FROM procurement_capability_snapshots
                    snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

                """;
    }

    private RequirementRow mapRequirement(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new RequirementRow(
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
                CapabilitySourceType.valueOf(
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
                        "skill_id",
                        UUID.class
                ),
                resultSet.getString(
                        "skill_code"
                ),
                resultSet.getString(
                        "skill_name"
                ),
                resultSet.getString(
                        "skill_category"
                ),
                resultSet.getInt(
                        "required_proficiency"
                ),
                resultSet.getBigDecimal(
                        "importance_weight_pct"
                ),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private DevelopmentActionRow mapDevelopmentAction(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DevelopmentActionRow(
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
                resultSet.getObject(
                        "skill_id",
                        UUID.class
                ),
                resultSet.getString(
                        "skill_code"
                ),
                resultSet.getString(
                        "skill_name"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                CapabilityActionType.valueOf(
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
                resultSet.getInt(
                        "target_proficiency"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                CapabilityActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "evidence_note"
                ),
                instant(
                        resultSet,
                        "started_at"
                ),
                instant(
                        resultSet,
                        "completed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
                ),
                resultSet.getTimestamp(
                        "created_at"
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
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getInt(
                        "active_skill_count"
                ),
                resultSet.getInt(
                        "assessed_member_count"
                ),
                resultSet.getInt(
                        "strategic_work_count"
                ),
                resultSet.getInt(
                        "work_with_requirements_count"
                ),
                resultSet.getInt(
                        "ready_work_count"
                ),
                resultSet.getInt(
                        "watch_work_count"
                ),
                resultSet.getInt(
                        "gap_work_count"
                ),
                resultSet.getInt(
                        "critical_work_count"
                ),
                resultSet.getInt(
                        "critical_gap_count"
                ),
                resultSet.getInt(
                        "open_development_action_count"
                ),
                resultSet.getBigDecimal(
                        "requirement_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "average_assigned_fit_pct"
                ),
                resultSet.getBigDecimal(
                        "average_bench_fit_pct"
                ),
                resultSet.getBigDecimal(
                        "capability_score"
                ),
                CapabilityReadiness.valueOf(
                        resultSet.getString(
                                "capability_health"
                        )
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

    public record SkillRow(
            UUID id,
            String code,
            String name,
            String category,
            String description,
            boolean active
    ) {
    }

    public record UserCapabilityRow(
            UUID id,
            UUID userId,
            String userName,
            String role,
            UUID skillId,
            String skillCode,
            String skillName,
            String skillCategory,
            int proficiencyLevel,
            String evidenceNote,
            String assessedByName,
            Instant assessedAt,
            long version
    ) {
    }

    public record RequirementRow(
            UUID id,
            String currency,
            int fiscalYear,
            CapabilitySourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            UUID skillId,
            String skillCode,
            String skillName,
            String skillCategory,
            int requiredProficiency,
            BigDecimal importanceWeightPct,
            long version
    ) {
    }

    public record DevelopmentActionRow(
            UUID id,
            UUID userId,
            String userName,
            UUID skillId,
            String skillCode,
            String skillName,
            int fiscalYear,
            CapabilityActionType actionType,
            String title,
            String description,
            int targetProficiency,
            LocalDate dueDate,
            CapabilityActionStatus status,
            String evidenceNote,
            Instant startedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            long version
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            String currency,
            int fiscalYear,
            int activeSkillCount,
            int assessedMemberCount,
            int strategicWorkCount,
            int workWithRequirementsCount,
            int readyWorkCount,
            int watchWorkCount,
            int gapWorkCount,
            int criticalWorkCount,
            int criticalGapCount,
            int openDevelopmentActionCount,
            BigDecimal requirementCoveragePct,
            BigDecimal averageAssignedFitPct,
            BigDecimal averageBenchFitPct,
            BigDecimal capabilityScore,
            CapabilityReadiness capabilityHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotMemberRow(
            UUID userId,
            String userName,
            String role,
            int assessedSkillCount,
            BigDecimal averageProficiency,
            int assignedWorkItemCount,
            int capabilityGapCount,
            int openDevelopmentActionCount
    ) {
    }

    public record SnapshotWorkRow(
            CapabilitySourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            int assignedMemberCount,
            int requirementCount,
            int criticalGapCount,
            BigDecimal assignedFitPct,
            BigDecimal benchFitPct,
            int benchReadyMemberCount,
            CapabilityReadiness readiness
    ) {
    }
}
