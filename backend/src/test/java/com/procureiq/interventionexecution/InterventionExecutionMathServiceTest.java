package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InterventionExecutionMathServiceTest {

    private InterventionExecutionMathService service;

    @BeforeEach
    void setUp() {
        service =
                new InterventionExecutionMathService();
    }

    @Test
    void shouldReconcilePartialCapitalImplementation() {
        InterventionExecutionMetricResult result =
                service.metrics(
                        InvestmentInterventionAction.REALLOCATE_UNRELEASED,
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "400.00"
                                )
                        ),
                        InterventionExecutionStatus.ACTIVE
                );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.implementedCapitalAmount()
        );

        assertEquals(
                new BigDecimal(
                        "600.00"
                ),
                result.remainingImplementationAmount()
        );

        assertEquals(
                new BigDecimal(
                        "40.00"
                ),
                result.implementationPct()
        );

        assertEquals(
                new BigDecimal(
                        "-600.00"
                ),
                result.implementationVarianceAmount()
        );

        assertEquals(
                InterventionExecutionHealth.IN_PROGRESS,
                result.health()
        );
    }

    @Test
    void shouldRecognizeCompletedCapitalImplementation() {
        InterventionExecutionMetricResult result =
                service.metrics(
                        InvestmentInterventionAction.REDUCE_UNRELEASED,
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "400.00"
                                ),
                                new BigDecimal(
                                        "600.00"
                                )
                        ),
                        InterventionExecutionStatus.READY_FOR_VERIFICATION
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.implementationPct()
        );

        assertEquals(
                InterventionExecutionHealth.COMPLETE,
                result.health()
        );
    }

    @Test
    void shouldTreatDocumentedContinueAsComplete() {
        InterventionExecutionMetricResult result =
                service.metrics(
                        InvestmentInterventionAction.CONTINUE,
                        BigDecimal.ZERO,
                        List.of(
                                BigDecimal.ZERO
                        ),
                        InterventionExecutionStatus.READY_FOR_VERIFICATION
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.implementationPct()
        );

        assertEquals(
                InterventionExecutionHealth.COMPLETE,
                result.health()
        );
    }

    @Test
    void shouldExposeVerificationVariance() {
        InterventionExecutionMetricResult result =
                service.metrics(
                        InvestmentInterventionAction.HOLD_FUTURE_RELEASES,
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "500.00"
                                )
                        ),
                        InterventionExecutionStatus.READY_FOR_VERIFICATION
                );

        assertEquals(
                InterventionExecutionHealth.VARIANCE,
                result.health()
        );
    }
}
