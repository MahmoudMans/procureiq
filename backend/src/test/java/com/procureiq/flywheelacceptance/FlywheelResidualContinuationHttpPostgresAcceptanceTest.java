package com.procureiq.flywheelacceptance;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationController;
import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationPolicyService;
import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationRepository;
import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitConfig(
        FlywheelResidualContinuationHttpPostgresAcceptanceTest.TestConfiguration.class
)
@WebAppConfiguration
class FlywheelResidualContinuationHttpPostgresAcceptanceTest {

    private static final String JDBC_URL =
            requiredEnvironment(
                    "PROCUREIQ_STEP85_DB_URL"
            );

    private static final String JDBC_USER =
            requiredEnvironment(
                    "PROCUREIQ_STEP85_DB_USER"
            );

    private static final String JDBC_PASSWORD =
            requiredEnvironment(
                    "PROCUREIQ_STEP85_DB_PASSWORD"
            );

    private static final String SCHEMA =
            "step85_http_"
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

    private static final UUID ADMIN_ID =
            UUID.randomUUID();


    @Autowired
    private WebApplicationContext context;


    @Autowired
    private JdbcTemplate jdbc;


    @Autowired
    private DataSource dataSource;


    private MockMvc mvc;


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
             * Keep all continuation governance/runtime triggers active.
             *
             * Disable only audit triggers in this disposable acceptance
             * schema because audit persistence is not Step 85's subject.
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
                    "BUYER"
            );

            seedUser(
                    connection,
                    MANAGER_ID,
                    "PROCUREMENT_MANAGER"
            );

            seedUser(
                    connection,
                    APPROVER_ID,
                    "APPROVER"
            );

            seedUser(
                    connection,
                    ADMIN_ID,
                    "ADMIN"
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
        mvc =
                MockMvcBuilders
                        .webAppContextSetup(
                                context
                        )
                        .apply(
                                springSecurity()
                        )
                        .build();


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
     * REAL HTTP AUTHENTICATION BOUNDARY
     * -----------------------------------------------------------------------
     */


    @Test
    void anonymousDashboardIsRejectedByRealSecurityChain() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/dashboard"
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * 2
     * HTTP -> SERVICE -> REPOSITORY -> POSTGRES READ
     * -----------------------------------------------------------------------
     */


    @Test
    void approverDashboardReadsEligibleResidualSourceFromPostgres() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "100.00",
                        "40.00"
                );


        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/dashboard"
                        )
                                .with(
                                        role(
                                                APPROVER_ID,
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.summary.totalCases"
                        )
                                .value(
                                        0
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.eligibleSources.length()"
                        )
                                .value(
                                        1
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.eligibleSources[0].outcomeCaseId"
                        )
                                .value(
                                        source.caseId()
                                                .toString()
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.eligibleSources[0].residualItemCount"
                        )
                                .value(
                                        1
                                )
                );
    }


    /*
     * -----------------------------------------------------------------------
     * 3
     * REAL CASE CREATION
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerCreatesContinuationThroughHttpAndPersistsExactAuthority() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "100.00",
                        "25.00"
                );


        String title =
                "Step 85 HTTP continuation "
                + shortId();


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases"
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        createCaseJson(
                                                source.caseId(),
                                                title
                                        )
                                )
                )
                .andExpect(
                        status().isCreated()
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.status"
                        )
                                .value(
                                        "DRAFT"
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.sourceOutcomeCaseId"
                        )
                                .value(
                                        source.caseId()
                                                .toString()
                                )
                );


        UUID continuationId =
                continuationId(
                        source.caseId()
                );


        assertEquals(
                title,
                jdbc.queryForObject(
                        """
                        SELECT title

                        FROM procurement_remediation_continuation_cases

                        WHERE id = ?
                        """,
                        String.class,
                        continuationId
                )
        );


        BigDecimal persistedResidual =
                jdbc.queryForObject(
                        """
                        SELECT source_remaining_residual_amount

                        FROM procurement_remediation_continuation_cases

                        WHERE id = ?
                        """,
                        BigDecimal.class,
                        continuationId
                );


        assertEquals(
                0,
                source.remainingTotal()
                        .compareTo(
                                persistedResidual
                        )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 4
     * REAL ITEM CREATION
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerAddsContinuationItemThroughHttpAndPersistsIt() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "100.00",
                        "40.00"
                );


        UUID continuationId =
                createCaseThroughHttp(
                        source
                );


        OutcomeItem sourceItem =
                source.items()
                        .getFirst();


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/items",
                                continuationId
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        itemJson(
                                                sourceItem.id()
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.itemCount"
                        )
                                .value(
                                        1
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.items[0].continuationAction"
                        )
                                .value(
                                        "RECOVERY_RETRY"
                                )
                );


        assertEquals(
                1L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_items

                        WHERE continuation_case_id = ?
                        """,
                        continuationId
                )
        );


        assertEquals(
                "RECOVERY_RETRY",
                jdbc.queryForObject(
                        """
                        SELECT continuation_action

                        FROM procurement_remediation_continuation_items

                        WHERE continuation_case_id = ?
                        """,
                        String.class,
                        continuationId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 5
     * REAL SUBMISSION
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerSubmitsCompleteContinuationThroughHttp() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "100.00",
                        "40.00"
                );


        UUID continuationId =
                completeDraftThroughHttp(
                        source
                );


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/submit",
                                continuationId
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.status"
                        )
                                .value(
                                        "IN_REVIEW"
                                )
                );


        assertEquals(
                "IN_REVIEW",
                continuationStatus(
                        continuationId
                )
        );


        assertEquals(
                BUYER_ID,
                jdbc.queryForObject(
                        """
                        SELECT review_submitted_by_user_id

                        FROM procurement_remediation_continuation_cases

                        WHERE id = ?
                        """,
                        UUID.class,
                        continuationId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 6
     * REAL METHOD AUTHORIZATION + DATABASE NON-MUTATION
     * -----------------------------------------------------------------------
     */


    @Test
    void buyerCannotApproveAndDatabaseRemainsInReview() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "100.00",
                        "40.00"
                );


        UUID continuationId =
                submittedCaseThroughHttp(
                        source
                );


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/approve",
                                continuationId
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        noteJson(
                                                "Buyer cannot approve."
                                        )
                                )
                )
                .andExpect(
                        status().isForbidden()
                );


        assertEquals(
                "IN_REVIEW",
                continuationStatus(
                        continuationId
                )
        );


        assertEquals(
                0L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_snapshots

                        WHERE continuation_case_id = ?
                        """,
                        continuationId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 7
     * REAL MANAGER APPROVAL + SNAPSHOT
     * -----------------------------------------------------------------------
     */


    @Test
    void procurementManagerApprovesThroughHttpAndCreatesSealedSnapshot() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "120.00",
                        "20.00"
                );


        UUID continuationId =
                submittedCaseThroughHttp(
                        source
                );


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/approve",
                                continuationId
                        )
                                .with(
                                        role(
                                                MANAGER_ID,
                                                "PROCUREMENT_MANAGER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        noteJson(
                                                "Manager approved through Step 85."
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.status"
                        )
                                .value(
                                        "APPROVED"
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.snapshots.length()"
                        )
                                .value(
                                        1
                                )
                );


        assertEquals(
                "APPROVED",
                continuationStatus(
                        continuationId
                )
        );


        assertEquals(
                MANAGER_ID,
                jdbc.queryForObject(
                        """
                        SELECT approved_by_user_id

                        FROM procurement_remediation_continuation_cases

                        WHERE id = ?
                        """,
                        UUID.class,
                        continuationId
                )
        );


        assertEquals(
                1L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_snapshots

                        WHERE continuation_case_id = ?

                        AND sealed = TRUE

                        AND continuation_status = 'APPROVED'
                        """,
                        continuationId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * 8
     * REAL ADMIN CLOSURE + SECOND SNAPSHOT
     * -----------------------------------------------------------------------
     */


    @Test
    void adminClosesThroughHttpAndCreatesSecondSealedSnapshot() throws Exception {
        OutcomeSeed source =
                seedVerifiedRecoveryOutcome(
                        "150.00",
                        "50.00"
                );


        UUID continuationId =
                submittedCaseThroughHttp(
                        source
                );


        approveThroughHttp(
                continuationId
        );


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/close",
                                continuationId
                        )
                                .with(
                                        role(
                                                ADMIN_ID,
                                                "ADMIN"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        noteJson(
                                                "Admin closed continuation through Step 85."
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.continuationCase.status"
                        )
                                .value(
                                        "CLOSED"
                                )
                )
                .andExpect(
                        jsonPath(
                                "$.snapshots.length()"
                        )
                                .value(
                                        2
                                )
                );


        assertEquals(
                "CLOSED",
                continuationStatus(
                        continuationId
                )
        );


        assertEquals(
                ADMIN_ID,
                jdbc.queryForObject(
                        """
                        SELECT closed_by_user_id

                        FROM procurement_remediation_continuation_cases

                        WHERE id = ?
                        """,
                        UUID.class,
                        continuationId
                )
        );


        assertEquals(
                2L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_snapshots

                        WHERE continuation_case_id = ?

                        AND sealed = TRUE
                        """,
                        continuationId
                )
        );


        assertEquals(
                1L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_snapshots

                        WHERE continuation_case_id = ?

                        AND continuation_status = 'APPROVED'
                        """,
                        continuationId
                )
        );


        assertEquals(
                1L,
                count(
                        """
                        SELECT COUNT(*)

                        FROM procurement_remediation_continuation_snapshots

                        WHERE continuation_case_id = ?

                        AND continuation_status = 'CLOSED'
                        """,
                        continuationId
                )
        );
    }


    /*
     * -----------------------------------------------------------------------
     * HTTP WORKFLOW HELPERS
     * -----------------------------------------------------------------------
     */


    private UUID createCaseThroughHttp(
            OutcomeSeed source
    ) throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases"
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        createCaseJson(
                                                source.caseId(),
                                                "Step 85 continuation "
                                                + shortId()
                                        )
                                )
                )
                .andExpect(
                        status().isCreated()
                );


        return continuationId(
                source.caseId()
        );
    }


    private UUID completeDraftThroughHttp(
            OutcomeSeed source
    ) throws Exception {
        UUID continuationId =
                createCaseThroughHttp(
                        source
                );


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


            mvc.perform(
                            post(
                                    "/api/v1/flywheel-remediation-continuations/cases/{id}/items",
                                    continuationId
                            )
                                    .with(
                                            role(
                                                    BUYER_ID,
                                                    "BUYER"
                                            )
                                    )
                                    .contentType(
                                            MediaType.APPLICATION_JSON
                                    )
                                    .content(
                                            itemJson(
                                                    item.id()
                                            )
                                    )
                    )
                    .andExpect(
                            status().isOk()
                    );
        }


        return continuationId;
    }


    private UUID submittedCaseThroughHttp(
            OutcomeSeed source
    ) throws Exception {
        UUID continuationId =
                completeDraftThroughHttp(
                        source
                );


        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/submit",
                                continuationId
                        )
                                .with(
                                        role(
                                                BUYER_ID,
                                                "BUYER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );


        return continuationId;
    }


    private void approveThroughHttp(
            UUID continuationId
    ) throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/approve",
                                continuationId
                        )
                                .with(
                                        role(
                                                MANAGER_ID,
                                                "PROCUREMENT_MANAGER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        noteJson(
                                                "Approved before closure."
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    private UUID continuationId(
            UUID sourceOutcomeCaseId
    ) {
        UUID value =
                jdbc.queryForObject(
                        """
                        SELECT id

                        FROM procurement_remediation_continuation_cases

                        WHERE source_outcome_case_id = ?
                        """,
                        UUID.class,
                        sourceOutcomeCaseId
                );


        if (
                value == null
        ) {
            throw new IllegalStateException(
                    "Continuation case was not persisted."
            );
        }


        return value;
    }


    private String continuationStatus(
            UUID continuationId
    ) {
        return jdbc.queryForObject(
                """
                SELECT status

                FROM procurement_remediation_continuation_cases

                WHERE id = ?
                """,
                String.class,
                continuationId
        );
    }


    private long count(
            String sql,
            UUID id
    ) {
        Long value =
                jdbc.queryForObject(
                        sql,
                        Long.class,
                        id
                );


        return value == null
                ? 0L
                : value;
    }


    /*
     * -----------------------------------------------------------------------
     * REQUEST CONTENT
     * -----------------------------------------------------------------------
     */


    private static String createCaseJson(
            UUID sourceId,
            String title
    ) {
        return """
               {
                 "sourceOutcomeCaseId": "%s",
                 "title": "%s"
               }
               """
                .formatted(
                        sourceId,
                        escapeJson(
                                title
                        )
                );
    }


    private static String itemJson(
            UUID sourceItemId
    ) {
        return """
               {
                 "sourceOutcomeItemId": "%s",
                 "continuationAction": "RECOVERY_RETRY",
                 "targetDate": "%s",
                 "rationale": "Step 85 full-stack continuation evidence."
               }
               """
                .formatted(
                        sourceItemId,
                        LocalDate.now()
                                .plusDays(
                                        30
                                )
                );
    }


    private static String noteJson(
            String note
    ) {
        return """
               {
                 "note": "%s"
               }
               """
                .formatted(
                        escapeJson(
                                note
                        )
                );
    }


    private static String escapeJson(
            String value
    ) {
        return value
                .replace(
                        "\\",
                        "\\\\"
                )
                .replace(
                        "\"",
                        "\\\""
                );
    }


    /*
     * -----------------------------------------------------------------------
     * SECURITY HELPER
     * -----------------------------------------------------------------------
     */


    private static RequestPostProcessor role(
            UUID userId,
            String role
    ) {
        return jwt()
                .jwt(
                        token ->
                                token.subject(
                                        userId.toString()
                                )
                )
                .authorities(
                        new SimpleGrantedAuthority(
                                "ROLE_"
                                + role
                        )
                );
    }


    /*
     * -----------------------------------------------------------------------
     * VERIFIED OUTCOME SOURCE FIXTURE
     * -----------------------------------------------------------------------
     */


    private OutcomeSeed seedVerifiedRecoveryOutcome(
            String sourceResidual,
            String resolvedAmount
    ) throws SQLException {
        BigDecimal source =
                money(
                        sourceResidual
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
                > 0,
                "RECOVERY_EVIDENCED fixtures require a positive resolved amount."
        );

        assertTrue(
                remaining.signum()
                > 0,
                "Step 85 fixtures require positive remaining residual."
        );


        UUID caseId =
                UUID.randomUUID();

        UUID itemId =
                UUID.randomUUID();

        String outcomeNumber =
                "ROC-STEP85-"
                + shortId();


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
                                            'USD',
                                            2026,
                                            ?,
                                            1,
                                            ?,
                                            'Step 85 Buyer',
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
                            "Step 85 verified outcome "
                            + shortId()
                    );

                    statement.setBigDecimal(
                            5,
                            source
                    );

                    statement.setObject(
                            6,
                            BUYER_ID
                    );

                    statement.setObject(
                            7,
                            BUYER_ID
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
                                            'Step 85 verified source evidence',
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
                            "STEP85-"
                            + shortId()
                    );

                    statement.setObject(
                            8,
                            BUYER_ID
                    );

                    statement.executeUpdate();
                }

            } finally {
                control.execute(
                        "SET session_replication_role = origin"
                );
            }
        }


        return new OutcomeSeed(
                caseId,
                outcomeNumber,
                "USD",
                remaining,
                List.of(
                        new OutcomeItem(
                                itemId,
                                remaining
                        )
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
                                FlywheelResidualContinuationHttpPostgresAcceptanceTest
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
                            role
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
                    "step85-"
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
                    "step85-password-hash"
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
                    "Step 85 "
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
                            "STEP85-"
                            + shortId()
                    );

            case "user-defined" ->
                    statement.setObject(
                            index,
                            "STEP85",
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
                    "Step 85 requires loopback PostgreSQL."
            );
        }


        if (
                !url.endsWith(
                        "/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 85 requires disposable procureiq_step70."
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
     * REAL TEST APPLICATION CONTEXT
     * -----------------------------------------------------------------------
     */


    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
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


        @Bean
        FlywheelResidualContinuationController continuationController(
                FlywheelResidualContinuationService service
        ) {
            return new FlywheelResidualContinuationController(
                    service
            );
        }


        @Bean
        SecurityFilterChain step85SecurityFilterChain(
                HttpSecurity http
        ) throws Exception {
            http
                    .csrf(
                            csrf ->
                                    csrf.disable()
                    )
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
                    );

            return http.build();
        }


        @Bean
        JwtDecoder jwtDecoder() {
            return token ->
                    Jwt.withTokenValue(
                                    token
                            )
                            .header(
                                    "alg",
                                    "none"
                            )
                            .subject(
                                    BUYER_ID.toString()
                            )
                            .issuedAt(
                                    Instant.now()
                                            .minusSeconds(
                                                    60
                                            )
                            )
                            .expiresAt(
                                    Instant.now()
                                            .plusSeconds(
                                                    3600
                                            )
                            )
                            .build();
        }
    }


    /*
     * -----------------------------------------------------------------------
     * RECORDS
     * -----------------------------------------------------------------------
     */


    private record OutcomeItem(
            UUID id,
            BigDecimal remaining
    ) {
    }


    private record OutcomeSeed(
            UUID caseId,
            String outcomeNumber,
            String currency,
            BigDecimal remainingTotal,
            List<OutcomeItem> items
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
