package com.procureiq.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ContractComplianceCalculatorTest {

    private ContractComplianceCalculator
            calculator;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        calculator =
                new ContractComplianceCalculator();

        today =
                LocalDate.of(
                        2026,
                        9,
                        14
                );
    }

    @Test
    void shouldIdentifyExpiringAndExpiredDocuments() {
        assertEquals(
                ComplianceDocumentStatus.EXPIRING_SOON,
                calculator.documentStatus(
                        today.plusDays(15),
                        today
                )
        );

        assertEquals(
                ComplianceDocumentStatus.EXPIRED,
                calculator.documentStatus(
                        today.minusDays(1),
                        today
                )
        );

        assertEquals(
                ComplianceDocumentStatus.VALID,
                calculator.documentStatus(
                        today.plusDays(90),
                        today
                )
        );
    }

    @Test
    void shouldCalculateComplianceScore() {
        assertEquals(
                new BigDecimal("75.00"),
                calculator.complianceScore(
                        4,
                        3
                )
        );

        assertEquals(
                new BigDecimal("100.00"),
                calculator.complianceScore(
                        0,
                        0
                )
        );
    }
}
