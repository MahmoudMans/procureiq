package com.procureiq.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ProcurementInvoiceInput(

        @NotNull
        UUID purchaseOrderId,

        @NotBlank
        @Size(max = 120)
        String supplierInvoiceNumber,

        @NotNull
        LocalDate invoiceDate,

        @NotNull
        LocalDate dueDate,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal taxAmount,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal poVarianceTolerancePct,

        @Size(max = 3000)
        String notes,

        @NotEmpty
        List<
                @Valid
                ProcurementInvoiceLineInput
        > lines
) {
}
