package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CapitalAllocationRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapitalAllocationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCycleSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_allocation_cycle_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_allocation_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createCycle(
            UUID cycleId,
            String cycleNumber,
            CapitalAllocationCycleInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_allocation_cycles (
                    id,
                    cycle_number,
                    title,
                    currency,
                    fiscal_year,
                    budget_amount,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                cycleId,
                cycleNumber,
                input.title()
                        .trim(),
                input.currency()
                        .trim()
                        .toUpperCase(),
                input.fiscalYear(),
                input.budgetAmount(),
                input.objective()
                        .trim(),
                currentUserId
        );
    }

    public CycleRow findCycle(
            UUID cycleId
    ) {
        return jdbcTemplate.query(
                cycleSql()
                        + """
                        WHERE allocation_cycle.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCycle(
                                resultSet
                        ),
                cycleId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CycleRow> cycles() {
        return jdbcTemplate.query(
                cycleSql()
                        + """
                        ORDER BY
                            CASE allocation_cycle.status
                                WHEN 'IN_REVIEW'
                                THEN 1
                                WHEN 'DRAFT'
                                THEN 2
                                WHEN 'APPROVED'
                                THEN 3
                                ELSE 4
                            END,
                            allocation_cycle.fiscal_year DESC,
                            allocation_cycle.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCycle(
                                resultSet
                        )
        );
    }

    public void addItem(
            UUID itemId,
            UUID cycleId,
            CapitalAllocationCandidateResponse candidate,
            BigDecimal requestedCapitalAmount,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_allocation_items (
                    id,
                    cycle_id,
                    value_case_id,
                    case_number,
                    persistence_plan_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    value_owner_name,
                    currency,
                    fiscal_year,
                    requested_capital_amount,
                    investment_cost_snapshot,
                    durable_horizon_value_snapshot,
                    net_value_snapshot,
                    roi_pct_snapshot,
                    payback_months_snapshot,
                    persistence_pct_snapshot,
                    value_health_snapshot,
                    priority_score,
                    recommendation,
                    decision,
                    created_by_user_id,
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
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                cycleId,
                candidate.valueCaseId(),
                candidate.caseNumber(),
                candidate.persistencePlanNumber(),
                candidate.commitmentNumber(),
                candidate.initiativeNumber(),
                candidate.initiativeTitle(),
                candidate.valueOwnerName(),
                candidate.currency(),
                candidate.fiscalYear(),
                requestedCapitalAmount,
                candidate.investmentCostAmount(),
                candidate.durableHorizonValueAmount(),
                candidate.netValueAmount(),
                candidate.roiPct(),
                candidate.paybackMonths(),
                candidate.persistencePct(),
                candidate.valueHealth()
                        .name(),
                candidate.priorityScore(),
                candidate.recommendation()
                        .name(),
                currentUserId
        );
    }

    public ItemRow findItem(
            UUID itemId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE allocation_item.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                itemId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ItemRow> items(
            UUID cycleId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE allocation_item.cycle_id = ?

                        ORDER BY
                            allocation_item.priority_score DESC,
                            allocation_item.case_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                cycleId
        );
    }

    public void removeItem(
            UUID itemId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_capital_allocation_items
                WHERE id = ?
                """,
                itemId
        );
    }

    public void submitCycle(
            UUID cycleId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_allocation_cycles

                SET
                    status = 'IN_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'DRAFT'
                """,
                cycleId
        );
    }

    public void decideItem(
            UUID itemId,
            CapitalAllocationDecisionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_allocation_items

                SET
                    decision = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                input.decision()
                        .name(),
                input.decisionNote()
                        .trim(),
                currentUserId,
                itemId
        );
    }

    public void approveCycle(
            UUID cycleId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_allocation_cycles

                SET
                    status = 'APPROVED',
                    approved_by_user_id = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    approval_note = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                currentUserId,
                note.trim(),
                cycleId
        );
    }

    public void closeCycle(
            UUID cycleId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_allocation_cycles

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'APPROVED'
                """,
                currentUserId,
                note.trim(),
                cycleId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            CapitalAllocationCycleResponse cycle,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_allocation_snapshots (
                    id,
                    snapshot_number,
                    cycle_id,
                    cycle_number,
                    cycle_title,
                    currency,
                    fiscal_year,
                    cycle_status,
                    budget_amount,
                    funded_amount,
                    remaining_budget_amount,
                    budget_utilization_pct,
                    funded_net_value_amount,
                    opportunity_cost_amount,
                    average_priority_score,
                    item_count,
                    funded_item_count,
                    deferred_item_count,
                    rejected_item_count,
                    pending_item_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                cycle.id(),
                cycle.cycleNumber(),
                cycle.title(),
                cycle.currency(),
                cycle.fiscalYear(),
                cycle.status()
                        .name(),
                cycle.budgetAmount(),
                cycle.fundedAmount(),
                cycle.remainingBudgetAmount(),
                cycle.budgetUtilizationPct(),
                cycle.fundedNetValueAmount(),
                cycle.opportunityCostAmount(),
                cycle.averagePriorityScore(),
                cycle.itemCount(),
                cycle.fundedItemCount(),
                cycle.deferredItemCount(),
                cycle.rejectedItemCount(),
                cycle.pendingItemCount(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            CapitalAllocationItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_allocation_snapshot_items (
                    id,
                    snapshot_id,
                    allocation_item_id,
                    case_number,
                    initiative_number,
                    initiative_title,
                    requested_capital_amount,
                    durable_horizon_value_amount,
                    net_value_amount,
                    roi_pct,
                    payback_months,
                    persistence_pct,
                    value_health,
                    priority_score,
                    recommendation,
                    decision,
                    decision_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                item.id(),
                item.caseNumber(),
                item.initiativeNumber(),
                item.initiativeTitle(),
                item.requestedCapitalAmount(),
                item.durableHorizonValueSnapshot(),
                item.netValueSnapshot(),
                item.roiPctSnapshot(),
                item.paybackMonthsSnapshot(),
                item.persistencePctSnapshot(),
                item.valueHealthSnapshot()
                        .name(),
                item.priorityScore(),
                item.recommendation()
                        .name(),
                item.decision()
                        .name(),
                item.decisionNote()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE allocation_snapshot.id = ?
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
                            allocation_snapshot.captured_at DESC

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
                    allocation_item_id,
                    case_number,
                    initiative_number,
                    initiative_title,
                    requested_capital_amount,
                    durable_horizon_value_amount,
                    net_value_amount,
                    roi_pct,
                    payback_months,
                    persistence_pct,
                    value_health,
                    priority_score,
                    recommendation,
                    decision,
                    decision_note

                FROM procurement_capital_allocation_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    priority_score DESC,
                    case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "allocation_item_id",
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
                                resultSet.getBigDecimal(
                                        "requested_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "durable_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "net_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "payback_months"
                                ),
                                resultSet.getBigDecimal(
                                        "persistence_pct"
                                ),
                                StrategicValueHealth.valueOf(
                                        resultSet.getString(
                                                "value_health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "priority_score"
                                ),
                                CapitalAllocationDecision.valueOf(
                                        resultSet.getString(
                                                "recommendation"
                                        )
                                ),
                                CapitalAllocationDecision.valueOf(
                                        resultSet.getString(
                                                "decision"
                                        )
                                ),
                                resultSet.getString(
                                        "decision_note"
                                )
                        ),
                snapshotId
        );
    }

    private String cycleSql() {
        return """
                SELECT
                    allocation_cycle.id,
                    allocation_cycle.cycle_number,
                    allocation_cycle.title,
                    allocation_cycle.currency,
                    allocation_cycle.fiscal_year,
                    allocation_cycle.budget_amount,
                    allocation_cycle.objective,
                    allocation_cycle.status,

                    approver.full_name
                        AS approved_by_name,

                    allocation_cycle.approved_at,
                    allocation_cycle.approval_note,

                    closer.full_name
                        AS closed_by_name,

                    allocation_cycle.closed_at,
                    allocation_cycle.close_note,
                    allocation_cycle.created_at,
                    allocation_cycle.updated_at,
                    allocation_cycle.version

                FROM procurement_capital_allocation_cycles
                    allocation_cycle

                LEFT JOIN app_users
                    approver
                    ON approver.id =
                       allocation_cycle.approved_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       allocation_cycle.closed_by_user_id

                """;
    }

    private String itemSql() {
        return """
                SELECT
                    allocation_item.id,
                    allocation_item.cycle_id,
                    allocation_item.value_case_id,
                    allocation_item.case_number,
                    allocation_item.persistence_plan_number,
                    allocation_item.commitment_number,
                    allocation_item.initiative_number,
                    allocation_item.initiative_title,
                    allocation_item.value_owner_name,
                    allocation_item.currency,
                    allocation_item.fiscal_year,
                    allocation_item.requested_capital_amount,
                    allocation_item.investment_cost_snapshot,
                    allocation_item.durable_horizon_value_snapshot,
                    allocation_item.net_value_snapshot,
                    allocation_item.roi_pct_snapshot,
                    allocation_item.payback_months_snapshot,
                    allocation_item.persistence_pct_snapshot,
                    allocation_item.value_health_snapshot,
                    allocation_item.priority_score,
                    allocation_item.recommendation,
                    allocation_item.decision,
                    allocation_item.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    allocation_item.decided_at,
                    allocation_item.created_at

                FROM procurement_capital_allocation_items
                    allocation_item

                LEFT JOIN app_users
                    decider
                    ON decider.id =
                       allocation_item.decided_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    allocation_snapshot.id,
                    allocation_snapshot.snapshot_number,
                    allocation_snapshot.cycle_id,
                    allocation_snapshot.cycle_number,
                    allocation_snapshot.cycle_title,
                    allocation_snapshot.currency,
                    allocation_snapshot.fiscal_year,
                    allocation_snapshot.cycle_status,
                    allocation_snapshot.budget_amount,
                    allocation_snapshot.funded_amount,
                    allocation_snapshot.remaining_budget_amount,
                    allocation_snapshot.budget_utilization_pct,
                    allocation_snapshot.funded_net_value_amount,
                    allocation_snapshot.opportunity_cost_amount,
                    allocation_snapshot.average_priority_score,
                    allocation_snapshot.item_count,
                    allocation_snapshot.funded_item_count,
                    allocation_snapshot.deferred_item_count,
                    allocation_snapshot.rejected_item_count,
                    allocation_snapshot.pending_item_count,

                    user_account.full_name
                        AS captured_by_name,

                    allocation_snapshot.captured_at

                FROM procurement_capital_allocation_snapshots
                    allocation_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       allocation_snapshot.captured_by_user_id

                """;
    }

    private CycleRow mapCycle(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CycleRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "cycle_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "budget_amount"
                ),
                resultSet.getString(
                        "objective"
                ),
                CapitalAllocationCycleStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "approved_by_name"
                ),
                instant(
                        resultSet,
                        "approved_at"
                ),
                resultSet.getString(
                        "approval_note"
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

    private ItemRow mapItem(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ItemRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "cycle_id",
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
                        "persistence_plan_number"
                ),
                resultSet.getString(
                        "commitment_number"
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                resultSet.getString(
                        "initiative_title"
                ),
                resultSet.getString(
                        "value_owner_name"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "requested_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "investment_cost_snapshot"
                ),
                resultSet.getBigDecimal(
                        "durable_horizon_value_snapshot"
                ),
                resultSet.getBigDecimal(
                        "net_value_snapshot"
                ),
                resultSet.getBigDecimal(
                        "roi_pct_snapshot"
                ),
                resultSet.getBigDecimal(
                        "payback_months_snapshot"
                ),
                resultSet.getBigDecimal(
                        "persistence_pct_snapshot"
                ),
                StrategicValueHealth.valueOf(
                        resultSet.getString(
                                "value_health_snapshot"
                        )
                ),
                resultSet.getBigDecimal(
                        "priority_score"
                ),
                CapitalAllocationDecision.valueOf(
                        resultSet.getString(
                                "recommendation"
                        )
                ),
                CapitalAllocationDecision.valueOf(
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
                        "cycle_id",
                        UUID.class
                ),
                resultSet.getString(
                        "cycle_number"
                ),
                resultSet.getString(
                        "cycle_title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                CapitalAllocationCycleStatus.valueOf(
                        resultSet.getString(
                                "cycle_status"
                        )
                ),
                resultSet.getBigDecimal(
                        "budget_amount"
                ),
                resultSet.getBigDecimal(
                        "funded_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_budget_amount"
                ),
                resultSet.getBigDecimal(
                        "budget_utilization_pct"
                ),
                resultSet.getBigDecimal(
                        "funded_net_value_amount"
                ),
                resultSet.getBigDecimal(
                        "opportunity_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "average_priority_score"
                ),
                resultSet.getInt(
                        "item_count"
                ),
                resultSet.getInt(
                        "funded_item_count"
                ),
                resultSet.getInt(
                        "deferred_item_count"
                ),
                resultSet.getInt(
                        "rejected_item_count"
                ),
                resultSet.getInt(
                        "pending_item_count"
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

    public record CycleRow(
            UUID id,
            String cycleNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal budgetAmount,
            String objective,
            CapitalAllocationCycleStatus status,
            String approvedByName,
            Instant approvedAt,
            String approvalNote,
            String closedByName,
            Instant closedAt,
            String closeNote,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ItemRow(
            UUID id,
            UUID cycleId,
            UUID valueCaseId,
            String caseNumber,
            String persistencePlanNumber,
            String commitmentNumber,
            String initiativeNumber,
            String initiativeTitle,
            String valueOwnerName,
            String currency,
            int fiscalYear,
            BigDecimal requestedCapitalAmount,
            BigDecimal investmentCostSnapshot,
            BigDecimal durableHorizonValueSnapshot,
            BigDecimal netValueSnapshot,
            BigDecimal roiPctSnapshot,
            BigDecimal paybackMonthsSnapshot,
            BigDecimal persistencePctSnapshot,
            StrategicValueHealth valueHealthSnapshot,
            BigDecimal priorityScore,
            CapitalAllocationDecision recommendation,
            CapitalAllocationDecision decision,
            String decisionNote,
            String decidedByName,
            Instant decidedAt,
            Instant createdAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            UUID cycleId,
            String cycleNumber,
            String cycleTitle,
            String currency,
            int fiscalYear,
            CapitalAllocationCycleStatus cycleStatus,
            BigDecimal budgetAmount,
            BigDecimal fundedAmount,
            BigDecimal remainingBudgetAmount,
            BigDecimal budgetUtilizationPct,
            BigDecimal fundedNetValueAmount,
            BigDecimal opportunityCostAmount,
            BigDecimal averagePriorityScore,
            int itemCount,
            int fundedItemCount,
            int deferredItemCount,
            int rejectedItemCount,
            int pendingItemCount,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID allocationItemId,
            String caseNumber,
            String initiativeNumber,
            String initiativeTitle,
            BigDecimal requestedCapitalAmount,
            BigDecimal durableHorizonValueAmount,
            BigDecimal netValueAmount,
            BigDecimal roiPct,
            BigDecimal paybackMonths,
            BigDecimal persistencePct,
            StrategicValueHealth valueHealth,
            BigDecimal priorityScore,
            CapitalAllocationDecision recommendation,
            CapitalAllocationDecision decision,
            String decisionNote
    ) {
    }
}
