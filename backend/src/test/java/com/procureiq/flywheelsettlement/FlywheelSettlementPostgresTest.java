package com.procureiq.flywheelsettlement;

import com.procureiq.flywheelrelease.FlywheelReleaseBatchDetailResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseBatchResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseBatchStatus;
import com.procureiq.flywheelrelease.FlywheelReleaseItemResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseItemStatus;
import com.procureiq.flywheelrelease.FlywheelReleaseService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(
        named = "PROCUREIQ_STEP72_DB_URL",
        matches = "jdbc:postgresql:.*"
)
class FlywheelSettlementPostgresTest {

    private final UUID userId =
            UUID.randomUUID();

    private final UUID strategyPortfolioId =
            UUID.randomUUID();

    private final UUID allocationMandateId =
            UUID.randomUUID();

    private final UUID allocationItemOne =
            UUID.randomUUID();

    private final UUID allocationItemTwo =
            UUID.randomUUID();

    private final UUID strategyItemOne =
            UUID.randomUUID();

    private final UUID strategyItemTwo =
            UUID.randomUUID();

    private final UUID lineageOne =
            UUID.randomUUID();

    private final UUID lineageTwo =
            UUID.randomUUID();

    private final UUID releaseBatchId =
            UUID.randomUUID();

    private final UUID releaseItemOne =
            UUID.randomUUID();

    private final UUID releaseItemTwo =
            UUID.randomUUID();

    private String schema;

    private JdbcTemplate jdbc;

    private TransactionTemplate transaction;

    private FlywheelSettlementRepository repository;

    private FlywheelSettlementPolicyService policy;

    private FlywheelSettlementService service;

    private FlywheelReleaseService releaseService;

    private FlywheelReleaseBatchDetailResponse releaseDetail;

    @BeforeEach
    void setup() throws Exception {
        String url =
                System.getenv(
                        "PROCUREIQ_STEP72_DB_URL"
                );

        if (
                url == null
                ||
                !url.matches(
                        "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 72 tests require the isolated loopback PostgreSQL database."
            );
        }

        String user =
                System.getenv(
                        "PROCUREIQ_STEP72_DB_USER"
                );

        String password =
                System.getenv(
                        "PROCUREIQ_STEP72_DB_PASSWORD"
                );

        schema =
                "step72_"
                        + UUID
                                .randomUUID()
                                .toString()
                                .replace(
                                        "-",
                                        ""
                                );

        JdbcTemplate admin =
                new JdbcTemplate(
                        new DriverManagerDataSource(
                                url,
                                user,
                                password
                        )
                );

        admin.execute(
                "CREATE SCHEMA "
                        + schema
        );

        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(
                        url
                                + "?currentSchema="
                                + schema,
                        user,
                        password
                );

        jdbc =
                new JdbcTemplate(
                        dataSource
                );

        transaction =
                new TransactionTemplate(
                        new DataSourceTransactionManager(
                                dataSource
                        )
                );

        transaction.setIsolationLevel(
                TransactionDefinition.ISOLATION_READ_COMMITTED
        );

        transaction.setTimeout(
                15
        );

        createAuthorityTables();

        jdbc.execute(
                resource(
                        "V67__create_flywheel_release_execution.sql"
                )
        );

        jdbc.execute(
                resource(
                        "V68__harden_flywheel_release_integrity.sql"
                )
        );

        jdbc.execute(
                resource(
                        "V69__create_flywheel_settlement_reconciliation.sql"
                )
        );

        jdbc.execute(
                resource(
                        "V70__harden_flywheel_settlement_runtime.sql"
                )
        );

        insertAuthorityRows();

        repository =
                new FlywheelSettlementRepository(
                        jdbc
                );

        policy =
                new FlywheelSettlementPolicyService();

        releaseService =
                mock(
                        FlywheelReleaseService.class
                );

        FlywheelReleaseBatchResponse releaseBatch =
                mock(
                        FlywheelReleaseBatchResponse.class
                );

        when(
                releaseBatch.id()
        ).thenReturn(
                releaseBatchId
        );

        when(
                releaseBatch.releaseNumber()
        ).thenReturn(
                "FWREL-TEST"
        );

        when(
                releaseBatch.allocationMandateId()
        ).thenReturn(
                allocationMandateId
        );

        when(
                releaseBatch.allocationMandateNumber()
        ).thenReturn(
                "FWALLOC-TEST"
        );

        when(
                releaseBatch.strategyPortfolioId()
        ).thenReturn(
                strategyPortfolioId
        );

        when(
                releaseBatch.strategyPortfolioNumber()
        ).thenReturn(
                "FWSTRAT-TEST"
        );

        when(
                releaseBatch.title()
        ).thenReturn(
                "Finalized release"
        );

        when(
                releaseBatch.currency()
        ).thenReturn(
                "EUR"
        );

        when(
                releaseBatch.fiscalYear()
        ).thenReturn(
                2026
        );

        when(
                releaseBatch.batchReleasedAmount()
        ).thenReturn(
                money(
                        "100.00"
                )
        );

        when(
                releaseBatch.releaseOwnerName()
        ).thenReturn(
                "Step 72 Manager"
        );

        when(
                releaseBatch.releaseRationale()
        ).thenReturn(
                "Synthetic release authority"
        );

        when(
                releaseBatch.status()
        ).thenReturn(
                FlywheelReleaseBatchStatus.EXECUTED
        );

        FlywheelReleaseItemResponse itemOne =
                releaseItem(
                        releaseItemOne,
                        allocationItemOne,
                        strategyItemOne,
                        lineageOne,
                        "LINEAGE-1",
                        "Initiative one",
                        "60.00",
                        "REL-1"
                );

        FlywheelReleaseItemResponse itemTwo =
                releaseItem(
                        releaseItemTwo,
                        allocationItemTwo,
                        strategyItemTwo,
                        lineageTwo,
                        "LINEAGE-2",
                        "Initiative two",
                        "40.00",
                        "REL-2"
                );

        releaseDetail =
                mock(
                        FlywheelReleaseBatchDetailResponse.class
                );

        when(
                releaseDetail.batch()
        ).thenReturn(
                releaseBatch
        );

        when(
                releaseDetail.items()
        ).thenReturn(
                List.of(
                        itemOne,
                        itemTwo
                )
        );

        when(
                releaseService.batch(
                        userId,
                        releaseBatchId
                )
        ).thenReturn(
                releaseDetail
        );

        AppUserEntity actor =
                mock(
                        AppUserEntity.class
                );

        when(
                actor.isActive()
        ).thenReturn(
                true
        );

        when(
                actor.getFullName()
        ).thenReturn(
                "Step 72 Manager"
        );

        when(
                actor.getRole()
        ).thenReturn(
                ProcurementRole.ADMIN
        );

        AppUserRepository users =
                mock(
                        AppUserRepository.class
                );

        when(
                users.findById(
                        userId
                )
        ).thenReturn(
                Optional.of(
                        actor
                )
        );

        service =
                new FlywheelSettlementService(
                        repository,
                        policy,
                        releaseService,
                        users
                );
    }

    @AfterEach
    void cleanup() {
        if (
                jdbc != null
                &&
                schema != null
        ) {
            jdbc.execute(
                    "DROP SCHEMA "
                            + schema
                            + " CASCADE"
            );
        }
    }

    private BigDecimal money(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    private <T> T tx(
            Supplier<T> work
    ) {
        return transaction.execute(
                status ->
                        work.get()
        );
    }

    private String resource(
            String migration
    ) throws Exception {
        try (
                InputStream input =
                        getClass()
                                .getClassLoader()
                                .getResourceAsStream(
                                        "db/migration/"
                                                + migration
                                )
        ) {
            if (
                    input == null
            ) {
                throw new IllegalStateException(
                        "Missing migration: "
                                + migration
                );
            }

            return new String(
                    input.readAllBytes(),
                    StandardCharsets.UTF_8
            );
        }
    }

    private void createAuthorityTables() {
        jdbc.execute(
                """
                CREATE TABLE app_users (
                    id UUID PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    active BOOLEAN NOT NULL
                );

                CREATE TABLE procurement_flywheel_strategy_portfolios (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_capital_flywheel_lineages (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_strategy_items (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_allocation_mandates (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_allocation_items (
                    id UUID PRIMARY KEY
                );

                CREATE FUNCTION procureiq_capture_audit_event()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RETURN NEW;
                END;
                $$;
                """
        );
    }

    private void insertAuthorityRows() {
        jdbc.update(
                """
                INSERT INTO app_users (
                    id,
                    full_name,
                    role,
                    active
                )
                VALUES (
                    ?,
                    'Step 72 Manager',
                    'ADMIN',
                    TRUE
                )
                """,
                userId
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_strategy_portfolios
                VALUES (?)
                """,
                strategyPortfolioId
        );

        jdbc.update(
                """
                INSERT INTO procurement_capital_flywheel_lineages
                VALUES (?)
                """,
                lineageOne
        );

        jdbc.update(
                """
                INSERT INTO procurement_capital_flywheel_lineages
                VALUES (?)
                """,
                lineageTwo
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_strategy_items
                VALUES (?)
                """,
                strategyItemOne
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_strategy_items
                VALUES (?)
                """,
                strategyItemTwo
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_allocation_mandates
                VALUES (?)
                """,
                allocationMandateId
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_allocation_items
                VALUES (?)
                """,
                allocationItemOne
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_allocation_items
                VALUES (?)
                """,
                allocationItemTwo
        );

        jdbc.update(
                """
                INSERT INTO procurement_flywheel_release_batches (
                    id,
                    release_number,
                    allocation_mandate_id,
                    allocation_mandate_number,
                    strategy_portfolio_id,
                    strategy_portfolio_number,
                    title,
                    currency,
                    fiscal_year,
                    mandate_authorized_amount,
                    release_owner_user_id,
                    release_owner_name_snapshot,
                    release_rationale,
                    status,
                    execution_note,
                    executed_by_user_id,
                    executed_at,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    'FWREL-TEST',
                    ?,
                    'FWALLOC-TEST',
                    ?,
                    'FWSTRAT-TEST',
                    'Finalized release',
                    'EUR',
                    2026,
                    100.00,
                    ?,
                    'Step 72 Manager',
                    'Synthetic release authority',
                    'EXECUTED',
                    'Release execution completed',
                    ?,
                    CURRENT_TIMESTAMP,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    1
                )
                """,
                releaseBatchId,
                allocationMandateId,
                strategyPortfolioId,
                userId,
                userId,
                userId
        );

        insertReleaseItem(
                releaseItemOne,
                allocationItemOne,
                strategyItemOne,
                lineageOne,
                "LINEAGE-1",
                "Initiative one",
                "60.00",
                "REL-1"
        );

        insertReleaseItem(
                releaseItemTwo,
                allocationItemTwo,
                strategyItemTwo,
                lineageTwo,
                "LINEAGE-2",
                "Initiative two",
                "40.00",
                "REL-2"
        );
    }

    private void insertReleaseItem(
            UUID releaseItemId,
            UUID allocationItemId,
            UUID strategyItemId,
            UUID lineageId,
            String lineageNumber,
            String title,
            String amount,
            String reference
    ) {
        jdbc.update(
                """
                INSERT INTO procurement_flywheel_release_items (
                    id,
                    release_batch_id,
                    allocation_item_id,
                    strategy_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    mandate_authorized_item_amount,
                    strategy_priority_score,
                    planned_release_amount,
                    status,
                    execution_reference,
                    execution_note,
                    released_by_user_id,
                    released_at,
                    added_by_user_id,
                    added_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    100.00,
                    80.00,
                    ?,
                    'RELEASED',
                    ?,
                    'Synthetic release evidence',
                    ?,
                    CURRENT_TIMESTAMP,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                releaseItemId,
                releaseBatchId,
                allocationItemId,
                strategyItemId,
                lineageId,
                lineageNumber,
                title,
                new BigDecimal(
                        amount
                ),
                reference,
                userId,
                userId
        );
    }

    private FlywheelReleaseItemResponse releaseItem(
            UUID releaseItemId,
            UUID allocationItemId,
            UUID strategyItemId,
            UUID lineageId,
            String lineageNumber,
            String title,
            String amount,
            String reference
    ) {
        FlywheelReleaseItemResponse item =
                mock(
                        FlywheelReleaseItemResponse.class
                );

        when(
                item.id()
        ).thenReturn(
                releaseItemId
        );

        when(
                item.allocationItemId()
        ).thenReturn(
                allocationItemId
        );

        when(
                item.strategyItemId()
        ).thenReturn(
                strategyItemId
        );

        when(
                item.flywheelLineageId()
        ).thenReturn(
                lineageId
        );

        when(
                item.lineageNumber()
        ).thenReturn(
                lineageNumber
        );

        when(
                item.rootTargetInitiativeTitle()
        ).thenReturn(
                title
        );

        when(
                item.plannedReleaseAmount()
        ).thenReturn(
                money(
                        amount
                )
        );

        when(
                item.executionReference()
        ).thenReturn(
                reference
        );

        when(
                item.status()
        ).thenReturn(
                FlywheelReleaseItemStatus.RELEASED
        );

        return item;
    }

    private UUID createCase() {
        return tx(
                () ->
                        service
                                .createCase(
                                        userId,
                                        new FlywheelSettlementCaseInput(
                                                releaseBatchId,
                                                "Settlement test",
                                                userId,
                                                "Synthetic reconciliation"
                                        )
                                )
                                .settlementCase()
                                .id()
        );
    }

    private void addEvidence(
            UUID caseId,
            UUID releaseItemId,
            BigDecimal settledAmount,
            String reference
    ) {
        tx(
                () ->
                        service.addItem(
                                userId,
                                caseId,
                                new FlywheelSettlementItemInput(
                                        releaseItemId,
                                        settledAmount,
                                        reference,
                                        LocalDate.now(),
                                        "Synthetic settlement evidence"
                                )
                        )
        );
    }

    private void addCompleteEvidence(
            UUID caseId
    ) {
        addEvidence(
                caseId,
                releaseItemOne,
                money(
                        "60.00"
                ),
                "BANK-1"
        );

        addEvidence(
                caseId,
                releaseItemTwo,
                money(
                        "40.00"
                ),
                "BANK-2"
        );
    }

    @Test
    void serviceDeclaresReadCommittedWriteTransactions() {
        Transactional annotation =
                FlywheelSettlementService.class
                        .getAnnotation(
                                Transactional.class
                        );

        assertNotNull(
                annotation
        );

        assertEquals(
                Isolation.READ_COMMITTED,
                annotation.isolation()
        );
    }

    @Test
    void sealedSnapshotQueriesWorkThroughEveryRepositoryPath() {
        UUID caseId =
                createCase();

        addCompleteEvidence(
                caseId
        );

        FlywheelSettlementSnapshotDetailResponse captured =
                tx(
                        () ->
                                service.captureSnapshot(
                                        userId,
                                        caseId
                                )
                );

        UUID snapshotId =
                captured
                        .snapshot()
                        .id();

        assertNotNull(
                repository.findSnapshot(
                        snapshotId
                )
        );

        assertEquals(
                1,
                repository
                        .snapshotsForCase(
                                caseId
                        )
                        .size()
        );

        assertTrue(
                repository
                        .snapshots()
                        .stream()
                        .anyMatch(
                                row ->
                                        row.id()
                                                .equals(
                                                        snapshotId
                                                )
                        )
        );
    }

    @Test
    void databaseRejectsTamperedCaseAuthorityAtInsert() {
        FlywheelSettlementReleaseAuthorityResponse badAuthority =
                new FlywheelSettlementReleaseAuthorityResponse(
                        releaseBatchId,
                        "FWREL-TEST",

                        allocationMandateId,
                        "FWALLOC-TEST",

                        strategyPortfolioId,
                        "FWSTRAT-TEST",

                        "Finalized release",

                        "EUR",
                        2026,

                        money(
                                "99.00"
                        ),

                        2,

                        "Step 72 Manager",
                        "Synthetic release authority",

                        FlywheelReleaseBatchStatus.EXECUTED
                );

        assertThrows(
                DataAccessException.class,
                () ->
                        repository.createCase(
                                UUID.randomUUID(),
                                "BAD-CASE",
                                new FlywheelSettlementCaseInput(
                                        releaseBatchId,
                                        "Tampered",
                                        userId,
                                        "Must fail"
                                ),
                                badAuthority,
                                "Step 72 Manager",
                                userId
                        )
        );
    }

    @Test
    void databaseRejectsTamperedReleaseItemAuthorityAtEvidenceInsert() {
        UUID caseId =
                createCase();

        FlywheelSettlementCandidateItemResponse badSource =
                new FlywheelSettlementCandidateItemResponse(
                        releaseItemOne,
                        allocationItemOne,

                        lineageOne,
                        "LINEAGE-1",

                        "Initiative one",

                        money(
                                "59.00"
                        ),

                        "REL-1"
                );

        FlywheelSettlementClassificationResult result =
                policy.classify(
                        money(
                                "59.00"
                        ),
                        money(
                                "59.00"
                        ),
                        "BANK-BAD"
                );

        assertThrows(
                DataAccessException.class,
                () ->
                        repository.createItem(
                                UUID.randomUUID(),
                                caseId,
                                badSource,
                                result,
                                new FlywheelSettlementItemInput(
                                        releaseItemOne,
                                        money(
                                                "59.00"
                                        ),
                                        "BANK-BAD",
                                        LocalDate.now(),
                                        "Must fail"
                                ),
                                "BANK-BAD",
                                "Must fail",
                                userId
                        )
        );
    }

    @Test
    void databaseBlocksReviewUntilEveryReleasedItemHasEvidence() {
        UUID caseId =
                createCase();

        addEvidence(
                caseId,
                releaseItemOne,
                money(
                        "60.00"
                ),
                "BANK-1"
        );

        assertThrows(
                DataAccessException.class,
                () ->
                        repository.submitForReview(
                                caseId,
                                userId
                        )
        );

        assertEquals(
                FlywheelSettlementCaseStatus.DRAFT,
                repository
                        .findCase(
                                caseId
                        )
                        .status()
        );
    }

    @Test
    void databaseRejectsNewEvidenceAfterCaseLeavesDraft() {
        UUID caseId =
                createCase();

        addCompleteEvidence(
                caseId
        );

        assertEquals(
                1,
                repository.submitForReview(
                        caseId,
                        userId
                )
        );

        assertThrows(
                DataAccessException.class,
                () ->
                        repository.createItem(
                                UUID.randomUUID(),
                                caseId,
                                new FlywheelSettlementCandidateItemResponse(
                                        releaseItemOne,
                                        allocationItemOne,
                                        lineageOne,
                                        "LINEAGE-1",
                                        "Initiative one",
                                        money(
                                                "60.00"
                                        ),
                                        "REL-1"
                                ),
                                policy.classify(
                                        money(
                                                "60.00"
                                        ),
                                        BigDecimal.ZERO,
                                        null
                                ),
                                new FlywheelSettlementItemInput(
                                        releaseItemOne,
                                        BigDecimal.ZERO,
                                        null,
                                        LocalDate.now(),
                                        "Late evidence"
                                ),
                                null,
                                "Late evidence",
                                userId
                        )
        );
    }

    @Test
    void databaseRejectsAuthorityMutationDuringLifecycleTransition() {
        UUID caseId =
                createCase();

        addCompleteEvidence(
                caseId
        );

        assertThrows(
                DataAccessException.class,
                () ->
                        jdbc.update(
                                """
                                UPDATE procurement_flywheel_settlement_cases

                                SET
                                    title = 'Tampered authority',
                                    status = 'IN_REVIEW',
                                    submitted_by_user_id = ?,
                                    submitted_at = CURRENT_TIMESTAMP,
                                    updated_at = CURRENT_TIMESTAMP,
                                    version = version + 1

                                WHERE id = ?
                                """,
                                userId,
                                caseId
                        )
        );

        assertEquals(
                FlywheelSettlementCaseStatus.DRAFT,
                repository
                        .findCase(
                                caseId
                        )
                        .status()
        );
    }

    @Test
    void completeCaseCanReviewReconcileCloseAndReadSnapshots() {
        UUID caseId =
                createCase();

        addCompleteEvidence(
                caseId
        );

        FlywheelSettlementCaseDetailResponse review =
                tx(
                        () ->
                                service.submitForReview(
                                        userId,
                                        caseId
                                )
                );

        assertEquals(
                FlywheelSettlementCaseStatus.IN_REVIEW,
                review
                        .settlementCase()
                        .status()
        );

        FlywheelSettlementCaseDetailResponse reconciled =
                tx(
                        () ->
                                service.reconcile(
                                        userId,
                                        caseId,
                                        new FlywheelSettlementNoteInput(
                                                "Evidence reviewed and reconciled"
                                        )
                                )
                );

        assertEquals(
                FlywheelSettlementCaseStatus.RECONCILED,
                reconciled
                        .settlementCase()
                        .status()
        );

        assertEquals(
                1,
                reconciled
                        .snapshots()
                        .size()
        );

        FlywheelSettlementCaseDetailResponse closed =
                tx(
                        () ->
                                service.close(
                                        userId,
                                        caseId,
                                        new FlywheelSettlementNoteInput(
                                                "Reconciliation complete"
                                        )
                                )
                );

        assertEquals(
                FlywheelSettlementCaseStatus.CLOSED,
                closed
                        .settlementCase()
                        .status()
        );

        assertEquals(
                2,
                closed
                        .snapshots()
                        .size()
        );

        assertEquals(
                2,
                repository
                        .snapshotsForCase(
                                caseId
                        )
                        .size()
        );
    }

    @Test
    void sourceReleaseLockBlocksAConcurrentWriter() throws Exception {
        ExecutorService pool =
                Executors.newSingleThreadExecutor();

        try {
            tx(
                    () -> {
                        repository.lockReleaseBatch(
                                releaseBatchId
                        );

                        Future<String> second =
                                pool.submit(
                                        () -> {
                                            try {
                                                tx(
                                                        () -> {
                                                            jdbc.execute(
                                                                    "SET LOCAL lock_timeout = '200ms'"
                                                            );

                                                            repository.lockReleaseBatch(
                                                                    releaseBatchId
                                                            );

                                                            return true;
                                                        }
                                                );

                                                return "NOT_BLOCKED";

                                            } catch (
                                                    DataAccessException exception
                                            ) {
                                                Throwable current =
                                                        exception;

                                                while (
                                                    current != null
                                                ) {
                                                    if (
                                                        current
                                                                instanceof
                                                                java.sql.SQLException sql
                                                    ) {
                                                        return sql.getSQLState();
                                                    }

                                                    current =
                                                            current.getCause();
                                                }

                                                throw exception;
                                            }
                                        }
                                );

                        try {
                            assertEquals(
                                    "55P03",
                                    second.get(
                                            5,
                                            TimeUnit.SECONDS
                                    )
                            );

                        } catch (
                                Exception exception
                        ) {
                            throw new AssertionError(
                                    exception
                            );
                        }

                        return true;
                    }
            );

        } finally {
            pool.shutdownNow();
        }
    }
}
