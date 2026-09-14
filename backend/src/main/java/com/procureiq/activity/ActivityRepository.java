package com.procureiq.activity;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class ActivityRepository {

    private final JdbcTemplate jdbcTemplate;

    public ActivityRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ActivityRow> findRecent(
            UUID currentUserId,
            boolean privileged,
            int limit
    ) {
        if (privileged) {
            return jdbcTemplate.query(
                    """
                    SELECT
                        audit.id,
                        audit.entity_type,
                        audit.entity_id,
                        audit.action,
                        audit.status,
                        audit.actor_user_id,
                        app_user.full_name
                            AS actor_name,
                        audit.occurred_at
                    FROM audit_events audit
                    LEFT JOIN app_users app_user
                        ON app_user.id =
                           audit.actor_user_id
                    ORDER BY
                        audit.occurred_at DESC,
                        audit.id DESC
                    LIMIT ?
                    """,
                    (
                            resultSet,
                            rowNumber
                    ) ->
                            mapRow(
                                    resultSet
                            ),
                    limit
            );
        }

        return jdbcTemplate.query(
                """
                SELECT
                    audit.id,
                    audit.entity_type,
                    audit.entity_id,
                    audit.action,
                    audit.status,
                    audit.actor_user_id,
                    app_user.full_name
                        AS actor_name,
                    audit.occurred_at
                FROM audit_events audit
                LEFT JOIN app_users app_user
                    ON app_user.id =
                       audit.actor_user_id
                WHERE audit.actor_user_id = ?
                ORDER BY
                    audit.occurred_at DESC,
                    audit.id DESC
                LIMIT ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRow(
                                resultSet
                        ),
                currentUserId,
                limit
        );
    }

    private ActivityRow mapRow(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp occurred =
                resultSet.getTimestamp(
                        "occurred_at"
                );

        return new ActivityRow(
                resultSet.getLong("id"),
                resultSet.getString(
                        "entity_type"
                ),
                resultSet.getObject(
                        "entity_id",
                        UUID.class
                ),
                resultSet.getString(
                        "action"
                ),
                resultSet.getString(
                        "status"
                ),
                resultSet.getObject(
                        "actor_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "actor_name"
                ),
                occurred == null
                        ? null
                        : occurred.toInstant()
        );
    }

    public record ActivityRow(
            long id,
            String entityType,
            UUID entityId,
            String action,
            String status,
            UUID actorUserId,
            String actorName,
            Instant occurredAt
    ) {
    }
}
