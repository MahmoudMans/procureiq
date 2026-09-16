package com.procureiq.flywheelcontinuation;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;

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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringJUnitConfig(
        FlywheelResidualContinuationServicePostgresIntegrationTest.TestConfiguration.class
)
class FlywheelResidualContinuationServicePostgresIntegrationTest {

    private static final String JDBC_URL =
            requiredEnvironment(
                    "PROCUREIQ_STEP84_DB_URL"
            );

    private static final String JDBC_USER =
            requiredEnvironment(
                    "PROCUREIQ_STEP84_DB_USER"
            );

    private static final String JDBC_PASSWORD =
            requiredEnvironment(
                    "PROCUREIQ_STEP84_DB_PASSWORD"
            );

    private static final String SCHEMA =
            "step84_integration_"
            + UUID.randomUUID()
                    .toString()
                    .replace(
                            "-",
                            ""
                    );


    private static final UUID BUYER_ID =
            UUID.randomUUID();

    private static final UUID MANAGER_ID =
            UUID.randomUUID();

    private static final UUID APPROVER_ID =
            UUID.randomUUID();


    @org.springframework.beans.factory.annotation.Autowired
    private FlywheelResidualContinuationService service;


    @org.springframework.beans.factory.annotation.Autowired
    private JdbcTemplate jdbc;


    @org.springframework.beans.factory.annotation.Autowired
    private DataSource dataSource;


    @BeforeAll
    static void beforeAll() throws Exception {
        validateDisposableDatabase(
                JDBC_URL
        );


        try (
                Connection connection =
                        DriverManager.getConnection(
                                JDBC_URL,
                                JDBC_USER,
                                JDBC_PASSWORD
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "CREATE SCHEMA "
                    + quoteIdentifier(
                            SCHEMA
                    )
            );
        }


        Flyway.configure()
                .dataSource(
                        JDBC_URL,
                        JDBC_USER,
                        JDBC_PASSWORD
                )
                .schemas(
                        SCHEMA
                )
                .defaultSchema(
                        SCHEMA
                )
                .locations(
                        "classpath:db/migration"
                )
                .load()
                .migrate();


        try (
                Connection connection =
                        DriverManager.getConnection(
                                JDBC_URL,
                                JDBC_USER,
                                JDBC_PASSWORD
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "SET search_path TO "
                    + quoteIdentifier(
                            SCHEMA
                    )
            );


            /*
             * Audit behavior is intentionally outside Step 84 scope.
             *
             * The production continuation lifecycle/database triggers stay
             * fully active.
             */
            statement.execute(
                    """
                    ALTER TABLE procurement_remediation_continuation_cases
                    DISABLE TRIGGER trg_audit_remediation_continuation_cases
                    """
            );

            statement.execute(
                    """
                    ALTER TABLE procurement_remediation_continuation_items
                    DISABLE TRIGGER trg_audit_remediation_continuation_items
                    """
            );


            seedUser(
                    connection,
                    BUYER_ID,
                    "BUYER",
                    true
            );

            seedUser(
                    connection,
                    MANAGER_ID,
                    "PROCUREMENT_MANAGER",
                    true
            );

            seedUser(
                    connection,
                    APPROVER_ID,
                    "APPROVER",
                    true
            );
        }
    }


    @AfterAll
    static void afterAll() throws Exception {
        try (
                Connection connection =
                        DriverManager.getConnection(
                                JDBC_URL,
                                JDBC_USER,
                                JDBC_PASSWORD
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "DROP SCHEMA IF EXISTS "
                    + quoteIdentifier(
                            SCHEMA
                    )
                    + " CASCADE"
            );
        }
    }


    @BeforeEach
    void beforeEach() {
        jdbc.execute(
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


    /*
     * -----------------------------------------------------------------------
     * 1
     * DASHBOARD SOURCE DISCOVERY
     * -----------------------------------------------------------------------
     */


    @Test
    void dashboardDiscoversVerifiedPositiveResidualSource() throws Exception {
        OutcomeSeed source =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "100.00",
                                        "40.00"
                                )
                        )
                );


        FlywheelResidualContinuationDashboardResponse dashboard =
                service.dashboard(
                        BUYER_ID
                );


        assertEquals(
                1,
                dashboard.eligibleSources()
                        .size()
        );


        FlywheelResidualContinuationSourceResponse eligible =
                dashboard.eligibleSources()
                        .getFirst();


        assertEquals(
                source.caseId(),
                eligible.outcomeCaseId()
        );

        assertEquals(
                0,
                money(
                        "60.00"
                ).compareTo(
                        eligible.remainingResidualAmount()
                )
        );

        assertEquals(
                1,
                eligible.residualItemCount()
        );


        assertEquals(
                0,
                dashboard.summary()
                        .totalCases()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * CREATE CASE + SOURCE ELIGIBILITY
     * -----------------------------------------------------------------------
     */


    @Test
    void createCasePersistsExactAuthorityAndRemovesSourceEligibility() throws Exception {
        OutcomeSeed source =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "100.00",
                                        "25.00"
                                )
                        )
                );


        FlywheelResidualContinuationCaseDetailResponse created =
                service.createCase(
                        BUYER_ID,
                        new FlywheelResidualContinuationCaseInput(
                                source.caseId(),
                                "Step 84 governed residual"
                        )
                );


        FlywheelResidualContinuationCaseResponse continuation =
                created.continuationCase();


        assertEquals(
                FlywheelResidualContinuationStatus.DRAFT,
                continuation.status()
        );

        assertEquals(
                source.caseId(),
                continuation.sourceOutcomeCaseId()
        );

        assertEquals(
                source.outcomeNumber(),
                continuation.sourceOutcomeNumber()
        );

        assertEquals(
                source.currency(),
                continuation.currency()
        );

        assertEquals(
                0,
                source.remainingTotal()
                        .compareTo(
                                continuation.sourceRemainingResidualAmount()
                        )
        );

        assertEquals(
                source.positiveCount(),
                continuation.sourceResidualItemCount()
        );

        assertEquals(
                0,
                continuation.itemCount()
        );


        FlywheelResidualContinuationDashboardResponse dashboard =
                service.dashboard(
                        BUYER_ID
                );


        assertTrue(
                dashboard.eligibleSources()
                        .isEmpty()
        );

        assertEquals(
                1,
                dashboard.cases()
                        .size()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 3
     * ITEM PERSISTENCE
     * -----------------------------------------------------------------------
     */


    @Test
    void addItemPersistsGovernedContinuationAction() throws Exception {
        OutcomeSeed source =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "100.00",
                                        "40.00"
                                )
                        )
                );


        FlywheelResidualContinuationCaseDetailResponse created =
                createCase(
                        source
                );


        OutcomeItem sourceItem =
                source.items()
                        .getFirst();


        FlywheelResidualContinuationCaseDetailResponse afterItem =
                service.addItem(
                        BUYER_ID,
                        created.continuationCase()
                                .id(),
                        new FlywheelResidualContinuationItemInput(
                                sourceItem.id(),
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                LocalDate.now()
                                        .plusDays(
                                                30
                                        ),
                                "Retry recovery with governed follow-up."
                        )
                );


        assertEquals(
                1,
                afterItem.items()
                        .size()
        );


        FlywheelResidualContinuationItemResponse item =
                afterItem.items()
                        .getFirst();


        assertEquals(
                sourceItem.id(),
                item.sourceOutcomeItemId()
        );

        assertEquals(
                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                item.continuationAction()
        );

        assertEquals(
                0,
                sourceItem.remaining()
                        .compareTo(
                                item.sourceRemainingResidualAmount()
                        )
        );

        assertEquals(
                1,
                afterItem.continuationCase()
                        .itemCount()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 4
     * COMPLETE COVERAGE BEFORE SUBMISSION
     * -----------------------------------------------------------------------
     */


    @Test
    void submitRejectsIncompleteCoverageThenSucceedsWhenComplete() throws Exception {
        OutcomeSeed source =
                seedOutcome(
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


        FlywheelResidualContinuationCaseDetailResponse created =
                createCase(
                        source
                );


        UUID caseId =
                created.continuationCase()
                        .id();


        addItem(
                caseId,
                source.items()
                        .getFirst()
        );


        IllegalArgumentException incomplete =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                service.submit(
                                        BUYER_ID,
                                        caseId
                                )
                );


        assertTrue(
                incomplete.getMessage()
                        .contains(
                                "Every residual item requires continuation governance"
                        )
        );


        addItem(
                caseId,
                source.items()
                        .get(1)
        );


        FlywheelResidualContinuationCaseDetailResponse submitted =
                service.submit(
                        BUYER_ID,
                        caseId
                );


        assertEquals(
                FlywheelResidualContinuationStatus.IN_REVIEW,
                submitted.continuationCase()
                        .status()
        );

        assertEquals(
                2,
                submitted.items()
                        .size()
        );

        assertEquals(
                BUYER_ID,
                submitted.continuationCase()
                        .reviewSubmittedByUserId()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * MANAGER APPROVAL + AUTOMATIC SEALED SNAPSHOT
     * -----------------------------------------------------------------------
     */


    @Test
    void approvalRequiresManagerAndAutomaticallyCapturesSealedSnapshot() throws Exception {
        ContinuationFixture fixture =
                completeSubmittedContinuation(
                        seedOutcome(
                                List.of(
                                        recoveryItem(
                                                "100.00",
                                                "40.00"
                                        )
                                )
                        )
                );


        IllegalArgumentException buyerApproval =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                service.approve(
                                        BUYER_ID,
                                        fixture.caseId(),
                                        new FlywheelResidualContinuationNoteInput(
                                                "Buyer must not approve."
                                        )
                                )
                );


        assertTrue(
                buyerApproval.getMessage()
                        .contains(
                                "Procurement manager approval is required"
                        )
        );


        FlywheelResidualContinuationCaseDetailResponse approved =
                service.approve(
                        MANAGER_ID,
                        fixture.caseId(),
                        new FlywheelResidualContinuationNoteInput(
                                "Manager approved continuation governance."
                        )
                );


        assertEquals(
                FlywheelResidualContinuationStatus.APPROVED,
                approved.continuationCase()
                        .status()
        );

        assertEquals(
                MANAGER_ID,
                approved.continuationCase()
                        .approvedByUserId()
        );

        assertEquals(
                1,
                approved.snapshots()
                        .size()
        );

        FlywheelResidualContinuationSnapshotSummaryResponse snapshot =
                approved.snapshots()
                        .getFirst();

        assertTrue(
                snapshot.sealed()
        );

        assertEquals(
                FlywheelResidualContinuationStatus.APPROVED,
                snapshot.continuationStatus()
        );

        assertEquals(
                approved.continuationCase()
                        .sourceResidualItemCount(),
                snapshot.itemCount()
        );


        FlywheelResidualContinuationSnapshotDetailResponse detail =
                service.snapshot(
                        APPROVER_ID,
                        snapshot.id()
                );


        assertEquals(
                approved.items()
                        .size(),
                detail.items()
                        .size()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * CLOSURE + SECOND SEALED SNAPSHOT
     * -----------------------------------------------------------------------
     */


    @Test
    void closureCreatesClosedStateAndSecondSealedSnapshot() throws Exception {
        ContinuationFixture fixture =
                completeSubmittedContinuation(
                        seedOutcome(
                                List.of(
                                        recoveryItem(
                                                "120.00",
                                                "20.00"
                                        )
                                )
                        )
                );


        service.approve(
                MANAGER_ID,
                fixture.caseId(),
                new FlywheelResidualContinuationNoteInput(
                        "Approved."
                )
        );


        FlywheelResidualContinuationCaseDetailResponse closed =
                service.close(
                        MANAGER_ID,
                        fixture.caseId(),
                        new FlywheelResidualContinuationNoteInput(
                                "Governance cycle closed."
                        )
                );


        assertEquals(
                FlywheelResidualContinuationStatus.CLOSED,
                closed.continuationCase()
                        .status()
        );

        assertEquals(
                MANAGER_ID,
                closed.continuationCase()
                        .closedByUserId()
        );

        assertEquals(
                2,
                closed.snapshots()
                        .size()
        );


        long approvedSnapshots =
                closed.snapshots()
                        .stream()
                        .filter(
                                snapshot ->
                                        snapshot.continuationStatus()
                                        ==
                                        FlywheelResidualContinuationStatus.APPROVED
                        )
                        .count();


        long closedSnapshots =
                closed.snapshots()
                        .stream()
                        .filter(
                                snapshot ->
                                        snapshot.continuationStatus()
                                        ==
                                        FlywheelResidualContinuationStatus.CLOSED
                        )
                        .count();


        assertEquals(
                1,
                approvedSnapshots
        );

        assertEquals(
                1,
                closedSnapshots
        );


        assertTrue(
                closed.snapshots()
                        .stream()
                        .allMatch(
                                FlywheelResidualContinuationSnapshotSummaryResponse
                                    ::sealed
                        )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 7
     * MANUAL SNAPSHOT COVERAGE
     * -----------------------------------------------------------------------
     */


    @Test
    void manualSnapshotRejectsIncompleteCoverageAndSealsWhenComplete() throws Exception {
        OutcomeSeed source =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "100.00",
                                        "40.00"
                                ),

                                writeOffItem(
                                        "80.00",
                                        "30.00"
                                )
                        )
                );


        FlywheelResidualContinuationCaseDetailResponse created =
                createCase(
                        source
                );


        UUID caseId =
                created.continuationCase()
                        .id();


        addItem(
                caseId,
                source.items()
                        .getFirst()
        );


        IllegalArgumentException incomplete =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                service.captureSnapshot(
                                        BUYER_ID,
                                        caseId
                                )
                );


        assertTrue(
                incomplete.getMessage()
                        .contains(
                                "Every residual item requires continuation governance"
                        )
        );


        addItem(
                caseId,
                source.items()
                        .get(1)
        );


        FlywheelResidualContinuationSnapshotDetailResponse snapshot =
                service.captureSnapshot(
                        BUYER_ID,
                        caseId
                );


        assertTrue(
                snapshot.snapshot()
                        .sealed()
        );

        assertEquals(
                FlywheelResidualContinuationStatus.DRAFT,
                snapshot.snapshot()
                        .continuationStatus()
        );

        assertEquals(
                2,
                snapshot.items()
                        .size()
        );

        assertEquals(
                0,
                source.remainingTotal()
                        .compareTo(
                                snapshot.snapshot()
                                        .sourceRemainingResidualAmount()
                        )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 8
     * DASHBOARD LIFECYCLE + FINANCIAL RECONCILIATION
     * -----------------------------------------------------------------------
     */


    @Test
    void dashboardSummaryReconcilesLifecycleAndGovernedResidual() throws Exception {
        /*
         * DRAFT = 10
         */
        OutcomeSeed draftSource =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "11.00",
                                        "1.00"
                                )
                        )
                );

        createCase(
                draftSource
        );


        /*
         * IN_REVIEW = 20
         */
        OutcomeSeed reviewSource =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "21.00",
                                        "1.00"
                                )
                        )
                );

        ContinuationFixture review =
                completeSubmittedContinuation(
                        reviewSource
                );


        /*
         * APPROVED = 30
         */
        OutcomeSeed approvedSource =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "31.00",
                                        "1.00"
                                )
                        )
                );

        ContinuationFixture approved =
                completeSubmittedContinuation(
                        approvedSource
                );

        service.approve(
                MANAGER_ID,
                approved.caseId(),
                new FlywheelResidualContinuationNoteInput(
                        "Approved."
                )
        );


        /*
         * CLOSED = 40
         */
        OutcomeSeed closedSource =
                seedOutcome(
                        List.of(
                                recoveryItem(
                                        "41.00",
                                        "1.00"
                                )
                        )
                );

        ContinuationFixture closed =
                completeSubmittedContinuation(
                        closedSource
                );

        service.approve(
                MANAGER_ID,
                closed.caseId(),
                new FlywheelResidualContinuationNoteInput(
                        "Approved."
                )
        );

        service.close(
                MANAGER_ID,
                closed.caseId(),
                new FlywheelResidualContinuationNoteInput(
                        "Closed."
                )
        );


        FlywheelResidualContinuationDashboardResponse dashboard =
                service.dashboard(
                        APPROVER_ID
                );


        FlywheelResidualContinuationSummaryResponse summary =
                dashboard.summary();


        assertEquals(
                4,
                summary.totalCases()
        );

        assertEquals(
                1,
                summary.draftCases()
        );

        assertEquals(
                1,
                summary.inReviewCases()
        );

        assertEquals(
                1,
                summary.approvedCases()
        );

        assertEquals(
                1,
                summary.closedCases()
        );


        assertEquals(
                FlywheelResidualContinuationStatus.IN_REVIEW,
                service.continuationCase(
                                APPROVER_ID,
                                review.caseId()
                        )
                        .continuationCase()
                        .status()
        );


        assertEquals(
                1,
                summary.governedResidualByCurrency()
                        .size()
        );


        FlywheelResidualContinuationCurrencyTotal total =
                summary.governedResidualByCurrency()
                        .getFirst();


        assertEquals(
                "USD",
                total.currency()
        );

        assertEquals(
                0,
                money(
                        "100.00"
                ).compareTo(
                        total.amount()
                )
        );


        assertTrue(
                dashboard.eligibleSources()
                        .isEmpty()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * SERVICE HELPERS
     * -----------------------------------------------------------------------
     */


    private FlywheelResidualContinuationCaseDetailResponse createCase(
            OutcomeSeed source
    ) {
        return service.createCase(
                BUYER_ID,
                new FlywheelResidualContinuationCaseInput(
                        source.caseId(),
                        "Step 84 continuation "
                        + shortId()
                )
        );
    }


    private FlywheelResidualContinuationCaseDetailResponse addItem(
            UUID caseId,
            OutcomeItem source
    ) {
        return service.addItem(
                BUYER_ID,
                caseId,
                new FlywheelResidualContinuationItemInput(
                        source.id(),
                        continuationAction(
                                source.sourceAction()
                        ),
                        LocalDate.now()
                                .plusDays(
                                        30
                                ),
                        "Step 84 continuation rationale "
                        + shortId()
                )
        );
    }


    private ContinuationFixture completeSubmittedContinuation(
            OutcomeSeed source
    ) {
        FlywheelResidualContinuationCaseDetailResponse created =
                createCase(
                        source
                );


        UUID caseId =
                created.continuationCase()
                        .id();


        for (
                OutcomeItem item
                : source.items()
        ) {
            if (
                    item.remaining()
                            .signum()
                    > 0
            ) {
                addItem(
                        caseId,
                        item
                );
            }
        }


        FlywheelResidualContinuationCaseDetailResponse submitted =
                service.submit(
                        BUYER_ID,
                        caseId
                );


        assertEquals(
                FlywheelResidualContinuationStatus.IN_REVIEW,
                submitted.continuationCase()
                        .status()
        );


        return new ContinuationFixture(
                caseId
        );
    }


    private static FlywheelResidualContinuationAction continuationAction(
            String sourceAction
    ) {
        return switch (sourceAction) {
            case "RECOVERY_FOLLOW_UP" ->
                    FlywheelResidualContinuationAction.RECOVERY_RETRY;

            case "WRITE_OFF_REVIEW" ->
                    FlywheelResidualContinuationAction.WRITE_OFF_ESCALATION;

            case "INVESTIGATION_ESCALATION" ->
                    FlywheelResidualContinuationAction.INVESTIGATION_ESCALATION;

            case "RESIDUAL_ACCEPTANCE_REVIEW" ->
                    FlywheelResidualContinuationAction.RISK_ACCEPTANCE_ESCALATION;

            default ->
                    throw new IllegalArgumentException(
                            "Unsupported source action: "
                            + sourceAction
                    );
        };
    }


    /*
     * -----------------------------------------------------------------------
     * OUTCOME SOURCE FIXTURES
     * -----------------------------------------------------------------------
     */


    private OutcomeSeed seedOutcome(
            List<OutcomeItemSpec> specs
    ) throws SQLException {
        UUID caseId =
                UUID.randomUUID();


        String outcomeNumber =
                "ROC-STEP84-"
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
                                amount ->
                                        amount.signum()
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
                                spec ->
                                        spec.remaining()
                                                .signum()
                                        > 0
                        )
                        .count();


        List<OutcomeItem> items =
                new ArrayList<>();


        try (
                Connection connection =
                        dataSource.getConnection();

                Statement control =
                        connection.createStatement()
        ) {
            control.execute(
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
                                            ?,
                                            ?,
                                            2026,
                                            ?,
                                            ?,
                                            ?,
                                            'Step 84 Buyer',
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

                    statement.setString(
                            4,
                            "Step 84 source outcome "
                            + shortId()
                    );

                    statement.setString(
                            5,
                            currency
                    );

                    statement.setBigDecimal(
                            6,
                            sourceTotal
                    );

                    statement.setInt(
                            7,
                            specs.size()
                    );

                    statement.setObject(
                            8,
                            BUYER_ID
                    );

                    statement.setObject(
                            9,
                            BUYER_ID
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
                                                'Step 84 integration evidence',
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
                                "STEP84-"
                                + shortId()
                        );

                        statement.setObject(
                                10,
                                BUYER_ID
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
                control.execute(
                        "SET session_replication_role = origin"
                );
            }
        }


        assertTrue(
                remainingTotal.signum()
                > 0,
                "Step 84 fixture must retain positive residual exposure."
        );


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


    /*
     * -----------------------------------------------------------------------
     * USER SEEDING
     * -----------------------------------------------------------------------
     */


    private static void seedUser(
            Connection connection,
            UUID id,
            String role,
            boolean active
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
                    SCHEMA
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
                    "app_users metadata was not found"
            );
        }


        List<ColumnDefinition> insert =
                definitions.stream()
                        .filter(
                                FlywheelResidualContinuationServicePostgresIntegrationTest
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


        try (
                Statement control =
                        connection.createStatement()
        ) {
            control.execute(
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
                            role,
                            active
                    );
                }


                statement.executeUpdate();

            } finally {
                control.execute(
                        "SET session_replication_role = origin"
                );
            }
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
            String role,
            boolean active
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
                    "step84-"
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
                    "step84-password-hash"
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
                    "Step 84 "
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
                    active
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
                            "STEP84-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP84",
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


    private static String schemaJdbcUrl() {
        return JDBC_URL
               + (
                       JDBC_URL.contains(
                               "?"
                       )
                       ? "&"
                       : "?"
               )
               + "currentSchema="
               + SCHEMA;
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
                    "Step 84 integration tests require loopback PostgreSQL."
            );
        }


        if (
                !url.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 84 integration tests require the disposable procureiq_step70 database."
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
     * TEST CONFIGURATION
     * -----------------------------------------------------------------------
     */


    @Configuration
    @EnableTransactionManagement
    static class TestConfiguration {

        @Bean
        DataSource dataSource() {
            DriverManagerDataSource dataSource =
                    new DriverManagerDataSource();

            dataSource.setDriverClassName(
                    "org.postgresql.Driver"
            );

            dataSource.setUrl(
                    schemaJdbcUrl()
            );

            dataSource.setUsername(
                    JDBC_USER
            );

            dataSource.setPassword(
                    JDBC_PASSWORD
            );

            return dataSource;
        }


        @Bean
        JdbcTemplate jdbcTemplate(
                DataSource dataSource
        ) {
            return new JdbcTemplate(
                    dataSource
            );
        }


        @Bean
        PlatformTransactionManager transactionManager(
                DataSource dataSource
        ) {
            return new DataSourceTransactionManager(
                    dataSource
            );
        }


        @Bean
        FlywheelResidualContinuationRepository continuationRepository(
                JdbcTemplate jdbc
        ) {
            return new FlywheelResidualContinuationRepository(
                    jdbc
            );
        }


        @Bean
        FlywheelResidualContinuationPolicyService continuationPolicy() {
            return new FlywheelResidualContinuationPolicyService();
        }


        @Bean
        FlywheelResidualContinuationService continuationService(
                FlywheelResidualContinuationRepository repository,
                FlywheelResidualContinuationPolicyService policy
        ) {
            return new FlywheelResidualContinuationService(
                    repository,
                    policy
            );
        }
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
            UUID caseId
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
