package com.procureiq.strategyrecovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RecoveryEscalationInput(

        @NotNull
        RecoveryEscalationLevel escalationLevel,

        @NotBlank
        @Size(max = 4000)
        String reason
) {
}
