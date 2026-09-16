package com.procureiq.flywheelacceptance;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationController;
import com.procureiq.flywheelremediation.FlywheelResidualRemediationService;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationOutcomeController;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationOutcomeService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringJUnitConfig(
        FlywheelRemediationHttpAuthorizationAcceptanceTest.TestConfiguration.class
)
@WebAppConfiguration
class FlywheelRemediationHttpAuthorizationAcceptanceTest {

    private static final String USER_ID =
            "11111111-1111-4111-8111-111111111111";

    private static final String ENTITY_ID =
            "22222222-2222-4222-8222-222222222222";

    private static final String NOTE_JSON =
            """
            {
              "note": "Step 80 authorization acceptance"
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
     * STEP 77 — RESIDUAL REMEDIATION
     * -----------------------------------------------------------------------
     */


    @Test
    void remediationDashboardRejectsAnonymous() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation/dashboard"
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    @Test
    void remediationDashboardAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation/dashboard"
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


    @Test
    void remediationSubmitRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/submit",
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
    void remediationSubmitAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/submit",
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
    void remediationApproveRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/approve",
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
    void remediationApproveAllowsProcurementManager() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/approve",
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


    @Test
    void remediationCloseRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/close",
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
    void remediationCloseAllowsAdmin() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/close",
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


    @Test
    void remediationSnapshotCaptureRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/snapshots",
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
    void remediationSnapshotCaptureAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation/plans/{id}/snapshots",
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
    void remediationSnapshotReadAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation/snapshots/{id}",
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


    @Test
    void remediationPlanReadRejectsAnonymous() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation/plans/{id}",
                                ENTITY_ID
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * STEP 78 — REMEDIATION OUTCOME ASSURANCE
     * -----------------------------------------------------------------------
     */


    @Test
    void outcomeDashboardRejectsAnonymous() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-outcomes/dashboard"
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    @Test
    void outcomeDashboardAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-outcomes/dashboard"
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


    @Test
    void outcomeSubmitRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/submit",
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
    void outcomeSubmitAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/submit",
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
    void outcomeVerifyRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/verify",
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
    void outcomeVerifyAllowsProcurementManager() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/verify",
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


    @Test
    void outcomeCloseRejectsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/close",
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
    void outcomeCloseAllowsAdmin() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/close",
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


    @Test
    void outcomeSnapshotCaptureRejectsApprover() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/snapshots",
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
    void outcomeSnapshotCaptureAllowsBuyer() throws Exception {
        mvc.perform(
                        post(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}/snapshots",
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
    void outcomeSnapshotReadAllowsApprover() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-outcomes/snapshots/{id}",
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


    @Test
    void outcomeCaseReadRejectsAnonymous() throws Exception {
        mvc.perform(
                        get(
                                "/api/v1/flywheel-remediation-outcomes/cases/{id}",
                                ENTITY_ID
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }


    /*
     * -----------------------------------------------------------------------
     * AUTH HELPERS
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
     * ISOLATED WEB SECURITY CONTEXT
     * -----------------------------------------------------------------------
     */


    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    static class TestConfiguration {

        @Bean
        FlywheelResidualRemediationService residualRemediationService() {
            return mock(
                    FlywheelResidualRemediationService.class
            );
        }


        @Bean
        FlywheelRemediationOutcomeService remediationOutcomeService() {
            return mock(
                    FlywheelRemediationOutcomeService.class
            );
        }


        @Bean
        FlywheelResidualRemediationController residualRemediationController(
                FlywheelResidualRemediationService service
        ) {
            return new FlywheelResidualRemediationController(
                    service
            );
        }


        @Bean
        FlywheelRemediationOutcomeController remediationOutcomeController(
                FlywheelRemediationOutcomeService service
        ) {
            return new FlywheelRemediationOutcomeController(
                    service
            );
        }


        @Bean
        SecurityFilterChain step80SecurityFilterChain(
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
