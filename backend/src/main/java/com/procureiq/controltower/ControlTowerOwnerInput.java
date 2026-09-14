package com.procureiq.controltower;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ControlTowerOwnerInput(

        @NotNull
        UUID ownerUserId
) {
}
