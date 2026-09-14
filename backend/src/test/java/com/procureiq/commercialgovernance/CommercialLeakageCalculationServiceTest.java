package com.procureiq.commercialgovernance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CommercialLeakageCalculationServiceTest {

    private CommercialLeakageCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new CommercialLeakageCalculationService();
    }

    @Test
    void shouldCalculateAllowedCommercialValue() {
        assertEquals(
                new BigDecimal(
                        "105000.00"
                ),
                service.allowedValue(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "5.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculatePositiveLeakageOnly() {
        assertEquals(
                new BigDecimal(
                        "10000.00"
                ),
                service.leakage(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "110000.00"
                        )
                )
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                service.leakage(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "95000.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyLeakageSeverity() {
        assertEquals(
                CommercialLeakageSeverity.CRITICAL,
                service.severity(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "125000.00"
                        )
                )
        );

        assertEquals(
                CommercialLeakageSeverity.HIGH,
                service.severity(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "112000.00"
                        )
                )
        );

        assertEquals(
                CommercialLeakageSeverity.MEDIUM,
                service.severity(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "106000.00"
                        )
                )
        );
    }
}
