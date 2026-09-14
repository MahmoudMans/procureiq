package com.procureiq.invoice;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InvoiceCalculationServiceTest {

    private InvoiceCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new InvoiceCalculationService();
    }

    @Test
    void shouldCalculateLineAndInvoiceTotals() {
        BigDecimal first =
                service.lineTotal(
                        new BigDecimal(
                                "2.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        )
                );

        BigDecimal second =
                service.lineTotal(
                        new BigDecimal(
                                "1.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        )
                );

        BigDecimal subtotal =
                service.subtotal(
                        List.of(
                                first,
                                second
                        )
                );

        assertEquals(
                new BigDecimal(
                        "250.00"
                ),
                subtotal
        );

        assertEquals(
                new BigDecimal(
                        "300.00"
                ),
                service.total(
                        subtotal,
                        new BigDecimal(
                                "50.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculatePoToleranceAndOverInvoice() {
        BigDecimal allowed =
                service
                        .allowedPurchaseOrderValue(
                                new BigDecimal(
                                        "1000.00"
                                ),
                                new BigDecimal(
                                        "2.00"
                                )
                        );

        assertEquals(
                new BigDecimal(
                        "1020.00"
                ),
                allowed
        );

        assertEquals(
                new BigDecimal(
                        "30.00"
                ),
                service.overInvoiceAmount(
                        new BigDecimal(
                                "1050.00"
                        ),
                        allowed
                )
        );
    }

    @Test
    void shouldNotCreateNegativeOverInvoice() {
        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                service.overInvoiceAmount(
                        new BigDecimal(
                                "900.00"
                        ),
                        new BigDecimal(
                                "1000.00"
                        )
                )
        );
    }
}
