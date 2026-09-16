package com.procureiq.flywheelrelease;

import com.procureiq.flywheelallocation.*;
import com.procureiq.user.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// Opt-in for ordinary Maven invocations.
// The Step 70 installer requires all twelve tests to execute with zero skips.
//
// Parent authorities and the audit hook are synthetic fixtures.
// This is not a full historical migration-chain or audit-subsystem test.
@EnabledIfEnvironmentVariable(
        named = "PROCUREIQ_STEP70_DB_URL",
        matches = "jdbc:postgresql:.*"
)
class FlywheelReleasePostgresTest {

    private final UUID userId = UUID.randomUUID();
    private final UUID mandateId = UUID.randomUUID();
    private final UUID strategyId = UUID.randomUUID();
    private final UUID allocationItemId = UUID.randomUUID();
    private final UUID strategyItemId = UUID.randomUUID();
    private final UUID lineageId = UUID.randomUUID();

    private String schema;
    private JdbcTemplate jdbc;
    private TransactionTemplate transaction;
    private FlywheelReleaseRepository repository;
    private FlywheelReleaseService service;
    private FlywheelAllocationMandateResponse authority;
    private AppUserEntity actor;

    @BeforeEach
    void setup() throws Exception {
        String url = System.getenv("PROCUREIQ_STEP70_DB_URL");

        if (
                url == null
                || !url.matches(
                        "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Tests require the isolated Step 70 loopback database."
            );
        }

        String user = System.getenv("PROCUREIQ_STEP70_DB_USER");
        String password = System.getenv("PROCUREIQ_STEP70_DB_PASSWORD");

        schema = "step70_"
                + UUID.randomUUID().toString().replace("-", "");

        JdbcTemplate admin = new JdbcTemplate(
                new DriverManagerDataSource(url, user, password)
        );

        admin.execute("CREATE SCHEMA " + schema);

        DriverManagerDataSource source = new DriverManagerDataSource(
                url + "?currentSchema=" + schema,
                user,
                password
        );

        jdbc = new JdbcTemplate(source);

        transaction = new TransactionTemplate(
                new DataSourceTransactionManager(source)
        );

        transaction.setIsolationLevel(
                TransactionDefinition.ISOLATION_READ_COMMITTED
        );

        transaction.setTimeout(15);

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
                    id UUID PRIMARY KEY,
                    status TEXT NOT NULL
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

        jdbc.execute(
                resource("V67__create_flywheel_release_execution.sql")
        );

        jdbc.execute(
                resource("V68__harden_flywheel_release_integrity.sql")
        );

        jdbc.update(
                "INSERT INTO app_users VALUES (?, 'Test manager', 'ADMIN', TRUE)",
                userId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_strategy_portfolios VALUES (?)",
                strategyId
        );

        jdbc.update(
                "INSERT INTO procurement_capital_flywheel_lineages VALUES (?)",
                lineageId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_strategy_items VALUES (?)",
                strategyItemId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_allocation_mandates VALUES (?, 'AUTHORIZED')",
                mandateId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_allocation_items VALUES (?)",
                allocationItemId
        );

        authority = mock(FlywheelAllocationMandateResponse.class);

        when(authority.id()).thenReturn(mandateId);
        when(authority.mandateNumber()).thenReturn("ALLOC-TEST");
        when(authority.strategyPortfolioId()).thenReturn(strategyId);
        when(authority.strategyPortfolioNumber()).thenReturn("STRAT-TEST");
        when(authority.title()).thenReturn("Test mandate");
        when(authority.currency()).thenReturn("EUR");
        when(authority.fiscalYear()).thenReturn(2026);
        when(authority.requestedAllocationAmount()).thenReturn(n("1000.00"));
        when(authority.itemCount()).thenReturn(1);
        when(authority.mandateOwnerName()).thenReturn("Test manager");
        when(authority.mandateRationale()).thenReturn("Synthetic test authority");

        when(authority.status()).thenReturn(
                FlywheelAllocationMandateStatus.AUTHORIZED
        );

        FlywheelAllocationItemResponse sourceItem =
                mock(FlywheelAllocationItemResponse.class);

        when(sourceItem.id()).thenReturn(allocationItemId);
        when(sourceItem.strategyItemId()).thenReturn(strategyItemId);
        when(sourceItem.flywheelLineageId()).thenReturn(lineageId);
        when(sourceItem.lineageNumber()).thenReturn("LINEAGE-TEST");

        when(sourceItem.rootTargetInitiativeTitle()).thenReturn(
                "Synthetic initiative"
        );

        when(sourceItem.requestedAllocationAmount()).thenReturn(
                n("1000.00")
        );

        when(sourceItem.strategyPriorityScore()).thenReturn(n("85.00"));

        FlywheelAllocationMandateDetailResponse detail =
                mock(FlywheelAllocationMandateDetailResponse.class);

        when(detail.mandate()).thenReturn(authority);
        when(detail.items()).thenReturn(List.of(sourceItem));

        FlywheelAllocationService allocation =
                mock(FlywheelAllocationService.class);

        when(allocation.mandate(userId, mandateId)).thenReturn(detail);

        actor = mock(AppUserEntity.class);

        when(actor.isActive()).thenReturn(true);
        when(actor.getFullName()).thenReturn("Test manager");
        when(actor.getRole()).thenReturn(ProcurementRole.ADMIN);

        AppUserRepository users = mock(AppUserRepository.class);

        when(users.findById(userId)).thenReturn(Optional.of(actor));

        repository = new FlywheelReleaseRepository(jdbc);

        service = new FlywheelReleaseService(
                repository,
                new FlywheelReleaseMathService(),
                allocation,
                users
        );
    }

    @AfterEach
    void cleanup() {
        if (jdbc != null && schema != null) {
            jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    private BigDecimal n(String value) {
        return new BigDecimal(value);
    }

    private <T> T tx(Supplier<T> work) {
        return transaction.execute(status -> work.get());
    }

    private String resource(String name) throws Exception {
        try (
                InputStream input = getClass()
                        .getClassLoader()
                        .getResourceAsStream("db/migration/" + name)
        ) {
            if (input == null) {
                throw new IllegalStateException(
                        "Missing migration: " + name
                );
            }

            return new String(
                    input.readAllBytes(),
                    StandardCharsets.UTF_8
            );
        }
    }

    private FlywheelReleaseBatchDetailResponse draft() {
        return tx(
                () -> service.createBatch(
                        userId,
                        new FlywheelReleaseBatchInput(
                                mandateId,
                                "Test release",
                                userId,
                                "Synthetic execution test"
                        )
                )
        );
    }

    private FlywheelReleaseBatchDetailResponse executing() {
        UUID id = draft().batch().id();

        tx(
                () -> service.addItem(
                        userId,
                        id,
                        new FlywheelReleaseItemInput(
                                allocationItemId,
                                n("400.00")
                        )
                )
        );

        return tx(
                () -> service.submitForExecution(userId, id)
        );
    }

    private FlywheelReleaseBatchDetailResponse released() {
        UUID itemId = executing().items().get(0).id();

        return tx(
                () -> service.releaseItem(
                        userId,
                        itemId,
                        new FlywheelReleaseExecutionInput(
                                "REF-1",
                                "Confirmed internally"
                        )
                )
        );
    }

    private int snapshotCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM procurement_flywheel_release_snapshots",
                Integer.class
        );
    }

    @Test
    void locksRequireAnActiveTransaction() {
        assertThrows(
                IllegalStateException.class,
                () -> repository.lockMandate(mandateId)
        );
    }

    @Test
    void parentLockActuallyBlocksASecondPostgresWriter() {
        ExecutorService pool = Executors.newSingleThreadExecutor();

        try {
            tx(
                    () -> {
                        repository.lockMandate(mandateId);

                        Future<String> second = pool.submit(
                                () -> {
                                    try {
                                        tx(
                                                () -> {
                                                    jdbc.execute(
                                                            "SET LOCAL lock_timeout = '200ms'"
                                                    );

                                                    repository.lockMandate(
                                                            mandateId
                                                    );

                                                    return true;
                                                }
                                        );

                                        return "NOT_BLOCKED";
                                    } catch (DataAccessException exception) {
                                        for (
                                                Throwable cause = exception;
                                                cause != null;
                                                cause = cause.getCause()
                                        ) {
                                            if (cause instanceof SQLException sql) {
                                                return sql.getSQLState();
                                            }
                                        }

                                        throw exception;
                                    }
                                }
                        );

                        try {
                            assertEquals(
                                    "55P03",
                                    second.get(5, TimeUnit.SECONDS)
                            );
                        } catch (Exception exception) {
                            throw new AssertionError(exception);
                        }

                        return true;
                    }
            );
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentIdenticalReleaseRequestsRecordOnlyOnce()
            throws Exception {
        UUID id = executing().items().get(0).id();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(2);

        Callable<FlywheelReleaseBatchDetailResponse> operation =
                () -> {
                    start.await(5, TimeUnit.SECONDS);

                    return tx(
                            () -> service.releaseItem(
                                    userId,
                                    id,
                                    new FlywheelReleaseExecutionInput(
                                            "REPLAY",
                                            "Same evidence"
                                    )
                            )
                    );
                };

        try {
            Future<FlywheelReleaseBatchDetailResponse> first =
                    pool.submit(operation);

            Future<FlywheelReleaseBatchDetailResponse> second =
                    pool.submit(operation);

            assertEquals(
                    n("400.00"),
                    first.get(10, TimeUnit.SECONDS)
                            .batch()
                            .batchReleasedAmount()
            );

            assertEquals(
                    n("400.00"),
                    second.get(10, TimeUnit.SECONDS)
                            .batch()
                            .batchReleasedAmount()
            );

            assertEquals(
                    1,
                    jdbc.queryForObject(
                            "SELECT count(*) FROM procurement_flywheel_release_items WHERE status = 'RELEASED'",
                            Integer.class
                    )
            );

            assertEquals(
                    n("400.00"),
                    repository.cumulativeReleasedForMandate(mandateId)
            );
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void conflictingReplayCannotReplaceRecordedEvidence() {
        FlywheelReleaseBatchDetailResponse result = released();
        UUID itemId = result.items().get(0).id();

        assertThrows(
                IllegalArgumentException.class,
                () -> tx(
                        () -> service.releaseItem(
                                userId,
                                itemId,
                                new FlywheelReleaseExecutionInput(
                                        "DIFFERENT",
                                        "Changed evidence"
                                )
                        )
                )
        );

        assertEquals(
                "REF-1",
                repository.findItem(itemId).executionReference()
        );
    }

    @Test
    void entirelyCancelledBatchTerminatesAndReleasesTheOpenBatchSlot() {
        FlywheelReleaseBatchDetailResponse current = executing();

        UUID batchId = current.batch().id();
        UUID itemId = current.items().get(0).id();

        tx(
                () -> service.cancelItem(
                        userId,
                        itemId,
                        new FlywheelReleaseNoteInput("Not proceeding")
                )
        );

        FlywheelReleaseBatchDetailResponse cancelled = tx(
                () -> service.cancelBatch(
                        userId,
                        batchId,
                        new FlywheelReleaseNoteInput(
                                "All items cancelled"
                        )
                )
        );

        assertEquals(
                FlywheelReleaseBatchStatus.CANCELLED,
                cancelled.batch().status()
        );

        assertEquals(
                n("0.00"),
                cancelled.batch().batchReleasedAmount()
        );

        assertEquals(1, cancelled.snapshots().size());

        assertEquals(
                FlywheelReleaseBatchStatus.DRAFT,
                draft().batch().status()
        );
    }

    @Test
    void aRecordedReleasePreventsBatchCancellation() {
        UUID batchId = released().batch().id();

        assertThrows(
                IllegalArgumentException.class,
                () -> tx(
                        () -> service.cancelBatch(
                                userId,
                                batchId,
                                new FlywheelReleaseNoteInput(
                                        "Cannot erase this"
                                )
                        )
                )
        );

        assertEquals(
                n("400.00"),
                repository.cumulativeReleasedForMandate(mandateId)
        );
    }

    @Test
    void snapshotItemFailureRollsBackItsHeader() {
        UUID batchId = executing().batch().id();

        jdbc.execute(
                """
                CREATE FUNCTION reject_test_snapshot_item()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'Injected snapshot item failure';
                END;
                $$;

                CREATE TRIGGER zz_reject_test_snapshot_item
                BEFORE INSERT
                ON procurement_flywheel_release_snapshot_items
                FOR EACH ROW
                EXECUTE FUNCTION reject_test_snapshot_item();
                """
        );

        assertThrows(
                DataAccessException.class,
                () -> tx(
                        () -> service.captureSnapshot(userId, batchId)
                )
        );

        assertEquals(0, snapshotCount());
    }

    @Test
    void sealedSnapshotCannotBeChangedOrReceiveAdditionalItems() {
        UUID batchId = executing().batch().id();

        UUID snapshotId = tx(
                () -> service.captureSnapshot(userId, batchId)
        ).snapshot().id();

        assertEquals(
                Boolean.TRUE,
                jdbc.queryForObject(
                        "SELECT sealed FROM procurement_flywheel_release_snapshots WHERE id = ?",
                        Boolean.class,
                        snapshotId
                )
        );

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update(
                        "UPDATE procurement_flywheel_release_snapshots SET sealed = FALSE WHERE id = ?",
                        snapshotId
                )
        );

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update(
                        """
                        INSERT INTO procurement_flywheel_release_snapshot_items (
                            id,
                            snapshot_id,
                            allocation_item_id,
                            flywheel_lineage_id,
                            lineage_number,
                            root_target_initiative_title,
                            mandate_authorized_item_amount,
                            planned_release_amount,
                            release_item_status,
                            created_at
                        )
                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            'LATE',
                            'Late append',
                            1000,
                            1,
                            'PENDING',
                            CURRENT_TIMESTAMP
                        )
                        """,
                        UUID.randomUUID(),
                        snapshotId,
                        allocationItemId,
                        lineageId
                )
        );

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update(
                        "DELETE FROM procurement_flywheel_release_snapshot_items WHERE snapshot_id = ?",
                        snapshotId
                )
        );
    }

    @Test
    void unsealedSnapshotCannotCommit() {
        FlywheelReleaseBatchResponse batch = executing().batch();

        assertThrows(
                RuntimeException.class,
                () -> tx(
                        () -> {
                            repository.createSnapshot(
                                    UUID.randomUUID(),
                                    "UNSEALED-TEST",
                                    batch,
                                    userId
                            );

                            return true;
                        }
                )
        );

        assertEquals(0, snapshotCount());
    }

    @Test
    void databaseRejectsEditingAReleasedItem() {
        UUID itemId = released().items().get(0).id();

        assertThrows(
                DataAccessException.class,
                () -> jdbc.update(
                        "UPDATE procurement_flywheel_release_items SET execution_note = 'Rewritten' WHERE id = ?",
                        itemId
                )
        );
    }

    @Test
    void completedExecutionCanBeFinalizedAfterUpstreamClosure() {
        UUID batchId = released().batch().id();

        jdbc.update(
                "UPDATE procurement_flywheel_allocation_mandates SET status = 'CLOSED' WHERE id = ?",
                mandateId
        );

        when(authority.status()).thenReturn(
                FlywheelAllocationMandateStatus.CLOSED
        );

        FlywheelReleaseBatchDetailResponse done = tx(
                () -> service.markExecuted(
                        userId,
                        batchId,
                        new FlywheelReleaseNoteInput(
                                "Finalizing already-recorded history"
                        )
                )
        );

        assertEquals(
                FlywheelReleaseBatchStatus.EXECUTED,
                done.batch().status()
        );

        assertEquals(
                FlywheelReleaseBatchStatus.EXECUTED,
                done.snapshots().get(0).releaseStatus()
        );
    }

    @Test
    void buyerCannotCancelABatchOrRecordARelease() {
        FlywheelReleaseBatchDetailResponse current = executing();

        when(actor.getRole()).thenReturn(ProcurementRole.BUYER);

        assertThrows(
                IllegalArgumentException.class,
                () -> tx(
                        () -> service.cancelBatch(
                                userId,
                                current.batch().id(),
                                new FlywheelReleaseNoteInput("Denied")
                        )
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> tx(
                        () -> service.releaseItem(
                                userId,
                                current.items().get(0).id(),
                                new FlywheelReleaseExecutionInput(
                                        "DENIED",
                                        "Denied"
                                )
                        )
                )
        );
    }
}
