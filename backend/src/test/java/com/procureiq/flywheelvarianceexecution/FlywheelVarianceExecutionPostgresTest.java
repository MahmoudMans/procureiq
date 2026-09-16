package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.*;
import com.procureiq.user.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.function.Executable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.aop.support.AopUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Real V72 + real execution service/repository, using a Spring transaction proxy.
 * Step 73 parent tables and upstream service are synthetic; audit is a no-op.
 * Not a full historical Flyway chain, HTTP, browser, or audit integration test.
 */
@EnabledIfEnvironmentVariable(
        named = "PROCUREIQ_STEP75_DB_URL",
        matches = "jdbc:postgresql:.*"
)
class FlywheelVarianceExecutionPostgresTest {

    private final UUID userId = UUID.randomUUID();
    private final UUID planId = UUID.randomUUID();
    private final UUID settlementId = UUID.randomUUID();
    private final UUID releaseId = UUID.randomUUID();
    private final UUID mandateId = UUID.randomUUID();
    private final UUID strategyId = UUID.randomUUID();

    private final List<UUID> sourceIds = List.of(
            UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()
    );

    private final List<FlywheelVarianceItemResponse> sources =
            new ArrayList<>();

    private JdbcTemplate jdbc;
    private DataSourceTransactionManager manager;
    private TransactionTemplate transaction;
    private FlywheelVarianceExecutionRepository repository;
    private FlywheelVarianceExecutionService service;
    private AppUserEntity actor;
    private String schema;

    @BeforeEach
    void setup() throws Exception {
        String url = System.getenv("PROCUREIQ_STEP75_DB_URL");

        if (url == null || !url.matches(
                "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
        )) {
            throw new IllegalStateException(
                    "Only the disposable Step 75 loopback database is allowed."
            );
        }

        String username = System.getenv("PROCUREIQ_STEP75_DB_USER");
        String password = System.getenv("PROCUREIQ_STEP75_DB_PASSWORD");

        schema = "step75_" + UUID.randomUUID().toString().replace("-", "");

        var admin = new JdbcTemplate(
                new DriverManagerDataSource(url, username, password)
        );

        admin.execute("CREATE SCHEMA " + schema);

        var dataSource = new DriverManagerDataSource(
                url + "?currentSchema=" + schema
                        + "&connectTimeout=5&socketTimeout=20",
                username,
                password
        );

        jdbc = new JdbcTemplate(dataSource);
        manager = new DataSourceTransactionManager(dataSource);
        manager.setDefaultTimeout(15);

        transaction = new TransactionTemplate(manager);
        transaction.setIsolationLevel(
                TransactionDefinition.ISOLATION_READ_COMMITTED
        );

        jdbc.execute("""
                CREATE TABLE app_users (
                    id UUID PRIMARY KEY,
                    full_name TEXT,
                    role TEXT,
                    active BOOLEAN
                );

                CREATE TABLE procurement_flywheel_settlement_cases (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_settlement_items (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_release_batches (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_release_items (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_allocation_mandates (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_allocation_items (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_strategy_portfolios (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_capital_flywheel_lineages (
                    id UUID PRIMARY KEY
                );

                CREATE TABLE procurement_flywheel_variance_plans (
                    id UUID PRIMARY KEY,
                    plan_number TEXT,
                    settlement_case_id UUID,
                    reconciliation_number TEXT,
                    release_batch_id UUID,
                    release_number TEXT,
                    allocation_mandate_id UUID,
                    allocation_mandate_number TEXT,
                    strategy_portfolio_id UUID,
                    strategy_portfolio_number TEXT,
                    currency TEXT,
                    fiscal_year INTEGER,
                    source_variance_amount NUMERIC(20,2),
                    status TEXT
                );

                CREATE TABLE procurement_flywheel_variance_items (
                    id UUID PRIMARY KEY,
                    variance_plan_id UUID,
                    settlement_item_id UUID,
                    release_item_id UUID,
                    allocation_item_id UUID,
                    flywheel_lineage_id UUID,
                    lineage_number TEXT,
                    root_target_initiative_title TEXT,
                    source_variance_amount NUMERIC(20,2),
                    decision TEXT
                );

                CREATE FUNCTION procureiq_capture_audit_event()
                RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RETURN NEW;
                END;
                $$;
                """);

        try (InputStream input = getClass().getClassLoader()
                .getResourceAsStream(
                        "db/migration/V72__create_variance_treatment_execution.sql"
                )) {
            assertNotNull(input, "V72 migration resource is required");
            jdbc.execute(
                    new String(input.readAllBytes(), StandardCharsets.UTF_8)
            );
        }

        jdbc.update(
                "INSERT INTO app_users VALUES (?, 'Step 75 manager', 'ADMIN', TRUE)",
                userId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_settlement_cases VALUES (?)",
                settlementId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_release_batches VALUES (?)",
                releaseId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_allocation_mandates VALUES (?)",
                mandateId
        );

        jdbc.update(
                "INSERT INTO procurement_flywheel_strategy_portfolios VALUES (?)",
                strategyId
        );

        jdbc.update("""
                INSERT INTO procurement_flywheel_variance_plans VALUES (
                    ?, 'PLAN-75',
                    ?, 'SET-75',
                    ?, 'REL-75',
                    ?, 'ALLOC-75',
                    ?, 'STRATEGY-75',
                    'EUR', 2026, 100.00, 'APPROVED'
                )
                """,
                planId, settlementId, releaseId, mandateId, strategyId
        );

        String[] amounts = {"40.00", "35.00", "25.00"};

        FlywheelVarianceDecision[] decisions = {
                FlywheelVarianceDecision.RECOVER,
                FlywheelVarianceDecision.WRITE_OFF,
                FlywheelVarianceDecision.INVESTIGATE
        };

        for (int i = 0; i < 3; i++) {
            UUID settlementItem = UUID.randomUUID();
            UUID releaseItem = UUID.randomUUID();
            UUID allocationItem = UUID.randomUUID();
            UUID lineage = UUID.randomUUID();

            jdbc.update(
                    "INSERT INTO procurement_flywheel_settlement_items VALUES (?)",
                    settlementItem
            );

            jdbc.update(
                    "INSERT INTO procurement_flywheel_release_items VALUES (?)",
                    releaseItem
            );

            jdbc.update(
                    "INSERT INTO procurement_flywheel_allocation_items VALUES (?)",
                    allocationItem
            );

            jdbc.update(
                    "INSERT INTO procurement_capital_flywheel_lineages VALUES (?)",
                    lineage
            );

            jdbc.update("""
                    INSERT INTO procurement_flywheel_variance_items
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    sourceIds.get(i),
                    planId,
                    settlementItem,
                    releaseItem,
                    allocationItem,
                    lineage,
                    "LINE-" + i,
                    "Initiative " + i,
                    n(amounts[i]),
                    decisions[i].name()
            );

            var item = mock(FlywheelVarianceItemResponse.class);

            when(item.id()).thenReturn(sourceIds.get(i));
            when(item.settlementItemId()).thenReturn(settlementItem);
            when(item.releaseItemId()).thenReturn(releaseItem);
            when(item.allocationItemId()).thenReturn(allocationItem);
            when(item.flywheelLineageId()).thenReturn(lineage);
            when(item.lineageNumber()).thenReturn("LINE-" + i);
            when(item.rootTargetInitiativeTitle())
                    .thenReturn("Initiative " + i);
            when(item.sourceVarianceAmount()).thenReturn(n(amounts[i]));
            when(item.decision()).thenReturn(decisions[i]);
            when(item.decisionRationale())
                    .thenReturn("Synthetic approved treatment");
            when(item.targetDate())
                    .thenReturn(LocalDate.of(2026, 9, 30));

            sources.add(item);
        }

        var sourcePlan = mock(FlywheelVariancePlanResponse.class);

        when(sourcePlan.id()).thenReturn(planId);
        when(sourcePlan.planNumber()).thenReturn("PLAN-75");
        when(sourcePlan.settlementCaseId()).thenReturn(settlementId);
        when(sourcePlan.reconciliationNumber()).thenReturn("SET-75");
        when(sourcePlan.releaseBatchId()).thenReturn(releaseId);
        when(sourcePlan.releaseNumber()).thenReturn("REL-75");
        when(sourcePlan.allocationMandateId()).thenReturn(mandateId);
        when(sourcePlan.allocationMandateNumber()).thenReturn("ALLOC-75");
        when(sourcePlan.strategyPortfolioId()).thenReturn(strategyId);
        when(sourcePlan.strategyPortfolioNumber()).thenReturn("STRATEGY-75");
        when(sourcePlan.title()).thenReturn("Synthetic approved plan");
        when(sourcePlan.currency()).thenReturn("EUR");
        when(sourcePlan.fiscalYear()).thenReturn(2026);
        when(sourcePlan.sourceVarianceAmount()).thenReturn(n("100.00"));
        when(sourcePlan.recoverAmount()).thenReturn(n("40.00"));
        when(sourcePlan.writeOffAmount()).thenReturn(n("35.00"));
        when(sourcePlan.investigationAmount()).thenReturn(n("25.00"));
        when(sourcePlan.itemCount()).thenReturn(3);
        when(sourcePlan.planOwnerName()).thenReturn("Step 75 manager");
        when(sourcePlan.resolutionObjective()).thenReturn("Synthetic fixture");
        when(sourcePlan.status()).thenReturn(FlywheelVariancePlanStatus.APPROVED);

        var detail = mock(FlywheelVariancePlanDetailResponse.class);

        when(detail.plan()).thenReturn(sourcePlan);
        when(detail.items()).thenReturn(sources);

        var upstream = mock(FlywheelVarianceService.class);
        when(upstream.plan(userId, planId)).thenReturn(detail);

        var dashboard = mock(FlywheelVarianceDashboardResponse.class);
        when(dashboard.plans()).thenReturn(List.of(sourcePlan));
        when(upstream.dashboard(userId)).thenReturn(dashboard);

        actor = mock(AppUserEntity.class);
        when(actor.isActive()).thenReturn(true);
        when(actor.getRole()).thenReturn(ProcurementRole.ADMIN);
        when(actor.getFullName()).thenReturn("Step 75 manager");

        var users = mock(AppUserRepository.class);
        when(users.findById(userId)).thenReturn(Optional.of(actor));

        repository = new FlywheelVarianceExecutionRepository(jdbc);

        var target = new FlywheelVarianceExecutionService(
                repository,
                new FlywheelVarianceExecutionPolicyService(),
                upstream,
                users
        );

        var advice = new TransactionInterceptor();
        advice.setTransactionManager(manager);
        advice.setTransactionAttributeSource(
                new AnnotationTransactionAttributeSource()
        );

        var factory = new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        factory.addAdvice(advice);

        service = (FlywheelVarianceExecutionService) factory.getProxy();
    }

    @AfterEach
    void cleanup() {
        if (jdbc != null && schema != null) {
            jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    private BigDecimal n(String amount) {
        return new BigDecimal(amount);
    }

    private <T> T tx(Supplier<T> task) {
        return transaction.execute(status -> task.get());
    }

    private UUID createCase() {
        return service.createCase(
                userId,
                new FlywheelVarianceExecutionCaseInput(
                        planId,
                        "Execution test",
                        userId,
                        "Record evidence only"
                )
        ).executionCase().id();
    }

    private FlywheelVarianceExecutionItemInput input(
            int index,
            String amount,
            FlywheelVarianceExecutionOutcome outcome
    ) {
        return new FlywheelVarianceExecutionItemInput(
                sourceIds.get(index),
                n(amount),
                outcome,
                "EVIDENCE-" + index,
                LocalDate.of(2026, 9, 16),
                "Synthetic external evidence"
        );
    }

    private void addMixed(UUID id) {
        service.addItem(
                userId, id,
                input(0, "10.00", FlywheelVarianceExecutionOutcome.PARTIAL)
        );

        service.addItem(
                userId, id,
                input(1, "35.00", FlywheelVarianceExecutionOutcome.COMPLETED)
        );

        service.addItem(
                userId, id,
                input(2, "0.00", FlywheelVarianceExecutionOutcome.COMPLETED)
        );
    }

    private int snapshotCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM procurement_variance_execution_snapshots",
                Integer.class
        );
    }

    private static SQLException sqlCause(Throwable failure) {
        for (
                Throwable current = failure;
                current != null;
                current = current.getCause()
        ) {
            if (current instanceof SQLException sql) {
                return sql;
            }
        }

        throw new AssertionError(
                "No PostgreSQL exception in cause chain", failure
        );
    }

    private void dbRejected(
            String state,
            String message,
            Executable work
    ) {
        SQLException sql = sqlCause(
                assertThrows(RuntimeException.class, work)
        );

        assertEquals(state, sql.getSQLState());
        assertTrue(sql.getMessage().contains(message), sql.getMessage());
    }

    @Test
    void emptyCaseRetainsFullResidualThroughTheRealService() {
        assertTrue(AopUtils.isAopProxy(service));

        UUID id = createCase();

        var result = service.executionCase(userId, id).executionCase();

        assertEquals(
                n("100.00"),
                result.exposure().financialResidualAmount()
        );

        assertEquals(
                n("100.00"),
                result.exposure().unrecordedVarianceAmount()
        );

        // Preserved legacy treatment metric, not the financial residual.
        assertEquals(n("0.00"), result.openExposureAmount());

        assertEquals(1, service.dashboard(userId).cases().size());
    }

    @Test
    void partialEvidenceRetainsTheUnrecordedSourceVariance() {
        UUID id = createCase();

        var detail = service.addItem(
                userId, id,
                input(0, "10.00", FlywheelVarianceExecutionOutcome.PARTIAL)
        );

        assertEquals(
                n("90.00"),
                detail.executionCase().exposure().financialResidualAmount()
        );

        assertEquals(
                n("60.00"),
                detail.executionCase().exposure().unrecordedVarianceAmount()
        );

        assertEquals(
                n("30.00"),
                detail.items().get(0).financialResidualAmount()
        );
    }

    @Test
    void mixedLifecycleAndAllSnapshotQueriesPreserveTheFinancialResidual() {
        UUID id = createCase();

        addMixed(id);
        service.submitForReview(userId, id);

        var verified = service.verify(
                userId, id,
                new FlywheelVarianceExecutionNoteInput("Evidence reviewed")
        );

        assertEquals(
                FlywheelVarianceExecutionCaseStatus.VERIFIED,
                verified.executionCase().status()
        );

        assertEquals(
                n("55.00"),
                verified.executionCase().exposure().financialResidualAmount()
        );

        assertEquals(
                n("70.00"),
                verified.executionCase().completionPct()
        );

        var totals = service.dashboard(userId)
                .summary()
                .financialResidualByCurrency();

        assertEquals(1, totals.size());
        assertEquals("EUR", totals.get(0).currency());
        assertEquals(n("55.00"), totals.get(0).amount());

        var closed = service.close(
                userId, id,
                new FlywheelVarianceExecutionNoteInput("Evidence case closed")
        );

        assertEquals(
                FlywheelVarianceExecutionCaseStatus.CLOSED,
                closed.executionCase().status()
        );

        assertEquals(2, repository.snapshotsForCase(id).size());
        assertEquals(2, repository.snapshots().size());

        UUID snapshotId = closed.snapshots().get(0).id();

        assertNotNull(repository.findSnapshot(snapshotId));

        var snapshot = service.snapshot(userId, snapshotId);

        assertEquals(
                n("55.00"),
                snapshot.snapshot().exposure().financialResidualAmount()
        );

        assertEquals(
                n("0.00"),
                snapshot.snapshot().exposure().unrecordedVarianceAmount()
        );

        var investigation = snapshot.items().stream()
                .filter(item ->
                        item.sourceDecision()
                                == FlywheelVarianceDecision.INVESTIGATE
                )
                .findFirst()
                .orElseThrow();

        assertEquals(
                n("25.00"),
                investigation.financialResidualAmount()
        );
    }

    @Test
    void duplicateEvidenceDoesNotAlterTheFirstRecord() {
        UUID id = createCase();

        service.addItem(
                userId, id,
                input(0, "10.00", FlywheelVarianceExecutionOutcome.PARTIAL)
        );

        assertThrows(IllegalArgumentException.class, () ->
                service.addItem(
                        userId, id,
                        input(
                                0,
                                "40.00",
                                FlywheelVarianceExecutionOutcome.COMPLETED
                        )
                )
        );

        assertEquals(1, repository.items(id).size());
        assertEquals(n("10.00"), repository.items(id).get(0).executedAmount());
    }

    @Test
    void incompleteReviewFailsInBothServiceAndDatabase() {
        UUID id = createCase();

        assertThrows(IllegalArgumentException.class, () ->
                service.submitForReview(userId, id)
        );

        dbRejected(
                "P0001",
                "Every Step 73 treatment decision",
                () -> repository.submitForReview(id, userId)
        );

        assertEquals(
                FlywheelVarianceExecutionCaseStatus.DRAFT,
                repository.findCase(id).status()
        );
    }

    @Test
    void databaseRejectsAnExecutionAboveSourceAuthority() {
        UUID id = createCase();

        var source = service.executionCase(userId, id)
                .candidates()
                .get(0);

        var invalid = new FlywheelVarianceExecutionValidationResult(
                n("40.00"),
                n("41.00"),
                n("0.00"),
                FlywheelVarianceExecutionOutcome.COMPLETED
        );

        dbRejected(
                "23514",
                "ck_variance_execution_amount",
                () -> repository.createItem(
                        UUID.randomUUID(),
                        id,
                        source,
                        invalid,
                        input(
                                0,
                                "41.00",
                                FlywheelVarianceExecutionOutcome.COMPLETED
                        ),
                        "BAD",
                        "Over authority",
                        userId
                )
        );

        assertTrue(repository.items(id).isEmpty());
    }

    @Test
    void databaseRejectsAChangedSourceDecision() {
        UUID id = createCase();

        var source = service.executionCase(userId, id)
                .candidates()
                .get(0);

        var bad = new FlywheelVarianceExecutionCandidateResponse(
                source.varianceItemId(),
                source.settlementItemId(),
                source.releaseItemId(),
                source.allocationItemId(),
                source.flywheelLineageId(),
                source.lineageNumber(),
                source.rootTargetInitiativeTitle(),
                source.sourceVarianceAmount(),
                FlywheelVarianceDecision.WRITE_OFF,
                source.decisionRationale(),
                source.targetDate()
        );

        var validMoney = new FlywheelVarianceExecutionValidationResult(
                n("40.00"),
                n("40.00"),
                n("0.00"),
                FlywheelVarianceExecutionOutcome.COMPLETED
        );

        dbRejected(
                "P0001",
                "does not match Step 73 variance authority",
                () -> repository.createItem(
                        UUID.randomUUID(),
                        id,
                        bad,
                        validMoney,
                        input(
                                0,
                                "40.00",
                                FlywheelVarianceExecutionOutcome.COMPLETED
                        ),
                        "BAD",
                        "Wrong decision",
                        userId
                )
        );
    }

    @Test
    void buyerCannotVerifyOrCloseEvidence() {
        UUID id = createCase();

        addMixed(id);
        service.submitForReview(userId, id);

        when(actor.getRole()).thenReturn(ProcurementRole.BUYER);

        assertThrows(IllegalArgumentException.class, () ->
                service.verify(
                        userId, id,
                        new FlywheelVarianceExecutionNoteInput("Denied")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                service.close(
                        userId, id,
                        new FlywheelVarianceExecutionNoteInput("Denied")
                )
        );

        assertEquals(
                FlywheelVarianceExecutionCaseStatus.IN_REVIEW,
                repository.findCase(id).status()
        );

        assertEquals(0, snapshotCount());
    }

    @Test
    void snapshotItemFailureRollsBackTheHeaderThroughTheProxy() {
        UUID id = createCase();
        addMixed(id);

        jdbc.execute("""
                CREATE FUNCTION step75_reject_snapshot_item()
                RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Step75 injected failure';
                END;
                $$;

                CREATE TRIGGER zz_step75_reject_snapshot_item
                BEFORE INSERT
                ON procurement_variance_execution_snapshot_items
                FOR EACH ROW
                EXECUTE FUNCTION step75_reject_snapshot_item();
                """);

        dbRejected(
                "P0001",
                "Step75 injected failure",
                () -> service.captureSnapshot(userId, id)
        );

        assertEquals(0, snapshotCount());
    }

    @Test
    void sealedSnapshotsRejectHeaderItemMutationAndLateAppend() {
        UUID id = createCase();
        addMixed(id);

        UUID snapshotId = service.captureSnapshot(userId, id)
                .snapshot()
                .id();

        dbRejected(
                "P0001",
                "snapshot is immutable",
                () -> jdbc.update(
                        """
                        UPDATE procurement_variance_execution_snapshots
                        SET completion_pct = 0
                        WHERE id = ?
                        """,
                        snapshotId
                )
        );

        dbRejected(
                "P0001",
                "snapshot items are immutable",
                () -> jdbc.update(
                        """
                        UPDATE procurement_variance_execution_snapshot_items
                        SET evidence_note = 'Changed'
                        WHERE snapshot_id = ?
                        """,
                        snapshotId
                )
        );

        dbRejected(
                "P0001",
                "snapshot items are immutable",
                () -> jdbc.update(
                        """
                        DELETE FROM procurement_variance_execution_snapshot_items
                        WHERE snapshot_id = ?
                        """,
                        snapshotId
                )
        );

        var item = service.executionCase(userId, id).items().get(0);

        dbRejected(
                "P0001",
                "Cannot append items",
                () -> repository.createSnapshotItem(snapshotId, item)
        );
    }

    @Test
    void lockingRejectsMissingReadOnlyAndIncompatibleTransactions() {
        assertThrows(IllegalStateException.class, () ->
                repository.lockVariancePlan(planId)
        );

        var readOnly = new TransactionTemplate(manager);
        readOnly.setReadOnly(true);

        assertThrows(IllegalStateException.class, () ->
                readOnly.execute(status -> {
                    repository.lockVariancePlan(planId);
                    return true;
                })
        );

        var repeatable = new TransactionTemplate(manager);

        repeatable.setIsolationLevel(
                TransactionDefinition.ISOLATION_REPEATABLE_READ
        );

        assertThrows(IllegalStateException.class, () ->
                repeatable.execute(status -> {
                    repository.lockVariancePlan(planId);
                    return true;
                })
        );
    }

    @Test
    void sourcePlanLockActuallyBlocksAnotherConnection() {
        ExecutorService pool = Executors.newSingleThreadExecutor();

        try {
            tx(() -> {
                repository.lockVariancePlan(planId);

                Future<String> second = pool.submit(() -> {
                    try {
                        tx(() -> {
                            jdbc.execute("SET LOCAL lock_timeout = '250ms'");
                            repository.lockVariancePlan(planId);
                            return true;
                        });

                        return "NOT_BLOCKED";
                    } catch (RuntimeException exception) {
                        return sqlCause(exception).getSQLState();
                    }
                });

                try {
                    assertEquals(
                            "55P03",
                            second.get(10, TimeUnit.SECONDS)
                    );
                } catch (Exception exception) {
                    throw new AssertionError(exception);
                }

                return true;
            });
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentDuplicateRequestsCreateExactlyOneEvidenceRecord()
            throws Exception {
        UUID id = createCase();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);

        Callable<String> operation = () -> {
            barrier.await(10, TimeUnit.SECONDS);

            try {
                service.addItem(
                        userId, id,
                        input(
                                0,
                                "10.00",
                                FlywheelVarianceExecutionOutcome.PARTIAL
                        )
                );

                return "RECORDED";
            } catch (IllegalArgumentException exception) {
                assertTrue(
                        exception.getMessage().contains("already exists"),
                        exception.getMessage()
                );

                return "DUPLICATE";
            }
        };

        try {
            Future<String> first = pool.submit(operation);
            Future<String> second = pool.submit(operation);

            assertEquals(
                    Set.of("RECORDED", "DUPLICATE"),
                    Set.of(
                            first.get(15, TimeUnit.SECONDS),
                            second.get(15, TimeUnit.SECONDS)
                    )
            );

            assertEquals(1, repository.items(id).size());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void inconsistentSnapshotHeaderCannotCommit() {
        UUID id = createCase();
        addMixed(id);

        var response = service.executionCase(userId, id).executionCase();

        dbRejected(
                "P0001",
                "header does not match",
                () -> tx(() -> {
                    UUID snapshotId = UUID.randomUUID();

                    repository.createSnapshot(
                            snapshotId,
                            "BAD-SNAPSHOT-75",
                            response,
                            userId
                    );

                    // Deliberately omit the three required captured items.
                    assertEquals(
                            1,
                            repository.sealSnapshot(snapshotId)
                    );

                    return true;
                })
        );

        assertEquals(0, snapshotCount());
    }
}
