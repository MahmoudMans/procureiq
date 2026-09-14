package com.procureiq.supplieronboarding;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SupplierOnboardingCaseInput(

        @NotNull
        UUID supplierId,

        @NotNull
        SupplierOnboardingCaseType caseType,

        @NotNull
        SupplierOnboardingRiskTier riskTier,

        UUID ownerUserId,

        @Size(max = 3000)
        String notes
) {
}
