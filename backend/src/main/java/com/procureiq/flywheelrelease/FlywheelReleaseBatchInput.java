package com.procureiq.flywheelrelease;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelReleaseBatchInput(
        @NotNull
        UUID allocationMandateId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        UUID releaseOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String releaseRationale
) {
}
