package com.procureiq.invoice;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProcurementInvoiceLineInput(

        @Min(1)
        int lineNumber,

        @NotBlank
        @Size(max = 500)
        String description,

        @NotNull
        @DecimalMin(
                value = "0.0001"
        )
        BigDecimal quantity,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal unitPrice
) {
}
