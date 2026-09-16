package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FlywheelContinuationOutcomePolicyServiceTest {

    private final FlywheelContinuationOutcomePolicyService policy =
            new FlywheelContinuationOutcomePolicyService();

    private LocalDate today() {
        return LocalDate.of(
                2026,
                9,
                16
        );
    }

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    @Test
    void acceptsConfirmedRecoveryAndCalculatesRemainingResidual() {
        assertEquals(
                n(
                        "40.00"
                ),
                policy.validateAndRemaining(
                        FlywheelResidualContinuationAction.RECOVERY_RETRY,
                        n(
                                "100.00"
                        ),
                        FlywheelContinuationOutcomeResolutionType.RECOVERY_CONFIRMED,
                        n(
                                "60.00"
                        ),
                        today(),
                        "RECOVERY-001",
                        "Observed recovery evidence.",
                        today()
                )
        );
    }

    @Test
    void acceptsConfirmedWriteOffWithPositiveReduction() {
        assertEquals(
                n(
                        "25.00"
                ),
                policy.validateAndRemaining(
                        FlywheelResidualContinuationAction.WRITE_OFF_ESCALATION,
                        n(
                                "100.00"
                        ),
                        FlywheelContinuationOutcomeResolutionType.WRITE_OFF_CONFIRMED,
                        n(
                                "75.00"
                        ),
                        today(),
                        "WRITE-OFF-001",
                        "Observed write-off evidence.",
                        today()
                )
        );
    }

    @Test
    void riskAcceptanceDoesNotReduceFinancialResidual() {
        assertEquals(
                n(
                        "100.00"
                ),
                policy.validateAndRemaining(
                        FlywheelResidualContinuationAction.RISK_ACCEPTANCE_ESCALATION,
                        n(
                                "100.00"
                        ),
                        FlywheelContinuationOutcomeResolutionType.RISK_ACCEPTANCE_CONFIRMED,
                        n(
                                "0.00"
                        ),
                        today(),
                        "RISK-001",
                        "Residual risk acceptance evidence.",
                        today()
                )
        );
    }

    @Test
    void partialRequiresPositiveIncompleteReduction() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateAndRemaining(
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                n(
                                        "100.00"
                                ),
                                FlywheelContinuationOutcomeResolutionType.PARTIAL,
                                n(
                                        "100.00"
                                ),
                                today(),
                                "PARTIAL-001",
                                "Invalid full reduction marked partial.",
                                today()
                        )
        );
    }

    @Test
    void unresolvedCannotClaimReduction() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateAndRemaining(
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                n(
                                        "100.00"
                                ),
                                FlywheelContinuationOutcomeResolutionType.UNRESOLVED,
                                n(
                                        "1.00"
                                ),
                                today(),
                                "UNRESOLVED-001",
                                "Invalid unresolved reduction.",
                                today()
                        )
        );
    }

    @Test
    void rejectsIncompatibleResolutionType() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateAndRemaining(
                                FlywheelResidualContinuationAction.RECOVERY_RETRY,
                                n(
                                        "100.00"
                                ),
                                FlywheelContinuationOutcomeResolutionType.WRITE_OFF_CONFIRMED,
                                n(
                                        "10.00"
                                ),
                                today(),
                                "WRONG-001",
                                "Wrong action lineage.",
                                today()
                        )
        );
    }

    @Test
    void dispositionSeparatesResolvedFromFurtherGovernance() {
        assertEquals(
                FlywheelContinuationOutcomeResidualDisposition.FULLY_RESOLVED,
                policy.disposition(
                        n(
                                "0.00"
                        )
                )
        );

        assertEquals(
                FlywheelContinuationOutcomeResidualDisposition.FURTHER_GOVERNANCE_REQUIRED,
                policy.disposition(
                        n(
                                "0.01"
                        )
                )
        );
    }
}
