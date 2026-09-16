package com.procureiq.flywheelacceptance;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(
        named = "PROCUREIQ_STEP76_DB_URL",
        matches = "jdbc:postgresql:.*"
)
class FlywheelFullMigrationChainPostgresTest {

    private String baseUrl;
    private String username;
    private String password;

    private String schema;

    @BeforeEach
    void setUp() throws Exception {
        baseUrl =
                System.getenv(
                        "PROCUREIQ_STEP76_DB_URL"
                );

        username =
                System.getenv(
                        "PROCUREIQ_STEP76_DB_USER"
                );

        password =
                System.getenv(
                        "PROCUREIQ_STEP76_DB_PASSWORD"
                );

        if (
                baseUrl == null
                ||
                !baseUrl.matches(
                        "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 76 migration tests require the disposable loopback database."
            );
        }

        schema =
                "step76_chain_"
                        + UUID
                                .randomUUID()
                                .toString()
                                .replace(
                                        "-",
                                        ""
                                );

        try (
                Connection connection =
                        DriverManager.getConnection(
                                baseUrl,
                                username,
                                password
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "CREATE SCHEMA "
                            + schema
            );
        }
    }

    @AfterEach
    void tearDown() throws Exception {
        if (
                baseUrl == null
                ||
                schema == null
        ) {
            return;
        }

        try (
                Connection connection =
                        DriverManager.getConnection(
                                baseUrl,
                                username,
                                password
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "DROP SCHEMA IF EXISTS "
                            + schema
                            + " CASCADE"
            );
        }
    }

    @Test
    void fullMigrationChainReachesV80AndHardensContinuationOutcomeRuntime()
            throws Exception {
        Flyway flyway =
                flyway();

        MigrateResult result =
                flyway.migrate();

        assertTrue(
                result.success
        );

        assertNotNull(
                flyway
                        .info()
                        .current()
        );

        assertEquals(
                "80",
                flyway
                        .info()
                        .current()
                        .getVersion()
                        .toString()
        );

        assertTable(
                "procurement_flywheel_release_batches"
        );

        assertTable(
                "procurement_flywheel_settlement_cases"
        );

        assertTable(
                "procurement_flywheel_variance_plans"
        );

        assertTable(
                "procurement_variance_execution_cases"
        );

        assertTable(
                "procurement_variance_execution_items"
        );

        assertTable(
                "procurement_variance_execution_snapshots"
        );

        assertTable(
                "supplier_compliance_documents"
        );

        assertTable(
                "supplier_document_vault_documents"
        );

        assertTable(
                "procurement_residual_remediation_plans"
        );

        assertTable(
                "procurement_residual_remediation_items"
        );

        assertTable(
                "procurement_residual_remediation_snapshots"
        );

        assertTable(
                "procurement_residual_remediation_snapshot_items"
        );

        assertTable(
                "procurement_remediation_outcome_cases"
        );

        assertTable(
                "procurement_remediation_outcome_items"
        );

        assertTable(
                "procurement_remediation_outcome_snapshots"
        );

        assertTable(
                "procurement_remediation_outcome_snapshot_items"
        );

        assertTable(
                "procurement_remediation_continuation_cases"
        );

        assertTable(
                "procurement_remediation_continuation_items"
        );

        assertTable(
                "procurement_remediation_continuation_snapshots"
        );

        assertTable(
                "procurement_remediation_continuation_snapshot_items"
        );

        assertTable(
                "procurement_remediation_continuation_outcome_cases"
        );

        assertTable(
                "procurement_remediation_continuation_outcome_items"
        );

        assertTable(
                "procurement_remediation_continuation_outcome_snapshots"
        );

        assertTable(
                "procurement_remediation_continuation_outcome_snapshot_items"
        );

        assertNoTable(
                "supplier_compliance_documents_v13_legacy"
        );

        assertColumn(
                "supplier_compliance_documents",
                "contract_id"
        );

        assertNoColumn(
                "supplier_compliance_documents",
                "requirement_id"
        );

        assertColumn(
                "supplier_document_vault_documents",
                "requirement_id"
        );

        assertNoColumn(
                "supplier_document_vault_documents",
                "contract_id"
        );

        assertFunction(
                "procureiq_fve74_validate_case_insert"
        );

        assertFunction(
                "procureiq_fve74_validate_snapshot"
        );
    }

    @Test
    void currentV80DatabaseHasNoPendingMigration()
            throws Exception {
        Flyway flyway =
                flyway();

        MigrateResult first =
                flyway.migrate();

        assertTrue(
                first.success
        );

        MigrateResult second =
                flyway.migrate();

        assertTrue(
                second.success
        );

        assertEquals(
                0,
                second.migrationsExecuted
        );

        assertEquals(
                "80",
                flyway
                        .info()
                        .current()
                        .getVersion()
                        .toString()
        );

        assertEquals(
                0,
                flyway
                        .info()
                        .pending()
                        .length
        );
    }

    private Flyway flyway() {
        return Flyway
                .configure()
                .dataSource(
                        baseUrl,
                        username,
                        password
                )
                .schemas(
                        schema
                )
                .defaultSchema(
                        schema
                )
                .createSchemas(
                        false
                )
                .locations(
                        "classpath:db/migration"
                )
                .validateMigrationNaming(
                        true
                )
                .load();
    }

    private void assertTable(
            String table
    ) throws Exception {
        try (
                Connection connection =
                        schemaConnection();

                var statement =
                        connection.prepareStatement(
                                """
                                SELECT EXISTS (
                                    SELECT 1

                                    FROM information_schema.tables

                                    WHERE table_schema = ?
                                    AND table_name = ?
                                )
                                """
                        )
        ) {
            statement.setString(
                    1,
                    schema
            );

            statement.setString(
                    2,
                    table
            );

            try (
                    ResultSet resultSet =
                            statement.executeQuery()
            ) {
                assertTrue(
                        resultSet.next()
                );

                assertTrue(
                        resultSet.getBoolean(
                                1
                        ),
                        "Missing table: "
                                + table
                );
            }
        }
    }

    private void assertColumn(
            String table,
            String column
    ) throws Exception {
        try (
                Connection connection =
                        schemaConnection();

                var statement =
                        connection.prepareStatement(
                                """
                                SELECT EXISTS (
                                    SELECT 1
                                    FROM information_schema.columns
                                    WHERE table_schema = ?
                                    AND table_name = ?
                                    AND column_name = ?
                                )
                                """
                        )
        ) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);

            try (
                    ResultSet resultSet =
                            statement.executeQuery()
            ) {
                assertTrue(resultSet.next());

                assertTrue(
                        resultSet.getBoolean(1),
                        "Missing column: "
                                + table
                                + "."
                                + column
                );
            }
        }
    }

    private void assertNoColumn(
            String table,
            String column
    ) throws Exception {
        try (
                Connection connection =
                        schemaConnection();

                var statement =
                        connection.prepareStatement(
                                """
                                SELECT EXISTS (
                                    SELECT 1
                                    FROM information_schema.columns
                                    WHERE table_schema = ?
                                    AND table_name = ?
                                    AND column_name = ?
                                )
                                """
                        )
        ) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);

            try (
                    ResultSet resultSet =
                            statement.executeQuery()
            ) {
                assertTrue(resultSet.next());

                assertFalse(
                        resultSet.getBoolean(1),
                        "Unexpected column: "
                                + table
                                + "."
                                + column
                );
            }
        }
    }

    private void assertNoTable(
            String table
    ) throws Exception {
        try (
                Connection connection =
                        schemaConnection();

                var statement =
                        connection.prepareStatement(
                                """
                                SELECT EXISTS (
                                    SELECT 1
                                    FROM information_schema.tables
                                    WHERE table_schema = ?
                                    AND table_name = ?
                                )
                                """
                        )
        ) {
            statement.setString(1, schema);
            statement.setString(2, table);

            try (
                    ResultSet resultSet =
                            statement.executeQuery()
            ) {
                assertTrue(resultSet.next());

                assertFalse(
                        resultSet.getBoolean(1),
                        "Unexpected table: "
                                + table
                );
            }
        }
    }

    private void assertFunction(
            String function
    ) throws Exception {
        try (
                Connection connection =
                        schemaConnection();

                var statement =
                        connection.prepareStatement(
                                """
                                SELECT EXISTS (
                                    SELECT 1

                                    FROM pg_proc procedure

                                    JOIN pg_namespace namespace
                                        ON namespace.oid =
                                           procedure.pronamespace

                                    WHERE namespace.nspname = ?
                                    AND procedure.proname = ?
                                )
                                """
                        )
        ) {
            statement.setString(
                    1,
                    schema
            );

            statement.setString(
                    2,
                    function
            );

            try (
                    ResultSet resultSet =
                            statement.executeQuery()
            ) {
                assertTrue(
                        resultSet.next()
                );

                assertTrue(
                        resultSet.getBoolean(
                                1
                        ),
                        "Missing function: "
                                + function
                );
            }
        }
    }

    private Connection schemaConnection()
            throws Exception {
        Connection connection =
                DriverManager.getConnection(
                        baseUrl,
                        username,
                        password
                );

        try (
                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "SET search_path TO "
                            + schema
            );
        }

        return connection;
    }
}
