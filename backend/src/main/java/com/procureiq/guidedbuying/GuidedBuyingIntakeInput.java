package com.procureiq.guidedbuying;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record GuidedBuyingIntakeInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2000)
        String description,

        @NotNull
        UUID departmentId,

        @NotBlank
        @Size(max = 120)
        String category,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal estimatedAmount,

        UUID supplierId,

        UUID templateId,

        @Size(max = 2000)
        String notes
) {
}
