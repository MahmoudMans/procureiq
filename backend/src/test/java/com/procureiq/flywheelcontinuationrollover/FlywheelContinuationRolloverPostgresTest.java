package com.procureiq.flywheelcontinuationrollover;

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

class FlywheelContinuationRolloverPostgresTest {

    private static String jdbcUrl;

    private static String jdbcUser;

    private static String jdbcPassword;

    private static String schema;

    private static UUID actorId;


    @BeforeAll
    static void beforeAll() throws Exception {
        jdbcUrl =
                requiredEnvironment(
                        "PROCUREIQ_STEP90_DB_URL"
                );

        jdbcUser =
                requiredEnvironment(
                        "PROCUREIQ_STEP90_DB_USER"
                );

        jdbcPassword =
                requiredEnvironment(
                        "PROCUREIQ_STEP90_DB_PASSWORD"
                );


        validateDisposableDatabase(
                jdbcUrl
        );


        schema =
                "step90_rollover_"
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
             * Audit storage is not Step 90's subject.
             *
             * Integrity triggers remain enabled.
             */
            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_rollover_cases
                    DISABLE TRIGGER trg_audit_continuation_rollover_cases
                    """
            );

            execute(
                    connection,
                    """
                    ALTER TABLE procurement_remediation_continuation_rollover_items
                    DISABLE TRIGGER trg_audit_continuation_rollover_items
                    """
            );


            actorId =
                    UUID.randomUUID();


            seedUser(
                    connection,
                    actorId
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
                        procurement_remediation_continuation_rollover_snapshot_items,
                        procurement_remediation_continuation_rollover_snapshots,
                        procurement_remediation_continuation_rollover_items,
                        procurement_remediation_continuation_rollover_cases,
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
    void rejectsNonVerifiedSourceOutcome() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "IN_REVIEW",
                            "FURTHER_GOVERNANCE_REQUIRED",
                            List.of(
                                    positiveItem(
                                            "40.00"
                                    )
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverCase(
                                            connection,
                                            source
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires VERIFIED positive residual requiring further governance"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsFullyResolvedOrZeroResidualSource() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            "FULLY_RESOLVED",
                            List.of(
                                    zeroItem()
                            )
                    );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverCase(
                                            connection,
                                            source
                                    )
                    );


            assertMessageContains(
                    exception,
                    "requires VERIFIED positive residual requiring further governance"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 3
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsForgedLineageAndDuplicateSourceRollover() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedEligibleOutcome(
                            connection,
                            "40.00"
                    );


            SQLException forged =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverCaseRaw(
                                            connection,
                                            source,
                                            UUID.randomUUID(),
                                            "RCR-STEP90-FORGED-"
                                            + shortId(),
                                            source.parentCaseId(),
                                            "FORGED-PARENT",
                                            source.remainingResidual(),
                                            source.positiveItemCount()
                                    )
                    );


            assertMessageContains(
                    forged,
                    "source authority does not reconcile"
            );


            insertRolloverCase(
                    connection,
                    source
            );


            SQLException duplicate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverCase(
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
     * 4
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsForeignAndZeroResidualSourceItems() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            "FURTHER_GOVERNANCE_REQUIRED",
                            List.of(
                                    positiveItem(
                                            "40.00"
                                    ),
                                    zeroItem()
                            )
                    );


            OutcomeSeed foreign =
                    seedEligibleOutcome(
                            connection,
                            "25.00"
                    );


            UUID caseId =
                    insertRolloverCase(
                            connection,
                            source
                    );


            SQLException foreignItem =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverItem(
                                            connection,
                                            caseId,
                                            foreign.items()
                                                    .getFirst(),
                                            foreign.items()
                                                    .getFirst()
                                                    .sourceAction(),
                                            LocalDate.now()
                                                    .plusDays(
                                                            30
                                                    ),
                                            "Foreign item"
                                    )
                    );


            assertMessageContains(
                    foreignItem,
                    "belongs to another source outcome"
            );


            SourceOutcomeItem zero =
                    source.items()
                            .stream()
                            .filter(
                                    item ->
                                            item.remaining()
                                                    .signum()
                                            == 0
                            )
                            .findFirst()
                            .orElseThrow();


            SQLException zeroResidual =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverItem(
                                            connection,
                                            caseId,
                                            zero,
                                            zero.sourceAction(),
                                            LocalDate.now()
                                                    .plusDays(
                                                            30
                                                    ),
                                            "Zero item"
                                    )
                    );


            assertMessageContains(
                    zeroResidual,
                    "Only positive continuation outcome residual may roll forward"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * -----------------------------------------------------------------------
     */


    @Test
    void requiresExactPriorContinuationAction() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedEligibleOutcome(
                            connection,
                            "40.00"
                    );


            UUID caseId =
                    insertRolloverCase(
                            connection,
                            source
                    );


            SourceOutcomeItem item =
                    source.items()
                            .getFirst();


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverItem(
                                            connection,
                                            caseId,
                                            item,
                                            "WRITE_OFF_ESCALATION",
                                            LocalDate.now()
                                                    .plusDays(
                                                            30
                                                    ),
                                            "Attempt to change strategy"
                                    )
                    );


            assertMessageContains(
                    exception,
                    "must preserve prior continuation action"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * -----------------------------------------------------------------------
     */


    @Test
    void rejectsPastTargetAndBlankRationale() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedEligibleOutcome(
                            connection,
                            "40.00"
                    );


            UUID caseId =
                    insertRolloverCase(
                            connection,
                            source
                    );


            SourceOutcomeItem item =
                    source.items()
                            .getFirst();


            SQLException past =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverItem(
                                            connection,
                                            caseId,
                                            item,
                                            item.sourceAction(),
                                            LocalDate.now()
                                                    .minusDays(
                                                            1
                                                    ),
                                            "Past"
                                    )
                    );


            assertMessageContains(
                    past,
                    "target date cannot be in the past"
            );


            SQLException blank =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertRolloverItem(
                                            connection,
                                            caseId,
                                            item,
                                            item.sourceAction(),
                                            LocalDate.now()
                                                    .plusDays(
                                                            30
                                                    ),
                                            " "
                                    )
                    );


            assertMessageContains(
                    blank,
                    "rationale is required"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 7
     * -----------------------------------------------------------------------
     */


    @Test
    void requiresCompletePositiveResidualCoverageBeforeSubmission() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            OutcomeSeed source =
                    seedOutcome(
                            connection,
                            "VERIFIED",
                            "FURTHER_GOVERNANCE_REQUIRED",
                            List.of(
                                    positiveItem(
                                            "40.00"
                                    ),
                                    positiveItem(
                                            "20.00"
                                    )
                            )
                    );


            UUID caseId =
                    insertRolloverCase(
                            connection,
                            source
                    );


            SourceOutcomeItem first =
                    source.items()
                            .getFirst();


            insertRolloverItem(
                    connection,
                    caseId,
                    first,
                    first.sourceAction(),
                    LocalDate.now()
                            .plusDays(
                                    30
                            ),
                    "First residual only"
            );


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            caseId,
                                            1
                                    )
                    );


            assertMessageContains(
                    exception,
                    "Every positive residual outcome item requires rollover governance"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 8
     * -----------------------------------------------------------------------
     */


    @Test
    void rolloverItemsAreImmutable() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            RolloverFixture fixture =
                    completeRollover(
                            connection,
                            List.of(
                                    "40.00"
                            )
                    );


            UUID itemId =
                    fixture.rolloverItemIds()
                            .getFirst();


            SQLException update =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_rollover_items

                                            SET rationale = 'Tampered'

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    update,
                    "rollover items are immutable"
            );


            SQLException delete =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            DELETE FROM procurement_remediation_continuation_rollover_items

                                            WHERE id = ?
                                            """,
                                            itemId
                                    )
                    );


            assertMessageContains(
                    delete,
                    "rollover items are immutable"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 9
     * -----------------------------------------------------------------------
     */


    @Test
    void lifecycleRequiresExactVersionAndApprovalEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            RolloverFixture fixture =
                    completeRollover(
                            connection,
                            List.of(
                                    "40.00"
                            )
                    );


            SQLException directApproval =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    directApproveFromDraft(
                                            connection,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    directApproval,
                    "Invalid continuation rollover lifecycle transition"
            );


            SQLException badVersion =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            fixture.caseId(),
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
                            1
                    )
            );


            SQLException blankApproval =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    approve(
                                            connection,
                                            fixture.caseId(),
                                            " "
                                    )
                    );


            assertMessageContains(
                    blankApproval,
                    "Manager approval evidence is required"
            );


            assertEquals(
                    1,
                    approve(
                            connection,
                            fixture.caseId(),
                            "Approved residual governance."
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
    void closurePreservesPriorLifecycleEvidence() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            RolloverFixture fixture =
                    completeRollover(
                            connection,
                            List.of(
                                    "40.00"
                            )
                    );


            submit(
                    connection,
                    fixture.caseId(),
                    1
            );


            approve(
                    connection,
                    fixture.caseId(),
                    "Approved residual governance."
            );


            SQLException tampered =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    closeChangingApprovalNote(
                                            connection,
                                            fixture.caseId()
                                    )
                    );


            assertMessageContains(
                    tampered,
                    "Closure cannot alter prior rollover evidence"
            );


            assertEquals(
                    1,
                    close(
                            connection,
                            fixture.caseId(),
                            "Governance cycle finalized."
                    )
            );


            assertEquals(
                    "CLOSED",
                    queryString(
                            connection,
                            """
                            SELECT status

                            FROM procurement_remediation_continuation_rollover_cases

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
    void lifecycleRevalidatesSourceOutcomeAuthority() throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            RolloverFixture fixture =
                    completeRollover(
                            connection,
                            List.of(
                                    "40.00"
                            )
                    );


            /*
             * Simulate storage corruption / an out-of-band historical write.
             *
             * Normal runtime cannot legally perform this transition because
             * the continuation-outcome layer is itself protected.
             */
            execute(
                    connection,
                    "SET session_replication_role = replica"
            );


            try {
                update(
                        connection,
                        """
                        UPDATE procurement_remediation_continuation_outcome_cases

                        SET status = 'CLOSED'

                        WHERE id = ?
                        """,
                        fixture.source()
                                .outcomeCaseId()
                );

            } finally {
                execute(
                        connection,
                        "SET session_replication_role = origin"
                );
            }


            SQLException exception =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    submit(
                                            connection,
                                            fixture.caseId(),
                                            1
                                    )
                    );


            assertMessageContains(
                    exception,
                    "source is no longer VERIFIED positive residual requiring further governance"
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 12
     * -----------------------------------------------------------------------
     */


    @Test
    void snapshotAuthorityCompletenessSealingAndImmutabilityAreEnforced()
            throws Exception {
        try (
                Connection connection =
                        connection()
        ) {
            RolloverFixture fixture =
                    completeRollover(
                            connection,
                            List.of(
                                    "40.00",
                                    "20.00"
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


            RolloverItemRow first =
                    rolloverItem(
                            connection,
                            fixture.rolloverItemIds()
                                    .get(0)
                    );


            RolloverItemRow second =
                    rolloverItem(
                            connection,
                            fixture.rolloverItemIds()
                                    .get(1)
                    );


            SQLException forgedItem =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    insertSnapshotItem(
                                            connection,
                                            snapshotId,
                                            first,
                                            "FORGED RATIONALE"
                                    )
                    );


            assertMessageContains(
                    forgedItem,
                    "snapshot item does not match authority"
            );


            insertSnapshotItem(
                    connection,
                    snapshotId,
                    first,
                    null
            );


            SQLException incompleteSeal =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    sealSnapshot(
                                            connection,
                                            snapshotId
                                    )
                    );


            assertMessageContains(
                    incompleteSeal,
                    "does not reconcile to authoritative rollover evidence"
            );


            insertSnapshotItem(
                    connection,
                    snapshotId,
                    second,
                    null
            );


            assertEquals(
                    1,
                    sealSnapshot(
                            connection,
                            snapshotId
                    )
            );


            assertTrue(
                    queryBoolean(
                            connection,
                            """
                            SELECT sealed

                            FROM procurement_remediation_continuation_rollover_snapshots

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
                                            first,
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


            SQLException mutate =
                    assertThrows(
                            SQLException.class,
                            () ->
                                    update(
                                            connection,
                                            """
                                            UPDATE procurement_remediation_continuation_rollover_snapshots

                                            SET title = 'Tampered after seal'

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
     * ROLLOVER FIXTURES
     * -----------------------------------------------------------------------
     */


    private static RolloverFixture completeRollover(
            Connection connection,
            List<String> positiveResiduals
    ) throws Exception {
        List<OutcomeItemSpec> specs =
                positiveResiduals.stream()
                        .map(
                                FlywheelContinuationRolloverPostgresTest
                                    ::positiveItem
                        )
                        .toList();


        OutcomeSeed source =
                seedOutcome(
                        connection,
                        "VERIFIED",
                        "FURTHER_GOVERNANCE_REQUIRED",
                        specs
                );


        UUID caseId =
                insertRolloverCase(
                        connection,
                        source
                );


        List<UUID> rolloverItems =
                new ArrayList<>();


        for (
                SourceOutcomeItem item
                : source.items()
        ) {
            if (
                    item.remaining()
                            .signum()
                    <= 0
            ) {
                continue;
            }


            rolloverItems.add(
                    insertRolloverItem(
                            connection,
                            caseId,
                            item,
                            item.sourceAction(),
                            LocalDate.now()
                                    .plusDays(
                                            30
                                    ),
                            "Step 90 governed residual continuation."
                    )
            );
        }


        return new RolloverFixture(
                caseId,
                source,
                List.copyOf(
                        rolloverItems
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * UPSTREAM FIXTURES
     * -----------------------------------------------------------------------
     */


    private static OutcomeSeed seedEligibleOutcome(
            Connection connection,
            String remaining
    ) throws Exception {
        return seedOutcome(
                connection,
                "VERIFIED",
                "FURTHER_GOVERNANCE_REQUIRED",
                List.of(
                        positiveItem(
                                remaining
                        )
                )
        );
    }


    private static OutcomeItemSpec positiveItem(
            String remaining
    ) {
        return new OutcomeItemSpec(
                "RECOVERY_RETRY",
                "PARTIAL",
                money(
                        "100.00"
                ),
                money(
                        remaining
                )
        );
    }


    private static OutcomeItemSpec zeroItem() {
        return new OutcomeItemSpec(
                "RECOVERY_RETRY",
                "RECOVERY_CONFIRMED",
                money(
                        "100.00"
                ),
                money(
                        "0.00"
                )
        );
    }


    private static OutcomeSeed seedOutcome(
            Connection connection,
            String outcomeStatus,
            String disposition,
            List<OutcomeItemSpec> specs
    ) throws Exception {
        UUID parentCaseId =
                UUID.randomUUID();


        String parentNumber =
                "RCC-STEP90-"
                + shortId();


        String title =
                "Step 90 rollover source "
                + shortId();


        String currency =
                "USD";


        int fiscalYear =
                2026;


        UUID outcomeCaseId =
                UUID.randomUUID();


        String outcomeNumber =
                "RCO-STEP90-"
                + shortId();


        BigDecimal sourceTotal =
                specs.stream()
                        .map(
                                OutcomeItemSpec::sourceAmount
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        BigDecimal positiveRemaining =
                specs.stream()
                        .map(
                                OutcomeItemSpec::remaining
                        )
                        .filter(
                                value ->
                                        value.signum() > 0
                        )
                        .reduce(
                                money(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        List<SourceOutcomeItem> items =
                new ArrayList<>();


        execute(
                connection,
                "SET session_replication_role = replica"
        );


        try {
            /*
             * Parent continuation.
             */
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
                                        'Step 90 Actor',
                                        'CLOSED',
                                        3,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        CURRENT_TIMESTAMP
                                    )
                                    """
                            )
            ) {
                statement.setObject(
                        1,
                        parentCaseId
                );

                statement.setString(
                        2,
                        parentNumber
                );

                statement.setObject(
                        3,
                        UUID.randomUUID()
                );

                statement.setString(
                        4,
                        "ROC-PARENT-"
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
                        sourceTotal
                );

                statement.setInt(
                        9,
                        specs.size()
                );

                statement.setObject(
                        10,
                        actorId
                );

                statement.setObject(
                        11,
                        actorId
                );

                statement.executeUpdate();
            }


            /*
             * Source continuation items.
             */
            List<UUID> continuationItemIds =
                    new ArrayList<>();


            for (
                    OutcomeItemSpec spec
                    : specs
            ) {
                UUID continuationItemId =
                        UUID.randomUUID();


                continuationItemIds.add(
                        continuationItemId
                );


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
                                            'RECOVERY_FOLLOW_UP',
                                            'RECOVERY_EVIDENCED',
                                            ?,
                                            ?,
                                            ?,
                                            'Step 90 parent governance',
                                            ?,
                                            CURRENT_TIMESTAMP
                                        )
                                        """
                                )
                ) {
                    statement.setObject(
                            1,
                            continuationItemId
                    );

                    statement.setObject(
                            2,
                            parentCaseId
                    );

                    statement.setObject(
                            3,
                            UUID.randomUUID()
                    );

                    statement.setBigDecimal(
                            4,
                            spec.sourceAmount()
                    );

                    statement.setString(
                            5,
                            spec.sourceAction()
                    );

                    statement.setDate(
                            6,
                            Date.valueOf(
                                    LocalDate.now()
                                            .plusDays(
                                                    10
                                            )
                            )
                    );

                    statement.setObject(
                            7,
                            actorId
                    );

                    statement.executeUpdate();
                }
            }


            /*
             * Outcome case.
             */
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
                                        residual_disposition,
                                        verified_remaining_residual_amount,
                                        review_submitted_by_user_id,
                                        review_submitted_at,
                                        verified_by_user_id,
                                        verified_at,
                                        verification_note,
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
                                        'Step 90 Actor',
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        'Step 90 source verification',
                                        2,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        CURRENT_TIMESTAMP
                                    )
                                    """
                            )
            ) {
                statement.setObject(
                        1,
                        outcomeCaseId
                );

                statement.setString(
                        2,
                        outcomeNumber
                );

                statement.setObject(
                        3,
                        parentCaseId
                );

                statement.setString(
                        4,
                        parentNumber
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
                        sourceTotal
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
                        outcomeStatus
                );

                if (disposition == null) {
                    statement.setNull(
                            12,
                            Types.VARCHAR
                    );
                } else {
                    statement.setString(
                            12,
                            disposition
                    );
                }

                statement.setBigDecimal(
                        13,
                        positiveRemaining
                );

                statement.setObject(
                        14,
                        actorId
                );

                statement.setObject(
                        15,
                        actorId
                );

                statement.setObject(
                        16,
                        actorId
                );

                statement.executeUpdate();
            }


            /*
             * Outcome items.
             */
            for (
                    int index = 0;
                    index < specs.size();
                    index++
            ) {
                OutcomeItemSpec spec =
                        specs.get(
                                index
                        );


                UUID outcomeItemId =
                        UUID.randomUUID();


                UUID continuationItemId =
                        continuationItemIds.get(
                                index
                        );


                BigDecimal reduction =
                        spec.sourceAmount()
                                .subtract(
                                        spec.remaining()
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
                                            'Step 90 outcome evidence',
                                            ?,
                                            CURRENT_TIMESTAMP
                                        )
                                        """
                                )
                ) {
                    statement.setObject(
                            1,
                            outcomeItemId
                    );

                    statement.setObject(
                            2,
                            outcomeCaseId
                    );

                    statement.setObject(
                            3,
                            continuationItemId
                    );

                    statement.setString(
                            4,
                            spec.sourceAction()
                    );

                    statement.setBigDecimal(
                            5,
                            spec.sourceAmount()
                    );

                    statement.setString(
                            6,
                            spec.resolutionType()
                    );

                    statement.setBigDecimal(
                            7,
                            reduction
                    );

                    statement.setBigDecimal(
                            8,
                            spec.remaining()
                    );

                    statement.setDate(
                            9,
                            Date.valueOf(
                                    LocalDate.now()
                            )
                    );

                    statement.setString(
                            10,
                            "STEP90-"
                            + shortId()
                    );

                    statement.setObject(
                            11,
                            actorId
                    );

                    statement.executeUpdate();
                }


                items.add(
                        new SourceOutcomeItem(
                                outcomeItemId,
                                continuationItemId,
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


        int positiveCount =
                (int)
                items.stream()
                        .filter(
                                item ->
                                        item.remaining()
                                                .signum()
                                        > 0
                        )
                        .count();


        return new OutcomeSeed(
                parentCaseId,
                parentNumber,
                outcomeCaseId,
                outcomeNumber,
                title,
                currency,
                fiscalYear,
                positiveRemaining,
                positiveCount,
                List.copyOf(
                        items
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * ROLLOVER CASE SQL
     * -----------------------------------------------------------------------
     */


    private static UUID insertRolloverCase(
            Connection connection,
            OutcomeSeed source
    ) throws SQLException {
        UUID id =
                UUID.randomUUID();


        insertRolloverCaseRaw(
                connection,
                source,
                id,
                "RCR-STEP90-"
                + shortId(),
                source.parentCaseId(),
                source.parentNumber(),
                source.remainingResidual(),
                source.positiveItemCount()
        );


        return id;
    }


    private static int insertRolloverCaseRaw(
            Connection connection,
            OutcomeSeed source,
            UUID id,
            String rolloverNumber,
            UUID parentCaseId,
            String parentNumber,
            BigDecimal residual,
            int itemCount
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_rollover_cases (
                                    id,
                                    rollover_number,
                                    source_continuation_outcome_case_id,
                                    source_continuation_outcome_number,
                                    parent_continuation_case_id,
                                    parent_continuation_number,
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
                                    ?,
                                    ?,
                                    'Step 90 Actor',
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
                    rolloverNumber
            );

            statement.setObject(
                    3,
                    source.outcomeCaseId()
            );

            statement.setString(
                    4,
                    source.outcomeNumber()
            );

            statement.setObject(
                    5,
                    parentCaseId
            );

            statement.setString(
                    6,
                    parentNumber
            );

            statement.setString(
                    7,
                    source.title()
            );

            statement.setString(
                    8,
                    source.currency()
            );

            statement.setInt(
                    9,
                    source.fiscalYear()
            );

            statement.setBigDecimal(
                    10,
                    residual
            );

            statement.setInt(
                    11,
                    itemCount
            );

            statement.setObject(
                    12,
                    actorId
            );

            statement.setObject(
                    13,
                    actorId
            );


            return statement.executeUpdate();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * ROLLOVER ITEM SQL
     * -----------------------------------------------------------------------
     */


    private static UUID insertRolloverItem(
            Connection connection,
            UUID rolloverCaseId,
            SourceOutcomeItem source,
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
                                INSERT INTO procurement_remediation_continuation_rollover_items (
                                    id,
                                    rollover_case_id,
                                    source_continuation_outcome_item_id,
                                    source_continuation_item_id,
                                    source_continuation_action,
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
                    rolloverCaseId
            );

            statement.setObject(
                    3,
                    source.outcomeItemId()
            );

            statement.setObject(
                    4,
                    source.continuationItemId()
            );

            statement.setString(
                    5,
                    source.sourceAction()
            );

            statement.setString(
                    6,
                    source.resolutionType()
            );

            statement.setBigDecimal(
                    7,
                    source.remaining()
            );

            statement.setString(
                    8,
                    continuationAction
            );

            statement.setDate(
                    9,
                    Date.valueOf(
                            targetDate
                    )
            );

            statement.setString(
                    10,
                    rationale
            );

            statement.setObject(
                    11,
                    actorId
            );

            statement.executeUpdate();
        }


        return id;
    }


    /*
     * -----------------------------------------------------------------------
     * LIFECYCLE
     * -----------------------------------------------------------------------
     */


    private static int submit(
            Connection connection,
            UUID caseId,
            int versionIncrement
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_rollover_cases

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
                    actorId
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


    private static int approve(
            Connection connection,
            UUID caseId,
            String note
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_rollover_cases

                                SET
                                    status = 'APPROVED',
                                    approved_by_user_id = ?,
                                    approved_at = CURRENT_TIMESTAMP,
                                    approval_note = ?,
                                    version = version + 1,
                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                                AND status = 'IN_REVIEW'
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    actorId
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


    private static int close(
            Connection connection,
            UUID caseId,
            String note
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_rollover_cases

                                SET
                                    status = 'CLOSED',
                                    closed_by_user_id = ?,
                                    closed_at = CURRENT_TIMESTAMP,
                                    close_note = ?,
                                    version = version + 1,
                                    updated_at = CURRENT_TIMESTAMP

                                WHERE id = ?

                                AND status = 'APPROVED'
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    actorId
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


    private static int directApproveFromDraft(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        return update(
                connection,
                """
                UPDATE procurement_remediation_continuation_rollover_cases

                SET
                    status = 'APPROVED',
                    approved_by_user_id = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    approval_note = 'Direct approval',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                actorId,
                caseId
        );
    }


    private static int closeChangingApprovalNote(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        return update(
                connection,
                """
                UPDATE procurement_remediation_continuation_rollover_cases

                SET
                    status = 'CLOSED',
                    approval_note = 'Tampered approval',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = 'Closure',
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                """,
                actorId,
                caseId
        );
    }


    /*
     * -----------------------------------------------------------------------
     * SNAPSHOT
     * -----------------------------------------------------------------------
     */


    private static UUID insertSnapshotHeader(
            Connection connection,
            UUID caseId,
            String titleOverride
    ) throws SQLException {
        RolloverCaseRow rollover =
                rolloverCase(
                        connection,
                        caseId
                );


        UUID id =
                UUID.randomUUID();


        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_rollover_snapshots (
                                    id,
                                    snapshot_number,
                                    rollover_case_id,
                                    rollover_number,
                                    source_continuation_outcome_case_id,
                                    source_continuation_outcome_number,
                                    parent_continuation_case_id,
                                    parent_continuation_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_remaining_residual_amount,
                                    item_count,
                                    rollover_status,
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
                    "RCRS-STEP90-"
                    + shortId()
            );

            statement.setObject(
                    3,
                    caseId
            );

            statement.setString(
                    4,
                    rollover.rolloverNumber()
            );

            statement.setObject(
                    5,
                    rollover.sourceOutcomeCaseId()
            );

            statement.setString(
                    6,
                    rollover.sourceOutcomeNumber()
            );

            statement.setObject(
                    7,
                    rollover.parentCaseId()
            );

            statement.setString(
                    8,
                    rollover.parentNumber()
            );

            statement.setString(
                    9,
                    titleOverride == null
                            ? rollover.title()
                            : titleOverride
            );

            statement.setString(
                    10,
                    rollover.currency()
            );

            statement.setInt(
                    11,
                    rollover.fiscalYear()
            );

            statement.setBigDecimal(
                    12,
                    rollover.residual()
            );

            statement.setInt(
                    13,
                    rollover.sourceItemCount()
            );

            statement.setString(
                    14,
                    rollover.status()
            );

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
            RolloverItemRow item,
            String rationaleOverride
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                INSERT INTO procurement_remediation_continuation_rollover_snapshot_items (
                                    id,
                                    snapshot_id,
                                    rollover_item_id,
                                    source_continuation_outcome_item_id,
                                    source_continuation_item_id,
                                    source_continuation_action,
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

            statement.setObject(
                    5,
                    item.sourceContinuationItemId()
            );

            statement.setString(
                    6,
                    item.sourceAction()
            );

            statement.setString(
                    7,
                    item.sourceResolution()
            );

            statement.setBigDecimal(
                    8,
                    item.remaining()
            );

            statement.setString(
                    9,
                    item.continuationAction()
            );

            statement.setDate(
                    10,
                    Date.valueOf(
                            item.targetDate()
                    )
            );

            statement.setString(
                    11,
                    rationaleOverride == null
                            ? item.rationale()
                            : rationaleOverride
            );

            statement.executeUpdate();
        }
    }


    private static int sealSnapshot(
            Connection connection,
            UUID snapshotId
    ) throws SQLException {
        return update(
                connection,
                """
                UPDATE procurement_remediation_continuation_rollover_snapshots

                SET sealed = TRUE

                WHERE id = ?

                AND sealed = FALSE
                """,
                snapshotId
        );
    }


    /*
     * -----------------------------------------------------------------------
     * READS
     * -----------------------------------------------------------------------
     */


    private static RolloverCaseRow rolloverCase(
            Connection connection,
            UUID caseId
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    rollover_number,
                                    source_continuation_outcome_case_id,
                                    source_continuation_outcome_number,
                                    parent_continuation_case_id,
                                    parent_continuation_number,
                                    title,
                                    currency,
                                    fiscal_year,
                                    source_remaining_residual_amount,
                                    source_residual_item_count,
                                    status

                                FROM procurement_remediation_continuation_rollover_cases

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
                            "Rollover case not found"
                    );
                }


                return new RolloverCaseRow(
                        result.getString(
                                "rollover_number"
                        ),
                        result.getObject(
                                "source_continuation_outcome_case_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_continuation_outcome_number"
                        ),
                        result.getObject(
                                "parent_continuation_case_id",
                                UUID.class
                        ),
                        result.getString(
                                "parent_continuation_number"
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


    private static RolloverItemRow rolloverItem(
            Connection connection,
            UUID id
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                SELECT
                                    id,
                                    source_continuation_outcome_item_id,
                                    source_continuation_item_id,
                                    source_continuation_action,
                                    source_resolution_type,
                                    source_remaining_residual_amount,
                                    continuation_action,
                                    target_date,
                                    rationale

                                FROM procurement_remediation_continuation_rollover_items

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
                            "Rollover item not found"
                    );
                }


                return new RolloverItemRow(
                        result.getObject(
                                "id",
                                UUID.class
                        ),
                        result.getObject(
                                "source_continuation_outcome_item_id",
                                UUID.class
                        ),
                        result.getObject(
                                "source_continuation_item_id",
                                UUID.class
                        ),
                        result.getString(
                                "source_continuation_action"
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
     * USER FIXTURE
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
                    "app_users metadata missing"
            );
        }


        List<ColumnDefinition> insert =
                definitions.stream()
                        .filter(
                                FlywheelContinuationRolloverPostgresTest
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
                    "step90-"
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
                    "step90-password-hash"
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
                    "Step 90 Actor"
            );

            return;
        }


        if (name.equals("role")) {
            setText(
                    statement,
                    index,
                    column,
                    "PROCUREMENT_MANAGER"
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
                            "STEP90-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP90",
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
     * GENERIC SQL
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
            String expected
    ) {
        assertTrue(
                messageChain(
                        exception
                )
                        .toLowerCase(
                                Locale.ROOT
                        )
                        .contains(
                                expected.toLowerCase(
                                        Locale.ROOT
                                )
                        ),
                () ->
                        "Expected SQL exception containing '"
                        + expected
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
        StringBuilder builder =
                new StringBuilder();


        SQLException cursor =
                exception;


        while (cursor != null) {
            if (cursor.getMessage() != null) {
                if (builder.length() > 0) {
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
                    "Step 90 requires loopback PostgreSQL."
            );
        }


        if (
                !value.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 90 requires disposable procureiq_step70."
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
            BigDecimal sourceAmount,
            BigDecimal remaining
    ) {
    }


    private record SourceOutcomeItem(
            UUID outcomeItemId,
            UUID continuationItemId,
            String sourceAction,
            String resolutionType,
            BigDecimal remaining
    ) {
    }


    private record OutcomeSeed(
            UUID parentCaseId,
            String parentNumber,
            UUID outcomeCaseId,
            String outcomeNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal remainingResidual,
            int positiveItemCount,
            List<SourceOutcomeItem> items
    ) {
    }


    private record RolloverFixture(
            UUID caseId,
            OutcomeSeed source,
            List<UUID> rolloverItemIds
    ) {
    }


    private record RolloverCaseRow(
            String rolloverNumber,
            UUID sourceOutcomeCaseId,
            String sourceOutcomeNumber,
            UUID parentCaseId,
            String parentNumber,
            String title,
            String currency,
            int fiscalYear,
            BigDecimal residual,
            int sourceItemCount,
            String status
    ) {
    }


    private record RolloverItemRow(
            UUID id,
            UUID sourceOutcomeItemId,
            UUID sourceContinuationItemId,
            String sourceAction,
            String sourceResolution,
            BigDecimal remaining,
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
