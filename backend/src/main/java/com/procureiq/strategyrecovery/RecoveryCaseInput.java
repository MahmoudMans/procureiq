package com.procureiq.strategyrecovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record RecoveryCaseInput(

        @NotNull
        UUID recoveryOwnerUserId,

        @NotNull
        LocalDate targetRecoveryDate,

        @NotBlank
        @Size(max = 4000)
        String recoveryObjective
) {
}
