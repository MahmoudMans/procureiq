package com.procureiq.capitalredeployment;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CapitalRedeploymentMathServiceTest {

    private CapitalRedeploymentMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapitalRedeploymentMathService();
    }

    @Test
    void shouldCalculatePartialRedeployment() {
        CapitalRedeploymentMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "400.00"
                                )
                        ),
                        CapitalRedeploymentStatus.ACTIVE
                );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.releasedRedeploymentAmount()
        );

        assertEquals(
                new BigDecimal(
                        "600.00"
                ),
                result.remainingRedeploymentAmount()
        );

        assertEquals(
                new BigDecimal(
                        "40.00"
                ),
                result.redeploymentPct()
        );

        assertEquals(
                CapitalRedeploymentHealth.IN_PROGRESS,
                result.health()
        );
    }

    @Test
    void shouldRecognizeCompleteRedeployment() {
        CapitalRedeploymentMetricResult result =
                service.metrics(
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
                        CapitalRedeploymentStatus.READY_FOR_VERIFICATION
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.redeploymentPct()
        );

        assertEquals(
                CapitalRedeploymentHealth.COMPLETE,
                result.health()
        );
    }

    @Test
    void shouldExposeVerificationVarianceForPartialRedeployment() {
        CapitalRedeploymentMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "750.00"
                                )
                        ),
                        CapitalRedeploymentStatus.READY_FOR_VERIFICATION
                );

        assertEquals(
                CapitalRedeploymentHealth.VARIANCE,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "-250.00"
                ),
                result.redeploymentVarianceAmount()
        );
    }

    @Test
    void shouldExposeRemediationHealth() {
        CapitalRedeploymentMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "500.00"
                                )
                        ),
                        CapitalRedeploymentStatus.REMEDIATION_REQUIRED
                );

        assertEquals(
                CapitalRedeploymentHealth.REMEDIATION_REQUIRED,
                result.health()
        );
    }
}
