package com.procureiq.flywheelcontinuationoutcome;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
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

class FlywheelContinuationOutcomePostgresTest {

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
                        "PROCUREIQ_STEP88_DB_URL"
                );

        jdbcUser =
                requiredEnvironment(
                        "PROCUREIQ_STEP88_DB_USER"
                );

        jdbcPassword =
                requiredEnvironment(
                        "PROCUREIQ_STEP88_DB_PASSWORD"
                );


        validateDisposableDatabase(
                jdbcUrl
        );


        schema =
                "step88_runtime_"
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
             * Audit persistence is not Step 88's subject.
             *
             * All continuation-outcome integrity triggers remain active.
             */
            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_outcome_cases
                    DISABLE TRIGGER trg_audit_continuation_outcome_cases
                    """
            );

            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_outcome_items
                    DISABLE TRIGGER trg_audit_continuation_outcome_items
                    """
            );


            actorId =
                    UUID.randomUUID();

            managerId =
                    UUID.randomUUID();


            seedUser(
                    connection,
                    actorId,
                    "BUYER"
            );

            seedUser(
                    connection,
                    managerId,
                    "PROCUREMENT_MANAGER"
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


    @BeforeEach
    void beforeEach() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            execute(
                    connection,
                    """
                    TRUNCATE TABLE
                        procurement_remediation_continuation_outcome_snapshot_items,
                        procurement_remediation_continuation_outcome_snapshots,
                        procurement_remediation_continuation_outcome_items,
                        procurement_remediation_continuation_outcome_cases,
                        procurement_remediation_continuation_items,
                        procurement_remediation_continuation_cases
                    CASCADE
                    """
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 1
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsOutcomeCaseFromNonClosedContinuation() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed source =
                    seedContinuation(
                            connection,
                            "APPROVED",
                            List.of(
                                    recoveryItem(
                                            "100.00"
                                    )
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeCase(
                                            connection,
                                            source
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires CLOSED source continuation"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsForgedAndDuplicateSourceAuthority() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed source =
                    seedClosedRecovery(
                            connection,
                            "100.00"
                    );


            SQLException forged =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeCaseRaw(
                                            connection,
                                            source,
                                            UUID.randomUUID(),
                                            "RCO-STEP88-FORGED-"
                                            + shortId(),
                                            "DRAFT",
                                            0,
                                            source.title(),
                                            source.currency(),
                                            source.fiscalYear(),
                                            money(
                                                    "99.00"
                                            ),
                                            source.items()
                                                    .size(),
                                            null
                                    )
                    );


            assertMessageContains(
                    forged,
                    "source authority does not reconcile"
            );


            insertOutcomeCase(
                    connection,
                    source
            );


            SQLException duplicate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeCase(
                                            connection,
                                            source
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
     * 3
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsNonDraftAndPrepopulatedCaseCreation() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed first =
                    seedClosedRecovery(
                            connection,
                            "100.00"
                    );


            SQLException wrongStatus =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeCaseRaw(
                                            connection,
                                            first,
                                            UUID.randomUUID(),
                                            "RCO-STEP88-STATUS-"
                                            + shortId(),
                                            "IN_REVIEW",
                                            0,
                                            first.title(),
                                            first.currency(),
                                            first.fiscalYear(),
                                            first.total(),
                                            first.items()
                                                    .size(),
                                            null
                                    )
                    );


            assertMessageContains(
                    wrongStatus,
                    "must be created as DRAFT version zero"
            );


            SourceSeed second =
                    seedClosedRecovery(
                            connection,
                            "80.00"
                    );


            SQLException prepopulated =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeCaseRaw(
                                            connection,
                                            second,
                                            UUID.randomUUID(),
                                            "RCO-STEP88-PREPOP-"
                                            + shortId(),
                                            "DRAFT",
                                            0,
                                            second.title(),
                                            second.currency(),
                                            second.fiscalYear(),
                                            second.total(),
                                            second.items()
                                                    .size(),
                                            actorId
                                    )
                    );


            assertMessageContains(
                    prepopulated,
                    "lifecycle evidence cannot be pre-populated"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 4
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsForeignSourceItemAndIncompatibleResolution() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed first =
                    seedClosedRecovery(
                            connection,
                            "100.00"
                    );

            SourceSeed second =
                    seedClosedRecovery(
                            connection,
                            "70.00"
                    );


            UUID caseId =
                    insertOutcomeCase(
                            connection,
                            first
                    );


            SQLException foreign =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            caseId,
                                            second.items()
                                                    .getFirst(),
                                            "RECOVERY_CONFIRMED",
                                            money(
                                                    "10.00"
                                            ),
                                            LocalDate.now(),
                                            "FOREIGN",
                                            "Foreign source."
                                    )
                    );


            assertMessageContains(
                    foreign,
                    "belongs to another continuation case"
            );


            SQLException incompatible =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            caseId,
                                            first.items()
                                                    .getFirst(),
                                            "WRITE_OFF_CONFIRMED",
                                            money(
                                                    "10.00"
                                            ),
                                            LocalDate.now(),
                                            "WRONG",
                                            "Wrong action lineage."
                                    )
                    );


            assertMessageContains(
                    incompatible,
                    "incompatible with continuation action"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * -----------------------------------------------------------------------
     */


    @Test
    void enforcesResolutionAmountSemantics() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed recovery =
                    seedClosedRecovery(
                            connection,
                            "100.00"
                    );

            UUID recoveryCase =
                    insertOutcomeCase(
                            connection,
                            recovery
                    );


            SQLException partialFull =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            recoveryCase,
                                            recovery.items()
                                                    .getFirst(),
                                            "PARTIAL",
                                            money(
                                                    "100.00"
                                            ),
                                            LocalDate.now(),
                                            "PARTIAL",
                                            "Invalid full partial."
                                    )
                    );


            assertMessageContains(
                    partialFull,
                    "PARTIAL outcome requires a positive incomplete reduction"
            );


            SQLException unresolvedReduction =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            recoveryCase,
                                            recovery.items()
                                                    .getFirst(),
                                            "UNRESOLVED",
                                            money(
                                                    "1.00"
                                            ),
                                            LocalDate.now(),
                                            "UNRESOLVED",
                                            "Invalid unresolved reduction."
                                    )
                    );


            assertMessageContains(
                    unresolvedReduction,
                    "UNRESOLVED outcome cannot claim residual reduction"
            );


            SourceSeed risk =
                    seedContinuation(
                            connection,
                            "CLOSED",
                            List.of(
                                    riskItem(
                                            "50.00"
                                    )
                            )
                    );


            UUID riskCase =
                    insertOutcomeCase(
                            connection,
                            risk
                    );


            SQLException riskReduction =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            riskCase,
                                            risk.items()
                                                    .getFirst(),
                                            "RISK_ACCEPTANCE_CONFIRMED",
                                            money(
                                                    "1.00"
                                            ),
                                            LocalDate.now(),
                                            "RISK",
                                            "Risk acceptance cannot reduce money."
                                    )
                    );


            assertMessageContains(
                    riskReduction,
                    "Risk acceptance does not reduce financial residual"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsFutureDateAndBlankEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed source =
                    seedClosedRecovery(
                            connection,
                            "100.00"
                    );


            UUID caseId =
                    insertOutcomeCase(
                            connection,
                            source
                    );


            SQLException future =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            caseId,
                                            source.items()
                                                    .getFirst(),
                                            "RECOVERY_CONFIRMED",
                                            money(
                                                    "10.00"
                                            ),
                                            LocalDate.now()
                                                    .plusDays(
                                                            1
                                                    ),
                                            "FUTURE",
                                            "Future evidence."
                                    )
                    );


            assertMessageContains(
                    future,
                    "Observed outcome date cannot be in the future"
            );


            SQLException blankReference =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            caseId,
                                            source.items()
                                                    .getFirst(),
                                            "RECOVERY_CONFIRMED",
                                            money(
                                                    "10.00"
                                            ),
                                            LocalDate.now(),
                                            " ",
                                            "Evidence note."
                                    )
                    );


            assertMessageContains(
                    blankReference,
                    "Outcome evidence reference is required"
            );


            SQLException blankNote =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertOutcomeItem(
                                            connection,
                                            caseId,
                                            source.items()
                                                    .getFirst(),
                                            "RECOVERY_CONFIRMED",
                                            money(
                                                    "10.00"
                                            ),
                                            LocalDate.now(),
                                            "REF",
                                            " "
                                    )
                    );


            assertMessageContains(
                    blankNote,
                    "Outcome evidence note is required"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 7
     * -----------------------------------------------------------------------
     */


    @Test
    void requiresCompleteCoverageBeforeSubmission() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            SourceSeed source =
                    seedContinuation(
                            connection,
                            "CLOSED",
                            List.of(
                                    recoveryItem(
                                            "100.00"
                                    ),
                                    recoveryItem(
                                            "50.00"
                                    )
                            )
                    );


            UUID caseId =
                    insertOutcomeCase(
                            connection,
                            source
                    );


            insertOutcomeItem(
                    connection,
                    caseId,
                    source.items()
                            .getFirst(),
                    "RECOVERY_CONFIRMED",
                    money(
                            "10.00"
                    ),
                    LocalDate.now(),
                    "ONE",
                    "Only one source item covered."
            );


            SQLException incomplete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            caseId,
                                            actorId,
                                            1
                                    )
                    );


            assertMessageContains(
                    incomplete,
                    "Every continuation item requires observed outcome evidence"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 8
     * -----------------------------------------------------------------------
     */


    @Test
    void outcomeEvidenceItemsAreImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeFixture fixture =
                    completeOutcome(
                            connection,
                            money(
                                    "40.00"
                            )
                    );


            UUID itemId =
                    fixture.outcomeItemIds()
                            .getFirst();


            SQLException update =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_outcome_items

                                            SET evidence_note = 'Tampered'

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    update,
                    "evidence items are immutable"
            );


            SQLException delete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            DELETE FROM procurement_remediation_continuation_outcome_items

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    delete,
                    "evidence items are immutable"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 9
     * -----------------------------------------------------------------------
     */


    @Test
    void lifecycleRequiresExactVersionAndVerificationEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeFixture fixture =
                    completeOutcome(
                            connection,
                            money(
                                    "40.00"
                            )
                    );


            SQLException directVerification =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_outcome_cases

                                            SET
                                                status = 'VERIFIED',
                                                verified_by_user_id = ?,
                                                verified_at = CURRENT_TIMESTAMP,
                                                verification_note = 'Direct',
                                                verified_remaining_residual_amount = 40.00,
                                                residual_disposition = 'FURTHER_GOVERNANCE_REQUIRED',
                                                version = version + 1,
                                                updated_at = CURRENT_TIMESTAMP

                                            WHERE id = ?
                                            """,
                                            managerId,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    directVerification,
                    "Invalid continuation outcome lifecycle transition"
            );


            SQLException badVersion =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            fixture.caseId(),
                                            actorId,
                                            2
                                    )
                    );


            assertMessageContains(
                    badVersion,
                    "version must increment exactly once"
            );


            assertEquals(
                    1,
                    submit(
                            connection,
                            fixture.caseId(),
                            actorId,
                            1
                    )
            );


            SQLException blankVerification =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    verify(
                                            connection,
                                            fixture.caseId(),
                                            managerId,
                                            " ",
                                            fixture.remaining(),
                                            disposition(
                                                    fixture.remaining()
                                            )
                                    )
                    );


            assertMessageContains(
                    blankVerification,
                    "Manager verification evidence is required"
            );


            assertEquals(
                    1,
                    verify(
                            connection,
                            fixture.caseId(),
                            managerId,
                            "Verified evidence.",
                            fixture.remaining(),
                            disposition(
                                    fixture.remaining()
                            )
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
    void positiveResidualRequiresFurtherGovernanceAndCannotClose() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeFixture fixture =
                    completeOutcome(
                            connection,
                            money(
                                    "40.00"
                            )
                    );


            submit(
                    connection,
                    fixture.caseId(),
                    actorId,
                    1
            );


            verify(
                    connection,
                    fixture.caseId(),
                    managerId,
                    "Positive residual verified.",
                    money(
                            "40.00"
                    ),
                    "FURTHER_GOVERNANCE_REQUIRED"
            );


            assertEquals(
                    "FURTHER_GOVERNANCE_REQUIRED",
                    queryString(
                            connection,
                            """
                            SELECT residual_disposition

                            FROM procurement_remediation_continuation_outcome_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );


            SQLException close =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    close(
                                            connection,
                                            fixture.caseId(),
                                            managerId,
                                            "False closure."
                                    )
                    );


            assertMessageContains(
                    close,
                    "Positive residual requires further governance and cannot be closed"
            );


            assertEquals(
                    "VERIFIED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_continuation_outcome_cases

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
    void zeroResidualCanVerifyFullyResolvedAndClose() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeFixture fixture =
                    completeOutcome(
                            connection,
                            money(
                                    "0.00"
                            )
                    );


            submit(
                    connection,
                    fixture.caseId(),
                    actorId,
                    1
            );


            verify(
                    connection,
                    fixture.caseId(),
                    managerId,
                    "Zero residual verified.",
                    money(
                            "0.00"
                    ),
                    "FULLY_RESOLVED"
            );


            assertEquals(
                    "FULLY_RESOLVED",
                    queryString(
                            connection,
                            """
                            SELECT residual_disposition

                            FROM procurement_remediation_continuation_outcome_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );


            assertEquals(
                    1,
                    close(
                            connection,
                            fixture.caseId(),
                            managerId,
                            "Resolved outcome closed."
                    )
            );


            assertEquals(
                    "CLOSED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_continuation_outcome_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 12
     * -----------------------------------------------------------------------
     */


    @Test
    void snapshotAuthoritySealingAndImmutabilityAreEnforced() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeFixture fixture =
                    completeOutcome(
                            connection,
                            money(
                                    "40.00"
                            )
                    );


            SQLException forgedHeader =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotHeader(
                                            connection,
                                            fixture.caseId(),
                                            "FORGED TITLE"
                                    )
                    );


            assertMessageContains(
                    forgedHeader,
                    "snapshot header does not match authority"
            );


            UUID snapshotId =
                    insertSnapshotHeader(
                            connection,
                            fixture.caseId(),
                            null
                    );


            OutcomeItemRow item =
                    outcomeItem(
                            connection,
                            fixture.outcomeItemIds()
                                    .getFirst()
                    );


            SQLException forgedItem =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotItem(
                                            connection,
                                            snapshotId,
                                            item,
                                            "FORGED"
                                    )
                    );


            assertMessageContains(
                    forgedItem,
                    "snapshot item does not match authority"
            );


            insertSnapshotItem(
                    connection,
                    snapshotId,
                    item,
                    null
            );


            assertEquals(
                    1,
                    update(
                            connection,
                            """
                            UPDATE procurement_remediation_continuation_outcome_snapshots

                            SET sealed = TRUE

                            WHERE id = ?
                            """,
                            snapshotId
                    )
            );


            assertTrue(
                    queryBoolean(
                            connection,
                            """
                            SELECT sealed

                            FROM procurement_remediation_continuation_outcome_snapshots

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
                                            item,
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


            SQLException mutateHeader =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_outcome_snapshots

                                            SET title = 'Later tampering'

                                            WHERE id = ?
                                            """,
                                            snapshotId
                                    )
                    );


            assertMessageContains(
                    mutateHeader,
                    "immutable after creation"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * OUTCOME FIXTURES
     * -----------------------------------------------------------------------
     */


    private static OutcomeFixture completeOutcome(
            Connection connection,
            BigDecimal desiredRemaining
    ) throws Exception {
        SourceSeed source =
                seedClosedRecovery(
                        connection,
                        "100.00"
                );


        UUID caseId =
                insertOutcomeCase(
                        connection,
                        source
                );


        SourceItem sourceItem =
                source.items()
                        .getFirst();


        BigDecimal reduction =
                sourceItem.amount()
                        .subtract(
                                desiredRemaining
                        );


        String resolution =
                desiredRemaining.signum() == 0
                        ? "RECOVERY_CONFIRMED"
                        : "PARTIAL";


        UUID itemId =
                insertOutcomeItem(
                        connection,
                        caseId,
                        sourceItem,
                        resolution,
                        reduction,
                        LocalDate.now(),
                        "STEP88-EVIDENCE",
                        "Observed continuation outcome evidence."
                );


        return new OutcomeFixture(
                caseId,
                desiredRemaining,
                List.of(
                        itemId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * CONTINUATION SOURCE FIXTURES
     * -----------------------------------------------------------------------
     */


    private static SourceSeed seedClosedRecovery(
            Connection connection,
            String amount
    ) throws Exception {
        return seedContinuation(
                connection,
                "CLOSED",
                List.of(
                        recoveryItem(
                                amount
                        )
                )
        );
    }


    private static SourceSeed seedContinuation(
            Connection connection,
            String status,
            List<SourceItemSpec> specs
    ) throws Exception {
        UUID caseId =
                UUID.randomUUID();


        String continuationNumber =
                "RCC-STEP88-"
                + shortId();


        String title =
                "Step 88 source "
                + shortId();


        String currency =
                "USD";


        int fiscalYear =
                2026;


        BigDecimal total =
                specs.stream()
                        .map(
                                SourceItemSpec::amount
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        List<SourceItem> items =
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
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        'Step 88 Buyer',
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
                        continuationNumber
                );

                statement.setObject(
                        3,
                        UUID.randomUUID()
                );

                statement.setString(
                        4,
                        "ROC-STEP88-"
                        + shortId()
                );

                statement.setString(
                        5,
                        title
                );

                statement.setString(
                        6,
                        currency
                );

                statement.setInt(
                        7,
                        fiscalYear
                );

                statement.setBigDecimal(
                        8,
                        total
                );

                statement.setInt(
                        9,
                        specs.size()
                );

                statement.setObject(
                        10,
                        actorId
                );

                statement.setString(
                        11,
                        status
                );

                statement.setObject(
                        12,
                        actorId
                );

                statement.executeUpdate();
            }


            for (
                    SourceItemSpec spec
                    : specs
            ) {
                UUID itemId =
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
                                            'Step 88 source continuation',
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

                    statement.setString(
                            5,
                            spec.sourceResolution()
                    );

                    statement.setBigDecimal(
                            6,
                            spec.amount()
                    );

                    statement.setString(
                            7,
                            spec.continuationAction()
                    );

                    statement.setDate(
                            8,
                            Date.valueOf(
                                    LocalDate.now()
                                            .plusDays(
                                                    30
                                            )
                            )
                    );

                    statement.setObject(
                            9,
                            actorId
                    );

                    statement.executeUpdate();
                }


                items.add(
                        new SourceItem(
                                itemId,
                                spec.continuationAction(),
                                spec.amount()
                        )
                );
            }

        } finally {
            execute(
                    connection,
                    "SET session_replication_role = origin"
            );
        }


        return new SourceSeed(
                caseId,
                continuationNumber,
                title,
                currency,
                fiscalYear,
                total,
                List.copyOf(
                        items
                )
        );
    }


    private static SourceItemSpec recoveryItem(
            String amount
    ) {
        return new SourceItemSpec(
                "RECOVERY_FOLLOW_UP",
                "RECOVERY_EVIDENCED",
                "RECOVERY_RETRY",
                money(
                        amount
                )
        );
    }


    private static SourceItemSpec riskItem(
            String amount
    ) {
        return new SourceItemSpec(
                "RESIDUAL_ACCEPTANCE_REVIEW",
                "RISK_ACCEPTANCE_EVIDENCED",
                "RISK_ACCEPTANCE_ESCALATION",
                money(
                        amount
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * OUTCOME CASE SQL
     * -----------------------------------------------------------------------
     */


    private static UUID insertOutcomeCase(
            Connection connection,
            SourceSeed source
    ) throws Exception {
        UUID id =
                UUID.randomUUID();


        insertOutcomeCaseRaw(
                connection,
                source,
                id,
                "RCO-STEP88-"
                + shortId(),
                "DRAFT",
                0,
                source.title(),
                source.currency(),
                source.fiscalYear(),
                source.total(),
                source.items()
                        .size(),
                null
        );


        return id;
    }


    private static int insertOutcomeCaseRaw(
            Connection connection,
            SourceSeed source,
            UUID id,
            String number,
            String status,
            long version,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal amount,
            int itemCount,
            UUID prepopulatedSubmitter
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_outcome_cases (
                                    id,
                                    outcome_number,
                                    source_continuation_case_id,
                                    source_continuation_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_residual_amount,
                                    source_item_count,
                                    owner_user_id,
                                    owner_name,
                                    status,
                                    review_submitted_by_user_id,
                                    review_submitted_at,
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
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    'Step 88 Buyer',
                                    ?,
                                    ?,
                                    CASE
                                        WHEN CAST(? AS UUID) IS NULL
                                        THEN NULL
                                        ELSE CURRENT_TIMESTAMP
                                    END,
                                    ?,
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
                    number
            );

            statement.setObject(
                    3,
                    source.caseId()
            );

            statement.setString(
                    4,
                    source.continuationNumber()
            );

            statement.setString(
                    5,
                    title
            );

            statement.setString(
                    6,
                    currency
            );

            statement.setInt(
                    7,
                    fiscalYear
            );

            statement.setBigDecimal(
                    8,
                    amount
            );

            statement.setInt(
                    9,
                    itemCount
            );

            statement.setObject(
                    10,
                    actorId
            );

            statement.setString(
                    11,
                    status
            );

            if (prepopulatedSubmitter == null) {
                statement.setNull(
                        12,
                        Types.OTHER
                );

                statement.setNull(
                        13,
                        Types.OTHER
                );

            } else {
                statement.setObject(
                        12,
                        prepopulatedSubmitter
                );

                statement.setObject(
                        13,
                        prepopulatedSubmitter
                );
            }

            statement.setLong(
                    14,
                    version
            );

            statement.setObject(
                    15,
                    actorId
            );


            return statement.executeUpdate();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * OUTCOME ITEM SQL
     * -----------------------------------------------------------------------
     */


    private static UUID insertOutcomeItem(
            Connection connection,
            UUID caseId,
            SourceItem source,
            String resolution,
            BigDecimal reduction,
            LocalDate observedOn,
            String reference,
            String note
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        BigDecimal remaining =
                source.amount()
                        .subtract(
                                reduction
                        );


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_outcome_items (
                                    id,
                                    outcome_case_id,
                                    source_continuation_item_id,
                                    source_continuation_action,
                                    source_residual_amount,
                                    resolution_type,
                                    observed_reduction_amount,
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
                    source.id()
            );

            statement.setString(
                    4,
                    source.continuationAction()
            );

            statement.setBigDecimal(
                    5,
                    source.amount()
            );

            statement.setString(
                    6,
                    resolution
            );

            statement.setBigDecimal(
                    7,
                    reduction
            );

            statement.setBigDecimal(
                    8,
                    remaining
            );

            statement.setDate(
                    9,
                    Date.valueOf(
                            observedOn
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


    /*
     * -----------------------------------------------------------------------
     * LIFECYCLE SQL
     * -----------------------------------------------------------------------
     */


    private static int submit(
            Connection connection,
            UUID caseId,
            UUID actor,
            int versionIncrement
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_outcome_cases

                                SET
                                    status = 'IN_REVIEW',
                                    review_submitted_by_user_id = ?,
                                    review_submitted_at = CURRENT_TIMESTAMP,
                                    version = version + ?,
                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                                AND status = 'DRAFT'
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    actor
            );

            statement.setInt(
                    2,
                    versionIncrement
            );

            statement.setObject(
                    3,
                    caseId
            );


            return statement.executeUpdate();
        }
    }


    private static int verify(
            Connection connection,
            UUID caseId,
            UUID manager,
            String note,
            BigDecimal remaining,
            String disposition
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_outcome_cases

                                SET
                                    status = 'VERIFIED',
                                    verified_by_user_id = ?,
                                    verified_at = CURRENT_TIMESTAMP,
                                    verification_note = ?,
                                    verified_remaining_residual_amount = ?,
                                    residual_disposition = ?,
                                    version = version + 1,
                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                                AND status = 'IN_REVIEW'
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    manager
            );

            statement.setString(
                    2,
                    note
            );

            statement.setBigDecimal(
                    3,
                    remaining
            );

            statement.setString(
                    4,
                    disposition
            );

            statement.setObject(
                    5,
                    caseId
            );


            return statement.executeUpdate();
        }
    }


    private static int close(
            Connection connection,
            UUID caseId,
            UUID manager,
            String note
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_outcome_cases

                                SET
                                    status = 'CLOSED',
                                    closed_by_user_id = ?,
                                    closed_at = CURRENT_TIMESTAMP,
                                    close_note = ?,
                                    version = version + 1,
                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                                AND status = 'VERIFIED'
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    manager
            );

            statement.setString(
                    2,
                    note
            );

            statement.setObject(
                    3,
                    caseId
            );


            return statement.executeUpdate();
        }
    }


    private static String disposition(
            BigDecimal remaining
    ) {
        return remaining.signum() == 0
                ? "FULLY_RESOLVED"
                : "FURTHER_GOVERNANCE_REQUIRED";
    }


    /*
     * -----------------------------------------------------------------------
     * SNAPSHOT SQL
     * -----------------------------------------------------------------------
     */


    private static UUID insertSnapshotHeader(
            Connection connection,
            UUID caseId,
            String titleOverride
    ) throws Exception {
        CaseRow outcome =
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
                                INSERT INTO procurement_remediation_continuation_outcome_snapshots (
                                    id,
                                    snapshot_number,
                                    outcome_case_id,
                                    outcome_number,
                                    source_continuation_case_id,
                                    source_continuation_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_residual_amount,
                                    remaining_residual_amount,
                                    item_count,
                                    outcome_status,
                                    residual_disposition,
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
                    "RCOS-STEP88-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    caseId
            );

            statement.setString(
                    4,
                    outcome.outcomeNumber()
            );

            statement.setObject(
                    5,
                    outcome.sourceContinuationCaseId()
            );

            statement.setString(
                    6,
                    outcome.sourceContinuationNumber()
            );

            statement.setString(
                    7,
                    titleOverride == null
                            ? outcome.title()
                            : titleOverride
            );

            statement.setString(
                    8,
                    outcome.currency()
            );

            statement.setInt(
                    9,
                    outcome.fiscalYear()
            );

            statement.setBigDecimal(
                    10,
                    outcome.sourceResidual()
            );

            statement.setBigDecimal(
                    11,
                    outcome.remainingResidual()
            );

            statement.setInt(
                    12,
                    outcome.itemCount()
            );

            statement.setString(
                    13,
                    outcome.status()
            );

            if (outcome.disposition() == null) {
                statement.setNull(
                        14,
                        Types.VARCHAR
                );
            } else {
                statement.setString(
                        14,
                        outcome.disposition()
                );
            }

            statement.setObject(
                    15,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    private static void insertSnapshotItem(
            Connection connection,
            UUID snapshotId,
            OutcomeItemRow item,
            String noteOverride
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_outcome_snapshot_items (
                                    id,
                                    snapshot_id,
                                    outcome_item_id,
                                    source_continuation_item_id,
                                    source_continuation_action,
                                    source_residual_amount,
                                    resolution_type,
                                    observed_reduction_amount,
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
                    item.id()
            );

            statement.setObject(
                    4,
                    item.sourceContinuationItemId()
            );

            statement.setString(
                    5,
                    item.sourceContinuationAction()
            );

            statement.setBigDecimal(
                    6,
                    item.sourceResidual()
            );

            statement.setString(
                    7,
                    item.resolutionType()
            );

            statement.setBigDecimal(
                    8,
                    item.reduction()
            );

            statement.setBigDecimal(
                    9,
                    item.remaining()
            );

            statement.setDate(
                    10,
                    Date.valueOf(
                            item.observedOn()
                    )
            );

            statement.setString(
                    11,
                    item.reference()
            );

            statement.setString(
                    12,
                    noteOverride == null
                            ? item.note()
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
                                    outcome_number,
                                    source_continuation_case_id,
                                    source_continuation_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_residual_amount,

                                    (
                                        SELECT COALESCE(
                                            SUM(
                                                remaining_residual_amount
                                            ),
                                            outcome.source_residual_amount
                                        )

                                        FROM procurement_remediation_continuation_outcome_items

                                        WHERE outcome_case_id =
                                            outcome.id
                                    ) AS remaining_residual,

                                    source_item_count,
                                    status,
                                    residual_disposition

                                FROM procurement_remediation_continuation_outcome_cases outcome

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
                            "Outcome case not found"
                    );
                }


                return new CaseRow(
                        result.getString(
                                "outcome_number"
                        ),
                        result.getObject(
                                "source_continuation_case_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_continuation_number"
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
                                "remaining_residual"
                        ),
                        result.getInt(
                                "source_item_count"
                        ),
                        result.getString(
                                "status"
                        ),
                        result.getString(
                                "residual_disposition"
                        )
                );
            }
        }
    }


    private static OutcomeItemRow outcomeItem(
            Connection connection,
            UUID id
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    id,
                                    source_continuation_item_id,
                                    source_continuation_action,
                                    source_residual_amount,
                                    resolution_type,
                                    observed_reduction_amount,
                                    remaining_residual_amount,
                                    observed_on,
                                    evidence_reference,
                                    evidence_note

                                FROM procurement_remediation_continuation_outcome_items

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


                return new OutcomeItemRow(
                        result.getObject(
                                "id",
                                UUID.class
                        ),
                        result.getObject(
                                "source_continuation_item_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_continuation_action"
                        ),
                        result.getBigDecimal(
                                "source_residual_amount"
                        ),
                        result.getString(
                                "resolution_type"
                        ),
                        result.getBigDecimal(
                                "observed_reduction_amount"
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
            UUID id,
            String role
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
                    "app_users metadata missing"
            );
        }


        List<ColumnDefinition> insert =
                definitions.stream()
                        .filter(
                                FlywheelContinuationOutcomePostgresTest
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
                        id,
                        role
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
                        column.generated()
                        != null

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
                column.defaultValue()
                == null;
    }


    private static void bindUserValue(
            PreparedStatement statement,
            int index,
            ColumnDefinition column,
            UUID id,
            String role
    ) throws SQLException {
        String name =
                column.name()
                        .toLowerCase(
                                Locale.ROOT
                        );


        if (name.equals("id")) {
            statement.setObject(
                    index,
                    id
            );

            return;
        }


        if (name.contains("email")) {
            setText(
                    statement,
                    index,
                    column,
                    "step88-"
                    + id
                    + "@example.test"
            );

            return;
        }


        if (name.contains("password")) {
            setText(
                    statement,
                    index,
                    column,
                    "step88-password-hash"
            );

            return;
        }


        if (
                name.equals("full_name")
                ||
                name.equals("name")
        ) {
            setText(
                    statement,
                    index,
                    column,
                    "Step 88 "
                    + role
            );

            return;
        }


        if (name.equals("role")) {
            setText(
                    statement,
                    index,
                    column,
                    role
            );

            return;
        }


        if (name.equals("active")) {
            statement.setBoolean(
                    index,
                    true
            );

            return;
        }


        if (name.contains("status")) {
            setText(
                    statement,
                    index,
                    column,
                    "ACTIVE"
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
                            "STEP88-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP88",
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
                assertTrue(
                        result.next()
                );


                return result.getString(
                        1
                );
            }
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
                assertTrue(
                        result.next()
                );


                return result.getBoolean(
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
                        "Expected SQL exception containing '"
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
                + " "
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
            if (cursor.getMessage() != null) {
                if (result.length() > 0) {
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
                    "Missing environment variable: "
                    + name
            );
        }


        return value;
    }


    private static void validateDisposableDatabase(
            String value
    ) {
        if (
                !value.startsWith(
                        "jdbc:postgresql://127.0.0.1:"
                )
        ) {
            throw new IllegalStateException(
                    "Step 88 requires loopback PostgreSQL."
            );
        }


        if (
                !value.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 88 requires disposable procureiq_step70."
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


    private record SourceItemSpec(
            String sourceAction,
            String sourceResolution,
            String continuationAction,
            BigDecimal amount
    ) {
    }


    private record SourceItem(
            UUID id,
            String continuationAction,
            BigDecimal amount
    ) {
    }


    private record SourceSeed(
            UUID caseId,
            String continuationNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal total,
            List<SourceItem> items
    ) {
    }


    private record OutcomeFixture(
            UUID caseId,
            BigDecimal remaining,
            List<UUID> outcomeItemIds
    ) {
    }


    private record CaseRow(
            String outcomeNumber,
            UUID sourceContinuationCaseId,
            String sourceContinuationNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal sourceResidual,
            BigDecimal remainingResidual,
            int itemCount,
            String status,
            String disposition
    ) {
    }


    private record OutcomeItemRow(
            UUID id,
            UUID sourceContinuationItemId,
            String sourceContinuationAction,
            BigDecimal sourceResidual,
            String resolutionType,
            BigDecimal reduction,
            BigDecimal remaining,
            LocalDate observedOn,
            String reference,
            String note
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
