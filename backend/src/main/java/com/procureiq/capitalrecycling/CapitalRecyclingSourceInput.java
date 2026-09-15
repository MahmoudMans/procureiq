package com.procureiq.capitalrecycling;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CapitalRecyclingSourceInput(

        @NotNull
        UUID sourceOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String recyclingObjective
) {
}
