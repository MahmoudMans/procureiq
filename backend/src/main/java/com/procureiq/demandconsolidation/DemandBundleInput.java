package com.procureiq.demandconsolidation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DemandBundleInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        @Size(max = 120)
        String category,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotEmpty
        List<UUID> intakeIds,

        UUID ownerUserId,

        @NotNull
        LocalDate targetSourcingDate,

        @Size(max = 3000)
        String rationale
) {
}
