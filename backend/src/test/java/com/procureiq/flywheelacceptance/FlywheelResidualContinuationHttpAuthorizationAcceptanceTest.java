package com.procureiq.flywheelacceptance;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationController;
import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
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
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringJUnitConfig(
        FlywheelResidualContinuationHttpAuthorizationAcceptanceTest.TestConfiguration.class
)
@WebAppConfiguration
class FlywheelResidualContinuationHttpAuthorizationAcceptanceTest {

    private static final String USER_ID =
            "11111111-1111-4111-8111-111111111111";

    private static final String ENTITY_ID =
            "22222222-2222-4222-8222-222222222222";

    private static final String SOURCE_ID =
            "33333333-3333-4333-8333-333333333333";

    private static final String CREATE_JSON =
            """
            {
              "sourceOutcomeCaseId": "33333333-3333-4333-8333-333333333333",
              "title": "Step 83 HTTP continuation"
            }
            """;

    private static final String ITEM_JSON =
            """
            {
              "sourceOutcomeItemId": "33333333-3333-4333-8333-333333333333",
              "continuationAction": "RECOVERY_RETRY",
              "targetDate": "2026-09-30",
              "rationale": "Step 83 authorization acceptance."
            }
            """;

    private static final String NOTE_JSON =
            """
            {
              "note": "Step 83 authorization acceptance"
            }
            """;


    @Autowired
    private WebApplicationContext context;


    private MockMvc mvc;


    @BeforeEach
    void setUp() {
        mvc =
                MockMvcBuilders
                        .webAppContextSetup(
                                context
                        )
                        .apply(
                                springSecurity()
                        )
                        .build();
    }


    /*
     * -----------------------------------------------------------------------
     * DASHBOARD
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationDashboardRejectsAnonymous() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/dashboard"
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    @Test
    void continuationDashboardAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/dashboard"
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * CASE CREATION
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationCreateRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases"
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        CREATE_JSON
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationCreateAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases"
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        CREATE_JSON
                                )
                )
                .andExpect(
                        status().isCreated()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * CASE READ
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationCaseReadAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * ITEM GOVERNANCE
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationItemRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/items",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        ITEM_JSON
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationItemAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/items",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        ITEM_JSON
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * SUBMIT
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationSubmitRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/submit",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationSubmitAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/submit",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * APPROVAL
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationApproveRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/approve",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        NOTE_JSON
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationApproveAllowsProcurementManager() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/approve",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "PROCUREMENT_MANAGER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        NOTE_JSON
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * CLOSURE
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationCloseRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/close",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        NOTE_JSON
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationCloseAllowsAdmin() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/close",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "ADMIN"
                                        )
                                )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        NOTE_JSON
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * SNAPSHOTS
     * -----------------------------------------------------------------------
     */


    @Test
    void continuationSnapshotCaptureRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/snapshots",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isForbidden()
                );
    }


    @Test
    void continuationSnapshotCaptureAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-continuations/cases/{id}/snapshots",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "BUYER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    @Test
    void continuationSnapshotReadAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-continuations/snapshots/{id}",
                                ENTITY_ID
                        )
                                .with(
                                        role(
                                                "APPROVER"
                                        )
                                )
                )
                .andExpect(
                        status().isOk()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * AUTHENTICATION HELPER
     * -----------------------------------------------------------------------
     */


    private RequestPostProcessor role(
            String role
    ) {
        return jwt()
                .jwt(
                        token ->
                                token.subject(
                                        USER_ID
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
     * ISOLATED MVC + METHOD SECURITY CONTEXT
     * -----------------------------------------------------------------------
     */


    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    static class TestConfiguration {

        @Bean
        FlywheelResidualContinuationService continuationService() {
            return mock(
                    FlywheelResidualContinuationService.class
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
        SecurityFilterChain step83SecurityFilterChain(
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
                                    USER_ID
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
}
