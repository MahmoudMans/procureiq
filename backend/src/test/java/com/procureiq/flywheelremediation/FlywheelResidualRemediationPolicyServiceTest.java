package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelResidualRemediationPolicyServiceTest {

    private final FlywheelResidualRemediationPolicyService policy =
            new FlywheelResidualRemediationPolicyService();

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    @Test
    void acceptsPositiveResidualDecision() {
        assertDoesNotThrow(
                () ->
                        policy.validateItem(
                                FlywheelVarianceDecision.RECOVER,
                                n("25.00"),
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                LocalDate.of(
                                        2026,
                                        10,
                                        1
                                ),
                                "Follow up remaining recovery evidence.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsNonPositiveResidual() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                FlywheelVarianceDecision.RECOVER,
                                n("0.00"),
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                LocalDate.of(
                                        2026,
                                        10,
                                        1
                                ),
                                "Follow up",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsMissingDecisionOrAction() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                null,
                                n("10.00"),
                                FlywheelResidualRemediationAction.WRITE_OFF_REVIEW,
                                LocalDate.of(
                                        2026,
                                        10,
                                        1
                                ),
                                "Review",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                FlywheelVarianceDecision.WRITE_OFF,
                                n("10.00"),
                                null,
                                LocalDate.of(
                                        2026,
                                        10,
                                        1
                                ),
                                "Review",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsPastTargetDate() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                FlywheelVarianceDecision.INVESTIGATE,
                                n("15.00"),
                                FlywheelResidualRemediationAction.INVESTIGATION_ESCALATION,
                                LocalDate.of(
                                        2026,
                                        9,
                                        15
                                ),
                                "Escalate investigation.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsBlankRationale() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateItem(
                                FlywheelVarianceDecision.WRITE_OFF,
                                n("12.00"),
                                FlywheelResidualRemediationAction.WRITE_OFF_REVIEW,
                                LocalDate.of(
                                        2026,
                                        10,
                                        1
                                ),
                                "   ",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void calculatesActionBucketsExactly() {
        var result =
                policy.metrics(
                        List.of(
                                new FlywheelResidualRemediationMetricInput(
                                        n("40.00"),
                                        FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP
                                ),
                                new FlywheelResidualRemediationMetricInput(
                                        n("30.00"),
                                        FlywheelResidualRemediationAction.WRITE_OFF_REVIEW
                                ),
                                new FlywheelResidualRemediationMetricInput(
                                        n("20.00"),
                                        FlywheelResidualRemediationAction.INVESTIGATION_ESCALATION
                                ),
                                new FlywheelResidualRemediationMetricInput(
                                        n("10.00"),
                                        FlywheelResidualRemediationAction.RESIDUAL_ACCEPTANCE_REVIEW
                                )
                        )
                );

        assertEquals(
                n("100.00"),
                result.coveredResidualAmount()
        );

        assertEquals(
                n("40.00"),
                result.recoveryFollowUpAmount()
        );

        assertEquals(
                n("30.00"),
                result.writeOffReviewAmount()
        );

        assertEquals(
                n("20.00"),
                result.investigationEscalationAmount()
        );

        assertEquals(
                n("10.00"),
                result.residualAcceptanceReviewAmount()
        );

        assertEquals(
                4,
                result.itemCount()
        );
    }

    @Test
    void rejectsInvalidMetricAmount() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.metrics(
                                List.of(
                                        new FlywheelResidualRemediationMetricInput(
                                                n("10.001"),
                                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP
                                        )
                                )
                        )
        );
    }
}
