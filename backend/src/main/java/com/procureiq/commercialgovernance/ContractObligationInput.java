package com.procureiq.commercialgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record ContractObligationInput(

        @NotNull
        ContractObligationType obligationType,

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2000)
        String description,

        @NotNull
        LocalDate dueDate,

        boolean critical,

        UUID ownerUserId
) {
}
