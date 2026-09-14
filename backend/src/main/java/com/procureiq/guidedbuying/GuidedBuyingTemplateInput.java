package com.procureiq.guidedbuying;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record GuidedBuyingTemplateInput(

        @NotBlank
        @Size(max = 220)
        String name,

        @Size(max = 2000)
        String description,

        @NotBlank
        @Size(max = 120)
        String category,

        @Size(max = 220)
        String defaultTitle,

        @NotBlank
        @Size(min = 3, max = 3)
        String defaultCurrency,

        @DecimalMin("0.00")
        BigDecimal defaultEstimatedAmount,

        UUID defaultDepartmentId,

        UUID ownerUserId
) {
}
