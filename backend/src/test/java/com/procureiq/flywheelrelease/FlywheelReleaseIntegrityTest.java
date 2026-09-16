package com.procureiq.flywheelrelease;

import com.procureiq.common.money.CurrencyTotal;
import com.procureiq.common.money.CurrencyTotals;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlywheelReleaseIntegrityTest {

    private BigDecimal n(String value) {
        return new BigDecimal(value);
    }

    @Test
    void rejectsInvalidAmountsWithoutRoundingThemIntoValidity() {
        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.positiveMoney(null)
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.positiveMoney(n("0"))
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.positiveMoney(n("-1"))
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.positiveMoney(n("0.001"))
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.positiveMoney(
                        n("1000000000000000000")
                )
        );
    }

    @Test
    void acceptsExactPositiveCents() {
        assertEquals(
                n("0.01"),
                FlywheelReleaseIntegrity.positiveMoney(n("0.01"))
        );

        assertEquals(
                n("10.00"),
                FlywheelReleaseIntegrity.positiveMoney(n("10"))
        );
    }

    @Test
    void keepsCurrenciesSeparateAndSorted() {
        List<CurrencyTotal> rows = List.of(
                new CurrencyTotal("USD", n("20.00")),
                new CurrencyTotal("EUR", n("10.00")),
                new CurrencyTotal("EUR", n("5.00"))
        );

        assertEquals(
                List.of(
                        new CurrencyTotal("EUR", n("15.00")),
                        new CurrencyTotal("USD", n("20.00"))
                ),
                CurrencyTotals.sum(
                        rows,
                        CurrencyTotal::currency,
                        CurrencyTotal::amount
                )
        );
    }

    @Test
    void emptyTotalsDoNotInventACurrency() {
        assertEquals(
                List.of(),
                CurrencyTotals.sum(
                        List.<CurrencyTotal>of(),
                        CurrencyTotal::currency,
                        CurrencyTotal::amount
                )
        );
    }

    @Test
    void invalidCurrencyIsNotSilentlyMerged() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CurrencyTotals.sum(
                        List.of(
                                new CurrencyTotal("EURO", n("1.00"))
                        ),
                        CurrencyTotal::currency,
                        CurrencyTotal::amount
                )
        );
    }

    @Test
    void canCancelEmptyOrEntirelyUnreleasedBatches() {
        assertDoesNotThrow(
                () -> FlywheelReleaseIntegrity.assertCancellable(
                        FlywheelReleaseBatchStatus.DRAFT,
                        List.of()
                )
        );

        assertDoesNotThrow(
                () -> FlywheelReleaseIntegrity.assertCancellable(
                        FlywheelReleaseBatchStatus.IN_EXECUTION,
                        List.of(
                                FlywheelReleaseItemStatus.PENDING,
                                FlywheelReleaseItemStatus.CANCELLED
                        )
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.assertCancellable(
                        FlywheelReleaseBatchStatus.IN_EXECUTION,
                        List.of(FlywheelReleaseItemStatus.RELEASED)
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.assertCancellable(
                        FlywheelReleaseBatchStatus.EXECUTED,
                        List.of()
                )
        );
    }

    @Test
    void evidenceMustBeNonblankAndBounded() {
        assertEquals(
                "reference",
                FlywheelReleaseIntegrity.text(
                        " reference ",
                        20,
                        "Reference"
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.text(
                        "  ",
                        20,
                        "Reference"
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> FlywheelReleaseIntegrity.text(
                        "long",
                        3,
                        "Reference"
                )
        );
    }

    @Test
    void releaseServiceDeclaresReadCommittedTransactions() {
        assertEquals(
                Isolation.READ_COMMITTED,
                FlywheelReleaseService.class
                        .getAnnotation(Transactional.class)
                        .isolation()
        );
    }
}
