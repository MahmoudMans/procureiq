package com.procureiq.strategicalignment;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record StrategicAlignmentLinkInput(

        @NotNull
        AlignmentSourceType sourceType,

        @NotNull
        UUID sourceEntityId,

        @NotNull
        AlignmentRole alignmentRole,

        @NotNull
        @DecimalMin("0.01")
        @DecimalMax("100.00")
        BigDecimal allocationPct,

        @NotBlank
        @Size(max = 3000)
        String rationale
) {
}
