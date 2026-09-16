package com.procureiq.flywheelvarianceexecution;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelVarianceExecutionExposureMetricsTest {

    private BigDecimal n(String value) {
        return new BigDecimal(value);
    }

    @Test
    void emptyCaseRetainsAllFinancialResidual() {
        var result = FlywheelVarianceExecutionExposureMetrics.calculate(
                n("100"), n("0"), n("0")
        );

        assertEquals(n("100.00"), result.financialResidualAmount());
        assertEquals(n("100.00"), result.unrecordedVarianceAmount());
        assertEquals(n("0.00"), result.evidenceCoveragePct());
    }

    @Test
    void partialCaptureDoesNotHideUnrecordedAuthority() {
        var result = FlywheelVarianceExecutionExposureMetrics.calculate(
                n("100"), n("40"), n("10")
        );

        assertEquals(n("90.00"), result.financialResidualAmount());
        assertEquals(n("60.00"), result.unrecordedVarianceAmount());
        assertEquals(n("40.00"), result.evidenceCoveragePct());
    }

    @Test
    void completedInvestigationIsNotFinancialResolution() {
        var legacy = new FlywheelVarianceExecutionPolicyService().metrics(
                n("200"),
                List.of(
                        new FlywheelVarianceExecutionMetricInput(
                                FlywheelVarianceDecision.RECOVER,
                                n("100"),
                                n("40"),
                                FlywheelVarianceExecutionOutcome.PARTIAL
                        ),
                        new FlywheelVarianceExecutionMetricInput(
                                FlywheelVarianceDecision.WRITE_OFF,
                                n("50"),
                                n("50"),
                                FlywheelVarianceExecutionOutcome.COMPLETED
                        ),
                        new FlywheelVarianceExecutionMetricInput(
                                FlywheelVarianceDecision.INVESTIGATE,
                                n("50"),
                                n("0"),
                                FlywheelVarianceExecutionOutcome.COMPLETED
                        )
                )
        );

        var exposure = FlywheelVarianceExecutionExposureMetrics.calculate(
                n("200"),
                legacy.capturedVarianceAmount(),
                legacy.executedFinancialAmount()
        );

        assertEquals(n("70.00"), legacy.completionPct());
        assertEquals(n("60.00"), legacy.openExposureAmount());
        assertEquals(n("110.00"), exposure.financialResidualAmount());
        assertEquals(n("100.00"), exposure.evidenceCoveragePct());
    }

    @Test
    void fullFinancialDispositionHasZeroResidual() {
        var result = FlywheelVarianceExecutionExposureMetrics.calculate(
                n("100"), n("100"), n("100")
        );

        assertEquals(n("0.00"), result.financialResidualAmount());
        assertEquals(n("0.00"), result.unrecordedVarianceAmount());
    }

    @Test
    void roundedCoverageIsNotUsedToDecideCompleteness() {
        var result = FlywheelVarianceExecutionExposureMetrics.calculate(
                n("10000"), n("9999.99"), n("0")
        );

        assertEquals(n("100.00"), result.evidenceCoveragePct());
        assertEquals(n("0.01"), result.unrecordedVarianceAmount());
        assertEquals(n("10000.00"), result.financialResidualAmount());
    }

    @Test
    void rejectsImpossibleBoundsRatherThanClampingThem() {
        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        n("0"), n("0"), n("0")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        n("100"), n("101"), n("0")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        n("100"), n("10"), n("11")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        n("100"), n("-1"), n("0")
                )
        );
    }

    @Test
    void preservesExactCentsAtTheStorageBoundary() {
        BigDecimal max = n("999999999999999999.99");

        var result = FlywheelVarianceExecutionExposureMetrics.calculate(
                max, max, max.subtract(n("0.01"))
        );

        assertEquals(n("0.01"), result.financialResidualAmount());

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        n("100"), n("1.001"), n("0")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        null, n("0"), n("0")
                )
        );

        assertThrows(IllegalArgumentException.class, () ->
                FlywheelVarianceExecutionExposureMetrics.calculate(
                        max.add(n("0.01")), n("0"), n("0")
                )
        );
    }

    @Test
    void derivedResponsePropertiesAreExplicitlyExposed() throws Exception {
        for (Class<?> type : List.of(
                FlywheelVarianceExecutionCaseResponse.class,
                FlywheelVarianceExecutionSnapshotSummaryResponse.class
        )) {
            assertEquals(
                    "exposure",
                    type.getMethod("exposure")
                            .getAnnotation(JsonProperty.class)
                            .value()
            );
        }

        for (Class<?> type : List.of(
                FlywheelVarianceExecutionItemResponse.class,
                FlywheelVarianceExecutionSnapshotItemResponse.class
        )) {
            assertEquals(
                    "financialResidualAmount",
                    type.getMethod("financialResidualAmount")
                            .getAnnotation(JsonProperty.class)
                            .value()
            );
        }
    }
}
