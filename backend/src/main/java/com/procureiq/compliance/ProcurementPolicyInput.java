package com.procureiq.compliance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record ProcurementPolicyInput(

        @NotBlank
        @Size(max = 60)
        String policyCode,

        @NotBlank
        @Size(max = 220)
        String name,

        @Size(max = 2000)
        String description,

        @NotNull
        ProcurementPolicyType policyType,

        @NotNull
        ProcurementPolicySeverity severity,

        @DecimalMin("0.00")
        BigDecimal thresholdAmount,

        @Size(min = 3, max = 3)
        String currency,

        boolean requiresWaiver,

        UUID ownerUserId
) {
}
