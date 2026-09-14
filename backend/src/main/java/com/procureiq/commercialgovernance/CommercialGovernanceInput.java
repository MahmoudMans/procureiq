package com.procureiq.commercialgovernance;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CommercialGovernanceInput(

        @NotNull
        UUID contractId,

        @Min(0)
        @Max(1095)
        int noticePeriodDays,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal baselineContractValue,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal priceEscalationPct,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal maxPoVariancePct,

        boolean autoRenewal,

        UUID ownerUserId,

        @Size(max = 3000)
        String notes
) {
}
