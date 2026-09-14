package com.procureiq.processmining;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class ProcessMiningRepository {

    private static final String TERMINAL_STATUS_SQL =
            """
            'CANCELLED',
            'CLOSED',
            'PAID',
            'RECEIVED',
            'REJECTED',
            'COMPLETED',
            'AWARDED',
            'WITHDRAWN',
            'TERMINATED'
            """;

    private final JdbcTemplate jdbcTemplate;

    public ProcessMiningRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<ProcessStageTargetResponse> targets() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    entity_type,
                    status,
                    target_hours
                FROM procurement_process_stage_targets
                ORDER BY
                    entity_type,
                    CASE
                        WHEN status = '*'
                        THEN 1
                        ELSE 2
                    END,
                    status
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessStageTargetResponse(
                                resultSet.getLong(
                                        "id"
                                ),
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getInt(
                                        "target_hours"
                                )
                        )
        );
    }

    public ProcessStageTargetResponse upsertTarget(
            ProcessStageTargetInput input
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_process_stage_targets (
                    entity_type,
                    status,
                    target_hours,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT (
                    entity_type,
                    status
                )

                DO UPDATE SET
                    target_hours =
                        EXCLUDED.target_hours,
                    updated_at =
                        CURRENT_TIMESTAMP
                """,
                input.entityType()
                        .name(),
                input.status()
                        .trim()
                        .toUpperCase(),
                input.targetHours()
        );

        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    entity_type,
                    status,
                    target_hours
                FROM procurement_process_stage_targets
                WHERE entity_type = ?
                AND status = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessStageTargetResponse(
                                resultSet.getLong(
                                        "id"
                                ),
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getInt(
                                        "target_hours"
                                )
                        ),
                input.entityType()
                        .name(),
                input.status()
                        .trim()
                        .toUpperCase()
        )
                .stream()
                .findFirst()
                .orElseThrow();
    }

    public long trackedEntities() {
        Long value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM (
                            SELECT DISTINCT
                                entity_type,
                                entity_id
                            FROM procurement_process_events
                        ) entities
                        """,
                        Long.class
                );

        return value == null
                ? 0
                : value;
    }

    public long liveTransitions() {
        Long value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM procurement_process_events
                        WHERE event_source =
                            'LIVE'
                        """,
                        Long.class
                );

        return value == null
                ? 0
                : value;
    }

    public long activeEntities() {
        Long value =
                jdbcTemplate.queryForObject(
                        """
                        WITH latest AS (
                            SELECT DISTINCT ON (
                                entity_type,
                                entity_id
                            )
                                entity_type,
                                entity_id,
                                status
                            FROM procurement_process_events
                            ORDER BY
                                entity_type,
                                entity_id,
                                event_at DESC,
                                id DESC
                        )

                        SELECT COUNT(*)
                        FROM latest
                        WHERE UPPER(status)
                            NOT IN (
                        """
                        +
                        TERMINAL_STATUS_SQL
                        +
                        """
                            )
                        """,
                        Long.class
                );

        return value == null
                ? 0
                : value;
    }

    public BigDecimal averageObservedCycleHours() {
        BigDecimal value =
                jdbcTemplate.queryForObject(
                        """
                        WITH observed_cycles AS (
                            SELECT
                                entity_type,
                                entity_id,

                                EXTRACT(
                                    EPOCH
                                    FROM (
                                        MAX(event_at)
                                        -
                                        MIN(event_at)
                                    )
                                )
                                /
                                3600.0
                                    AS cycle_hours

                            FROM procurement_process_events

                            WHERE event_source =
                                'LIVE'

                            GROUP BY
                                entity_type,
                                entity_id

                            HAVING COUNT(*) >= 2
                        )

                        SELECT
                            ROUND(
                                COALESCE(
                                    AVG(cycle_hours),
                                    0
                                )::NUMERIC,
                                2
                            )

                        FROM observed_cycles
                        """,
                        BigDecimal.class
                );

        return value == null
                ? BigDecimal.ZERO
                        .setScale(2)
                : value;
    }

    public List<ProcessStageMetricResponse> stageMetrics() {
        return jdbcTemplate.query(
                """
                WITH ordered_events AS (
                    SELECT
                        entity_type,
                        entity_id,
                        status,

                        LAG(status)
                        OVER (
                            PARTITION BY
                                entity_type,
                                entity_id
                            ORDER BY
                                event_at,
                                id
                        )
                            AS previous_stage,

                        event_at,

                        LAG(event_at)
                        OVER (
                            PARTITION BY
                                entity_type,
                                entity_id
                            ORDER BY
                                event_at,
                                id
                        )
                            AS previous_event_at

                    FROM procurement_process_events

                    WHERE event_source =
                        'LIVE'
                ),

                durations AS (
                    SELECT
                        entity_type,
                        previous_stage
                            AS stage_status,

                        EXTRACT(
                            EPOCH
                            FROM (
                                event_at
                                -
                                previous_event_at
                            )
                        )
                        /
                        3600.0
                            AS duration_hours

                    FROM ordered_events

                    WHERE previous_event_at
                        IS NOT NULL

                    AND previous_stage
                        IS NOT NULL
                )

                SELECT
                    entity_type,
                    stage_status,

                    COUNT(*)
                        AS completed_transitions,

                    ROUND(
                        AVG(
                            duration_hours
                        )::NUMERIC,
                        2
                    )
                        AS average_hours,

                    ROUND(
                        PERCENTILE_CONT(
                            0.95
                        )
                        WITHIN GROUP (
                            ORDER BY
                                duration_hours
                        )::NUMERIC,
                        2
                    )
                        AS p95_hours

                FROM durations

                GROUP BY
                    entity_type,
                    stage_status

                ORDER BY
                    average_hours DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessStageMetricResponse(
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getString(
                                        "stage_status"
                                ),
                                resultSet.getLong(
                                        "completed_transitions"
                                ),
                                resultSet.getBigDecimal(
                                        "average_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "p95_hours"
                                )
                        )
        );
    }

    public List<BottleneckRow> bottlenecks() {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        event.entity_type,
                        event.entity_id
                    )
                        event.entity_type,
                        event.entity_id,
                        event.entity_reference,
                        event.status,
                        event.department_id,
                        event.category,
                        event.event_at

                    FROM procurement_process_events
                        event

                    ORDER BY
                        event.entity_type,
                        event.entity_id,
                        event.event_at DESC,
                        event.id DESC
                ),

                targeted AS (
                    SELECT
                        latest.*,

                        COALESCE(
                            exact_target.target_hours,
                            default_target.target_hours,
                            72
                        )
                            AS target_hours,

                        (
                            EXTRACT(
                                EPOCH
                                FROM (
                                    CURRENT_TIMESTAMP
                                    -
                                    latest.event_at
                                )
                            )
                            /
                            3600.0
                        )
                            AS age_hours

                    FROM latest

                    LEFT JOIN procurement_process_stage_targets
                        exact_target
                        ON exact_target.entity_type =
                           latest.entity_type
                        AND exact_target.status =
                            UPPER(
                                latest.status
                            )

                    LEFT JOIN procurement_process_stage_targets
                        default_target
                        ON default_target.entity_type =
                           latest.entity_type
                        AND default_target.status =
                            '*'

                    WHERE UPPER(
                        latest.status
                    )
                    NOT IN (
                """
                +
                TERMINAL_STATUS_SQL
                +
                """
                    )
                )

                SELECT
                    targeted.entity_type,
                    targeted.entity_id,
                    targeted.entity_reference,
                    targeted.status,
                    targeted.department_id,

                    department.name
                        AS department_name,

                    targeted.category,

                    ROUND(
                        targeted.age_hours::NUMERIC,
                        2
                    )
                        AS age_hours,

                    targeted.target_hours,

                    ROUND(
                        (
                            targeted.age_hours
                            /
                            targeted.target_hours
                        )::NUMERIC,
                        2
                    )
                        AS target_ratio,

                    targeted.event_at

                FROM targeted

                LEFT JOIN departments department
                    ON department.id =
                       targeted.department_id

                WHERE targeted.age_hours
                    >
                    targeted.target_hours

                ORDER BY
                    target_ratio DESC,
                    age_hours DESC

                LIMIT 100
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BottleneckRow(
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "entity_reference"
                                ),
                                resultSet.getString(
                                        "status"
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
                                resultSet.getBigDecimal(
                                        "age_hours"
                                ),
                                resultSet.getInt(
                                        "target_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "target_ratio"
                                ),
                                resultSet.getTimestamp(
                                        "event_at"
                                )
                                        .toInstant()
                        )
        );
    }

    public List<ProcessDimensionMetricResponse> departmentMetrics() {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        event.entity_type,
                        event.entity_id
                    )
                        event.entity_type,
                        event.entity_id,
                        event.status,
                        event.department_id,
                        event.event_at

                    FROM procurement_process_events
                        event

                    ORDER BY
                        event.entity_type,
                        event.entity_id,
                        event.event_at DESC,
                        event.id DESC
                ),

                targeted AS (
                    SELECT
                        latest.*,

                        COALESCE(
                            exact_target.target_hours,
                            default_target.target_hours,
                            72
                        )
                            AS target_hours,

                        (
                            EXTRACT(
                                EPOCH
                                FROM (
                                    CURRENT_TIMESTAMP
                                    -
                                    latest.event_at
                                )
                            )
                            /
                            3600.0
                        )
                            AS age_hours

                    FROM latest

                    LEFT JOIN procurement_process_stage_targets
                        exact_target
                        ON exact_target.entity_type =
                           latest.entity_type
                        AND exact_target.status =
                            UPPER(
                                latest.status
                            )

                    LEFT JOIN procurement_process_stage_targets
                        default_target
                        ON default_target.entity_type =
                           latest.entity_type
                        AND default_target.status =
                            '*'

                    WHERE latest.department_id
                        IS NOT NULL

                    AND UPPER(
                        latest.status
                    )
                    NOT IN (
                """
                +
                TERMINAL_STATUS_SQL
                +
                """
                    )
                )

                SELECT
                    department.name
                        AS dimension_value,

                    COUNT(*)
                        AS active_items,

                    COUNT(*)
                    FILTER (
                        WHERE targeted.age_hours
                            >
                            targeted.target_hours
                    )
                        AS bottlenecks,

                    ROUND(
                        AVG(
                            targeted.age_hours
                        )::NUMERIC,
                        2
                    )
                        AS average_age_hours

                FROM targeted

                JOIN departments department
                    ON department.id =
                       targeted.department_id

                GROUP BY
                    department.name

                ORDER BY
                    bottlenecks DESC,
                    average_age_hours DESC

                LIMIT 20
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessDimensionMetricResponse(
                                "DEPARTMENT",
                                resultSet.getString(
                                        "dimension_value"
                                ),
                                resultSet.getLong(
                                        "active_items"
                                ),
                                resultSet.getLong(
                                        "bottlenecks"
                                ),
                                resultSet.getBigDecimal(
                                        "average_age_hours"
                                )
                        )
        );
    }

    public List<ProcessDimensionMetricResponse> categoryMetrics() {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        event.entity_type,
                        event.entity_id
                    )
                        event.entity_type,
                        event.entity_id,
                        event.status,
                        event.category,
                        event.event_at

                    FROM procurement_process_events
                        event

                    ORDER BY
                        event.entity_type,
                        event.entity_id,
                        event.event_at DESC,
                        event.id DESC
                ),

                targeted AS (
                    SELECT
                        latest.*,

                        COALESCE(
                            exact_target.target_hours,
                            default_target.target_hours,
                            72
                        )
                            AS target_hours,

                        (
                            EXTRACT(
                                EPOCH
                                FROM (
                                    CURRENT_TIMESTAMP
                                    -
                                    latest.event_at
                                )
                            )
                            /
                            3600.0
                        )
                            AS age_hours

                    FROM latest

                    LEFT JOIN procurement_process_stage_targets
                        exact_target
                        ON exact_target.entity_type =
                           latest.entity_type
                        AND exact_target.status =
                            UPPER(
                                latest.status
                            )

                    LEFT JOIN procurement_process_stage_targets
                        default_target
                        ON default_target.entity_type =
                           latest.entity_type
                        AND default_target.status =
                            '*'

                    WHERE latest.category
                        IS NOT NULL

                    AND BTRIM(
                        latest.category
                    )
                        <> ''

                    AND UPPER(
                        latest.status
                    )
                    NOT IN (
                """
                +
                TERMINAL_STATUS_SQL
                +
                """
                    )
                )

                SELECT
                    category
                        AS dimension_value,

                    COUNT(*)
                        AS active_items,

                    COUNT(*)
                    FILTER (
                        WHERE age_hours
                            >
                            target_hours
                    )
                        AS bottlenecks,

                    ROUND(
                        AVG(
                            age_hours
                        )::NUMERIC,
                        2
                    )
                        AS average_age_hours

                FROM targeted

                GROUP BY
                    category

                ORDER BY
                    bottlenecks DESC,
                    average_age_hours DESC

                LIMIT 20
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessDimensionMetricResponse(
                                "CATEGORY",
                                resultSet.getString(
                                        "dimension_value"
                                ),
                                resultSet.getLong(
                                        "active_items"
                                ),
                                resultSet.getLong(
                                        "bottlenecks"
                                ),
                                resultSet.getBigDecimal(
                                        "average_age_hours"
                                )
                        )
        );
    }

    public List<DeviationRow> repeatedStageDeviations() {
        return jdbcTemplate.query(
                """
                WITH repeated AS (
                    SELECT
                        entity_type,
                        entity_id,
                        status,
                        COUNT(*)
                            AS stage_visits,
                        MAX(event_at)
                            AS detected_at

                    FROM procurement_process_events

                    WHERE event_source =
                        'LIVE'

                    AND event_type =
                        'STATUS_CHANGED'

                    GROUP BY
                        entity_type,
                        entity_id,
                        status

                    HAVING COUNT(*) > 1
                ),

                reference_event AS (
                    SELECT DISTINCT ON (
                        entity_type,
                        entity_id
                    )
                        entity_type,
                        entity_id,
                        entity_reference

                    FROM procurement_process_events

                    ORDER BY
                        entity_type,
                        entity_id,
                        event_at DESC,
                        id DESC
                )

                SELECT
                    repeated.entity_type,
                    repeated.entity_id,
                    reference_event.entity_reference,
                    repeated.status,
                    repeated.stage_visits,
                    repeated.detected_at

                FROM repeated

                JOIN reference_event
                    ON reference_event.entity_type =
                       repeated.entity_type
                    AND reference_event.entity_id =
                        repeated.entity_id

                ORDER BY
                    repeated.stage_visits DESC,
                    repeated.detected_at DESC

                LIMIT 30
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DeviationRow(
                                ProcessDeviationType.REPEATED_STAGE,
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "entity_reference"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                "Entity entered stage "
                                        + resultSet.getString(
                                                "status"
                                        )
                                        + " "
                                        + resultSet.getLong(
                                                "stage_visits"
                                        )
                                        + " times.",
                                resultSet.getTimestamp(
                                        "detected_at"
                                )
                                        .toInstant()
                        )
        );
    }

    public List<DeviationRow> cancelledFlowDeviations() {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        entity_type,
                        entity_id
                    )
                        entity_type,
                        entity_id,
                        entity_reference,
                        status,
                        event_at

                    FROM procurement_process_events

                    ORDER BY
                        entity_type,
                        entity_id,
                        event_at DESC,
                        id DESC
                )

                SELECT
                    entity_type,
                    entity_id,
                    entity_reference,
                    status,
                    event_at

                FROM latest

                WHERE UPPER(status) IN (
                    'CANCELLED',
                    'REJECTED',
                    'WITHDRAWN',
                    'TERMINATED'
                )

                ORDER BY
                    event_at DESC

                LIMIT 30
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DeviationRow(
                                ProcessDeviationType.CANCELLED_FLOW,
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "entity_reference"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                "Workflow ended with status "
                                        + resultSet.getString(
                                                "status"
                                        )
                                        + ".",
                                resultSet.getTimestamp(
                                        "event_at"
                                )
                                        .toInstant()
                        )
        );
    }

    public List<ProcessEventResponse> recentEvents() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    entity_type,
                    entity_id,
                    entity_reference,
                    status,
                    previous_status,
                    event_type,
                    event_source,
                    source_table,
                    department_id,
                    category,
                    event_at

                FROM procurement_process_events

                ORDER BY
                    event_at DESC,
                    id DESC

                LIMIT 100
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ProcessEventResponse(
                                resultSet.getLong(
                                        "id"
                                ),
                                ProcessEntityType.valueOf(
                                        resultSet.getString(
                                                "entity_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "entity_reference"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "previous_status"
                                ),
                                resultSet.getString(
                                        "event_type"
                                ),
                                resultSet.getString(
                                        "event_source"
                                ),
                                resultSet.getString(
                                        "source_table"
                                ),
                                resultSet.getObject(
                                        "department_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getTimestamp(
                                        "event_at"
                                )
                                        .toInstant()
                        )
        );
    }

    public record BottleneckRow(
            ProcessEntityType entityType,
            UUID entityId,
            String entityReference,
            String status,
            UUID departmentId,
            String departmentName,
            String category,
            BigDecimal ageHours,
            int targetHours,
            BigDecimal targetRatio,
            Instant enteredStageAt
    ) {
    }

    public record DeviationRow(
            ProcessDeviationType deviationType,
            ProcessEntityType entityType,
            UUID entityId,
            String entityReference,
            String status,
            String details,
            Instant detectedAt
    ) {
    }
}
