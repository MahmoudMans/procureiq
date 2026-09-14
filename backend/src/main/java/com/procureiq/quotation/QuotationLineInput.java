package com.procureiq.quotation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record QuotationLineInput(

        @NotNull
        UUID rfqLineItemId,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal unitPrice
) {
}
