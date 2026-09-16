package com.procureiq.flywheelvariance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelVariancePolicyServiceTest {

    private FlywheelVariancePolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelVariancePolicyService();
    }

    private BigDecimal n(
            String value
    ) {
        return new BigDecimal(
                value
        );
    }

    @Test
    void calculatesFullRecoveryCoverage() {
        FlywheelVarianceMetricResult result =
                service.metrics(
                        n("100.00"),
                        List.of(
                                new FlywheelVarianceMetricInput(
                                        FlywheelVarianceDecision.RECOVER,
                                        n("100.00")
                                )
                        )
                );

        assertEquals(
                n("100.00"),
                result.recoverAmount()
        );

        assertEquals(
                n("100.00"),
                result.coveragePct()
        );
    }

    @Test
    void calculatesMixedVarianceTreatments() {
        FlywheelVarianceMetricResult result =
                service.metrics(
                        n("100.00"),
                        List.of(
                                new FlywheelVarianceMetricInput(
                                        FlywheelVarianceDecision.RECOVER,
                                        n("40.00")
                                ),
                                new FlywheelVarianceMetricInput(
                                        FlywheelVarianceDecision.WRITE_OFF,
                                        n("35.00")
                                ),
                                new FlywheelVarianceMetricInput(
                                        FlywheelVarianceDecision.INVESTIGATE,
                                        n("25.00")
                                )
                        )
                );

        assertEquals(
                n("40.00"),
                result.recoverAmount()
        );

        assertEquals(
                n("35.00"),
                result.writeOffAmount()
        );

        assertEquals(
                n("25.00"),
                result.investigationAmount()
        );

        assertEquals(
                n("100.00"),
                result.governedAmount()
        );
    }

    @Test
    void exposesPartialGovernanceCoverage() {
        FlywheelVarianceMetricResult result =
                service.metrics(
                        n("100.00"),
                        List.of(
                                new FlywheelVarianceMetricInput(
                                        FlywheelVarianceDecision.INVESTIGATE,
                                        n("25.00")
                                )
                        )
                );

        assertEquals(
                n("25.00"),
                result.coveragePct()
        );
    }

    @Test
    void rejectsGovernanceAboveSourceVariance() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.metrics(
                                n("100.00"),
                                List.of(
                                        new FlywheelVarianceMetricInput(
                                                FlywheelVarianceDecision.RECOVER,
                                                n("100.01")
                                        )
                                )
                        )
        );
    }

    @Test
    void rejectsFractionalCents() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.metrics(
                                n("100.00"),
                                List.of(
                                        new FlywheelVarianceMetricInput(
                                                FlywheelVarianceDecision.RECOVER,
                                                n("10.001")
                                        )
                                )
                        )
        );
    }

    @Test
    void rejectsZeroSourceVariance() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.metrics(
                                n("0.00"),
                                List.of()
                        )
        );
    }

    @Test
    void validatesRequiredDecisionRationale() {
        assertEquals(
                "Investigate mismatch",
                service.requiredText(
                        " Investigate mismatch ",
                        5000,
                        "Decision rationale"
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.requiredText(
                                " ",
                                5000,
                                "Decision rationale"
                        )
        );
    }
}
