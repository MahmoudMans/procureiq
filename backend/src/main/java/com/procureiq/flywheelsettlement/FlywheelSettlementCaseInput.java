package com.procureiq.flywheelsettlement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelSettlementCaseInput(
        @NotNull
        UUID releaseBatchId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        UUID reconciliationOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String reconciliationRationale
) {
}
