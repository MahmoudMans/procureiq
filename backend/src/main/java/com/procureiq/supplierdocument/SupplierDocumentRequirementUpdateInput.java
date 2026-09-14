package com.procureiq.supplierdocument;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierDocumentRequirementUpdateInput(

        @NotBlank
        @Size(max = 240)
        String name,

        @NotBlank
        @Size(max = 2000)
        String description,

        @Size(max = 180)
        String categoryScope,

        boolean mandatory,

        boolean expiryRequired,

        @Min(0)
        @Max(730)
        int renewalLeadDays,

        boolean onboardingRelevant,

        boolean sustainabilityRelevant,

        boolean active
) {
}
