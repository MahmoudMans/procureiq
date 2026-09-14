package com.procureiq.reporting;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class ReportSnapshotRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReportSnapshotRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void create(
            UUID id,
            ReportType reportType,
            LocalDate periodStart,
            LocalDate periodEnd,
            String label,
            String payload,
            UUID createdByUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO report_snapshots (
                    id,
                    report_type,
                    period_start,
                    period_end,
                    label,
                    payload,
                    created_by_user_id
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                """,
                id,
                reportType.name(),
                periodStart,
                periodEnd,
                label,
                payload,
                createdByUserId
        );
    }

    public List<ReportSnapshotResponse> findRecent() {
        return jdbcTemplate.query(
                """
                SELECT
                    snapshot.id,
                    snapshot.report_type,
                    snapshot.period_start,
                    snapshot.period_end,
                    snapshot.label,
                    snapshot.created_by_user_id,
                    app_user.full_name
                        AS created_by_name,
                    snapshot.created_at
                FROM report_snapshots snapshot
                JOIN app_users app_user
                    ON app_user.id =
                       snapshot.created_by_user_id
                ORDER BY
                    snapshot.created_at DESC
                LIMIT 100
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new ReportSnapshotResponse(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            ReportType.valueOf(
                                    resultSet.getString(
                                            "report_type"
                                    )
                            ),
                            resultSet.getObject(
                                    "period_start",
                                    LocalDate.class
                            ),
                            resultSet.getObject(
                                    "period_end",
                                    LocalDate.class
                            ),
                            resultSet.getString(
                                    "label"
                            ),
                            resultSet.getObject(
                                    "created_by_user_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "created_by_name"
                            ),
                            created.toInstant()
                    );
                }
        );
    }
}
