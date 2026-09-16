package com.procureiq.flywheelremediationoutcome;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.Date;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlywheelRemediationOutcomePostgresTest {

    private static String jdbcUrl;

    private static String jdbcUser;

    private static String jdbcPassword;

    private static String schema;

    private static UUID actorId;

    private static UUID secondActorId;


    @BeforeAll
    static void beforeAll() throws Exception {
        jdbcUrl =
                requiredEnvironment(
                        "PROCUREIQ_STEP79_DB_URL"
                );

        jdbcUser =
                requiredEnvironment(
                        "PROCUREIQ_STEP79_DB_USER"
                );

        jdbcPassword =
                requiredEnvironment(
                        "PROCUREIQ_STEP79_DB_PASSWORD"
                );


        validateDisposableDatabase(
                jdbcUrl
        );


        schema =
                "step79_runtime_"
                + UUID.randomUUID()
                        .toString()
                        .replace(
                                "-",
                                ""
                        );


        try (
                Connection connection =
                        DriverManager.getConnection(
                                jdbcUrl,
                                jdbcUser,
                                jdbcPassword
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "CREATE SCHEMA "
                    + quoteIdentifier(
                            schema
                    )
            );
        }


        Flyway.configure()
                .dataSource(
                        jdbcUrl,
                        jdbcUser,
                        jdbcPassword
                )
                .schemas(
                        schema
                )
                .defaultSchema(
                        schema
                )
                .locations(
                        "classpath:db/migration"
                )
                .load()
                .migrate();


        try (
                Connection connection =
                        connection()
        ) {
            /*
             * Audit capture is validated elsewhere.
             * These tests isolate Step 79 runtime-governance behavior.
             */
            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_outcome_cases
                    DISABLE TRIGGER trg_audit_remediation_outcome_cases
                    """
            );

            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_outcome_items
                    DISABLE TRIGGER trg_audit_remediation_outcome_items
                    """
            );


            actorId =
                    UUID.randomUUID();

            secondActorId =
                    UUID.randomUUID();


            seedUser(
                    connection,
                    actorId
            );

            seedUser(
                    connection,
                    secondActorId
            );
        }
    }


    @AfterAll
    static void afterAll() throws Exception {
        if (
                jdbcUrl == null
                ||
                schema == null
        ) {
            return;
        }

        try (
                Connection connection =
                        DriverManager.getConnection(
                                jdbcUrl,
                                jdbcUser,
                                jdbcPassword
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "DROP SCHEMA IF EXISTS "
                    + quoteIdentifier(
                            schema
                    )
                    + " CASCADE"
            );
        }
    }


    @Test
    void rejectsOutcomeCaseFromDraftRemediationPlan() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan plan =
                    seedPlan(
                            connection,
                            "DRAFT",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "100.00"
                                    )
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertCase(
                                            connection,
                                            plan,
                                            plan.totalResidual()
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires APPROVED or CLOSED"
            );
        }
    }


    @Test
    void acceptsApprovedSourceAndRejectsSourceReconciliationDrift() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan valid =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "60.00"
                                    ),

                                    item(
                                            "WRITE_OFF_REVIEW",
                                            "40.00"
                                    )
                            )
                    );


            UUID caseId =
                    insertCase(
                            connection,
                            valid,
                            valid.totalResidual()
                    );


            assertTrue(
                    rowExists(
                            connection,
                            """
                            SELECT EXISTS (
                                SELECT 1

                                FROM procurement_remediation_outcome_cases

                                WHERE id = ?
                            )
                            """,
                            caseId
                    )
            );


            SQLException duplicate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertCase(
                                            connection,
                                            valid,
                                            valid.totalResidual()
                                    )
                    );


            assertSqlState(
                    duplicate,
                    "23505"
            );


            SeedPlan drift =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "75.00"
                                    )
                            )
                    );


            SQLException mismatch =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertCase(
                                            connection,
                                            drift,
                                            money(
                                                    "74.00"
                                            )
                                    )
                    );


            assertMessageContains(
                    mismatch,
                    "does not reconcile"
            );
        }
    }


    @Test
    void rejectsOutcomeEvidenceCopiedFromWrongSourceAuthority() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan plan =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "100.00"
                                    )
                            )
                    );


            UUID caseId =
                    insertCase(
                            connection,
                            plan,
                            plan.totalResidual()
                    );


            SeedItem source =
                    plan.items()
                            .getFirst();


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItemRaw(
                                            connection,
                                            caseId,
                                            source.id(),
                                            "WRITE_OFF_REVIEW",
                                            source.residual(),
                                            "WRITE_OFF_EVIDENCED",
                                            source.residual(),
                                            source.residual()
                                                    .subtract(
                                                            source.residual()
                                                    ),
                                            "AUTH-DRIFT",
                                            "Forged copied action."
                                    )
                    );


            assertMessageContains(
                    exception,
                    "does not match remediation authority"
            );
        }
    }


    @Test
    void enforcesResolutionCompatibilityAndUnresolvedAmountRules() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan plan =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "100.00"
                                    )
                            )
                    );


            UUID firstCase =
                    insertCase(
                            connection,
                            plan,
                            plan.totalResidual()
                    );


            SeedItem source =
                    plan.items()
                            .getFirst();


            SQLException incompatible =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItemRaw(
                                            connection,
                                            firstCase,
                                            source.id(),
                                            source.action(),
                                            source.residual(),
                                            "WRITE_OFF_EVIDENCED",
                                            source.residual(),
                                            money(
                                                    "0.00"
                                            ),
                                            "BAD-RESOLUTION",
                                            "Incompatible resolution."
                                    )
                    );


            assertSqlState(
                    incompatible,
                    "23514"
            );


            SeedPlan secondPlan =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "50.00"
                                    )
                            )
                    );


            UUID secondCase =
                    insertCase(
                            connection,
                            secondPlan,
                            secondPlan.totalResidual()
                    );


            SeedItem secondSource =
                    secondPlan.items()
                            .getFirst();


            SQLException unresolvedWithAmount =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItemRaw(
                                            connection,
                                            secondCase,
                                            secondSource.id(),
                                            secondSource.action(),
                                            secondSource.residual(),
                                            "UNRESOLVED",
                                            money(
                                                    "1.00"
                                            ),
                                            money(
                                                    "49.00"
                                            ),
                                            "BAD-UNRESOLVED",
                                            "UNRESOLVED cannot resolve value."
                                    )
                    );


            assertSqlState(
                    unresolvedWithAmount,
                    "23514"
            );
        }
    }


    @Test
    void requiresCompleteEvidenceCoverageBeforeSubmission() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan plan =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "60.00"
                                    ),

                                    item(
                                            "WRITE_OFF_REVIEW",
                                            "40.00"
                                    )
                            )
                    );


            UUID caseId =
                    insertCase(
                            connection,
                            plan,
                            plan.totalResidual()
                    );


            SeedItem source =
                    plan.items()
                            .getFirst();


            insertValidOutcomeItem(
                    connection,
                    caseId,
                    source,
                    source.residual()
            );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            caseId
                                    )
                    );


            assertMessageContains(
                    exception,
                    "Every remediation decision requires one outcome evidence record"
            );
        }
    }


    @Test
    void outcomeEvidenceIsImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan plan =
                    oneApprovedRecoveryPlan(
                            connection,
                            "100.00"
                    );


            UUID caseId =
                    insertCase(
                            connection,
                            plan,
                            plan.totalResidual()
                    );


            UUID outcomeItemId =
                    insertValidOutcomeItem(
                            connection,
                            caseId,
                            plan.items()
                                    .getFirst(),
                            money(
                                    "100.00"
                            )
                    );


            SQLException update =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_outcome_items

                                            SET evidence_note = 'tampered'

                                            WHERE id = ?
                                            """,
                                            outcomeItemId
                                    )
                    );


            assertMessageContains(
                    update,
                    "evidence is immutable"
            );


            SQLException delete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            DELETE FROM procurement_remediation_outcome_items

                                            WHERE id = ?
                                            """,
                                            outcomeItemId
                                    )
                    );


            assertMessageContains(
                    delete,
                    "evidence is immutable"
            );
        }
    }


    @Test
    void verificationCannotPrepopulateClosureEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            CaseFixture fixture =
                    fullyResolvedCase(
                            connection
                    );


            submit(
                    connection,
                    fixture.caseId()
            );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_outcome_cases

                                            SET
                                                status = 'VERIFIED',
                                                verified_by_user_id = ?,
                                                verified_at = CURRENT_TIMESTAMP,
                                                verification_note = 'Verified',
                                                closed_by_user_id = ?,
                                                closed_at = CURRENT_TIMESTAMP,
                                                close_note = 'Premature closure',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            actorId,
                                            actorId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    exception,
                    "Verification cannot alter closure evidence"
            );


            verify(
                    connection,
                    fixture.caseId()
            );


            assertEquals(
                    "VERIFIED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_outcome_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );
        }
    }


    @Test
    void closureCannotMutatePriorGovernanceEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            CaseFixture fixture =
                    fullyResolvedCase(
                            connection
                    );


            submit(
                    connection,
                    fixture.caseId()
            );

            verify(
                    connection,
                    fixture.caseId()
            );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_outcome_cases

                                            SET
                                                status = 'CLOSED',
                                                verification_note = 'Tampered verification',
                                                closed_by_user_id = ?,
                                                closed_at = CURRENT_TIMESTAMP,
                                                close_note = 'Close',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            actorId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    exception,
                    "Closure cannot alter submission or verification evidence"
            );
        }
    }


    @Test
    void closureRejectsRemainingResidualAndAllowsZeroResidual() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan partialPlan =
                    oneApprovedRecoveryPlan(
                            connection,
                            "100.00"
                    );


            UUID partialCase =
                    insertCase(
                            connection,
                            partialPlan,
                            partialPlan.totalResidual()
                    );


            insertValidOutcomeItem(
                    connection,
                    partialCase,
                    partialPlan.items()
                            .getFirst(),
                    money(
                            "40.00"
                    )
            );


            submit(
                    connection,
                    partialCase
            );

            verify(
                    connection,
                    partialCase
            );


            SQLException residual =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    close(
                                            connection,
                                            partialCase
                                    )
                    );


            assertMessageContains(
                    residual,
                    "cannot close while financial residual remains"
            );


            CaseFixture zero =
                    fullyResolvedCase(
                            connection
                    );


            submit(
                    connection,
                    zero.caseId()
            );

            verify(
                    connection,
                    zero.caseId()
            );

            close(
                    connection,
                    zero.caseId()
            );


            assertEquals(
                    "CLOSED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_outcome_cases

                            WHERE id = ?
                            """,
                            zero.caseId()
                    )
            );
        }
    }


    @Test
    void snapshotRequiresCompleteCoverageAndAuthoritativeHeader() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SeedPlan incompletePlan =
                    seedPlan(
                            connection,
                            "APPROVED",
                            List.of(
                                    item(
                                            "RECOVERY_FOLLOW_UP",
                                            "60.00"
                                    ),

                                    item(
                                            "WRITE_OFF_REVIEW",
                                            "40.00"
                                    )
                            )
                    );


            UUID incompleteCase =
                    insertCase(
                            connection,
                            incompletePlan,
                            incompletePlan.totalResidual()
                    );


            insertValidOutcomeItem(
                    connection,
                    incompleteCase,
                    incompletePlan.items()
                            .getFirst(),
                    money(
                            "60.00"
                    )
            );


            SQLException incomplete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotHeader(
                                            connection,
                                            incompleteCase,
                                            null
                                    )
                    );


            assertMessageContains(
                    incomplete,
                    "requires complete outcome evidence coverage"
            );


            CaseFixture complete =
                    fullyResolvedCase(
                            connection
                    );


            SQLException forgedHeader =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotHeader(
                                            connection,
                                            complete.caseId(),
                                            "FORGED TITLE"
                                    )
                    );


            assertMessageContains(
                    forgedHeader,
                    "header does not match authoritative case state"
            );
        }
    }


    @Test
    void snapshotItemsMustMatchAuthoritativeOutcomeEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            CaseFixture fixture =
                    fullyResolvedCase(
                            connection
                    );


            UUID snapshotId =
                    insertSnapshotHeader(
                            connection,
                            fixture.caseId(),
                            null
                    );


            OutcomeRow row =
                    outcomeRow(
                            connection,
                            fixture.outcomeItemIds()
                                    .getFirst()
                    );


            SQLException forged =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotItem(
                                            connection,
                                            snapshotId,
                                            row,
                                            "FORGED EVIDENCE"
                                    )
                    );


            assertMessageContains(
                    forged,
                    "does not match authoritative remediation outcome evidence"
            );


            insertSnapshotItem(
                    connection,
                    snapshotId,
                    row,
                    null
            );
        }
    }


    @Test
    void sealedSnapshotReconcilesAndBecomesImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            CaseFixture fixture =
                    fullyResolvedCase(
                            connection
                    );


            UUID snapshotId =
                    insertSnapshotHeader(
                            connection,
                            fixture.caseId(),
                            null
                    );


            for (
                    UUID itemId
                    : fixture.outcomeItemIds()
            ) {
                insertSnapshotItem(
                        connection,
                        snapshotId,
                        outcomeRow(
                                connection,
                                itemId
                        ),
                        null
                );
            }


            SQLException tamperedSeal =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_outcome_snapshots

                                            SET
                                                title = 'Tampered',
                                                sealed = TRUE

                                            WHERE id = ?
                                            """,
                                            snapshotId
                                    )
                    );


            assertMessageContains(
                    tamperedSeal,
                    "Snapshot content cannot change while sealing"
            );


            update(
                    connection,
                    """
                    UPDATE procurement_remediation_outcome_snapshots

                    SET sealed = TRUE

                    WHERE id = ?
                    """,
                    snapshotId
            );


            assertTrue(
                    queryBoolean(
                            connection,
                            """
                            SELECT sealed

                            FROM procurement_remediation_outcome_snapshots

                            WHERE id = ?
                            """,
                            snapshotId
                    )
            );


            OutcomeRow authoritative =
                    outcomeRow(
                            connection,
                            fixture.outcomeItemIds()
                                    .getFirst()
                    );


            SQLException append =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotItem(
                                            connection,
                                            snapshotId,
                                            authoritative,
                                            null
                                    )
                    );


            /*
             * Depending on uniqueness evaluation order PostgreSQL may report
             * either the sealing trigger or the unique constraint first.
             */
            assertTrue(
                    messageChain(
                            append
                    ).contains(
                            "sealed"
                    )
                    ||
                    "23505".equals(
                            append.getSQLState()
                    )
            );


            SQLException mutate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_outcome_snapshots

                                            SET title = 'Later tampering'

                                            WHERE id = ?
                                            """,
                                            snapshotId
                                    )
                    );


            assertMessageContains(
                    mutate,
                    "immutable after creation"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * FIXTURES
     * -----------------------------------------------------------------------
     */

    private static CaseFixture fullyResolvedCase(
            Connection connection
    ) throws SQLException {
        SeedPlan plan =
                seedPlan(
                        connection,
                        "APPROVED",
                        List.of(
                                item(
                                        "RECOVERY_FOLLOW_UP",
                                        "100.00"
                                )
                        )
                );


        UUID caseId =
                insertCase(
                        connection,
                        plan,
                        plan.totalResidual()
                );


        UUID outcomeItemId =
                insertValidOutcomeItem(
                        connection,
                        caseId,
                        plan.items()
                                .getFirst(),
                        plan.items()
                                .getFirst()
                                .residual()
                );


        return new CaseFixture(
                caseId,
                List.of(
                        outcomeItemId
                )
        );
    }


    private static SeedPlan oneApprovedRecoveryPlan(
            Connection connection,
            String amount
    ) throws SQLException {
        return seedPlan(
                connection,
                "APPROVED",
                List.of(
                        item(
                                "RECOVERY_FOLLOW_UP",
                                amount
                        )
                )
        );
    }


    private static SeedItemSpec item(
            String action,
            String amount
    ) {
        return new SeedItemSpec(
                action,
                money(
                        amount
                )
        );
    }


    private static SeedPlan seedPlan(
            Connection connection,
            String status,
            List<SeedItemSpec> specs
    ) throws SQLException {
        UUID planId =
                UUID.randomUUID();

        UUID sourceExecutionCaseId =
                UUID.randomUUID();


        BigDecimal total =
                specs.stream()
                        .map(
                                SeedItemSpec::residual
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        List<SeedItem> items =
                new ArrayList<>();


        execute(
                connection,
                "SET session_replication_role = replica"
        );


        try {
            try (
                    PreparedStatement statement =
                            connection.prepareStatement(
                                    """
                                    INSERT INTO procurement_residual_remediation_plans (
                                        id,
                                        plan_number,
                                        source_execution_case_id,
                                        title,
                                        currency,
                                        fiscal_year,
                                        source_residual_amount,
                                        source_positive_item_count,
                                        owner_user_id,
                                        owner_name,
                                        remediation_objective,
                                        status,
                                        version,
                                        created_by_user_id,
                                        created_at,
                                        updated_at
                                    )
                                    VALUES (
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        'USD',
                                        2026,
                                        ?,
                                        ?,
                                        ?,
                                        'Step 79 User',
                                        'Step 79 runtime assurance fixture',
                                        ?,
                                        0,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        CURRENT_TIMESTAMP
                                    )
                                    """
                            )
            ) {
                statement.setObject(
                        1,
                        planId
                );

                statement.setString(
                        2,
                        "RRP-STEP79-"
                        + shortId()
                );

                statement.setObject(
                        3,
                        sourceExecutionCaseId
                );

                statement.setString(
                        4,
                        "Step 79 remediation fixture"
                );

                statement.setBigDecimal(
                        5,
                        total
                );

                statement.setInt(
                        6,
                        specs.size()
                );

                statement.setObject(
                        7,
                        actorId
                );

                statement.setString(
                        8,
                        status
                );

                statement.setObject(
                        9,
                        actorId
                );

                statement.executeUpdate();
            }


            for (
                    SeedItemSpec spec
                    : specs
            ) {
                UUID itemId =
                        UUID.randomUUID();

                UUID sourceExecutionItemId =
                        UUID.randomUUID();


                BigDecimal executed =
                        money(
                                "10.00"
                        );

                BigDecimal sourceVariance =
                        spec.residual()
                                .add(
                                        executed
                                );


                try (
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        """
                                        INSERT INTO procurement_residual_remediation_items (
                                            id,
                                            remediation_plan_id,
                                            source_execution_item_id,
                                            source_decision,
                                            source_variance_amount,
                                            source_executed_amount,
                                            residual_amount,
                                            remediation_action,
                                            target_date,
                                            rationale,
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
                                            'Step 79 runtime fixture',
                                            ?,
                                            CURRENT_TIMESTAMP
                                        )
                                        """
                                )
                ) {
                    statement.setObject(
                            1,
                            itemId
                    );

                    statement.setObject(
                            2,
                            planId
                    );

                    statement.setObject(
                            3,
                            sourceExecutionItemId
                    );

                    statement.setString(
                            4,
                            sourceDecisionFor(
                                    spec.action()
                            )
                    );

                    statement.setBigDecimal(
                            5,
                            sourceVariance
                    );

                    statement.setBigDecimal(
                            6,
                            executed
                    );

                    statement.setBigDecimal(
                            7,
                            spec.residual()
                    );

                    statement.setString(
                            8,
                            spec.action()
                    );

                    statement.setDate(
                            9,
                            Date.valueOf(
                                    LocalDate.now()
                                            .plusDays(
                                                    30
                                            )
                            )
                    );

                    statement.setObject(
                            10,
                            actorId
                    );

                    statement.executeUpdate();
                }


                items.add(
                        new SeedItem(
                                itemId,
                                spec.action(),
                                spec.residual()
                        )
                );
            }

        } finally {
            execute(
                    connection,
                    "SET session_replication_role = origin"
            );
        }


        return new SeedPlan(
                planId,
                total,
                List.copyOf(
                        items
                )
        );
    }


    private static UUID insertCase(
            Connection connection,
            SeedPlan plan,
            BigDecimal copiedSourceAmount
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_outcome_cases (
                                    id,
                                    outcome_number,
                                    source_remediation_plan_id,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_residual_amount,
                                    source_item_count,
                                    owner_user_id,
                                    owner_name,
                                    status,
                                    version,
                                    created_by_user_id,
                                    created_at,
                                    updated_at
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    ?,
                                    'Step 79 outcome assurance',
                                    'USD',
                                    2026,
                                    ?,
                                    ?,
                                    ?,
                                    'Step 79 User',
                                    'DRAFT',
                                    0,
                                    ?,
                                    CURRENT_TIMESTAMP,
                                    CURRENT_TIMESTAMP
                                )
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    id
            );

            statement.setString(
                    2,
                    "ROC-STEP79-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    plan.planId()
            );

            statement.setBigDecimal(
                    4,
                    copiedSourceAmount
            );

            statement.setInt(
                    5,
                    plan.items()
                            .size()
            );

            statement.setObject(
                    6,
                    actorId
            );

            statement.setObject(
                    7,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static UUID insertValidOutcomeItem(
            Connection connection,
            UUID caseId,
            SeedItem source,
            BigDecimal resolvedAmount
    ) throws SQLException {
        String resolution =
                switch (
                        source.action()
                ) {
                    case "RECOVERY_FOLLOW_UP" ->
                            "RECOVERY_EVIDENCED";

                    case "WRITE_OFF_REVIEW" ->
                            "WRITE_OFF_EVIDENCED";

                    case "INVESTIGATION_ESCALATION" ->
                            "INVESTIGATION_RESOLVED";

                    case "RESIDUAL_ACCEPTANCE_REVIEW" ->
                            "RISK_ACCEPTANCE_EVIDENCED";

                    default ->
                            throw new IllegalArgumentException(
                                    "Unknown source action: "
                                    + source.action()
                            );
                };


        return insertOutcomeItemRaw(
                connection,
                caseId,
                source.id(),
                source.action(),
                source.residual(),
                resolution,
                resolvedAmount,
                source.residual()
                        .subtract(
                                resolvedAmount
                        ),
                "EVIDENCE-"
                + shortId(),
                "Step 79 authoritative evidence."
        );
    }


    private static UUID insertOutcomeItemRaw(
            Connection connection,
            UUID caseId,
            UUID sourceItemId,
            String sourceAction,
            BigDecimal sourceAmount,
            String resolution,
            BigDecimal resolved,
            BigDecimal remaining,
            String reference,
            String note
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_outcome_items (
                                    id,
                                    outcome_case_id,
                                    source_remediation_item_id,
                                    source_action,
                                    source_residual_amount,
                                    resolution_type,
                                    resolved_amount,
                                    remaining_residual_amount,
                                    observed_on,
                                    evidence_reference,
                                    evidence_note,
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
                                    CURRENT_TIMESTAMP
                                )
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    id
            );

            statement.setObject(
                    2,
                    caseId
            );

            statement.setObject(
                    3,
                    sourceItemId
            );

            statement.setString(
                    4,
                    sourceAction
            );

            statement.setBigDecimal(
                    5,
                    sourceAmount
            );

            statement.setString(
                    6,
                    resolution
            );

            statement.setBigDecimal(
                    7,
                    resolved
            );

            statement.setBigDecimal(
                    8,
                    remaining
            );

            statement.setDate(
                    9,
                    Date.valueOf(
                            LocalDate.now()
                    )
            );

            statement.setString(
                    10,
                    reference
            );

            statement.setString(
                    11,
                    note
            );

            statement.setObject(
                    12,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static void submit(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        update(
                connection,
                """
                UPDATE procurement_remediation_outcome_cases

                SET
                    status = 'IN_REVIEW',
                    review_submitted_by_user_id = ?,
                    review_submitted_at = CURRENT_TIMESTAMP,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                actorId,
                caseId
        );
    }


    private static void verify(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        update(
                connection,
                """
                UPDATE procurement_remediation_outcome_cases

                SET
                    status = 'VERIFIED',
                    verified_by_user_id = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    verification_note = 'Verified by Step 79',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                secondActorId,
                caseId
        );
    }


    private static void close(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        update(
                connection,
                """
                UPDATE procurement_remediation_outcome_cases

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = 'Closed by Step 79',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                secondActorId,
                caseId
        );
    }


    private static UUID insertSnapshotHeader(
            Connection connection,
            UUID caseId,
            String titleOverride
    ) throws SQLException {
        CaseRow row =
                caseRow(
                        connection,
                        caseId
                );


        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_outcome_snapshots (
                                    id,
                                    snapshot_number,
                                    outcome_case_id,
                                    outcome_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_residual_amount,
                                    resolved_amount,
                                    remaining_residual_amount,
                                    item_count,
                                    unresolved_item_count,
                                    outcome_status,
                                    captured_by_user_id,
                                    captured_at,
                                    sealed
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
                                    CURRENT_TIMESTAMP,
                                    FALSE
                                )
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    id
            );

            statement.setString(
                    2,
                    "ROS-STEP79-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    caseId
            );

            statement.setString(
                    4,
                    row.outcomeNumber()
            );

            statement.setString(
                    5,
                    titleOverride == null
                            ? row.title()
                            : titleOverride
            );

            statement.setString(
                    6,
                    row.currency()
            );

            statement.setInt(
                    7,
                    row.fiscalYear()
            );

            statement.setBigDecimal(
                    8,
                    row.sourceResidual()
            );

            statement.setBigDecimal(
                    9,
                    row.resolved()
            );

            statement.setBigDecimal(
                    10,
                    row.remaining()
            );

            statement.setInt(
                    11,
                    row.itemCount()
            );

            statement.setInt(
                    12,
                    row.unresolvedCount()
            );

            statement.setString(
                    13,
                    row.status()
            );

            statement.setObject(
                    14,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static void insertSnapshotItem(
            Connection connection,
            UUID snapshotId,
            OutcomeRow row,
            String noteOverride
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_outcome_snapshot_items (
                                    id,
                                    snapshot_id,
                                    outcome_item_id,
                                    source_remediation_item_id,
                                    source_action,
                                    source_residual_amount,
                                    resolution_type,
                                    resolved_amount,
                                    remaining_residual_amount,
                                    observed_on,
                                    evidence_reference,
                                    evidence_note
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
                                    ?
                                )
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    UUID.randomUUID()
            );

            statement.setObject(
                    2,
                    snapshotId
            );

            statement.setObject(
                    3,
                    row.id()
            );

            statement.setObject(
                    4,
                    row.sourceRemediationItemId()
            );

            statement.setString(
                    5,
                    row.sourceAction()
            );

            statement.setBigDecimal(
                    6,
                    row.sourceResidual()
            );

            statement.setString(
                    7,
                    row.resolutionType()
            );

            statement.setBigDecimal(
                    8,
                    row.resolved()
            );

            statement.setBigDecimal(
                    9,
                    row.remaining()
            );

            statement.setDate(
                    10,
                    Date.valueOf(
                            row.observedOn()
                    )
            );

            statement.setString(
                    11,
                    row.evidenceReference()
            );

            statement.setString(
                    12,
                    noteOverride == null
                            ? row.evidenceNote()
                            : noteOverride
            );

            statement.executeUpdate();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * READ HELPERS
     * -----------------------------------------------------------------------
     */

    private static CaseRow caseRow(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    outcome.outcome_number,
                                    outcome.title,
                                    outcome.currency,
                                    outcome.fiscal_year,
                                    outcome.source_residual_amount,
                                    outcome.status,

                                    COALESCE(
                                        SUM(
                                            item.resolved_amount
                                        ),
                                        0
                                    ) AS resolved_amount,

                                    COALESCE(
                                        SUM(
                                            item.remaining_residual_amount
                                        ),
                                        outcome.source_residual_amount
                                    ) AS remaining_residual_amount,

                                    COUNT(
                                        item.id
                                    ) AS item_count,

                                    COUNT(
                                        item.id
                                    )
                                    FILTER (
                                        WHERE item.remaining_residual_amount > 0
                                    ) AS unresolved_item_count

                                FROM procurement_remediation_outcome_cases outcome

                                LEFT JOIN procurement_remediation_outcome_items item
                                    ON item.outcome_case_id =
                                       outcome.id

                                WHERE outcome.id = ?

                                GROUP BY
                                    outcome.id
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    caseId
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                if (!result.next()) {
                    throw new SQLException(
                            "Outcome case not found"
                    );
                }


                return new CaseRow(
                        result.getString(
                                "outcome_number"
                        ),
                        result.getString(
                                "title"
                        ),
                        result.getString(
                                "currency"
                        ),
                        result.getInt(
                                "fiscal_year"
                        ),
                        result.getBigDecimal(
                                "source_residual_amount"
                        ),
                        result.getBigDecimal(
                                "resolved_amount"
                        ),
                        result.getBigDecimal(
                                "remaining_residual_amount"
                        ),
                        result.getInt(
                                "item_count"
                        ),
                        result.getInt(
                                "unresolved_item_count"
                        ),
                        result.getString(
                                "status"
                        )
                );
            }
        }
    }


    private static OutcomeRow outcomeRow(
            Connection connection,
            UUID id
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    id,
                                    source_remediation_item_id,
                                    source_action,
                                    source_residual_amount,
                                    resolution_type,
                                    resolved_amount,
                                    remaining_residual_amount,
                                    observed_on,
                                    evidence_reference,
                                    evidence_note

                                FROM procurement_remediation_outcome_items

                                WHERE id = ?
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    id
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                if (!result.next()) {
                    throw new SQLException(
                            "Outcome item not found"
                    );
                }


                return new OutcomeRow(
                        result.getObject(
                                "id",
                                UUID.class
                        ),
                        result.getObject(
                                "source_remediation_item_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_action"
                        ),
                        result.getBigDecimal(
                                "source_residual_amount"
                        ),
                        result.getString(
                                "resolution_type"
                        ),
                        result.getBigDecimal(
                                "resolved_amount"
                        ),
                        result.getBigDecimal(
                                "remaining_residual_amount"
                        ),
                        result.getObject(
                                "observed_on",
                                LocalDate.class
                        ),
                        result.getString(
                                "evidence_reference"
                        ),
                        result.getString(
                                "evidence_note"
                        )
                );
            }
        }
    }


    /*
     * -----------------------------------------------------------------------
     * USER SEEDING
     * -----------------------------------------------------------------------
     */

    private static void seedUser(
            Connection connection,
            UUID id
    ) throws SQLException {
        List<ColumnDefinition> definitions =
                new ArrayList<>();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    column_name,
                                    data_type,
                                    udt_name,
                                    is_nullable,
                                    column_default,
                                    is_identity,
                                    is_generated

                                FROM information_schema.columns

                                WHERE table_schema = ?

                                AND table_name = 'app_users'

                                ORDER BY ordinal_position
                                """
                        )
        ) {
            statement.setString(
                    1,
                    schema
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                while (result.next()) {
                    definitions.add(
                            new ColumnDefinition(
                                    result.getString(
                                            "column_name"
                                    ),
                                    result.getString(
                                            "data_type"
                                    ),
                                    result.getString(
                                            "udt_name"
                                    ),
                                    result.getString(
                                            "is_nullable"
                                    ),
                                    result.getString(
                                            "column_default"
                                    ),
                                    result.getString(
                                            "is_identity"
                                    ),
                                    result.getString(
                                            "is_generated"
                                    )
                            )
                    );
                }
            }
        }


        if (definitions.isEmpty()) {
            throw new SQLException(
                    "app_users metadata was not found"
            );
        }


        List<ColumnDefinition> insert =
                definitions.stream()
                        .filter(
                                column ->
                                        shouldSeed(
                                                column
                                        )
                        )
                        .toList();


        String columns =
                insert.stream()
                        .map(
                                column ->
                                        quoteIdentifier(
                                                column.name()
                                        )
                        )
                        .reduce(
                                (
                                        left,
                                        right
                                ) ->
                                        left
                                        + ", "
                                        + right
                        )
                        .orElseThrow();


        String placeholders =
                String.join(
                        ", ",
                        java.util.Collections.nCopies(
                                insert.size(),
                                "?"
                        )
                );


        execute(
                connection,
                "SET session_replication_role = replica"
        );


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                "INSERT INTO app_users ("
                                + columns
                                + ") VALUES ("
                                + placeholders
                                + ")"
                        )
        ) {
            int index = 1;

            for (
                    ColumnDefinition column
                    : insert
            ) {
                bindUserValue(
                        statement,
                        index++,
                        column,
                        id
                );
            }


            statement.executeUpdate();

        } finally {
            execute(
                    connection,
                    "SET session_replication_role = origin"
            );
        }
    }


    private static boolean shouldSeed(
            ColumnDefinition column
    ) {
        String name =
                column.name()
                        .toLowerCase(
                                Locale.ROOT
                        );


        if (
                "YES".equalsIgnoreCase(
                        column.identity()
                )
                ||
                (
                        column.generated() != null

                        &&

                        !"NEVER".equalsIgnoreCase(
                                column.generated()
                        )
                )
        ) {
            return false;
        }


        if (
                name.equals(
                        "id"
                )
                ||
                name.equals(
                        "email"
                )
                ||
                name.equals(
                        "password_hash"
                )
                ||
                name.equals(
                        "full_name"
                )
                ||
                name.equals(
                        "role"
                )
                ||
                name.equals(
                        "active"
                )
        ) {
            return true;
        }


        return
                "NO".equalsIgnoreCase(
                        column.nullable()
                )
                &&
                column.defaultValue() == null;
    }


    private static void bindUserValue(
            PreparedStatement statement,
            int index,
            ColumnDefinition column,
            UUID id
    ) throws SQLException {
        String name =
                column.name()
                        .toLowerCase(
                                Locale.ROOT
                        );


        if (
                name.equals(
                        "id"
                )
        ) {
            statement.setObject(
                    index,
                    id
            );

            return;
        }


        if (
                name.contains(
                        "email"
                )
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "step79-"
                    + id
                    + "@example.test"
            );

            return;
        }


        if (
                name.contains(
                        "password"
                )
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "step79-test-password-hash"
            );

            return;
        }


        if (
                name.equals(
                        "full_name"
                )
                ||
                name.equals(
                        "name"
                )
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "Step 79 Runtime User"
            );

            return;
        }


        if (
                name.equals(
                        "role"
                )
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "ADMIN"
            );

            return;
        }


        if (
                name.contains(
                        "status"
                )
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "ACTIVE"
            );

            return;
        }


        if (
                name.equals(
                        "active"
                )
        ) {
            statement.setBoolean(
                    index,
                    true
            );

            return;
        }


        String type =
                column.dataType()
                        .toLowerCase(
                                Locale.ROOT
                        );


        switch (
                type
        ) {
            case "uuid" ->
                    statement.setObject(
                            index,
                            UUID.randomUUID()
                    );

            case "boolean" ->
                    statement.setBoolean(
                            index,
                            true
                    );

            case "smallint",
                 "integer" ->
                    statement.setInt(
                            index,
                            1
                    );

            case "bigint" ->
                    statement.setLong(
                            index,
                            1L
                    );

            case "numeric",
                 "decimal",
                 "real",
                 "double precision" ->
                    statement.setBigDecimal(
                            index,
                            BigDecimal.ONE
                    );

            case "date" ->
                    statement.setDate(
                            index,
                            Date.valueOf(
                                    LocalDate.now()
                            )
                    );

            case "timestamp without time zone",
                 "timestamp with time zone" ->
                    statement.setTimestamp(
                            index,
                            Timestamp.from(
                                    Instant.now()
                            )
                    );

            case "character varying",
                 "character",
                 "text" ->
                    statement.setString(
                            index,
                            "STEP79-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP79",
                            Types.OTHER
                    );

            default ->
                    throw new SQLException(
                            "Unsupported mandatory app_users column: "
                            + column.name()
                            + " type="
                            + column.dataType()
                    );
        }
    }


    private static void setText(
            PreparedStatement statement,
            int index,
            ColumnDefinition column,
            String value
    ) throws SQLException {
        if (
                "USER-DEFINED".equalsIgnoreCase(
                        column.dataType()
                )
        ) {
            statement.setObject(
                    index,
                    value,
                    Types.OTHER
            );

        } else {
            statement.setString(
                    index,
                    value
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * SQL HELPERS
     * -----------------------------------------------------------------------
     */

    private static Connection connection() throws SQLException {
        Connection connection =
                DriverManager.getConnection(
                        jdbcUrl,
                        jdbcUser,
                        jdbcPassword
                );


        try (
                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "SET search_path TO "
                    + quoteIdentifier(
                            schema
                    )
            );
        }


        return connection;
    }


    private static void execute(
            Connection connection,
            String sql
    ) throws SQLException {
        try (
                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    sql
            );
        }
    }


    private static int update(
            Connection connection,
            String sql,
            Object... values
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                sql
                        )
        ) {
            for (
                    int index = 0;
                    index < values.length;
                    index++
            ) {
                statement.setObject(
                        index + 1,
                        values[index]
                );
            }


            return statement.executeUpdate();
        }
    }


    private static boolean rowExists(
            Connection connection,
            String sql,
            Object value
    ) throws SQLException {
        return queryBoolean(
                connection,
                sql,
                value
        );
    }


    private static boolean queryBoolean(
            Connection connection,
            String sql,
            Object value
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                sql
                        )
        ) {
            statement.setObject(
                    1,
                    value
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                if (!result.next()) {
                    throw new SQLException(
                            "Expected boolean result"
                    );
                }


                return result.getBoolean(
                        1
                );
            }
        }
    }


    private static String queryString(
            Connection connection,
            String sql,
            Object value
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                sql
                        )
        ) {
            statement.setObject(
                    1,
                    value
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                if (!result.next()) {
                    throw new SQLException(
                            "Expected string result"
                    );
                }


                return result.getString(
                        1
                );
            }
        }
    }


    private static void assertMessageContains(
            SQLException exception,
            String token
    ) {
        assertTrue(
                messageChain(
                        exception
                )
                        .toLowerCase(
                                Locale.ROOT
                        )
                        .contains(
                                token.toLowerCase(
                                        Locale.ROOT
                                )
                        ),
                () ->
                        "Expected SQL exception message to contain '"
                        + token
                        + "' but was: "
                        + messageChain(
                                exception
                        )
        );
    }


    private static void assertSqlState(
            SQLException exception,
            String expected
    ) {
        SQLException cursor =
                exception;


        while (cursor != null) {
            if (
                    expected.equals(
                            cursor.getSQLState()
                    )
            ) {
                return;
            }

            cursor =
                    cursor.getNextException();
        }


        throw new AssertionError(
                "Expected SQL state "
                + expected
                + " but received "
                + exception.getSQLState()
                + " message="
                + messageChain(
                        exception
                )
        );
    }


    private static String messageChain(
            SQLException exception
    ) {
        StringBuilder result =
                new StringBuilder();


        SQLException cursor =
                exception;


        while (cursor != null) {
            if (
                    cursor.getMessage() != null
            ) {
                if (!result.isEmpty()) {
                    result.append(
                            " | "
                    );
                }

                result.append(
                        cursor.getMessage()
                );
            }

            cursor =
                    cursor.getNextException();
        }


        return result.toString();
    }


    private static BigDecimal money(
            String value
    ) {
        return new BigDecimal(
                value
        ).setScale(
                2
        );
    }


    private static String sourceDecisionFor(
            String action
    ) {
        return switch (
                action
        ) {
            case "RECOVERY_FOLLOW_UP" ->
                    "RECOVER";

            case "WRITE_OFF_REVIEW" ->
                    "WRITE_OFF";

            case "INVESTIGATION_ESCALATION",
                 "RESIDUAL_ACCEPTANCE_REVIEW" ->
                    "INVESTIGATE";

            default ->
                    throw new IllegalArgumentException(
                            "Unknown action: "
                            + action
                    );
        };
    }


    private static String shortId() {
        return UUID.randomUUID()
                .toString()
                .replace(
                        "-",
                        ""
                )
                .substring(
                        0,
                        12
                );
    }


    private static String requiredEnvironment(
            String name
    ) {
        String value =
                System.getenv(
                        name
                );


        if (
                value == null
                ||
                value.isBlank()
        ) {
            throw new IllegalStateException(
                    "Missing required environment variable: "
                    + name
            );
        }


        return value;
    }


    private static void validateDisposableDatabase(
            String url
    ) {
        if (
                !url.startsWith(
                        "jdbc:postgresql://127.0.0.1:"
                )
        ) {
            throw new IllegalStateException(
                    "Step 79 PostgreSQL tests require loopback PostgreSQL."
            );
        }


        if (
                !url.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 79 PostgreSQL tests require the disposable procureiq_step70 database."
            );
        }
    }


    private static String quoteIdentifier(
            String value
    ) {
        return "\""
               + value.replace(
                        "\"",
                        "\"\""
                )
               + "\"";
    }


    /*
     * -----------------------------------------------------------------------
     * RECORDS
     * -----------------------------------------------------------------------
     */

    private record SeedItemSpec(
            String action,
            BigDecimal residual
    ) {
    }


    private record SeedItem(
            UUID id,
            String action,
            BigDecimal residual
    ) {
    }


    private record SeedPlan(
            UUID planId,
            BigDecimal totalResidual,
            List<SeedItem> items
    ) {
    }


    private record CaseFixture(
            UUID caseId,
            List<UUID> outcomeItemIds
    ) {
    }


    private record CaseRow(
            String outcomeNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal sourceResidual,
            BigDecimal resolved,
            BigDecimal remaining,
            int itemCount,
            int unresolvedCount,
            String status
    ) {
    }


    private record OutcomeRow(
            UUID id,
            UUID sourceRemediationItemId,
            String sourceAction,
            BigDecimal sourceResidual,
            String resolutionType,
            BigDecimal resolved,
            BigDecimal remaining,
            LocalDate observedOn,
            String evidenceReference,
            String evidenceNote
    ) {
    }


    private record ColumnDefinition(
            String name,
            String dataType,
            String udtName,
            String nullable,
            String defaultValue,
            String identity,
            String generated
    ) {
    }
}
