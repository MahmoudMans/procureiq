package com.procureiq.planning;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ProcurementPlanInput(

        @NotBlank
        @Size(max = 220)
        String name,

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        UUID ownerUserId,

        @Size(max = 2000)
        String notes
) {
}
