package com.procureiq.purchaserequest;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PurchaseRequestItemInput(

        @NotBlank
        @Size(max = 180)
        String itemName,

        @Size(max = 1000)
        String description,

        @NotBlank
        @Size(max = 120)
        String category,

        @NotNull
        @DecimalMin("0.001")
        BigDecimal quantity,

        @NotBlank
        @Size(max = 30)
        String unit,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal estimatedUnitPrice
) {
}
