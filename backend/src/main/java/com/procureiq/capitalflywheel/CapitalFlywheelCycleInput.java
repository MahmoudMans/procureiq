package com.procureiq.capitalflywheel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CapitalFlywheelCycleInput(

        @NotNull
        UUID persistenceCaseId,

        @NotBlank
        @Size(max = 5000)
        String relationshipRationale
) {
}
