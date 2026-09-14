package com.procureiq.invoice;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class InvoiceCalculationService {

    private static final BigDecimal HUNDRED =
            new BigDecimal(
                    "100.00"
            );

    public BigDecimal lineTotal(
            BigDecimal quantity,
            BigDecimal unitPrice
    ) {
        requirePositive(
                quantity,
                "Quantity"
        );

        requireNonNegative(
                unitPrice,
                "Unit price"
        );

        return quantity
                .multiply(
                        unitPrice
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal subtotal(
            List<BigDecimal> lineTotals
    ) {
        if (
                lineTotals == null
                ||
                lineTotals.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one invoice line is required."
            );
        }

        return lineTotals
                .stream()
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal total(
            BigDecimal subtotal,
            BigDecimal tax
    ) {
        requireNonNegative(
                subtotal,
                "Subtotal"
        );

        requireNonNegative(
                tax,
                "Tax"
        );

        return subtotal
                .add(
                        tax
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal allowedPurchaseOrderValue(
            BigDecimal purchaseOrderTotal,
            BigDecimal tolerancePct
    ) {
        requireNonNegative(
                purchaseOrderTotal,
                "Purchase order"
        );

        requirePercentage(
                tolerancePct
        );

        return purchaseOrderTotal
                .multiply(
                        BigDecimal.ONE.add(
                                tolerancePct.divide(
                                        HUNDRED,
                                        8,
                                        RoundingMode.HALF_UP
                                )
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal overInvoiceAmount(
            BigDecimal cumulativeInvoiceValue,
            BigDecimal allowedPurchaseOrderValue
    ) {
        requireNonNegative(
                cumulativeInvoiceValue,
                "Cumulative invoice"
        );

        requireNonNegative(
                allowedPurchaseOrderValue,
                "Allowed purchase order"
        );

        return cumulativeInvoiceValue
                .subtract(
                        allowedPurchaseOrderValue
                )
                .max(
                        BigDecimal.ZERO
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private void requirePositive(
            BigDecimal value,
            String label
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must be greater than zero."
            );
        }
    }

    private void requireNonNegative(
            BigDecimal value,
            String label
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must be zero or greater."
            );
        }
    }

    private void requirePercentage(
            BigDecimal value
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
                ||
                value.compareTo(
                        HUNDRED
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Tolerance percentage must be between 0 and 100."
            );
        }
    }
}
