package com.procureiq.successionplanning;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CriticalCapabilityPolicyInput(

        @NotNull
        UUID skillId,

        @NotNull
        SuccessionCriticality criticality,

        @Min(1)
        @Max(5)
        int requiredProficiency,

        @Min(1)
        @Max(20)
        int targetReadyPeople,

        @Size(max = 3000)
        String notes
) {
}
