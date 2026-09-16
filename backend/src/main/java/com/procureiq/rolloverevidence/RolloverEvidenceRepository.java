package com.procureiq.rolloverevidence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RolloverEvidenceRepository {
    private final JdbcTemplate jdbc;

    public RolloverEvidenceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // JSON is constructed from authoritative PostgreSQL records, not from
    // a second, potentially inconsistent application-side calculation.
    public String scalar(String sql, Object... arguments) {
        return jdbc.queryForObject(
            sql,
            (rs, row) -> rs.getString(1),
            arguments
        );
    }

    public void execute(String sql, Object... arguments) {
        jdbc.queryForObject(
            sql,
            (rs, row) -> Boolean.TRUE,
            arguments
        );
    }
}
