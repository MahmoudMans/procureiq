package com.procureiq.quotation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record QuotationCreateInput(

        @NotNull
        UUID supplierId,

        @Min(0)
        int leadTimeDays,

        @NotBlank
        @Size(max = 300)
        String paymentTerms,

        @NotNull
        @FutureOrPresent
        LocalDate validityDate,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal discountAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal shippingAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal taxAmount,

        @NotEmpty
        @Size(max = 100)
        List<
                @Valid
                QuotationLineInput
                > lines
) {
}
