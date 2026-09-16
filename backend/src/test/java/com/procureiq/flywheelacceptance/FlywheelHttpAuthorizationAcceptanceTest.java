package com.procureiq.flywheelacceptance;

import com.procureiq.flywheelrelease.FlywheelReleaseController;
import com.procureiq.flywheelrelease.FlywheelReleaseService;
import com.procureiq.flywheelsettlement.FlywheelSettlementController;
import com.procureiq.flywheelsettlement.FlywheelSettlementService;
import com.procureiq.flywheelvariance.FlywheelVarianceController;
import com.procureiq.flywheelvariance.FlywheelVarianceService;
import com.procureiq.flywheelvarianceexecution.FlywheelVarianceExecutionController;
import com.procureiq.flywheelvarianceexecution.FlywheelVarianceExecutionService;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestInstance(
        TestInstance.Lifecycle.PER_CLASS
)
class FlywheelHttpAuthorizationAcceptanceTest {

    private static final UUID USER_ID =
            UUID.fromString(
                    "10000000-0000-0000-0000-000000000001"
            );

    private static final UUID RESOURCE_ID =
            UUID.fromString(
                    "20000000-0000-0000-0000-000000000001"
            );

    private AnnotationConfigWebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeAll
    void setUp() {
        context =
                new AnnotationConfigWebApplicationContext();

        context.setServletContext(
                new MockServletContext()
        );

        context.register(
                Harness.class
        );

        context.refresh();

        Filter springSecurityFilterChain =
                context.getBean(
                        "springSecurityFilterChain",
                        Filter.class
                );

        mockMvc =
                MockMvcBuilders
                        .webAppContextSetup(
                                context
                        )
                        .addFilters(
                                springSecurityFilterChain
                        )
                        .build();
    }

    @AfterAll
    void tearDown() {
        if (
                context != null
        ) {
            context.close();
        }

        SecurityContextHolder.clearContext();
    }

    @Test
    void anonymousCannotReadReleaseDashboard()
            throws Exception {
        mockMvc
                .perform(
                        get(
                                "/api/v1/flywheel-release"
                        )
                )
                .andExpect(
                        status().isUnauthorized()
                );
    }

    @Test
    void requesterCannotReadReleaseDashboard()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedGet(
                                "/api/v1/flywheel-release",
                                "REQUESTER"
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void approverCanReadEveryGovernanceDashboard()
            throws Exception {
        for (
                String path
                : List.of(
                        "/api/v1/flywheel-release",
                        "/api/v1/flywheel-settlement",
                        "/api/v1/flywheel-variance",
                        "/api/v1/flywheel-variance-execution"
                )
        ) {
            mockMvc
                    .perform(
                            authenticatedGet(
                                    path,
                                    "APPROVER"
                            )
                    )
                    .andExpect(
                            status().isOk()
                    );
        }
    }

    @Test
    void buyerCanCreateReleaseBatch()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-release/batches",
                                "BUYER",
                                """
                                {
                                  "allocationMandateId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "HTTP release test",
                                  "releaseOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "releaseRationale":
                                    "Authorization acceptance"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isCreated()
                );
    }

    @Test
    void approverCannotCreateReleaseBatch()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-release/batches",
                                "APPROVER",
                                """
                                {
                                  "allocationMandateId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "Denied",
                                  "releaseOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "releaseRationale":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void buyerCannotCancelReleaseBatch()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-release/batches/"
                                        + RESOURCE_ID
                                        + "/cancel",
                                "BUYER",
                                """
                                {
                                  "note":
                                    "Buyer cannot cancel batch"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void managerCanCancelReleaseBatch()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-release/batches/"
                                        + RESOURCE_ID
                                        + "/cancel",
                                "PROCUREMENT_MANAGER",
                                """
                                {
                                  "note":
                                    "Manager authorization test"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isOk()
                );
    }

    @Test
    void buyerCanCreateSettlementCase()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-settlement/cases",
                                "BUYER",
                                """
                                {
                                  "releaseBatchId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "HTTP settlement test",
                                  "reconciliationOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "reconciliationRationale":
                                    "Authorization acceptance"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isCreated()
                );
    }

    @Test
    void approverCannotCreateSettlementCase()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-settlement/cases",
                                "APPROVER",
                                """
                                {
                                  "releaseBatchId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "Denied",
                                  "reconciliationOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "reconciliationRationale":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void buyerCannotReconcileSettlementCase()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-settlement/cases/"
                                        + RESOURCE_ID
                                        + "/reconcile",
                                "BUYER",
                                """
                                {
                                  "note":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void managerCanReconcileSettlementCase()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-settlement/cases/"
                                        + RESOURCE_ID
                                        + "/reconcile",
                                "PROCUREMENT_MANAGER",
                                """
                                {
                                  "note":
                                    "Verified reconciliation"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isOk()
                );
    }

    @Test
    void buyerCanCreateVariancePlan()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance/plans",
                                "BUYER",
                                """
                                {
                                  "settlementCaseId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "HTTP variance test",
                                  "planOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "resolutionObjective":
                                    "Authorization acceptance"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isCreated()
                );
    }

    @Test
    void approverCannotCreateVariancePlan()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance/plans",
                                "APPROVER",
                                """
                                {
                                  "settlementCaseId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "Denied",
                                  "planOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "resolutionObjective":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void buyerCannotApproveVariancePlan()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance/plans/"
                                        + RESOURCE_ID
                                        + "/approve",
                                "BUYER",
                                """
                                {
                                  "note":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void managerCanApproveVariancePlan()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance/plans/"
                                        + RESOURCE_ID
                                        + "/approve",
                                "PROCUREMENT_MANAGER",
                                """
                                {
                                  "note":
                                    "Manager approval"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isOk()
                );
    }

    @Test
    void buyerCanCreateVarianceExecutionCase()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance-execution/cases",
                                "BUYER",
                                """
                                {
                                  "variancePlanId":
                                    "20000000-0000-0000-0000-000000000001",
                                  "title":
                                    "HTTP execution test",
                                  "executionOwnerUserId":
                                    "10000000-0000-0000-0000-000000000001",
                                  "executionObjective":
                                    "Authorization acceptance"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isCreated()
                );
    }

    @Test
    void buyerCannotVerifyVarianceExecution()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance-execution/cases/"
                                        + RESOURCE_ID
                                        + "/verify",
                                "BUYER",
                                """
                                {
                                  "note":
                                    "Denied"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isForbidden()
                );
    }

    @Test
    void managerCanVerifyVarianceExecution()
            throws Exception {
        mockMvc
                .perform(
                        authenticatedPost(
                                "/api/v1/flywheel-variance-execution/cases/"
                                        + RESOURCE_ID
                                        + "/verify",
                                "PROCUREMENT_MANAGER",
                                """
                                {
                                  "note":
                                    "Execution evidence verified"
                                }
                                """
                        )
                )
                .andExpect(
                        status().isOk()
                );
    }

    private MockHttpServletRequestBuilder authenticatedGet(
            String path,
            String role
    ) {
        return get(
                path
        )
                .header(
                        "X-Step76-Role",
                        role
                )
                .header(
                        "X-Step76-Subject",
                        USER_ID.toString()
                );
    }

    private MockHttpServletRequestBuilder authenticatedPost(
            String path,
            String role,
            String body
    ) {
        return post(
                path
        )
                .header(
                        "X-Step76-Role",
                        role
                )
                .header(
                        "X-Step76-Subject",
                        USER_ID.toString()
                )
                .contentType(
                        "application/json"
                )
                .content(
                        body
                );
    }

    @Configuration(
            proxyBeanMethods = false
    )
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    @Import({
            FlywheelReleaseController.class,
            FlywheelSettlementController.class,
            FlywheelVarianceController.class,
            FlywheelVarianceExecutionController.class
    })
    static class Harness {

        @Bean
        FlywheelReleaseService flywheelReleaseService() {
            return mock(
                    FlywheelReleaseService.class
            );
        }

        @Bean
        FlywheelSettlementService flywheelSettlementService() {
            return mock(
                    FlywheelSettlementService.class
            );
        }

        @Bean
        FlywheelVarianceService flywheelVarianceService() {
            return mock(
                    FlywheelVarianceService.class
            );
        }

        @Bean
        FlywheelVarianceExecutionService flywheelVarianceExecutionService() {
            return mock(
                    FlywheelVarianceExecutionService.class
            );
        }

        @Bean
        Step76AuthenticationFilter step76AuthenticationFilter() {
            return new Step76AuthenticationFilter();
        }

        @Bean
        SecurityFilterChain step76SecurityFilterChain(
                HttpSecurity http,
                Step76AuthenticationFilter authenticationFilter
        ) throws Exception {

            http
                    .csrf(
                            csrf ->
                                    csrf.disable()
                    )

                    .sessionManagement(
                            sessions ->
                                    sessions.sessionCreationPolicy(
                                            SessionCreationPolicy.STATELESS
                                    )
                    )

                    .authorizeHttpRequests(
                            requests ->
                                    requests
                                            .anyRequest()
                                            .authenticated()
                    )

                    .exceptionHandling(
                            exceptions ->
                                    exceptions
                                            .authenticationEntryPoint(
                                                    (
                                                            request,
                                                            response,
                                                            exception
                                                    ) ->
                                                            response.sendError(
                                                                    HttpServletResponse
                                                                            .SC_UNAUTHORIZED
                                                            )
                                            )

                                            .accessDeniedHandler(
                                                    (
                                                            request,
                                                            response,
                                                            exception
                                                    ) ->
                                                            response.sendError(
                                                                    HttpServletResponse
                                                                            .SC_FORBIDDEN
                                                            )
                                            )
                    )

                    .addFilterAfter(
                            authenticationFilter,
                            SecurityContextHolderFilter.class
                    );

            return http.build();
        }
    }

    static class Step76AuthenticationFilter
            extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(
                HttpServletRequest request,
                HttpServletResponse response,
                FilterChain filterChain
        ) throws ServletException, IOException {

            String role =
                    request.getHeader(
                            "X-Step76-Role"
                    );

            if (
                    role != null
                    &&
                    !role.isBlank()
            ) {
                String subject =
                        request.getHeader(
                                "X-Step76-Subject"
                        );

                if (
                        subject == null
                        ||
                        subject.isBlank()
                ) {
                    subject =
                            USER_ID.toString();
                }

                Instant now =
                        Instant.now();

                Jwt jwt =
                        Jwt
                                .withTokenValue(
                                        "step76-test-token"
                                )
                                .header(
                                        "alg",
                                        "none"
                                )
                                .subject(
                                        subject
                                )
                                .issuedAt(
                                        now
                                )
                                .expiresAt(
                                        now.plusSeconds(
                                                300
                                        )
                                )
                                .build();

                JwtAuthenticationToken authentication =
                        new JwtAuthenticationToken(
                                jwt,
                                List.of(
                                        new SimpleGrantedAuthority(
                                                "ROLE_"
                                                        + role
                                        )
                                )
                        );

                var context =
                        SecurityContextHolder
                                .createEmptyContext();

                context.setAuthentication(
                        authentication
                );

                SecurityContextHolder.setContext(
                        context
                );
            }

            filterChain.doFilter(
                    request,
                    response
            );
        }
    }
}
