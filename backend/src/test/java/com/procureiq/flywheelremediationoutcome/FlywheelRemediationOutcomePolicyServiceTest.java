package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelRemediationOutcomePolicyServiceTest {

    private final FlywheelRemediationOutcomePolicyService policy =
            new FlywheelRemediationOutcomePolicyService();

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    @Test
    void acceptsRecoveryEvidence() {
        assertDoesNotThrow(
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("100.00"),
                                FlywheelRemediationResolutionType.RECOVERY_EVIDENCED,
                                n("100.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                ),
                                "REC-001",
                                "External recovery evidence reviewed.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void acceptsUnresolvedEvidenceWithZeroResolvedAmount() {
        assertDoesNotThrow(
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.INVESTIGATION_ESCALATION,
                                n("50.00"),
                                FlywheelRemediationResolutionType.UNRESOLVED,
                                n("0.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                ),
                                "INV-OPEN",
                                "Investigation remains unresolved.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsIncompatibleResolutionType() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.WRITE_OFF_REVIEW,
                                n("40.00"),
                                FlywheelRemediationResolutionType.RECOVERY_EVIDENCED,
                                n("40.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                ),
                                "BAD-001",
                                "Wrong resolution type.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsResolvedAmountGreaterThanSource() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.RECOVERY_FOLLOW_UP,
                                n("10.00"),
                                FlywheelRemediationResolutionType.RECOVERY_EVIDENCED,
                                n("11.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                ),
                                "REC-002",
                                "Invalid amount.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsFutureObservationDate() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.RESIDUAL_ACCEPTANCE_REVIEW,
                                n("25.00"),
                                FlywheelRemediationResolutionType.RISK_ACCEPTANCE_EVIDENCED,
                                n("25.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        17
                                ),
                                "RA-001",
                                "Risk acceptance evidence.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void rejectsMissingEvidenceReference() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        policy.validateOutcome(
                                FlywheelResidualRemediationAction.INVESTIGATION_ESCALATION,
                                n("15.00"),
                                FlywheelRemediationResolutionType.INVESTIGATION_RESOLVED,
                                n("15.00"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                ),
                                " ",
                                "Resolved investigation.",
                                LocalDate.of(
                                        2026,
                                        9,
                                        16
                                )
                        )
        );
    }

    @Test
    void calculatesResidualMetricsExactly() {
        var result =
                policy.metrics(
                        List.of(
                                new FlywheelRemediationOutcomeMetricInput(
                                        n("100.00"),
                                        n("100.00")
                                ),
                                new FlywheelRemediationOutcomeMetricInput(
                                        n("60.00"),
                                        n("20.00")
                                ),
                                new FlywheelRemediationOutcomeMetricInput(
                                        n("40.00"),
                                        n("0.00")
                                )
                        )
                );

        assertEquals(
                n("200.00"),
                result.sourceResidualAmount()
        );

        assertEquals(
                n("120.00"),
                result.resolvedAmount()
        );

        assertEquals(
                n("80.00"),
                result.remainingResidualAmount()
        );

        assertEquals(
                3,
                result.itemCount()
        );

        assertEquals(
                2,
                result.unresolvedItemCount()
        );
    }
}
