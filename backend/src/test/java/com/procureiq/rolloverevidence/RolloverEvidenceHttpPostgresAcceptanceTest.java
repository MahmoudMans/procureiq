package com.procureiq.rolloverevidence;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

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
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


@SpringBootTest(
        classes =
                RolloverEvidenceHttpPostgresAcceptanceTest
                        .Step92FocusedApplication.class,
        webEnvironment =
                SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "spring.flyway.enabled=false",
                "spring.sql.init.mode=never",
                "spring.jpa.open-in-view=false"
        }
)
class RolloverEvidenceHttpPostgresAcceptanceTest {

    private static final String DATABASE_URL =
            requiredEnvironment(
                    "PROCUREIQ_STEP92_DB_URL"
            );

    private static final String DATABASE_USER =
            requiredEnvironment(
                    "PROCUREIQ_STEP92_DB_USER"
            );

    private static final String DATABASE_PASSWORD =
            requiredEnvironment(
                    "PROCUREIQ_STEP92_DB_PASSWORD"
            );

    private static final String SCHEMA =
            "step92_http_"
            + UUID.randomUUID()
                    .toString()
                    .replace(
                            "-",
                            ""
                    );


    private static final UUID BUYER =
            UUID.randomUUID();

    private static final UUID MANAGER =
            UUID.randomUUID();

    private static final UUID APPROVER =
            UUID.randomUUID();

    private static final UUID ADMIN =
            UUID.randomUUID();


    static {
        prepareDatabase();
    }


    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private JdbcTemplate jdbc;
    private MockMvc mvc;


    @DynamicPropertySource
    static void databaseProperties(
            DynamicPropertyRegistry registry
    ) {
        registry.add(
                "spring.datasource.url",
                () ->
                        DATABASE_URL
                        + "?currentSchema="
                        + SCHEMA
        );

        registry.add(
                "spring.datasource.username",
                () -> DATABASE_USER
        );

        registry.add(
                "spring.datasource.password",
                () -> DATABASE_PASSWORD
        );

        registry.add(
                "spring.datasource.hikari.schema",
                () -> SCHEMA
        );

        registry.add(
                "spring.jpa.properties.hibernate.default_schema",
                () -> SCHEMA
        );

        registry.add(
                "spring.flyway.enabled",
                () -> "false"
        );

        registry.add(
                "spring.sql.init.mode",
                () -> "never"
        );
    }


    @BeforeEach
    void beforeEach() {
        mvc =
                MockMvcBuilders
                        .webAppContextSetup(
                                webApplicationContext
                        )
                        .apply(
                                springSecurity()
                        )
                        .build();


        jdbc.execute(
                """
                TRUNCATE TABLE
                    procurement_rollover_evidence_cycles,
                    procurement_remediation_continuation_rollover_cases
                CASCADE
                """
        );
    }


    @AfterAll
    static void afterAll() throws Exception {
        try (
                Connection connection =
                        DriverManager.getConnection(
                                DATABASE_URL,
                                DATABASE_USER,
                                DATABASE_PASSWORD
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


    /*
     * -----------------------------------------------------------------------
     * 01
     * -----------------------------------------------------------------------
     */


    @Test
    void anonymousDashboardIsUnauthorized()
            throws Exception {
        mvc.perform(
                get(
                        "/api/v1/flywheel-rollover-outcomes/dashboard"
                )
        )
                .andExpect(
                        status()
                                .isUnauthorized()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * 02
     * -----------------------------------------------------------------------
     */


    @Test
    void approverCanReadDashboardButCannotOpenEvidence()
            throws Exception {
        JsonNode dashboard =
                json(
                        httpGet(
                                "/api/v1/flywheel-rollover-outcomes/dashboard",
                                APPROVER,
                                "APPROVER"
                        )
                                .andExpect(
                                        status()
                                                .isOk()
                                )
                                .andReturn()
                );


        assertFalse(
                dashboard
                        .path(
                                "permissions"
                        )
                        .path(
                                "write"
                        )
                        .asBoolean()
        );


        UUID root =
                seedRoot(
                        "CLOSED",
                        "RECOVERY_RETRY"
                );


        httpPost(
                "/api/v1/flywheel-rollover-outcomes/cycles",
                APPROVER,
                "APPROVER",
                Map.of(
                        "rolloverCaseId",
                        root.toString()
                )
        )
                .andExpect(
                        status()
                                .isForbidden()
                );


        assertEquals(
                0,
                cycleCount()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 03
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerOpensClosedRolloverAndReceivesValidatedContract()
            throws Exception {
        UUID root =
                seedRoot(
                        "CLOSED",
                        "RECOVERY_RETRY"
                );


        JsonNode detail =
                openRoot(
                        root,
                        BUYER,
                        "BUYER"
                );


        assertEquals(
                root.toString(),
                detail
                        .path(
                                "cycle"
                        )
                        .path(
                                "rootRolloverId"
                        )
                        .asText()
        );


        assertEquals(
                "OBSERVING",
                detail
                        .path(
                                "cycle"
                        )
                        .path(
                                "status"
                        )
                        .asText()
        );


        assertTrue(
                detail
                        .path(
                                "metrics"
                        )
                        .path(
                                "opening"
                        )
                        .isTextual()
        );


        assertEquals(
                "100.00",
                money(
                        detail,
                        "opening"
                )
        );


        assertEquals(
                1,
                detail
                        .path(
                                "items"
                        )
                        .size()
        );


        assertTrue(
                detail
                        .path(
                                "permissions"
                        )
                        .path(
                                "write"
                        )
                        .asBoolean()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 04
     * -----------------------------------------------------------------------
     */


    @Test
    void duplicateRootImportReturnsConflictAndDoesNotDuplicateState()
            throws Exception {
        UUID root =
                seedRoot(
                        "CLOSED",
                        "RECOVERY_RETRY"
                );


        openRoot(
                root,
                BUYER,
                "BUYER"
        );


        httpPost(
                "/api/v1/flywheel-rollover-outcomes/cycles",
                BUYER,
                "BUYER",
                Map.of(
                        "rolloverCaseId",
                        root.toString()
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        assertEquals(
                1,
                cycleCount()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 05
     * -----------------------------------------------------------------------
     */


    @Test
    void staleVersionReturnsConflictWithoutMutation()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        UUID cycleId =
                cycleId(
                        detail
                );


        UUID itemId =
                itemId(
                        detail,
                        0
                );


        httpPost(
                cyclePath(
                        cycleId,
                        "/observations"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "itemId",
                        itemId.toString(),

                        "version",
                        99,

                        "resolutionType",
                        "PARTIAL",

                        "reductionAmount",
                        "20.00",

                        "observedOn",
                        today(),

                        "evidenceReference",
                        "STEP92-STALE",

                        "evidenceNote",
                        "Stale version must fail."
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        assertEquals(
                0L,
                databaseVersion(
                        cycleId
                )
        );


        assertEquals(
                0,
                observationCount(
                        cycleId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 06
     * -----------------------------------------------------------------------
     */


    @Test
    void invalidObservedReductionReturnsBadRequestAndRollsBack()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        UUID cycleId =
                cycleId(
                        detail
                );


        UUID itemId =
                itemId(
                        detail,
                        0
                );


        httpPost(
                cyclePath(
                        cycleId,
                        "/observations"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "itemId",
                        itemId.toString(),

                        "version",
                        0,

                        "resolutionType",
                        "RECOVERY_CONFIRMED",

                        "reductionAmount",
                        "101.00",

                        "observedOn",
                        today(),

                        "evidenceReference",
                        "STEP92-INVALID",

                        "evidenceNote",
                        "Reduction exceeds exposure."
                )
        )
                .andExpect(
                        status()
                                .isBadRequest()
                );


        assertEquals(
                0L,
                databaseVersion(
                        cycleId
                )
        );


        assertEquals(
                0,
                observationCount(
                        cycleId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 07
     * -----------------------------------------------------------------------
     */


    @Test
    void malformedMoneyIsRejectedBeforeDatabaseMutation()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        UUID cycleId =
                cycleId(
                        detail
                );


        httpPost(
                cyclePath(
                        cycleId,
                        "/observations"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "itemId",
                        itemId(
                                detail,
                                0
                        ).toString(),

                        "version",
                        0,

                        "resolutionType",
                        "PARTIAL",

                        "reductionAmount",
                        "10.001",

                        "observedOn",
                        today(),

                        "evidenceReference",
                        "STEP92-MONEY",

                        "evidenceNote",
                        "Sub-cent amount."
                )
        )
                .andExpect(
                        status()
                                .isBadRequest()
                );


        assertEquals(
                0,
                observationCount(
                        cycleId
                )
        );


        assertEquals(
                0L,
                databaseVersion(
                        cycleId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 08
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerRecordsCompleteEvidenceAndSubmitsForReview()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        detail =
                observe(
                        detail,
                        0,
                        BUYER,
                        "BUYER",
                        "RECOVERY_CONFIRMED",
                        "60.00"
                );


        assertEquals(
                "OBSERVING",
                cycleStatus(detail)
        );


        assertEquals(
                1L,
                version(
                        detail
                )
        );


        detail =
                transition(
                        detail,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Buyer submits complete observed evidence."
                );


        assertEquals(
                "EVIDENCE_REVIEW",
                cycleStatus(detail)
        );


        assertEquals(
                2L,
                version(
                        detail
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 09
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerCannotManagerVerifyEvidence()
            throws Exception {
        JsonNode detail =
                observedRoot(
                        "60.00"
                );


        detail =
                transition(
                        detail,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit evidence."
                );


        UUID cycleId =
                cycleId(
                        detail
                );


        httpPost(
                cyclePath(
                        cycleId,
                        "/transition"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "version",
                        version(
                                detail
                        ),

                        "operation",
                        "verify-evidence",

                        "note",
                        "Buyer must not verify."
                )
        )
                .andExpect(
                        status()
                                .isForbidden()
                );


        assertEquals(
                "EVIDENCE_REVIEW",
                databaseStatus(
                        cycleId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 10
     * -----------------------------------------------------------------------
     */


    @Test
    void procurementManagerAndAdminCanVerifyEvidence()
            throws Exception {
        JsonNode managerCase =
                observedRoot(
                        "60.00"
                );


        managerCase =
                transition(
                        managerCase,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit for manager."
                );


        managerCase =
                transition(
                        managerCase,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "verify-evidence",
                        "Manager verifies evidence."
                );


        assertEquals(
                "VERIFIED",
                cycleStatus(managerCase)
        );


        JsonNode adminCase =
                observedRoot(
                        "50.00"
                );


        adminCase =
                transition(
                        adminCase,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit for administrator."
                );


        adminCase =
                transition(
                        adminCase,
                        ADMIN,
                        "ADMIN",
                        "verify-evidence",
                        "Administrator verifies evidence."
                );


        assertEquals(
                "VERIFIED",
                cycleStatus(adminCase)
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 11
     * -----------------------------------------------------------------------
     */


    @Test
    void positiveResidualCannotBeClosedAsFinanciallyResolved()
            throws Exception {
        JsonNode detail =
                verifiedRoot(
                        "60.00"
                );


        assertEquals(
                "40.00",
                money(
                        detail,
                        "remaining"
                )
        );


        assertEquals(
                "FURTHER_GOVERNANCE_REQUIRED",
                detail
                        .path(
                                "metrics"
                        )
                        .path(
                                "disposition"
                        )
                        .asText()
        );


        UUID cycleId =
                cycleId(
                        detail
                );


        httpPost(
                cyclePath(
                        cycleId,
                        "/transition"
                ),
                MANAGER,
                "PROCUREMENT_MANAGER",
                Map.of(
                        "version",
                        version(
                                detail
                        ),

                        "operation",
                        "close-evidence",

                        "note",
                        "Must not falsely close positive exposure."
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        assertEquals(
                "VERIFIED",
                databaseStatus(
                        cycleId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 12
     * -----------------------------------------------------------------------
     */


    @Test
    void fullyResolvedEvidenceCanClose()
            throws Exception {
        JsonNode detail =
                verifiedRoot(
                        "100.00"
                );


        assertEquals(
                "0.00",
                money(
                        detail,
                        "remaining"
                )
        );


        detail =
                transition(
                        detail,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "close-evidence",
                        "Zero residual verified and closed."
                );


        assertEquals(
                "CLOSED",
                cycleStatus(detail)
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 13
     * -----------------------------------------------------------------------
     */


    @Test
    void capturedSnapshotRemainsImmutableAfterLaterEvidence()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        UUID cycleId =
                cycleId(
                        detail
                );


        JsonNode snapshot =
                captureSnapshot(
                        detail,
                        BUYER,
                        "BUYER"
                );


        UUID snapshotId =
                UUID.fromString(
                        snapshot
                                .path(
                                        "id"
                                )
                                .asText()
                );


        assertEquals(
                "100.00",
                snapshot
                        .path(
                                "document"
                        )
                        .path(
                                "metrics"
                        )
                        .path(
                                "remaining"
                        )
                        .asText()
        );


        detail =
                observe(
                        detail,
                        0,
                        BUYER,
                        "BUYER",
                        "PARTIAL",
                        "60.00"
                );


        assertEquals(
                "40.00",
                money(
                        detail,
                        "remaining"
                )
        );


        JsonNode historical =
                json(
                        httpGet(
                                "/api/v1/flywheel-rollover-outcomes/snapshots/"
                                + snapshotId,
                                BUYER,
                                "BUYER"
                        )
                                .andExpect(
                                        status()
                                                .isOk()
                                )
                                .andReturn()
                );


        assertEquals(
                "100.00",
                historical
                        .path(
                                "document"
                        )
                        .path(
                                "metrics"
                        )
                        .path(
                                "remaining"
                        )
                        .asText()
        );


        assertEquals(
                0,
                historical
                        .path(
                                "document"
                        )
                        .path(
                                "cycle"
                        )
                        .path(
                                "version"
                        )
                        .asInt()
        );


        assertNotEquals(
                version(
                        detail
                ),
                historical
                        .path(
                                "document"
                        )
                        .path(
                                "cycle"
                        )
                        .path(
                                "version"
                        )
                        .asLong()
        );


        assertEquals(
                cycleId.toString(),
                historical
                        .path(
                                "document"
                        )
                        .path(
                                "cycle"
                        )
                        .path(
                                "id"
                        )
                        .asText()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 14
     * -----------------------------------------------------------------------
     */


    @Test
    void approverCanReadSnapshotButCannotCaptureSnapshot()
            throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        JsonNode snapshot =
                captureSnapshot(
                        detail,
                        BUYER,
                        "BUYER"
                );


        String snapshotId =
                snapshot
                        .path(
                                "id"
                        )
                        .asText();


        httpGet(
                "/api/v1/flywheel-rollover-outcomes/snapshots/"
                + snapshotId,
                APPROVER,
                "APPROVER"
        )
                .andExpect(
                        status()
                                .isOk()
                );


        httpPost(
                cyclePath(
                        cycleId(
                                detail
                        ),
                        "/snapshots"
                ),
                APPROVER,
                "APPROVER",
                Map.of()
        )
                .andExpect(
                        status()
                                .isForbidden()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * 15
     * -----------------------------------------------------------------------
     */


    @Test
    void childCycleRequiresVerifiedPositiveResidualParent()
            throws Exception {
        JsonNode parent =
                observedRoot(
                        "60.00"
                );


        UUID parentId =
                cycleId(
                        parent
                );


        httpPost(
                "/api/v1/flywheel-rollover-outcomes/cycles",
                BUYER,
                "BUYER",
                Map.of(
                        "parentCycleId",
                        parentId.toString()
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        parent =
                transition(
                        parent,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit evidence."
                );


        parent =
                transition(
                        parent,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "verify-evidence",
                        "Verify positive residual."
                );


        JsonNode child =
                openChild(
                        parent,
                        BUYER,
                        "BUYER"
                );


        assertEquals(
                "PLAN_DRAFT",
                cycleStatus(child)
        );


        assertEquals(
                parentId.toString(),
                child
                        .path(
                                "cycle"
                        )
                        .path(
                                "parentCycleId"
                        )
                        .asText()
        );


        assertEquals(
                "40.00",
                money(
                        child,
                        "opening"
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 16
     * -----------------------------------------------------------------------
     */


    @Test
    void duplicateChildCycleReturnsConflict()
            throws Exception {
        JsonNode parent =
                verifiedRoot(
                        "60.00"
                );


        openChild(
                parent,
                BUYER,
                "BUYER"
        );


        httpPost(
                "/api/v1/flywheel-rollover-outcomes/cycles",
                BUYER,
                "BUYER",
                Map.of(
                        "parentCycleId",
                        cycleId(
                                parent
                        ).toString()
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        assertEquals(
                2,
                cycleCount()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 17
     * -----------------------------------------------------------------------
     */


    @Test
    void childPlanRequiresCompleteCoverageBeforeSubmission()
            throws Exception {
        JsonNode parent =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        parent =
                observe(
                        parent,
                        0,
                        BUYER,
                        "BUYER",
                        "PARTIAL",
                        "60.00"
                );


        parent =
                observe(
                        parent,
                        1,
                        BUYER,
                        "BUYER",
                        "PARTIAL",
                        "50.00"
                );


        parent =
                transition(
                        parent,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit both observations."
                );


        parent =
                transition(
                        parent,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "verify-evidence",
                        "Verify parent."
                );


        JsonNode child =
                openChild(
                        parent,
                        BUYER,
                        "BUYER"
                );


        child =
                plan(
                        child,
                        0,
                        BUYER,
                        "BUYER"
                );


        UUID childId =
                cycleId(
                        child
                );


        httpPost(
                cyclePath(
                        childId,
                        "/transition"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "version",
                        version(
                                child
                        ),

                        "operation",
                        "submit-plan",

                        "note",
                        "Incomplete plan must fail."
                )
        )
                .andExpect(
                        status()
                                .isConflict()
                );


        assertEquals(
                "PLAN_DRAFT",
                databaseStatus(
                        childId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 18
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerCannotApproveChildGovernance()
            throws Exception {
        JsonNode parent =
                verifiedRoot(
                        "60.00"
                );


        JsonNode child =
                openChild(
                        parent,
                        BUYER,
                        "BUYER"
                );


        child =
                planAll(
                        child,
                        BUYER,
                        "BUYER"
                );


        child =
                transition(
                        child,
                        BUYER,
                        "BUYER",
                        "submit-plan",
                        "Buyer submits child governance plan."
                );


        UUID childId =
                cycleId(
                        child
                );


        httpPost(
                cyclePath(
                        childId,
                        "/transition"
                ),
                BUYER,
                "BUYER",
                Map.of(
                        "version",
                        version(
                                child
                        ),

                        "operation",
                        "approve-plan",

                        "note",
                        "Buyer must not approve."
                )
        )
                .andExpect(
                        status()
                                .isForbidden()
                );


        assertEquals(
                "PLAN_REVIEW",
                databaseStatus(
                        childId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 19
     * -----------------------------------------------------------------------
     */


    @Test
    void managerCanApproveAndCloseChildGovernance()
            throws Exception {
        JsonNode parent =
                verifiedRoot(
                        "60.00"
                );


        JsonNode child =
                openChild(
                        parent,
                        BUYER,
                        "BUYER"
                );


        child =
                planAll(
                        child,
                        BUYER,
                        "BUYER"
                );


        child =
                transition(
                        child,
                        BUYER,
                        "BUYER",
                        "submit-plan",
                        "Submit governed residual plan."
                );


        child =
                transition(
                        child,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "approve-plan",
                        "Manager approves residual plan."
                );


        assertEquals(
                "PLAN_APPROVED",
                cycleStatus(child)
        );


        child =
                transition(
                        child,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "close-governance",
                        "Governance complete; begin outcome observation."
                );


        assertEquals(
                "OBSERVING",
                cycleStatus(child)
        );


        assertTrue(
                child
                        .path(
                                "snapshots"
                        )
                        .size()
                >= 2
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 20
     * -----------------------------------------------------------------------
     */


    @Test
    void recursiveChainDashboardCountsLatestGenerationOnly()
            throws Exception {
        /*
         * Generation 1:
         *
         * 100 opening
         * 60 recovered
         * 40 remains
         */
        JsonNode first =
                verifiedRoot(
                        "60.00"
                );


        assertEquals(
                "40.00",
                money(
                        first,
                        "remaining"
                )
        );


        /*
         * Generation 2:
         *
         * 40 opening
         * 15 recovered
         * 25 remains
         */
        JsonNode second =
                openChild(
                        first,
                        BUYER,
                        "BUYER"
                );


        second =
                governChild(
                        second
                );


        second =
                observe(
                        second,
                        0,
                        BUYER,
                        "BUYER",
                        "PARTIAL",
                        "15.00"
                );


        second =
                transition(
                        second,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit second-generation evidence."
                );


        second =
                transition(
                        second,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "verify-evidence",
                        "Verify second generation."
                );


        assertEquals(
                "25.00",
                money(
                        second,
                        "remaining"
                )
        );


        /*
         * Generation 3:
         *
         * 25 opening
         * 25 recovered
         * 0 remains
         */
        JsonNode third =
                openChild(
                        second,
                        BUYER,
                        "BUYER"
                );


        third =
                governChild(
                        third
                );


        third =
                observe(
                        third,
                        0,
                        BUYER,
                        "BUYER",
                        "RECOVERY_CONFIRMED",
                        "25.00"
                );


        third =
                transition(
                        third,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit final evidence."
                );


        third =
                transition(
                        third,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "verify-evidence",
                        "Verify final recovery."
                );


        third =
                transition(
                        third,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "close-evidence",
                        "Residual is zero."
                );


        assertEquals(
                "CLOSED",
                cycleStatus(third)
        );


        JsonNode dashboard =
                json(
                        httpGet(
                                "/api/v1/flywheel-rollover-outcomes/dashboard",
                                BUYER,
                                "BUYER"
                        )
                                .andExpect(
                                        status()
                                                .isOk()
                                )
                                .andReturn()
                );


        JsonNode exposure =
                dashboard
                        .path(
                                "exposure"
                        )
                        .get(
                                0
                        );


        assertTrue(
                exposure != null
        );


        assertEquals(
                "USD",
                exposure
                        .path(
                                "currency"
                        )
                        .asText()
        );


        assertEquals(
                "100.00",
                normalizedMoney(
                        exposure
                                .path(
                                        "original"
                                )
                                .asText()
                )
        );


        assertEquals(
                "0.00",
                normalizedMoney(
                        exposure
                                .path(
                                        "remaining"
                                )
                                .asText()
                )
        );


        assertEquals(
                "100.00",
                normalizedMoney(
                        exposure
                                .path(
                                        "cumulativeReduction"
                                )
                                .asText()
                )
        );


        long latest =
                0;


        for (
                JsonNode entry
                : dashboard.path(
                        "cycles"
                )
        ) {
            if (
                    entry
                            .path(
                                    "isLatest"
                            )
                            .asBoolean()
            ) {
                latest++;
            }
        }


        assertEquals(
                1L,
                latest
        );


        assertEquals(
                3,
                dashboard
                        .path(
                                "cycles"
                        )
                        .size()
        );
    }


    /*
     * -----------------------------------------------------------------------
     * HTTP HELPERS
     * -----------------------------------------------------------------------
     */


    private ResultActions httpGet(
            String path,
            UUID actor,
            String role
    ) throws Exception {
        return mvc.perform(
                get(
                        path
                )
                        .with(
                                jwt()
                                        .jwt(
                                                token ->
                                                        token.subject(
                                                                actor.toString()
                                                        )
                                        )
                                        .authorities(
                                                new SimpleGrantedAuthority(
                                                        "ROLE_"
                                                        + role
                                                )
                                        )
                        )
        );
    }


    private ResultActions httpPost(
            String path,
            UUID actor,
            String role,
            Object body
    ) throws Exception {
        return mvc.perform(
                post(
                        path
                )
                        .with(
                                jwt()
                                        .jwt(
                                                token ->
                                                        token.subject(
                                                                actor.toString()
                                                        )
                                        )
                                        .authorities(
                                                new SimpleGrantedAuthority(
                                                        "ROLE_"
                                                        + role
                                                )
                                        )
                        )
                        .with(
                                csrf()
                        )
                        .contentType(
                                MediaType.APPLICATION_JSON
                        )
                        .content(
                                jsonBytes(body)
                        )
        );
    }


    private JsonNode json(
            org.springframework.test.web.servlet.MvcResult result
    ) throws Exception {
        return parseJson(
                result
                        .getResponse()
                        .getContentAsByteArray()
        );
    }


    private JsonNode openRoot(
            UUID root,
            UUID actor,
            String role
    ) throws Exception {
        return json(
                httpPost(
                        "/api/v1/flywheel-rollover-outcomes/cycles",
                        actor,
                        role,
                        Map.of(
                                "rolloverCaseId",
                                root.toString()
                        )
                )
                        .andExpect(
                                status()
                                        .isCreated()
                        )
                        .andReturn()
        );
    }


    private JsonNode openChild(
            JsonNode parent,
            UUID actor,
            String role
    ) throws Exception {
        return json(
                httpPost(
                        "/api/v1/flywheel-rollover-outcomes/cycles",
                        actor,
                        role,
                        Map.of(
                                "parentCycleId",
                                cycleId(
                                        parent
                                ).toString()
                        )
                )
                        .andExpect(
                                status()
                                        .isCreated()
                        )
                        .andReturn()
        );
    }


    private JsonNode observe(
            JsonNode detail,
            int itemIndex,
            UUID actor,
            String role,
            String resolutionType,
            String reduction
    ) throws Exception {
        UUID cycleId =
                cycleId(
                        detail
                );


        UUID itemId =
                itemId(
                        detail,
                        itemIndex
                );


        return json(
                httpPost(
                        cyclePath(
                                cycleId,
                                "/observations"
                        ),
                        actor,
                        role,
                        Map.of(
                                "itemId",
                                itemId.toString(),

                                "version",
                                version(
                                        detail
                                ),

                                "resolutionType",
                                resolutionType,

                                "reductionAmount",
                                reduction,

                                "observedOn",
                                today(),

                                "evidenceReference",
                                "STEP92-"
                                + UUID.randomUUID(),

                                "evidenceNote",
                                "Observed through Step 92 full-stack acceptance."
                        )
                )
                        .andExpect(
                                status()
                                        .isOk()
                        )
                        .andReturn()
        );
    }


    private JsonNode plan(
            JsonNode detail,
            int itemIndex,
            UUID actor,
            String role
    ) throws Exception {
        UUID cycleId =
                cycleId(
                        detail
                );


        return json(
                httpPost(
                        cyclePath(
                                cycleId,
                                "/plans"
                        ),
                        actor,
                        role,
                        Map.of(
                                "itemId",
                                itemId(
                                        detail,
                                        itemIndex
                                ).toString(),

                                "version",
                                version(
                                        detail
                                ),

                                "targetDate",
                                LocalDate.parse(
                                        today()
                                )
                                        .plusDays(
                                                30
                                        )
                                        .toString(),

                                "rationale",
                                "Continue governed treatment of verified residual exposure."
                        )
                )
                        .andExpect(
                                status()
                                        .isOk()
                        )
                        .andReturn()
        );
    }


    private JsonNode planAll(
            JsonNode detail,
            UUID actor,
            String role
    ) throws Exception {
        int total =
                detail
                        .path(
                                "items"
                        )
                        .size();


        JsonNode current =
                detail;


        for (
                int index = 0;
                index < total;
                index++
        ) {
            current =
                    plan(
                            current,
                            index,
                            actor,
                            role
                    );
        }


        return current;
    }


    private JsonNode transition(
            JsonNode detail,
            UUID actor,
            String role,
            String operation,
            String note
    ) throws Exception {
        return json(
                httpPost(
                        cyclePath(
                                cycleId(
                                        detail
                                ),
                                "/transition"
                        ),
                        actor,
                        role,
                        Map.of(
                                "version",
                                version(
                                        detail
                                ),

                                "operation",
                                operation,

                                "note",
                                note
                        )
                )
                        .andExpect(
                                status()
                                        .isOk()
                        )
                        .andReturn()
        );
    }


    private JsonNode captureSnapshot(
            JsonNode detail,
            UUID actor,
            String role
    ) throws Exception {
        return json(
                httpPost(
                        cyclePath(
                                cycleId(
                                        detail
                                ),
                                "/snapshots"
                        ),
                        actor,
                        role,
                        Map.of()
                )
                        .andExpect(
                                status()
                                        .isOk()
                        )
                        .andReturn()
        );
    }


    private JsonNode observedRoot(
            String reduction
    ) throws Exception {
        JsonNode detail =
                openRoot(
                        seedRoot(
                                "CLOSED",
                                "RECOVERY_RETRY"
                        ),
                        BUYER,
                        "BUYER"
                );


        return observe(
                detail,
                0,
                BUYER,
                "BUYER",
                "RECOVERY_CONFIRMED",
                reduction
        );
    }


    private JsonNode verifiedRoot(
            String reduction
    ) throws Exception {
        JsonNode detail =
                observedRoot(
                        reduction
                );


        detail =
                transition(
                        detail,
                        BUYER,
                        "BUYER",
                        "submit-evidence",
                        "Submit complete root evidence."
                );


        return transition(
                detail,
                MANAGER,
                "PROCUREMENT_MANAGER",
                "verify-evidence",
                "Manager verifies root evidence."
        );
    }


    private JsonNode governChild(
            JsonNode detail
    ) throws Exception {
        detail =
                planAll(
                        detail,
                        BUYER,
                        "BUYER"
                );


        detail =
                transition(
                        detail,
                        BUYER,
                        "BUYER",
                        "submit-plan",
                        "Submit complete follow-up governance."
                );


        detail =
                transition(
                        detail,
                        MANAGER,
                        "PROCUREMENT_MANAGER",
                        "approve-plan",
                        "Manager approves follow-up governance."
                );


        return transition(
                detail,
                MANAGER,
                "PROCUREMENT_MANAGER",
                "close-governance",
                "Governance finalized; observations may begin."
        );
    }


    private static String cyclePath(
            UUID id,
            String suffix
    ) {
        return "/api/v1/flywheel-rollover-outcomes/cycles/"
               + id
               + suffix;
    }


    private static UUID cycleId(
            JsonNode detail
    ) {
        return UUID.fromString(
                detail
                        .path(
                                "cycle"
                        )
                        .path(
                                "id"
                        )
                        .asText()
        );
    }


    private static UUID itemId(
            JsonNode detail,
            int index
    ) {
        return UUID.fromString(
                detail
                        .path(
                                "items"
                        )
                        .get(
                                index
                        )
                        .path(
                                "id"
                        )
                        .asText()
        );
    }


    private static long version(
            JsonNode detail
    ) {
        return detail
                .path(
                        "cycle"
                )
                .path(
                        "version"
                )
                .asLong();
    }


    private static String cycleStatus(
            JsonNode detail
    ) {
        return detail
                .path(
                        "cycle"
                )
                .path(
                        "status"
                )
                .asText();
    }


    private static String money(
            JsonNode detail,
            String metric
    ) {
        return normalizedMoney(
                detail
                        .path(
                                "metrics"
                        )
                        .path(
                                metric
                        )
                        .asText()
        );
    }


    private static String normalizedMoney(
            String value
    ) {
        return new BigDecimal(
                value
        )
                .setScale(
                        2
                )
                .toPlainString();
    }


    /*
     * -----------------------------------------------------------------------
     * DATABASE ASSERTION HELPERS
     * -----------------------------------------------------------------------
     */


    private int cycleCount() {
        Integer value =
                jdbc.queryForObject(
                        """
                        SELECT count(*)

                        FROM procurement_rollover_evidence_cycles
                        """,
                        Integer.class
                );


        return value == null
                ? 0
                : value;
    }


    private int observationCount(
            UUID cycleId
    ) {
        Integer value =
                jdbc.queryForObject(
                        """
                        SELECT count(*)

                        FROM procurement_rollover_evidence_observations

                        WHERE cycle_id = ?
                        """,
                        Integer.class,
                        cycleId
                );


        return value == null
                ? 0
                : value;
    }


    private long databaseVersion(
            UUID cycleId
    ) {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT version

                        FROM procurement_rollover_evidence_cycles

                        WHERE id = ?
                        """,
                        Long.class,
                        cycleId
                );


        if (value == null) {
            throw new AssertionError(
                    "Cycle version not found."
            );
        }


        return value;
    }


    private String databaseStatus(
            UUID cycleId
    ) {
        return jdbc.queryForObject(
                """
                SELECT status

                FROM procurement_rollover_evidence_cycles

                WHERE id = ?
                """,
                String.class,
                cycleId
        );
    }


    private String today() {
        return jdbc.queryForObject(
                """
                SELECT CURRENT_DATE::TEXT
                """,
                String.class
        );
    }


    /*
     * -----------------------------------------------------------------------
     * SYNTHETIC CLOSED ROLLOVER SOURCE
     *
     * Only fixture construction bypasses historical trigger/FK chains.
     * Every Step 91/92 operation itself executes with normal PostgreSQL
     * trigger authority.
     * -----------------------------------------------------------------------
     */


    private UUID seedRoot(
            String sourceStatus,
            String... actions
    ) throws Exception {
        UUID id =
                UUID.randomUUID();


        BigDecimal total =
                new BigDecimal(
                        actions.length
                        * 100
                )
                        .setScale(
                                2
                        );


        try (
                Connection connection =
                        schemaConnection();

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
                                            closed_by_user_id,
                                            closed_at,
                                            close_note,
                                            version,
                                            created_by_user_id,
                                            created_at,
                                            updated_at
                                        )
                                        VALUES (
                                            ?,
                                            ?,
                                            ?,
                                            'RCO-STEP92',
                                            ?,
                                            'RCC-STEP92',
                                            'Step 92 source rollover',
                                            'USD',
                                            2026,
                                            ?,
                                            ?,
                                            ?,
                                            'Step 92 Buyer',
                                            ?,
                                            ?,
                                            CURRENT_TIMESTAMP,
                                            'Governance finalized before outcome observation.',
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
                            id
                    );

                    statement.setString(
                            2,
                            "RCR-STEP92-"
                            + UUID.randomUUID()
                    );

                    statement.setObject(
                            3,
                            UUID.randomUUID()
                    );

                    statement.setObject(
                            4,
                            UUID.randomUUID()
                    );

                    statement.setBigDecimal(
                            5,
                            total
                    );

                    statement.setInt(
                            6,
                            actions.length
                    );

                    statement.setObject(
                            7,
                            BUYER
                    );

                    statement.setString(
                            8,
                            sourceStatus
                    );

                    statement.setObject(
                            9,
                            MANAGER
                    );

                    statement.setObject(
                            10,
                            BUYER
                    );


                    statement.executeUpdate();
                }


                for (
                        String action
                        : actions
                ) {
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
                                                'UNRESOLVED',
                                                100.00,
                                                ?,
                                                CURRENT_DATE,
                                                'Step 92 source governance',
                                                ?,
                                                CURRENT_TIMESTAMP
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
                                id
                        );

                        statement.setObject(
                                3,
                                UUID.randomUUID()
                        );

                        statement.setObject(
                                4,
                                UUID.randomUUID()
                        );

                        statement.setString(
                                5,
                                action
                        );

                        statement.setString(
                                6,
                                action
                        );

                        statement.setObject(
                                7,
                                BUYER
                        );


                        statement.executeUpdate();
                    }
                }

            } finally {
                control.execute(
                        "SET session_replication_role = origin"
                );
            }
        }


        return id;
    }


    /*
     * -----------------------------------------------------------------------
     * DATABASE BOOTSTRAP
     * -----------------------------------------------------------------------
     */


    private static void prepareDatabase() {
        try {
            validateDisposableDatabase(
                    DATABASE_URL
            );


            try (
                    Connection connection =
                            DriverManager.getConnection(
                                    DATABASE_URL,
                                    DATABASE_USER,
                                    DATABASE_PASSWORD
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
                            DATABASE_URL,
                            DATABASE_USER,
                            DATABASE_PASSWORD
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
                            schemaConnection()
            ) {
                seedUser(
                        connection,
                        BUYER,
                        "BUYER"
                );

                seedUser(
                        connection,
                        MANAGER,
                        "PROCUREMENT_MANAGER"
                );

                seedUser(
                        connection,
                        APPROVER,
                        "APPROVER"
                );

                seedUser(
                        connection,
                        ADMIN,
                        "ADMIN"
                );
            }

        } catch (Exception exception) {
            throw new ExceptionInInitializerError(
                    exception
            );
        }
    }


    private static Connection schemaConnection()
            throws SQLException {
        Connection connection =
                DriverManager.getConnection(
                        DATABASE_URL,
                        DATABASE_USER,
                        DATABASE_PASSWORD
                );


        try (
                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "SET search_path TO "
                    + quoteIdentifier(
                            SCHEMA
                    )
            );


            statement.execute(
                    "SET statement_timeout = '20s'"
            );
        }


        return connection;
    }


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
                    "app_users metadata missing."
            );
        }


        List<ColumnDefinition> insert =
                definitions
                        .stream()
                        .filter(
                                RolloverEvidenceHttpPostgresAcceptanceTest
                                    ::shouldSeedUserColumn
                        )
                        .toList();


        String columns =
                insert
                        .stream()
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
        }


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
            int parameter =
                    1;


            for (
                    ColumnDefinition definition
                    : insert
            ) {
                bindUserColumn(
                        statement,
                        parameter++,
                        definition,
                        id,
                        role
                );
            }


            statement.executeUpdate();

        } finally {
            try (
                    Statement control =
                            connection.createStatement()
            ) {
                control.execute(
                        "SET session_replication_role = origin"
                );
            }
        }
    }


    private static boolean shouldSeedUserColumn(
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
                        "name"
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


    private static void bindUserColumn(
            PreparedStatement statement,
            int parameter,
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
                    parameter,
                    id
            );

            return;
        }


        if (
                name.contains(
                        "email"
                )
        ) {
            setUserText(
                    statement,
                    parameter,
                    column,
                    "step92-"
                    + role.toLowerCase(
                            Locale.ROOT
                    )
                    + "-"
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
            setUserText(
                    statement,
                    parameter,
                    column,
                    "step92-not-a-login-password"
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
            setUserText(
                    statement,
                    parameter,
                    column,
                    "Step 92 "
                    + role
            );

            return;
        }


        if (
                name.equals(
                        "role"
                )
        ) {
            setUserText(
                    statement,
                    parameter,
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
                    parameter,
                    true
            );

            return;
        }


        if (
                name.contains(
                        "status"
                )
        ) {
            setUserText(
                    statement,
                    parameter,
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
                            parameter,
                            UUID.randomUUID()
                    );

            case "boolean" ->
                    statement.setBoolean(
                            parameter,
                            true
                    );

            case "smallint",
                 "integer" ->
                    statement.setInt(
                            parameter,
                            1
                    );

            case "bigint" ->
                    statement.setLong(
                            parameter,
                            1L
                    );

            case "numeric",
                 "decimal",
                 "real",
                 "double precision" ->
                    statement.setBigDecimal(
                            parameter,
                            BigDecimal.ONE
                    );

            case "date" ->
                    statement.setDate(
                            parameter,
                            Date.valueOf(
                                    LocalDate.now()
                            )
                    );

            case "timestamp without time zone",
                 "timestamp with time zone" ->
                    statement.setTimestamp(
                            parameter,
                            Timestamp.from(
                                    Instant.now()
                            )
                    );

            case "character varying",
                 "character",
                 "text" ->
                    statement.setString(
                            parameter,
                            "STEP92-"
                            + UUID.randomUUID()
                    );

            case "user-defined" ->
                    statement.setObject(
                            parameter,
                            "STEP92",
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


    private static void setUserText(
            PreparedStatement statement,
            int parameter,
            ColumnDefinition column,
            String value
    ) throws SQLException {
        if (
                "USER-DEFINED".equalsIgnoreCase(
                        column.dataType()
                )
        ) {
            statement.setObject(
                    parameter,
                    value,
                    Types.OTHER
            );

        } else {
            statement.setString(
                    parameter,
                    value
            );
        }
    }


    private static void validateDisposableDatabase(
            String url
    ) {
        if (
                !url.matches(
                        "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 92 requires disposable loopback PostgreSQL."
            );
        }
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
     * A decoder bean keeps the actual resource-server SecurityFilterChain
     * fully constructible in this isolated context. MockMvc's jwt() processor
     * supplies the authenticated JwtAuthenticationToken exercised by requests.
     */
    /*
     * Focused Step 92 application context.
     *
     * It deliberately imports only the Step 91 feature runtime.
     *
     * This prevents unrelated ProcureIQ JPA mappings from participating in
     * this feature-specific HTTP/JDBC acceptance test while retaining real:
     *
     *   MVC dispatch
     *   Spring Security filter chain
     *   method security
     *   Bean Validation
     *   transaction management
     *   DataSource
     *   JdbcTemplate
     *   controller/service/repository beans
     */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableWebSecurity
    @EnableMethodSecurity
    @EnableTransactionManagement
    @Import({
            RolloverEvidenceController.class,
            RolloverEvidenceService.class,
            RolloverEvidenceRepository.class,
            Step92SecurityDependencyConfiguration.class
    })
    static class Step92FocusedApplication {
    }


    @TestConfiguration
    static class Step92SecurityDependencyConfiguration {

        @Bean
        @Primary
        JwtDecoder step92JwtDecoder() {
            return encoded ->
                    new Jwt(
                            encoded,
                            Instant.now(),
                            Instant.now()
                                    .plusSeconds(
                                            60
                                    ),
                            Map.of(
                                    "alg",
                                    "none"
                            ),
                            Map.of(
                                    "sub",
                                    BUYER.toString()
                            )
                    );
        }


        @Bean
        SecurityFilterChain step92SecurityFilterChain(
                HttpSecurity http
        ) throws Exception {
            return http
                    .authorizeHttpRequests(
                            authorization ->
                                    authorization
                                            .anyRequest()
                                            .authenticated()
                    )
                    .oauth2ResourceServer(
                            resourceServer ->
                                    resourceServer.jwt(
                                            Customizer.withDefaults()
                                    )
                    )
                    .build();
        }
}


    /*
     * -----------------------------------------------------------------------
     * STEP 92 TEST-LOCAL JSON SUPPORT
     *
     * The backend intentionally does not require Jackson Databind on this
     * test classpath. Keep the acceptance test self-contained and dependency
     * neutral.
     *
     * This parser/writer supports the complete JSON grammar needed by the
     * actual rollover-evidence HTTP contracts:
     *
     *   object
     *   array
     *   string / escapes / unicode
     *   number
     *   boolean
     *   null
     * -----------------------------------------------------------------------
     */


    private static byte[] jsonBytes(
            Object value
    ) {
        return jsonEncode(
                value
        )
                .getBytes(
                        java.nio.charset.StandardCharsets.UTF_8
                );
    }


    private static String jsonEncode(
            Object value
    ) {
        if (
                value == null
        ) {
            return "null";
        }


        if (
                value instanceof String text
        ) {
            return jsonQuote(
                    text
            );
        }


        if (
                value instanceof UUID uuid
                ||
                value instanceof LocalDate
        ) {
            return jsonQuote(
                    value.toString()
            );
        }


        if (
                value instanceof Number
                ||
                value instanceof Boolean
        ) {
            return value.toString();
        }


        if (
                value instanceof Map<?, ?> map
        ) {
            StringBuilder builder =
                    new StringBuilder(
                            "{"
                    );


            boolean first =
                    true;


            for (
                    Map.Entry<?, ?>
                    entry
                    : map.entrySet()
            ) {
                if (
                        !first
                ) {
                    builder.append(
                            ','
                    );
                }


                first =
                        false;


                builder.append(
                        jsonQuote(
                                String.valueOf(
                                        entry.getKey()
                                )
                        )
                );


                builder.append(
                        ':'
                );


                builder.append(
                        jsonEncode(
                                entry.getValue()
                        )
                );
            }


            return builder
                    .append(
                            '}'
                    )
                    .toString();
        }


        if (
                value instanceof Iterable<?> iterable
        ) {
            StringBuilder builder =
                    new StringBuilder(
                            "["
                    );


            boolean first =
                    true;


            for (
                    Object element
                    : iterable
            ) {
                if (
                        !first
                ) {
                    builder.append(
                            ','
                    );
                }


                first =
                        false;


                builder.append(
                        jsonEncode(
                                element
                        )
                );
            }


            return builder
                    .append(
                            ']'
                    )
                    .toString();
        }


        throw new IllegalArgumentException(
                "Unsupported test JSON value: "
                + value.getClass()
                        .getName()
        );
    }


    private static String jsonQuote(
            String value
    ) {
        StringBuilder builder =
                new StringBuilder(
                        value.length()
                        + 16
                );


        builder.append(
                '"'
        );


        for (
                int index = 0;
                index < value.length();
                index++
        ) {
            char character =
                    value.charAt(
                            index
                    );


            switch (
                    character
            ) {
                case '"' ->
                        builder.append(
                                "\\\""
                        );

                case '\\' ->
                        builder.append(
                                "\\\\"
                        );

                case '\b' ->
                        builder.append(
                                "\\b"
                        );

                case '\f' ->
                        builder.append(
                                "\\f"
                        );

                case '\n' ->
                        builder.append(
                                "\\n"
                        );

                case '\r' ->
                        builder.append(
                                "\\r"
                        );

                case '\t' ->
                        builder.append(
                                "\\t"
                        );

                default -> {
                    if (
                            character < 0x20
                    ) {
                        builder.append(
                                String.format(
                                        "\\u%04x",
                                        (int) character
                                )
                        );

                    } else {
                        builder.append(
                                character
                        );
                    }
                }
            }
        }


        return builder
                .append(
                        '"'
                )
                .toString();
    }


    private static JsonNode parseJson(
            byte[] bytes
    ) {
        return new MiniJsonParser(
                new String(
                        bytes,
                        java.nio.charset.StandardCharsets.UTF_8
                )
        )
                .parse();
    }


    private static final class JsonNode
            implements Iterable<JsonNode> {

        private static final Object MISSING =
                new Object();


        private static final JsonNode MISSING_NODE =
                new JsonNode(
                        MISSING
                );


        private final Object value;


        private JsonNode(
                Object value
        ) {
            this.value =
                    value;
        }


        JsonNode path(
                String name
        ) {
            if (
                    value instanceof Map<?, ?> map
                    &&
                    map.containsKey(
                            name
                    )
            ) {
                return new JsonNode(
                        map.get(
                                name
                        )
                );
            }


            return MISSING_NODE;
        }


        JsonNode get(
                int index
        ) {
            if (
                    value instanceof List<?> list
                    &&
                    index >= 0
                    &&
                    index < list.size()
            ) {
                return new JsonNode(
                        list.get(
                                index
                        )
                );
            }


            return null;
        }


        boolean isTextual() {
            return value instanceof String;
        }


        String asText() {
            if (
                    value == MISSING
                    ||
                    value == null
            ) {
                return "";
            }


            if (
                    value instanceof BigDecimal decimal
            ) {
                return decimal.toPlainString();
            }


            return String.valueOf(
                    value
            );
        }


        boolean asBoolean() {
            if (
                    value instanceof Boolean bool
            ) {
                return bool;
            }


            if (
                    value instanceof String text
            ) {
                return Boolean.parseBoolean(
                        text
                );
            }


            return false;
        }


        int asInt() {
            if (
                    value instanceof Number number
            ) {
                return number.intValue();
            }


            try {
                return Integer.parseInt(
                        asText()
                );

            } catch (
                    RuntimeException ignored
            ) {
                return 0;
            }
        }


        long asLong() {
            if (
                    value instanceof Number number
            ) {
                return number.longValue();
            }


            try {
                return Long.parseLong(
                        asText()
                );

            } catch (
                    RuntimeException ignored
            ) {
                return 0L;
            }
        }


        int size() {
            if (
                    value instanceof List<?> list
            ) {
                return list.size();
            }


            if (
                    value instanceof Map<?, ?> map
            ) {
                return map.size();
            }


            return 0;
        }


        @Override
        public java.util.Iterator<JsonNode> iterator() {
            if (
                    !(value instanceof List<?> list)
            ) {
                return java.util.Collections
                        .<JsonNode>emptyList()
                        .iterator();
            }


            return list
                    .stream()
                    .map(
                            JsonNode::new
                    )
                    .iterator();
        }
    }


    private static final class MiniJsonParser {

        private final String source;

        private int index;


        private MiniJsonParser(
                String source
        ) {
            this.source =
                    source;
        }


        JsonNode parse() {
            skipWhitespace();


            Object result =
                    value();


            skipWhitespace();


            if (
                    index != source.length()
            ) {
                throw invalidJson(
                        "Trailing content"
                );
            }


            return new JsonNode(
                    result
            );
        }


        private Object value() {
            skipWhitespace();


            if (
                    index >= source.length()
            ) {
                throw invalidJson(
                        "Unexpected end of JSON"
                );
            }


            char current =
                    source.charAt(
                            index
                    );


            return switch (
                    current
            ) {
                case '{' ->
                        object();

                case '[' ->
                        array();

                case '"' ->
                        string();

                case 't' -> {
                    literal(
                            "true"
                    );

                    yield Boolean.TRUE;
                }

                case 'f' -> {
                    literal(
                            "false"
                    );

                    yield Boolean.FALSE;
                }

                case 'n' -> {
                    literal(
                            "null"
                    );

                    yield null;
                }

                default -> {
                    if (
                            current == '-'
                            ||
                            Character.isDigit(
                                    current
                            )
                    ) {
                        yield number();
                    }


                    throw invalidJson(
                            "Unexpected token"
                    );
                }
            };
        }


        private Map<String, Object> object() {
            expect(
                    '{'
            );


            skipWhitespace();


            Map<String, Object> result =
                    new java.util.LinkedHashMap<>();


            if (
                    consume(
                            '}'
                    )
            ) {
                return result;
            }


            while (
                    true
            ) {
                skipWhitespace();


                if (
                        peek()
                        != '"'
                ) {
                    throw invalidJson(
                            "Object key must be a string"
                    );
                }


                String key =
                        string();


                skipWhitespace();


                expect(
                        ':'
                );


                Object value =
                        value();


                result.put(
                        key,
                        value
                );


                skipWhitespace();


                if (
                        consume(
                                '}'
                        )
                ) {
                    return result;
                }


                expect(
                        ','
                );
            }
        }


        private List<Object> array() {
            expect(
                    '['
            );


            skipWhitespace();


            List<Object> result =
                    new ArrayList<>();


            if (
                    consume(
                            ']'
                    )
            ) {
                return result;
            }


            while (
                    true
            ) {
                result.add(
                        value()
                );


                skipWhitespace();


                if (
                        consume(
                                ']'
                        )
                ) {
                    return result;
                }


                expect(
                        ','
                );
            }
        }


        private String string() {
            expect(
                    '"'
            );


            StringBuilder result =
                    new StringBuilder();


            while (
                    index < source.length()
            ) {
                char character =
                        source.charAt(
                                index++
                        );


                if (
                        character == '"'
                ) {
                    return result.toString();
                }


                if (
                        character != '\\'
                ) {
                    result.append(
                            character
                    );

                    continue;
                }


                if (
                        index >= source.length()
                ) {
                    throw invalidJson(
                            "Incomplete escape"
                    );
                }


                char escaped =
                        source.charAt(
                                index++
                        );


                switch (
                        escaped
                ) {
                    case '"' ->
                            result.append(
                                    '"'
                            );

                    case '\\' ->
                            result.append(
                                    '\\'
                            );

                    case '/' ->
                            result.append(
                                    '/'
                            );

                    case 'b' ->
                            result.append(
                                    '\b'
                            );

                    case 'f' ->
                            result.append(
                                    '\f'
                            );

                    case 'n' ->
                            result.append(
                                    '\n'
                            );

                    case 'r' ->
                            result.append(
                                    '\r'
                            );

                    case 't' ->
                            result.append(
                                    '\t'
                            );

                    case 'u' -> {
                        if (
                                index + 4
                                >
                                source.length()
                        ) {
                            throw invalidJson(
                                    "Incomplete unicode escape"
                            );
                        }


                        String hex =
                                source.substring(
                                        index,
                                        index + 4
                                );


                        try {
                            result.append(
                                    (char)
                                    Integer.parseInt(
                                            hex,
                                            16
                                    )
                            );

                        } catch (
                                NumberFormatException exception
                        ) {
                            throw invalidJson(
                                    "Invalid unicode escape"
                            );
                        }


                        index +=
                                4;
                    }

                    default ->
                            throw invalidJson(
                                    "Unknown escape"
                            );
                }
            }


            throw invalidJson(
                    "Unterminated string"
            );
        }


        private BigDecimal number() {
            int start =
                    index;


            if (
                    peek()
                    == '-'
            ) {
                index++;
            }


            digits();


            if (
                    peek()
                    == '.'
            ) {
                index++;

                digits();
            }


            char exponent =
                    peek();


            if (
                    exponent == 'e'
                    ||
                    exponent == 'E'
            ) {
                index++;


                char sign =
                        peek();


                if (
                        sign == '+'
                        ||
                        sign == '-'
                ) {
                    index++;
                }


                digits();
            }


            try {
                return new BigDecimal(
                        source.substring(
                                start,
                                index
                        )
                );

            } catch (
                    NumberFormatException exception
            ) {
                throw invalidJson(
                        "Invalid number"
                );
            }
        }


        private void digits() {
            int start =
                    index;


            while (
                    index < source.length()
                    &&
                    Character.isDigit(
                            source.charAt(
                                    index
                            )
                    )
            ) {
                index++;
            }


            if (
                    start == index
            ) {
                throw invalidJson(
                        "Expected digit"
                );
            }
        }


        private void literal(
                String expected
        ) {
            if (
                    !source.startsWith(
                            expected,
                            index
                    )
            ) {
                throw invalidJson(
                        "Invalid literal"
                );
            }


            index +=
                    expected.length();
        }


        private boolean consume(
                char expected
        ) {
            skipWhitespace();


            if (
                    peek()
                    != expected
            ) {
                return false;
            }


            index++;

            return true;
        }


        private void expect(
                char expected
        ) {
            skipWhitespace();


            if (
                    peek()
                    != expected
            ) {
                throw invalidJson(
                        "Expected '"
                        + expected
                        + "'"
                );
            }


            index++;
        }


        private char peek() {
            if (
                    index >= source.length()
            ) {
                return '\0';
            }


            return source.charAt(
                    index
            );
        }


        private void skipWhitespace() {
            while (
                    index < source.length()
                    &&
                    Character.isWhitespace(
                            source.charAt(
                                    index
                            )
                    )
            ) {
                index++;
            }
        }


        private IllegalArgumentException invalidJson(
                String message
        ) {
            return new IllegalArgumentException(
                    message
                    + " at JSON offset "
                    + index
            );
        }
    }



    private record ColumnDefinition(
            String name,
            String dataType,
            String nullable,
            String defaultValue,
            String identity,
            String generated
    ) {
    }
}
