package com.procureiq.flywheelcontinuation;

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
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlywheelResidualContinuationPostgresTest {

    private static String jdbcUrl;

    private static String jdbcUser;

    private static String jdbcPassword;

    private static String schema;

    private static UUID actorId;

    private static UUID managerId;


    @BeforeAll
    static void beforeAll() throws Exception {
        jdbcUrl =
                requiredEnvironment(
                        "PROCUREIQ_STEP82_DB_URL"
                );

        jdbcUser =
                requiredEnvironment(
                        "PROCUREIQ_STEP82_DB_USER"
                );

        jdbcPassword =
                requiredEnvironment(
                        "PROCUREIQ_STEP82_DB_PASSWORD"
                );


        validateDisposableDatabase(
                jdbcUrl
        );


        schema =
                "step82_runtime_"
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
             * Audit behavior is covered by its own infrastructure.
             * Step 82 isolates continuation-governance invariants.
             */
            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_cases
                    DISABLE TRIGGER trg_audit_remediation_continuation_cases
                    """
            );

            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_items
                    DISABLE TRIGGER trg_audit_remediation_continuation_items
                    """
            );


            actorId =
                    UUID.randomUUID();

            managerId =
                    UUID.randomUUID();


            seedUser(
                    connection,
                    actorId
            );

            seedUser(
                    connection,
                    managerId
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


    /*
     * -----------------------------------------------------------------------
     * 1
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsContinuationFromNonVerifiedOutcome() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "IN_REVIEW",
                            List.of(
                                    recoveryItem(
                                            "100.00",
                                            "40.00"
                                    )
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationCase(
                                            connection,
                                            source,
                                            source.remainingTotal(),
                                            source.positiveCount(),
                                            source.currency()
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires VERIFIED remediation outcome"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsContinuationWithoutPositiveResidual() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            List.of(
                                    recoveryItem(
                                            "100.00",
                                            "100.00"
                                    )
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationCase(
                                            connection,
                                            source,
                                            money(
                                                    "1.00"
                                            ),
                                            1,
                                            source.currency()
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires positive remaining exposure"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 3
     * -----------------------------------------------------------------------
     */


    @Test
    void acceptsVerifiedResidualAndRejectsDuplicateSourceCase() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    verifiedRecoveryOutcome(
                            connection,
                            "100.00",
                            "40.00"
                    );


            UUID continuationId =
                    insertContinuationCase(
                            connection,
                            source,
                            source.remainingTotal(),
                            source.positiveCount(),
                            source.currency()
                    );


            assertTrue(
                    queryBoolean(
                            connection,
                            """
                            SELECT EXISTS (
                                SELECT 1

                                FROM procurement_remediation_continuation_cases

                                WHERE id = ?
                            )
                            """,
                            continuationId
                    )
            );


            SQLException duplicate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationCase(
                                            connection,
                                            source,
                                            source.remainingTotal(),
                                            source.positiveCount(),
                                            source.currency()
                                    )
                    );


            assertSqlState(
                    duplicate,
                    "23505"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 4
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsForgedContinuationCaseAuthority() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    verifiedRecoveryOutcome(
                            connection,
                            "100.00",
                            "40.00"
                    );


            SQLException amount =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationCase(
                                            connection,
                                            source,
                                            money(
                                                    "59.00"
                                            ),
                                            source.positiveCount(),
                                            source.currency()
                                    )
                    );


            assertMessageContains(
                    amount,
                    "source authority does not reconcile"
            );


            OutcomeSeed second =
                    verifiedRecoveryOutcome(
                            connection,
                            "80.00",
                            "20.00"
                    );


            SQLException currency =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationCase(
                                            connection,
                                            second,
                                            second.remainingTotal(),
                                            second.positiveCount(),
                                            "EUR"
                                    )
                    );


            assertMessageContains(
                    currency,
                    "source authority does not reconcile"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsContinuationItemFromAnotherOutcomeAndWrongAction() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed first =
                    verifiedRecoveryOutcome(
                            connection,
                            "100.00",
                            "40.00"
                    );


            OutcomeSeed second =
                    verifiedRecoveryOutcome(
                            connection,
                            "70.00",
                            "20.00"
                    );


            UUID continuationId =
                    insertContinuationCase(
                            connection,
                            first,
                            first.remainingTotal(),
                            first.positiveCount(),
                            first.currency()
                    );


            OutcomeItem foreignItem =
                    second.items()
                            .getFirst();


            SQLException foreign =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationItemRaw(
                                            connection,
                                            continuationId,
                                            foreignItem,
                                            expectedContinuationAction(
                                                    foreignItem.sourceAction()
                                            ),
                                            LocalDate.now()
                                                    .plusDays(
                                                            10
                                                    ),
                                            "Foreign source."
                                    )
                    );


            assertMessageContains(
                    foreign,
                    "belongs to another outcome case"
            );


            OutcomeItem source =
                    first.items()
                            .getFirst();


            SQLException wrongAction =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationItemRaw(
                                            connection,
                                            continuationId,
                                            source,
                                            "WRITE_OFF_ESCALATION",
                                            LocalDate.now()
                                                    .plusDays(
                                                            10
                                                    ),
                                            "Wrong action."
                                    )
                    );


            assertMessageContains(
                    wrongAction,
                    "does not match source remediation authority"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsPastTargetDateAndBlankRationaleAtDatabaseBoundary() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed first =
                    verifiedRecoveryOutcome(
                            connection,
                            "100.00",
                            "40.00"
                    );


            UUID firstCase =
                    insertContinuationCase(
                            connection,
                            first,
                            first.remainingTotal(),
                            first.positiveCount(),
                            first.currency()
                    );


            OutcomeItem firstItem =
                    first.items()
                            .getFirst();


            SQLException past =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationItemRaw(
                                            connection,
                                            firstCase,
                                            firstItem,
                                            expectedContinuationAction(
                                                    firstItem.sourceAction()
                                            ),
                                            LocalDate.now()
                                                    .minusDays(
                                                            1
                                                    ),
                                            "Past target."
                                    )
                    );


            assertMessageContains(
                    past,
                    "target date cannot be in the past"
            );


            OutcomeSeed second =
                    verifiedRecoveryOutcome(
                            connection,
                            "80.00",
                            "20.00"
                    );


            UUID secondCase =
                    insertContinuationCase(
                            connection,
                            second,
                            second.remainingTotal(),
                            second.positiveCount(),
                            second.currency()
                    );


            OutcomeItem secondItem =
                    second.items()
                            .getFirst();


            SQLException blank =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertContinuationItemRaw(
                                            connection,
                                            secondCase,
                                            secondItem,
                                            expectedContinuationAction(
                                                    secondItem.sourceAction()
                                            ),
                                            LocalDate.now()
                                                    .plusDays(
                                                            10
                                                    ),
                                            " "
                                    )
                    );


            assertMessageContains(
                    blank,
                    "Continuation rationale is required"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 7
     * -----------------------------------------------------------------------
     */


    @Test
    void requiresCompleteResidualCoverageBeforeSubmission() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            List.of(
                                    recoveryItem(
                                            "100.00",
                                            "40.00"
                                    ),

                                    writeOffItem(
                                            "80.00",
                                            "20.00"
                                    )
                            )
                    );


            UUID continuationId =
                    insertContinuationCase(
                            connection,
                            source,
                            source.remainingTotal(),
                            source.positiveCount(),
                            source.currency()
                    );


            insertValidContinuationItem(
                    connection,
                    continuationId,
                    source.items()
                            .getFirst()
            );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            continuationId
                                    )
                    );


            assertMessageContains(
                    exception,
                    "Every positive residual outcome item requires continuation governance"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 8
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationItemsAreImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            ContinuationFixture fixture =
                    completeContinuation(
                            connection
                    );


            UUID itemId =
                    fixture.continuationItemIds()
                            .getFirst();


            SQLException update =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_items

                                            SET rationale = 'tampered'

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    update,
                    "Residual continuation items are immutable"
            );


            SQLException delete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            DELETE FROM procurement_remediation_continuation_items

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    delete,
                    "Residual continuation items are immutable"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 9
     * -----------------------------------------------------------------------
     */


    @Test
    void lifecycleRequiresExactTransitionsVersionAndEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            ContinuationFixture fixture =
                    completeContinuation(
                            connection
                    );


            SQLException directApproval =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_cases

                                            SET
                                                status = 'APPROVED',
                                                approved_by_user_id = ?,
                                                approved_at = CURRENT_TIMESTAMP,
                                                approval_note = 'Direct approval',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            managerId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    directApproval,
                    "Invalid residual continuation lifecycle transition"
            );


            SQLException badVersion =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_cases

                                            SET
                                                status = 'IN_REVIEW',
                                                review_submitted_by_user_id = ?,
                                                review_submitted_at = CURRENT_TIMESTAMP,
                                                version = version + 2,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            actorId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    badVersion,
                    "version must increment exactly once"
            );


            submit(
                    connection,
                    fixture.caseId()
            );


            SQLException blankApproval =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_cases

                                            SET
                                                status = 'APPROVED',
                                                approved_by_user_id = ?,
                                                approved_at = CURRENT_TIMESTAMP,
                                                approval_note = ' ',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            managerId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    blankApproval,
                    "Manager approval evidence is required"
            );


            approve(
                    connection,
                    fixture.caseId()
            );


            assertEquals(
                    "APPROVED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 10
     * -----------------------------------------------------------------------
     */


    @Test
    void approvalCannotPrepopulateClosureAndClosurePreservesPriorEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            ContinuationFixture fixture =
                    completeContinuation(
                            connection
                    );


            submit(
                    connection,
                    fixture.caseId()
            );


            SQLException prematureClosure =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_cases

                                            SET
                                                status = 'APPROVED',
                                                approved_by_user_id = ?,
                                                approved_at = CURRENT_TIMESTAMP,
                                                approval_note = 'Approved',
                                                closed_by_user_id = ?,
                                                closed_at = CURRENT_TIMESTAMP,
                                                close_note = 'Premature close',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            managerId,
                                            managerId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    prematureClosure,
                    "Approval cannot alter closure evidence"
            );


            approve(
                    connection,
                    fixture.caseId()
            );


            SQLException tamperedApproval =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_cases

                                            SET
                                                status = 'CLOSED',
                                                approval_note = 'Tampered approval',
                                                closed_by_user_id = ?,
                                                closed_at = CURRENT_TIMESTAMP,
                                                close_note = 'Close',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            managerId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    tamperedApproval,
                    "Closure cannot alter submission or approval evidence"
            );


            close(
                    connection,
                    fixture.caseId()
            );


            assertEquals(
                    "CLOSED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 11
     * -----------------------------------------------------------------------
     */


    @Test
    void snapshotRequiresCompleteCoverageAndAuthoritativeHeader() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed incompleteSource =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            List.of(
                                    recoveryItem(
                                            "100.00",
                                            "40.00"
                                    ),

                                    writeOffItem(
                                            "80.00",
                                            "20.00"
                                    )
                            )
                    );


            UUID incompleteCase =
                    insertContinuationCase(
                            connection,
                            incompleteSource,
                            incompleteSource.remainingTotal(),
                            incompleteSource.positiveCount(),
                            incompleteSource.currency()
                    );


            insertValidContinuationItem(
                    connection,
                    incompleteCase,
                    incompleteSource.items()
                            .getFirst()
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
                    "Every positive residual outcome item requires continuation governance"
            );


            ContinuationFixture complete =
                    completeContinuation(
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
                    "snapshot header does not match authoritative case"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 12
     * -----------------------------------------------------------------------
     */


    @Test
    void snapshotItemsAreAuthoritativeAndSealedSnapshotIsImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            ContinuationFixture fixture =
                    completeContinuation(
                            connection
                    );


            UUID snapshotId =
                    insertSnapshotHeader(
                            connection,
                            fixture.caseId(),
                            null
                    );


            ContinuationItemRow authoritative =
                    continuationItem(
                            connection,
                            fixture.continuationItemIds()
                                    .getFirst()
                    );


            SQLException forged =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotItem(
                                            connection,
                                            snapshotId,
                                            authoritative,
                                            "FORGED RATIONALE"
                                    )
                    );


            assertMessageContains(
                    forged,
                    "does not match authoritative governance"
            );


            for (
                    UUID itemId
                    : fixture.continuationItemIds()
            ) {
                insertSnapshotItem(
                        connection,
                        snapshotId,
                        continuationItem(
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
                                            UPDATE procurement_remediation_continuation_snapshots

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
                    "content cannot change while sealing"
            );


            update(
                    connection,
                    """
                    UPDATE procurement_remediation_continuation_snapshots

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

                            FROM procurement_remediation_continuation_snapshots

                            WHERE id = ?
                            """,
                            snapshotId
                    )
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


            String appendMessage =
                    messageChain(
                            append
                    ).toLowerCase(
                            Locale.ROOT
                    );


            assertTrue(
                    appendMessage.contains(
                            "sealed"
                    )
                    ||
                    "23505".equals(
                            append.getSQLState()
                    )
            );


            SQLException updateHeader =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_snapshots

                                            SET title = 'Later tampering'

                                            WHERE id = ?
                                            """,
                                            snapshotId
                                    )
                    );


            assertMessageContains(
                    updateHeader,
                    "immutable after creation"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * FIXTURES
     * -----------------------------------------------------------------------
     */


    private static ContinuationFixture completeContinuation(
            Connection connection
    ) throws SQLException {
        OutcomeSeed source =
                verifiedRecoveryOutcome(
                        connection,
                        "100.00",
                        "40.00"
                );


        UUID caseId =
                insertContinuationCase(
                        connection,
                        source,
                        source.remainingTotal(),
                        source.positiveCount(),
                        source.currency()
                );


        List<UUID> continuationItems =
                new ArrayList<>();


        for (
                OutcomeItem item
                : source.items()
        ) {
            if (
                    item.remaining()
                            .signum()
                    > 0
            ) {
                continuationItems.add(
                        insertValidContinuationItem(
                                connection,
                                caseId,
                                item
                        )
                );
            }
        }


        return new ContinuationFixture(
                caseId,
                List.copyOf(
                        continuationItems
                )
        );
    }


    private static OutcomeSeed verifiedRecoveryOutcome(
            Connection connection,
            String sourceAmount,
            String resolvedAmount
    ) throws SQLException {
        return seedOutcome(
                connection,
                "VERIFIED",
                List.of(
                        recoveryItem(
                                sourceAmount,
                                resolvedAmount
                        )
                )
        );
    }


    private static OutcomeItemSpec recoveryItem(
            String source,
            String resolved
    ) {
        BigDecimal sourceValue =
                money(
                        source
                );

        BigDecimal resolvedValue =
                money(
                        resolved
                );


        return new OutcomeItemSpec(
                "RECOVERY_FOLLOW_UP",
                "RECOVERY_EVIDENCED",
                sourceValue,
                resolvedValue,
                sourceValue.subtract(
                        resolvedValue
                )
        );
    }


    private static OutcomeItemSpec writeOffItem(
            String source,
            String resolved
    ) {
        BigDecimal sourceValue =
                money(
                        source
                );

        BigDecimal resolvedValue =
                money(
                        resolved
                );


        return new OutcomeItemSpec(
                "WRITE_OFF_REVIEW",
                "WRITE_OFF_EVIDENCED",
                sourceValue,
                resolvedValue,
                sourceValue.subtract(
                        resolvedValue
                )
        );
    }


    private static OutcomeSeed seedOutcome(
            Connection connection,
            String status,
            List<OutcomeItemSpec> specs
    ) throws SQLException {
        UUID caseId =
                UUID.randomUUID();


        String outcomeNumber =
                "ROC-STEP82-"
                + shortId();


        String currency =
                "USD";


        BigDecimal sourceTotal =
                specs.stream()
                        .map(
                                OutcomeItemSpec::sourceResidual
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        BigDecimal remainingTotal =
                specs.stream()
                        .map(
                                OutcomeItemSpec::remaining
                        )
                        .filter(
                                value ->
                                        value.signum()
                                        > 0
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        int positiveCount =
                (int)
                specs.stream()
                        .filter(
                                value ->
                                        value.remaining()
                                                .signum()
                                        > 0
                        )
                        .count();


        List<OutcomeItem> items =
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
                                        'Step 82 outcome source',
                                        ?,
                                        2026,
                                        ?,
                                        ?,
                                        ?,
                                        'Step 82 User',
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
                        caseId
                );

                statement.setString(
                        2,
                        outcomeNumber
                );

                statement.setObject(
                        3,
                        UUID.randomUUID()
                );

                statement.setString(
                        4,
                        currency
                );

                statement.setBigDecimal(
                        5,
                        sourceTotal
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
                    OutcomeItemSpec spec
                    : specs
            ) {
                UUID itemId =
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
                                            CURRENT_DATE,
                                            ?,
                                            'Step 82 source outcome evidence',
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
                            caseId
                    );

                    statement.setObject(
                            3,
                            UUID.randomUUID()
                    );

                    statement.setString(
                            4,
                            spec.sourceAction()
                    );

                    statement.setBigDecimal(
                            5,
                            spec.sourceResidual()
                    );

                    statement.setString(
                            6,
                            spec.resolutionType()
                    );

                    statement.setBigDecimal(
                            7,
                            spec.resolved()
                    );

                    statement.setBigDecimal(
                            8,
                            spec.remaining()
                    );

                    statement.setString(
                            9,
                            "STEP82-"
                            + shortId()
                    );

                    statement.setObject(
                            10,
                            actorId
                    );

                    statement.executeUpdate();
                }


                items.add(
                        new OutcomeItem(
                                itemId,
                                spec.sourceAction(),
                                spec.resolutionType(),
                                spec.remaining()
                        )
                );
            }

        } finally {
            execute(
                    connection,
                    "SET session_replication_role = origin"
            );
        }


        return new OutcomeSeed(
                caseId,
                outcomeNumber,
                currency,
                remainingTotal,
                positiveCount,
                List.copyOf(
                        items
                )
        );
    }


    private static UUID insertContinuationCase(
            Connection connection,
            OutcomeSeed source,
            BigDecimal copiedAmount,
            int copiedCount,
            String copiedCurrency
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_cases (
                                    id,
                                    continuation_number,
                                    source_outcome_case_id,
                                    source_outcome_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_remaining_residual_amount,
                                    source_residual_item_count,
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
                                    ?,
                                    'Step 82 continuation',
                                    ?,
                                    2026,
                                    ?,
                                    ?,
                                    ?,
                                    'Step 82 User',
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
                    "RCC-STEP82-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    source.caseId()
            );

            statement.setString(
                    4,
                    source.outcomeNumber()
            );

            statement.setString(
                    5,
                    copiedCurrency
            );

            statement.setBigDecimal(
                    6,
                    copiedAmount
            );

            statement.setInt(
                    7,
                    copiedCount
            );

            statement.setObject(
                    8,
                    actorId
            );

            statement.setObject(
                    9,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static UUID insertValidContinuationItem(
            Connection connection,
            UUID continuationCaseId,
            OutcomeItem source
    ) throws SQLException {
        return insertContinuationItemRaw(
                connection,
                continuationCaseId,
                source,
                expectedContinuationAction(
                        source.sourceAction()
                ),
                LocalDate.now()
                        .plusDays(
                                30
                        ),
                "Step 82 governed continuation."
        );
    }


    private static UUID insertContinuationItemRaw(
            Connection connection,
            UUID continuationCaseId,
            OutcomeItem source,
            String continuationAction,
            LocalDate targetDate,
            String rationale
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_items (
                                    id,
                                    continuation_case_id,
                                    source_outcome_item_id,
                                    source_action,
                                    source_resolution_type,
                                    source_remaining_residual_amount,
                                    continuation_action,
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
                    continuationCaseId
            );

            statement.setObject(
                    3,
                    source.id()
            );

            statement.setString(
                    4,
                    source.sourceAction()
            );

            statement.setString(
                    5,
                    source.resolutionType()
            );

            statement.setBigDecimal(
                    6,
                    source.remaining()
            );

            statement.setString(
                    7,
                    continuationAction
            );

            statement.setDate(
                    8,
                    Date.valueOf(
                            targetDate
                    )
            );

            statement.setString(
                    9,
                    rationale
            );

            statement.setObject(
                    10,
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
                UPDATE procurement_remediation_continuation_cases

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


    private static void approve(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        update(
                connection,
                """
                UPDATE procurement_remediation_continuation_cases

                SET
                    status = 'APPROVED',
                    approved_by_user_id = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    approval_note = 'Approved by Step 82',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                managerId,
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
                UPDATE procurement_remediation_continuation_cases

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = 'Closed by Step 82',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                managerId,
                caseId
        );
    }


    private static UUID insertSnapshotHeader(
            Connection connection,
            UUID continuationCaseId,
            String titleOverride
    ) throws SQLException {
        ContinuationCaseRow row =
                continuationCase(
                        connection,
                        continuationCaseId
                );


        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_snapshots (
                                    id,
                                    snapshot_number,
                                    continuation_case_id,
                                    continuation_number,
                                    source_outcome_case_id,
                                    source_outcome_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_remaining_residual_amount,
                                    item_count,
                                    continuation_status,
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
                    "RCS-STEP82-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    continuationCaseId
            );

            statement.setString(
                    4,
                    row.continuationNumber()
            );

            statement.setObject(
                    5,
                    row.sourceOutcomeCaseId()
            );

            statement.setString(
                    6,
                    row.sourceOutcomeNumber()
            );

            statement.setString(
                    7,
                    titleOverride == null
                            ? row.title()
                            : titleOverride
            );

            statement.setString(
                    8,
                    row.currency()
            );

            statement.setInt(
                    9,
                    row.fiscalYear()
            );

            statement.setBigDecimal(
                    10,
                    row.sourceResidual()
            );

            statement.setInt(
                    11,
                    row.sourceItemCount()
            );

            statement.setString(
                    12,
                    row.status()
            );

            statement.setObject(
                    13,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static void insertSnapshotItem(
            Connection connection,
            UUID snapshotId,
            ContinuationItemRow item,
            String rationaleOverride
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_snapshot_items (
                                    id,
                                    snapshot_id,
                                    continuation_item_id,
                                    source_outcome_item_id,
                                    source_action,
                                    source_resolution_type,
                                    source_remaining_residual_amount,
                                    continuation_action,
                                    target_date,
                                    rationale
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
                    item.id()
            );

            statement.setObject(
                    4,
                    item.sourceOutcomeItemId()
            );

            statement.setString(
                    5,
                    item.sourceAction()
            );

            statement.setString(
                    6,
                    item.sourceResolutionType()
            );

            statement.setBigDecimal(
                    7,
                    item.sourceRemainingResidual()
            );

            statement.setString(
                    8,
                    item.continuationAction()
            );

            statement.setDate(
                    9,
                    Date.valueOf(
                            item.targetDate()
                    )
            );

            statement.setString(
                    10,
                    rationaleOverride == null
                            ? item.rationale()
                            : rationaleOverride
            );

            statement.executeUpdate();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * READ HELPERS
     * -----------------------------------------------------------------------
     */


    private static ContinuationCaseRow continuationCase(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    continuation_number,
                                    source_outcome_case_id,
                                    source_outcome_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_remaining_residual_amount,
                                    source_residual_item_count,
                                    status

                                FROM procurement_remediation_continuation_cases

                                WHERE id = ?
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
                            "Continuation case not found"
                    );
                }


                return new ContinuationCaseRow(
                        result.getString(
                                "continuation_number"
                        ),
                        result.getObject(
                                "source_outcome_case_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_outcome_number"
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
                                "source_remaining_residual_amount"
                        ),
                        result.getInt(
                                "source_residual_item_count"
                        ),
                        result.getString(
                                "status"
                        )
                );
            }
        }
    }


    private static ContinuationItemRow continuationItem(
            Connection connection,
            UUID itemId
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    id,
                                    source_outcome_item_id,
                                    source_action,
                                    source_resolution_type,
                                    source_remaining_residual_amount,
                                    continuation_action,
                                    target_date,
                                    rationale

                                FROM procurement_remediation_continuation_items

                                WHERE id = ?
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    itemId
            );


            try (
                    ResultSet result =
                            statement.executeQuery()
            ) {
                if (!result.next()) {
                    throw new SQLException(
                            "Continuation item not found"
                    );
                }


                return new ContinuationItemRow(
                        result.getObject(
                                "id",
                                UUID.class
                        ),
                        result.getObject(
                                "source_outcome_item_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_action"
                        ),
                        result.getString(
                                "source_resolution_type"
                        ),
                        result.getBigDecimal(
                                "source_remaining_residual_amount"
                        ),
                        result.getString(
                                "continuation_action"
                        ),
                        result.getObject(
                                "target_date",
                                LocalDate.class
                        ),
                        result.getString(
                                "rationale"
                        )
                );
            }
        }
    }


    /*
     * -----------------------------------------------------------------------
     * APP USER SEEDING
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
                                FlywheelResidualContinuationPostgresTest
                                    ::shouldSeed
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
                        Collections.nCopies(
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
            int index =
                    1;


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
                    "step82-"
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
                    "step82-test-password-hash"
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
                    "Step 82 Runtime User"
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


        switch (type) {
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
                            "STEP82-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP82",
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
        StringBuilder builder =
                new StringBuilder();


        SQLException cursor =
                exception;


        while (cursor != null) {
            if (
                    cursor.getMessage()
                    != null
            ) {
                if (
                        builder.length()
                        > 0
                ) {
                    builder.append(
                            " | "
                    );
                }

                builder.append(
                        cursor.getMessage()
                );
            }

            cursor =
                    cursor.getNextException();
        }


        return builder.toString();
    }


    private static String expectedContinuationAction(
            String sourceAction
    ) {
        return switch (sourceAction) {
            case "RECOVERY_FOLLOW_UP" ->
                    "RECOVERY_RETRY";

            case "WRITE_OFF_REVIEW" ->
                    "WRITE_OFF_ESCALATION";

            case "INVESTIGATION_ESCALATION" ->
                    "INVESTIGATION_ESCALATION";

            case "RESIDUAL_ACCEPTANCE_REVIEW" ->
                    "RISK_ACCEPTANCE_ESCALATION";

            default ->
                    throw new IllegalArgumentException(
                            "Unknown source action: "
                            + sourceAction
                    );
        };
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
                    "Step 82 PostgreSQL tests require loopback PostgreSQL."
            );
        }


        if (
                !url.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 82 PostgreSQL tests require the disposable procureiq_step70 database."
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


    private record OutcomeItemSpec(
            String sourceAction,
            String resolutionType,
            BigDecimal sourceResidual,
            BigDecimal resolved,
            BigDecimal remaining
    ) {
    }


    private record OutcomeItem(
            UUID id,
            String sourceAction,
            String resolutionType,
            BigDecimal remaining
    ) {
    }


    private record OutcomeSeed(
            UUID caseId,
            String outcomeNumber,
            String currency,
            BigDecimal remainingTotal,
            int positiveCount,
            List<OutcomeItem> items
    ) {
    }


    private record ContinuationFixture(
            UUID caseId,
            List<UUID> continuationItemIds
    ) {
    }


    private record ContinuationCaseRow(
            String continuationNumber,
            UUID sourceOutcomeCaseId,
            String sourceOutcomeNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal sourceResidual,
            int sourceItemCount,
            String status
    ) {
    }


    private record ContinuationItemRow(
            UUID id,
            UUID sourceOutcomeItemId,
            String sourceAction,
            String sourceResolutionType,
            BigDecimal sourceRemainingResidual,
            String continuationAction,
            LocalDate targetDate,
            String rationale
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
