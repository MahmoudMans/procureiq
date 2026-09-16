package com.procureiq.flywheelcontinuation;

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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FlywheelResidualContinuationConcurrencyPostgresTest {

    private static String jdbcUrl;

    private static String jdbcUser;

    private static String jdbcPassword;

    private static String schema;

    private static UUID actorId;

    private static UUID managerOneId;

    private static UUID managerTwoId;


    @BeforeAll
    static void beforeAll() throws Exception {
        jdbcUrl =
                requiredEnvironment(
                        "PROCUREIQ_STEP86_DB_URL"
                );

        jdbcUser =
                requiredEnvironment(
                        "PROCUREIQ_STEP86_DB_USER"
                );

        jdbcPassword =
                requiredEnvironment(
                        "PROCUREIQ_STEP86_DB_PASSWORD"
                );


        validateDisposableDatabase(
                jdbcUrl
        );


        schema =
                "step86_concurrency_"
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
             * Keep continuation integrity triggers active.
             *
             * Disable only audit triggers because audit persistence is not
             * the subject of Step 86 race-condition assurance.
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

            managerOneId =
                    UUID.randomUUID();

            managerTwoId =
                    UUID.randomUUID();


            seedUser(
                    connection,
                    actorId,
                    "BUYER"
            );

            seedUser(
                    connection,
                    managerOneId,
                    "PROCUREMENT_MANAGER"
            );

            seedUser(
                    connection,
                    managerTwoId,
                    "ADMIN"
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
                        procurement_remediation_continuation_snapshot_items,
                        procurement_remediation_continuation_snapshots,
                        procurement_remediation_continuation_items,
                        procurement_remediation_continuation_cases,
                        procurement_remediation_outcome_items,
                        procurement_remediation_outcome_cases
                    CASCADE
                    """
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 1
     * SAME OUTCOME -> TWO CONTINUATION CASE INSERTS
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentContinuationCreationAllowsExactlyOneCase() throws Exception {
        OutcomeSeed source =
                seedVerifiedOutcome(
                        "100.00",
                        "40.00"
                );


        UUID leftId =
                UUID.randomUUID();

        UUID rightId =
                UUID.randomUUID();


        List<RaceResult> results =
                race(
                        connection ->
                                insertContinuationCase(
                                        connection,
                                        source,
                                        leftId,
                                        "RCC-STEP86-L-"
                                        + shortId()
                                ),

                        connection ->
                                insertContinuationCase(
                                        connection,
                                        source,
                                        rightId,
                                        "RCC-STEP86-R-"
                                        + shortId()
                                )
                );


        assertUniqueInsertRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    1L,
                    queryLong(
                            connection,
                            """
                            SELECT COUNT(*)

                            FROM procurement_remediation_continuation_cases

                            WHERE source_outcome_case_id = ?
                            """,
                            source.caseId()
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * SAME SOURCE OUTCOME ITEM -> TWO CONTINUATION ITEM INSERTS
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentContinuationItemCreationAllowsExactlyOneItem() throws Exception {
        OutcomeSeed source =
                seedVerifiedOutcome(
                        "100.00",
                        "40.00"
                );


        UUID caseId =
                createContinuation(
                        source
                );


        OutcomeItem sourceItem =
                source.items()
                        .getFirst();


        List<RaceResult> results =
                race(
                        connection ->
                                insertContinuationItem(
                                        connection,
                                        caseId,
                                        sourceItem,
                                        UUID.randomUUID()
                                ),

                        connection ->
                                insertContinuationItem(
                                        connection,
                                        caseId,
                                        sourceItem,
                                        UUID.randomUUID()
                                )
                );


        assertUniqueInsertRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    1L,
                    queryLong(
                            connection,
                            """
                            SELECT COUNT(*)

                            FROM procurement_remediation_continuation_items

                            WHERE continuation_case_id = ?
                            """,
                            caseId
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 3
     * DRAFT -> IN_REVIEW RACE
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentSubmissionAllowsExactlyOneTransition() throws Exception {
        ContinuationFixture fixture =
                completeDraft();


        List<RaceResult> results =
                race(
                        connection ->
                                submit(
                                        connection,
                                        fixture.caseId(),
                                        actorId
                                ),

                        connection ->
                                submit(
                                        connection,
                                        fixture.caseId(),
                                        actorId
                                )
                );


        assertSingleTransitionRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    "IN_REVIEW",
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


            assertEquals(
                    1L,
                    queryLong(
                            connection,
                            """
                            SELECT version

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
     * 4
     * IN_REVIEW -> APPROVED RACE
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentApprovalAllowsExactlyOneManagerTransition() throws Exception {
        ContinuationFixture fixture =
                completeSubmitted();


        List<RaceResult> results =
                race(
                        connection ->
                                approve(
                                        connection,
                                        fixture.caseId(),
                                        managerOneId,
                                        "Manager one approval"
                                ),

                        connection ->
                                approve(
                                        connection,
                                        fixture.caseId(),
                                        managerTwoId,
                                        "Manager two approval"
                                )
                );


        assertSingleTransitionRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
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


            assertEquals(
                    2L,
                    queryLong(
                            connection,
                            """
                            SELECT version

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );


            UUID approvedBy =
                    queryUuid(
                            connection,
                            """
                            SELECT approved_by_user_id

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    );


            assertTrue(
                    Set.of(
                            managerOneId,
                            managerTwoId
                    ).contains(
                            approvedBy
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * APPROVED -> CLOSED RACE
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentClosureAllowsExactlyOneTransition() throws Exception {
        ContinuationFixture fixture =
                completeApproved();


        List<RaceResult> results =
                race(
                        connection ->
                                close(
                                        connection,
                                        fixture.caseId(),
                                        managerOneId,
                                        "Manager one closure"
                                ),

                        connection ->
                                close(
                                        connection,
                                        fixture.caseId(),
                                        managerTwoId,
                                        "Manager two closure"
                                )
                );


        assertSingleTransitionRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
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


            assertEquals(
                    3L,
                    queryLong(
                            connection,
                            """
                            SELECT version

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    )
            );


            UUID closedBy =
                    queryUuid(
                            connection,
                            """
                            SELECT closed_by_user_id

                            FROM procurement_remediation_continuation_cases

                            WHERE id = ?
                            """,
                            fixture.caseId()
                    );


            assertTrue(
                    Set.of(
                            managerOneId,
                            managerTwoId
                    ).contains(
                            closedBy
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * SNAPSHOT FALSE -> TRUE RACE
     * -----------------------------------------------------------------------
     */


    @Test
    void concurrentSnapshotSealingAllowsExactlyOneTransition() throws Exception {
        ContinuationFixture fixture =
                completeDraft();


        UUID snapshotId =
                createCompleteUnsealedSnapshot(
                        fixture
                );


        List<RaceResult> results =
                race(
                        connection ->
                                sealSnapshot(
                                        connection,
                                        snapshotId
                                ),

                        connection ->
                                sealSnapshot(
                                        connection,
                                        snapshotId
                                )
                );


        assertSingleTransitionRace(
                results
        );


        try (
                Connection connection =
                        connection()
        ) {
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


            assertEquals(
                    fixture.itemIds()
                            .size(),
                    Math.toIntExact(
                            queryLong(
                                    connection,
                                    """
                                    SELECT COUNT(*)

                                    FROM procurement_remediation_continuation_snapshot_items

                                    WHERE snapshot_id = ?
                                    """,
                                    snapshotId
                            )
                    )
            );
        }
    }


    /*
     * -----------------------------------------------------------------------
     * FIXTURE BUILDERS
     * -----------------------------------------------------------------------
     */


    private static ContinuationFixture completeDraft() throws Exception {
        OutcomeSeed source =
                seedVerifiedOutcome(
                        "100.00",
                        "40.00"
                );


        UUID caseId =
                createContinuation(
                        source
                );


        List<UUID> itemIds =
                new ArrayList<>();


        try (
                Connection connection =
                        connection()
        ) {
            for (
                    OutcomeItem item
                    : source.items()
            ) {
                if (
                        item.remaining()
                                .signum()
                        <= 0
                ) {
                    continue;
                }


                UUID id =
                        UUID.randomUUID();


                int inserted =
                        insertContinuationItem(
                                connection,
                                caseId,
                                item,
                                id
                        );


                assertEquals(
                        1,
                        inserted
                );


                itemIds.add(
                        id
                );
            }
        }


        return new ContinuationFixture(
                caseId,
                List.copyOf(
                        itemIds
                )
        );
    }


    private static ContinuationFixture completeSubmitted() throws Exception {
        ContinuationFixture fixture =
                completeDraft();


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    1,
                    submit(
                            connection,
                            fixture.caseId(),
                            actorId
                    )
            );
        }


        return fixture;
    }


    private static ContinuationFixture completeApproved() throws Exception {
        ContinuationFixture fixture =
                completeSubmitted();


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    1,
                    approve(
                            connection,
                            fixture.caseId(),
                            managerOneId,
                            "Sequential setup approval"
                    )
            );
        }


        return fixture;
    }


    private static UUID createContinuation(
            OutcomeSeed source
    ) throws Exception {
        UUID id =
                UUID.randomUUID();


        try (
                Connection connection =
                        connection()
        ) {
            assertEquals(
                    1,
                    insertContinuationCase(
                            connection,
                            source,
                            id,
                            "RCC-STEP86-"
                            + shortId()
                    )
            );
        }


        return id;
    }


    /*
     * -----------------------------------------------------------------------
     * SOURCE OUTCOME
     * -----------------------------------------------------------------------
     */


    private static OutcomeSeed seedVerifiedOutcome(
            String sourceAmount,
            String resolvedAmount
    ) throws Exception {
        BigDecimal source =
                money(
                        sourceAmount
                );

        BigDecimal resolved =
                money(
                        resolvedAmount
                );

        BigDecimal remaining =
                source.subtract(
                        resolved
                );


        assertTrue(
                resolved.signum()
                > 0
        );

        assertTrue(
                remaining.signum()
                > 0
        );


        UUID caseId =
                UUID.randomUUID();

        UUID itemId =
                UUID.randomUUID();

        String outcomeNumber =
                "ROC-STEP86-"
                + shortId();


        try (
                Connection connection =
                        connection()
        ) {
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
                                            'Step 86 verified outcome',
                                            'USD',
                                            2026,
                                            ?,
                                            1,
                                            ?,
                                            'Step 86 Buyer',
                                            'VERIFIED',
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

                    statement.setBigDecimal(
                            4,
                            source
                    );

                    statement.setObject(
                            5,
                            actorId
                    );

                    statement.setObject(
                            6,
                            actorId
                    );

                    statement.executeUpdate();
                }


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
                                            'RECOVERY_FOLLOW_UP',
                                            ?,
                                            'RECOVERY_EVIDENCED',
                                            ?,
                                            ?,
                                            CURRENT_DATE,
                                            ?,
                                            'Step 86 concurrency source',
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

                    statement.setBigDecimal(
                            4,
                            source
                    );

                    statement.setBigDecimal(
                            5,
                            resolved
                    );

                    statement.setBigDecimal(
                            6,
                            remaining
                    );

                    statement.setString(
                            7,
                            "STEP86-"
                            + shortId()
                    );

                    statement.setObject(
                            8,
                            actorId
                    );

                    statement.executeUpdate();
                }

            } finally {
                execute(
                        connection,
                        "SET session_replication_role = origin"
                );
            }
        }


        return new OutcomeSeed(
                caseId,
                outcomeNumber,
                "USD",
                remaining,
                1,
                List.of(
                        new OutcomeItem(
                                itemId,
                                "RECOVERY_FOLLOW_UP",
                                "RECOVERY_EVIDENCED",
                                remaining
                        )
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * CONTINUATION SQL
     * -----------------------------------------------------------------------
     */


    private static int insertContinuationCase(
            Connection connection,
            OutcomeSeed source,
            UUID id,
            String continuationNumber
    ) throws SQLException {
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
                                    'Step 86 continuation',
                                    ?,
                                    2026,
                                    ?,
                                    ?,
                                    ?,
                                    'Step 86 Buyer',
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
                    continuationNumber
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
                    source.currency()
            );

            statement.setBigDecimal(
                    6,
                    source.remainingTotal()
            );

            statement.setInt(
                    7,
                    source.positiveCount()
            );

            statement.setObject(
                    8,
                    actorId
            );

            statement.setObject(
                    9,
                    actorId
            );


            return statement.executeUpdate();
        }
    }


    private static int insertContinuationItem(
            Connection connection,
            UUID caseId,
            OutcomeItem source,
            UUID itemId
    ) throws SQLException {
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
                                    'RECOVERY_RETRY',
                                    ?,
                                    'Step 86 concurrency governance',
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

            statement.setDate(
                    7,
                    Date.valueOf(
                            LocalDate.now()
                                    .plusDays(
                                            30
                                    )
                    )
            );

            statement.setObject(
                    8,
                    actorId
            );


            return statement.executeUpdate();
        }
    }


    private static int submit(
            Connection connection,
            UUID caseId,
            UUID actor
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_cases

                                SET
                                    status = 'IN_REVIEW',
                                    review_submitted_by_user_id = ?,
                                    review_submitted_at = CURRENT_TIMESTAMP,
                                    version = version + 1,
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

            statement.setObject(
                    2,
                    caseId
            );


            return statement.executeUpdate();
        }
    }


    private static int approve(
            Connection connection,
            UUID caseId,
            UUID manager,
            String note
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_cases

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
                                UPDATE procurement_remediation_continuation_cases

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


    /*
     * -----------------------------------------------------------------------
     * SNAPSHOT SQL
     * -----------------------------------------------------------------------
     */


    private static UUID createCompleteUnsealedSnapshot(
            ContinuationFixture fixture
    ) throws Exception {
        UUID snapshotId =
                UUID.randomUUID();


        try (
                Connection connection =
                        connection()
        ) {
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
                                    SELECT
                                        ?,
                                        ?,
                                        continuation.id,
                                        continuation.continuation_number,
                                        continuation.source_outcome_case_id,
                                        continuation.source_outcome_number,
                                        continuation.title,
                                        continuation.currency,
                                        continuation.fiscal_year,
                                        continuation.source_remaining_residual_amount,
                                        continuation.source_residual_item_count,
                                        continuation.status,
                                        ?,
                                        CURRENT_TIMESTAMP,
                                        FALSE

                                    FROM procurement_remediation_continuation_cases continuation

                                    WHERE continuation.id = ?
                                    """
                            )
            ) {
                statement.setObject(
                        1,
                        snapshotId
                );

                statement.setString(
                        2,
                        "RCS-STEP86-"
                        + shortId()
                );

                statement.setObject(
                        3,
                        actorId
                );

                statement.setObject(
                        4,
                        fixture.caseId()
                );


                assertEquals(
                        1,
                        statement.executeUpdate()
                );
            }


            for (
                    UUID continuationItemId
                    : fixture.itemIds()
            ) {
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
                                        SELECT
                                            ?,
                                            ?,
                                            item.id,
                                            item.source_outcome_item_id,
                                            item.source_action,
                                            item.source_resolution_type,
                                            item.source_remaining_residual_amount,
                                            item.continuation_action,
                                            item.target_date,
                                            item.rationale

                                        FROM procurement_remediation_continuation_items item

                                        WHERE item.id = ?
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
                            continuationItemId
                    );


                    assertEquals(
                            1,
                            statement.executeUpdate()
                    );
                }
            }
        }


        return snapshotId;
    }


    private static int sealSnapshot(
            Connection connection,
            UUID snapshotId
    ) throws SQLException {
        try (
                PreparedStatement statement =
                        connection.prepareStatement(
                                """
                                UPDATE procurement_remediation_continuation_snapshots

                                SET sealed = TRUE

                                WHERE id = ?

                                AND sealed = FALSE
                                """
                        )
        ) {
            statement.setObject(
                    1,
                    snapshotId
            );


            return statement.executeUpdate();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * RACE ENGINE
     * -----------------------------------------------------------------------
     */


    private static List<RaceResult> race(
            SqlOperation left,
            SqlOperation right
    ) throws Exception {
        ExecutorService executor =
                Executors.newFixedThreadPool(
                        2
                );


        CountDownLatch ready =
                new CountDownLatch(
                        2
                );

        CountDownLatch start =
                new CountDownLatch(
                        1
                );


        try {
            Future<RaceResult> leftFuture =
                    executor.submit(
                            raceTask(
                                    ready,
                                    start,
                                    left
                            )
                    );


            Future<RaceResult> rightFuture =
                    executor.submit(
                            raceTask(
                                    ready,
                                    start,
                                    right
                            )
                    );


            assertTrue(
                    ready.await(
                            10,
                            TimeUnit.SECONDS
                    ),
                    "Concurrent transactions did not become ready."
            );


            start.countDown();


            RaceResult leftResult =
                    leftFuture.get(
                            30,
                            TimeUnit.SECONDS
                    );


            RaceResult rightResult =
                    rightFuture.get(
                            30,
                            TimeUnit.SECONDS
                    );


            return List.of(
                    leftResult,
                    rightResult
            );

        } finally {
            start.countDown();

            executor.shutdownNow();

            executor.awaitTermination(
                    5,
                    TimeUnit.SECONDS
            );
        }
    }


    private static Callable<RaceResult> raceTask(
            CountDownLatch ready,
            CountDownLatch start,
            SqlOperation operation
    ) {
        return () -> {
            try (
                    Connection connection =
                            connection()
            ) {
                connection.setAutoCommit(
                        false
                );


                ready.countDown();


                if (
                        !start.await(
                                10,
                                TimeUnit.SECONDS
                        )
                ) {
                    connection.rollback();

                    return new RaceResult(
                            false,
                            -1,
                            null,
                            "Race start timeout"
                    );
                }


                try {
                    int updateCount =
                            operation.run(
                                    connection
                            );


                    connection.commit();


                    return new RaceResult(
                            true,
                            updateCount,
                            null,
                            null
                    );

                } catch (SQLException exception) {
                    connection.rollback();


                    return new RaceResult(
                            false,
                            -1,
                            exception.getSQLState(),
                            sqlMessages(
                                    exception
                            )
                    );
                }
            }
        };
    }


    private static void assertUniqueInsertRace(
            List<RaceResult> results
    ) {
        long committedOne =
                results.stream()
                        .filter(
                                RaceResult::committed
                        )
                        .filter(
                                result ->
                                        result.updateCount()
                                        == 1
                        )
                        .count();


        long failures =
                results.stream()
                        .filter(
                                result ->
                                        !result.committed()
                        )
                        .count();


        assertEquals(
                1,
                committedOne,
                () ->
                        "Expected one committed insert but got "
                        + results
        );


        assertEquals(
                1,
                failures,
                () ->
                        "Expected one rejected duplicate but got "
                        + results
        );


        RaceResult rejected =
                results.stream()
                        .filter(
                                result ->
                                        !result.committed()
                        )
                        .findFirst()
                        .orElseThrow();


        assertEquals(
                "23505",
                rejected.sqlState(),
                () ->
                        "Expected unique violation but got "
                        + rejected
        );
    }


    private static void assertSingleTransitionRace(
            List<RaceResult> results
    ) {
        assertTrue(
                results.stream()
                        .allMatch(
                                RaceResult::committed
                        ),
                () ->
                        "Lifecycle race unexpectedly raised SQL failure: "
                        + results
        );


        List<Integer> counts =
                results.stream()
                        .map(
                                RaceResult::updateCount
                        )
                        .sorted(
                                Comparator.naturalOrder()
                        )
                        .toList();


        assertEquals(
                List.of(
                        0,
                        1
                ),
                counts,
                () ->
                        "Expected exactly one lifecycle mutation: "
                        + results
        );
    }


    /*
     * -----------------------------------------------------------------------
     * SQL READ HELPERS
     * -----------------------------------------------------------------------
     */


    private static long queryLong(
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


                return result.getLong(
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
                assertTrue(
                        result.next()
                );


                return result.getString(
                        1
                );
            }
        }
    }


    private static UUID queryUuid(
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


                return result.getObject(
                        1,
                        UUID.class
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
                while (
                        result.next()
                ) {
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


        if (
                definitions.isEmpty()
        ) {
            throw new SQLException(
                    "app_users metadata missing"
            );
        }


        List<ColumnDefinition> insert =
                definitions.stream()
                        .filter(
                                FlywheelResidualContinuationConcurrencyPostgresTest
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
                    "step86-"
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
                    "step86-password-hash"
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
                    "Step 86 "
                    + role
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
                    role
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
                            "STEP86-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP86",
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
     * GENERIC HELPERS
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


    private static String sqlMessages(
            SQLException exception
    ) {
        StringBuilder result =
                new StringBuilder();


        SQLException cursor =
                exception;


        while (
                cursor != null
        ) {
            if (
                    cursor.getMessage()
                    != null
            ) {
                if (
                        result.length()
                        > 0
                ) {
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
            String value
    ) {
        if (
                !value.startsWith(
                        "jdbc:postgresql://127.0.0.1:"
                )
        ) {
            throw new IllegalStateException(
                    "Step 86 requires loopback PostgreSQL."
            );
        }


        if (
                !value.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 86 requires disposable procureiq_step70."
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
     * TYPES
     * -----------------------------------------------------------------------
     */


    @FunctionalInterface
    private interface SqlOperation {

        int run(
                Connection connection
        ) throws SQLException;
    }


    private record RaceResult(
            boolean committed,
            int updateCount,
            String sqlState,
            String message
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
            List<UUID> itemIds
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
