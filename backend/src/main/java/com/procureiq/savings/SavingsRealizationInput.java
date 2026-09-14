package com.procureiq.savings;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SavingsRealizationInput(

        @NotNull
        @DecimalMin("0.00")
        BigDecimal amount,

        @NotNull
        LocalDate realizationDate,

        UUID purchaseOrderId,

        @Size(max = 2000)
        String notes
) {
}
