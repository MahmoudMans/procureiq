package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelResidualContinuationPolicyServiceTest {

    private final FlywheelResidualContinuationPolicyService policy =
            new FlywheelResidualContinuationPolicyService();

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(value);
    }

    private LocalDate today() {
        return LocalDate.of(
                2026,
                9,
                16
        );
    }

    @Test
    void acceptsRecoveryRetry() {
        assertDoesNotThrow(
                () ->
                        policy.validate(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("100.00"),
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                today(),
                                "Retry recovery using governed follow-up.",
                                today()
                        )
        );
    }

    @Test
    void mapsWriteOffEscalation() {
        assertEquals(
                FlywheelResidualContinuationAction.WRITE_OFF_ESCALATION,
                policy.expectedAction(
                        FlywheelResidualRemediationAction.WRITE_OFF_REVIEW
                )
        );
    }

    @Test
    void mapsInvestigationEscalation() {
        assertEquals(
                FlywheelResidualContinuationAction.INVESTIGATION_ESCALATION,
                policy.expectedAction(
                        FlywheelResidualRemediationAction.INVESTIGATION_ESCALATION
                )
        );
    }

    @Test
    void mapsRiskAcceptanceEscalation() {
        assertEquals(
                FlywheelResidualContinuationAction.RISK_ACCEPTANCE_ESCALATION,
                policy.expectedAction(
                        FlywheelResidualRemediationAction.RESIDUAL_ACCEPTANCE_REVIEW
                )
        );
    }

    @Test
    void rejectsNonPositiveResidual() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validate(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("0.00"),
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                today(),
                                "Invalid.",
                                today()
                        )
        );
    }

    @Test
    void rejectsIncompatibleAction() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validate(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("25.00"),
                                FlywheelResidualContinuationAction.WRITE_OFF_ESCALATION,
                                today(),
                                "Wrong continuation lineage.",
                                today()
                        )
        );
    }

    @Test
    void rejectsPastTargetDateAndBlankRationale() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validate(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("25.00"),
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                today().minusDays(1),
                                " ",
                                today()
                        )
        );
    }
}
