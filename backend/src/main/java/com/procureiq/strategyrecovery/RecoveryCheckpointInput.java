package com.procureiq.strategyrecovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecoveryCheckpointInput(

        @NotBlank
        @Size(max = 5000)
        String checkpointNote
) {
}
