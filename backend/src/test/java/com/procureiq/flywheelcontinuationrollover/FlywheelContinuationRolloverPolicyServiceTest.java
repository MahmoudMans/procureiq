package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FlywheelContinuationRolloverPolicyServiceTest {

    private final FlywheelContinuationRolloverPolicyService policy =
            new FlywheelContinuationRolloverPolicyService();


    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }


    private LocalDate today() {
        return LocalDate.of(
                2026,
                9,
                16
        );
    }


    @Test
    void verifiedPositiveResidualRequiringFurtherGovernanceIsEligible() {
        policy.validateEligibleSource(
                "VERIFIED",
                "FURTHER_GOVERNANCE_REQUIRED",
                n(
                        "100.00"
                ),
                2
        );
    }


    @Test
    void nonVerifiedOutcomeIsRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateEligibleSource(
                                "IN_REVIEW",
                                "FURTHER_GOVERNANCE_REQUIRED",
                                n(
                                        "100.00"
                                ),
                                1
                        )
        );
    }


    @Test
    void fullyResolvedOutcomeIsRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateEligibleSource(
                                "VERIFIED",
                                "FULLY_RESOLVED",
                                n(
                                        "0.00"
                                ),
                                0
                        )
        );
    }


    @Test
    void zeroResidualIsRejectedEvenWhenDispositionClaimsFurtherGovernance() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateEligibleSource(
                                "VERIFIED",
                                "FURTHER_GOVERNANCE_REQUIRED",
                                n(
                                        "0.00"
                                ),
                                1
                        )
        );
    }


    @Test
    void rolloverPreservesContinuationActionExactly() {
        for (
                FlywheelResidualContinuationAction action
                : FlywheelResidualContinuationAction.values()
        ) {
            assertEquals(
                    action,
                    policy.continuationAction(
                            action
                    )
            );
        }
    }


    @Test
    void positiveResidualFutureTargetAndRationaleAreAccepted() {
        policy.validateItem(
                n(
                        "25.00"
                ),
                today()
                        .plusDays(
                                30
                        ),
                "Continue governed recovery activity.",
                today()
        );
    }


    @Test
    void pastTargetAndBlankRationaleAreRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                n(
                                        "25.00"
                                ),
                                today()
                                        .minusDays(
                                                1
                                        ),
                                "Valid rationale",
                                today()
                        )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                n(
                                        "25.00"
                                ),
                                today(),
                                " ",
                                today()
                        )
        );
    }
}
