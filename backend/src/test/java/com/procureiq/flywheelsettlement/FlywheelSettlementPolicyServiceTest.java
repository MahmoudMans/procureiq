package com.procureiq.flywheelsettlement;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelSettlementPolicyServiceTest {

    private FlywheelSettlementPolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelSettlementPolicyService();
    }

    @Test
    void classifiesFullySettledEvidence() {
        FlywheelSettlementClassificationResult result =
                service.classify(
                        new BigDecimal("100.00"),
                        new BigDecimal("100.00"),
                        "BANK-001"
                );

        assertEquals(
                FlywheelSettlementItemStatus.SETTLED,
                result.status()
        );

        assertEquals(
                new BigDecimal("0.00"),
                result.varianceAmount()
        );
    }

    @Test
    void classifiesPartialEvidence() {
        FlywheelSettlementClassificationResult result =
                service.classify(
                        new BigDecimal("100.00"),
                        new BigDecimal("75.00"),
                        "BANK-002"
                );

        assertEquals(
                FlywheelSettlementItemStatus.PARTIAL,
                result.status()
        );

        assertEquals(
                new BigDecimal("25.00"),
                result.varianceAmount()
        );
    }

    @Test
    void classifiesZeroSettlementAsUnresolved() {
        FlywheelSettlementClassificationResult result =
                service.classify(
                        new BigDecimal("100.00"),
                        new BigDecimal("0.00"),
                        null
                );

        assertEquals(
                FlywheelSettlementItemStatus.UNRESOLVED,
                result.status()
        );
    }

    @Test
    void rejectsSettlementAboveRecordedRelease() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.classify(
                                new BigDecimal("100.00"),
                                new BigDecimal("100.01"),
                                "BAD"
                        )
        );
    }

    @Test
    void positiveSettlementRequiresEvidenceReference() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.classify(
                                new BigDecimal("100.00"),
                                new BigDecimal("10.00"),
                                " "
                        )
        );
    }

    @Test
    void rejectsFractionalCentsInsteadOfRoundingAuthority() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.classify(
                                new BigDecimal("100.00"),
                                new BigDecimal("10.001"),
                                "REF"
                        )
        );
    }

    @Test
    void calculatesAggregateSettlementMetrics() {
        FlywheelSettlementMetricResult result =
                service.metrics(
                        new BigDecimal("1000.00"),
                        List.of(
                                new BigDecimal("300.00"),
                                new BigDecimal("450.00")
                        )
                );

        assertEquals(
                new BigDecimal("750.00"),
                result.settledAmount()
        );

        assertEquals(
                new BigDecimal("250.00"),
                result.varianceAmount()
        );

        assertEquals(
                new BigDecimal("75.00"),
                result.settlementPct()
        );
    }
}
