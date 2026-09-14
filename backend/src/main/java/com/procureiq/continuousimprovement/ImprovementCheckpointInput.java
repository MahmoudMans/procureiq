package com.procureiq.continuousimprovement;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ImprovementCheckpointInput(

        @NotNull
        UUID snapshotId
) {
}
