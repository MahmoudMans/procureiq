package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelVarianceExecutionPolicyServiceTest {

    private FlywheelVarianceExecutionPolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelVarianceExecutionPolicyService();
    }

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    @Test
    void validatesCompletedRecovery() {
        FlywheelVarianceExecutionValidationResult result =
                service.validate(
                        FlywheelVarianceDecision.RECOVER,
                        n("100.00"),
                        n("100.00"),
                        FlywheelVarianceExecutionOutcome.COMPLETED,
                        "BANK-1"
                );

        assertEquals(
                n("0.00"),
                result.openExposureAmount()
        );
    }

    @Test
    void validatesPartialRecovery() {
        FlywheelVarianceExecutionValidationResult result =
                service.validate(
                        FlywheelVarianceDecision.RECOVER,
                        n("100.00"),
                        n("40.00"),
                        FlywheelVarianceExecutionOutcome.PARTIAL,
                        "BANK-2"
                );

        assertEquals(
                n("60.00"),
                result.openExposureAmount()
        );
    }

    @Test
    void positiveFinancialExecutionRequiresReference() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.validate(
                                FlywheelVarianceDecision.WRITE_OFF,
                                n("100.00"),
                                n("100.00"),
                                FlywheelVarianceExecutionOutcome.COMPLETED,
                                " "
                        )
        );
    }

    @Test
    void completedInvestigationIsNonFinancialButResolved() {
        FlywheelVarianceExecutionValidationResult result =
                service.validate(
                        FlywheelVarianceDecision.INVESTIGATE,
                        n("50.00"),
                        n("0.00"),
                        FlywheelVarianceExecutionOutcome.COMPLETED,
                        null
                );

        assertEquals(
                n("0.00"),
                result.executedAmount()
        );

        assertEquals(
                n("0.00"),
                result.openExposureAmount()
        );
    }

    @Test
    void unresolvedInvestigationKeepsExposureOpen() {
        FlywheelVarianceExecutionValidationResult result =
                service.validate(
                        FlywheelVarianceDecision.INVESTIGATE,
                        n("50.00"),
                        n("0.00"),
                        FlywheelVarianceExecutionOutcome.UNRESOLVED,
                        null
                );

        assertEquals(
                n("50.00"),
                result.openExposureAmount()
        );
    }

    @Test
    void investigationRejectsFinancialAmountAndPartialOutcome() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.validate(
                                FlywheelVarianceDecision.INVESTIGATE,
                                n("50.00"),
                                n("1.00"),
                                FlywheelVarianceExecutionOutcome.COMPLETED,
                                null
                        )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.validate(
                                FlywheelVarianceDecision.INVESTIGATE,
                                n("50.00"),
                                n("0.00"),
                                FlywheelVarianceExecutionOutcome.PARTIAL,
                                null
                        )
        );
    }

    @Test
    void calculatesMixedExecutionMetrics() {
        FlywheelVarianceExecutionMetricResult result =
                service.metrics(
                        n("200.00"),
                        List.of(
                                new FlywheelVarianceExecutionMetricInput(
                                        FlywheelVarianceDecision.RECOVER,
                                        n("100.00"),
                                        n("40.00"),
                                        FlywheelVarianceExecutionOutcome.PARTIAL
                                ),
                                new FlywheelVarianceExecutionMetricInput(
                                        FlywheelVarianceDecision.WRITE_OFF,
                                        n("50.00"),
                                        n("50.00"),
                                        FlywheelVarianceExecutionOutcome.COMPLETED
                                ),
                                new FlywheelVarianceExecutionMetricInput(
                                        FlywheelVarianceDecision.INVESTIGATE,
                                        n("50.00"),
                                        n("0.00"),
                                        FlywheelVarianceExecutionOutcome.COMPLETED
                                )
                        )
                );

        assertEquals(
                n("90.00"),
                result.executedFinancialAmount()
        );

        assertEquals(
                n("40.00"),
                result.recoveredAmount()
        );

        assertEquals(
                n("50.00"),
                result.writtenOffAmount()
        );

        assertEquals(
                n("50.00"),
                result.completedInvestigationAmount()
        );

        assertEquals(
                n("60.00"),
                result.openExposureAmount()
        );

        assertEquals(
                n("70.00"),
                result.completionPct()
        );
    }
}
