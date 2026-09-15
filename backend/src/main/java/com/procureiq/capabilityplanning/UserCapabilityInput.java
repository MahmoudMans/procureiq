package com.procureiq.capabilityplanning;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserCapabilityInput(

        @Min(1)
        @Max(5)
        int proficiencyLevel,

        @NotBlank
        @Size(max = 3000)
        String evidenceNote
) {
}
