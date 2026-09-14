package com.procureiq.savings;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record SavingsInitiativeInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        SavingsType savingsType,

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @Size(max = 120)
        String category,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal baselineValue,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal negotiatedValue,

        UUID ownerUserId,

        UUID rfqId,

        UUID supplierId,

        UUID purchaseOrderId,

        @Size(max = 2000)
        String notes
) {
}
