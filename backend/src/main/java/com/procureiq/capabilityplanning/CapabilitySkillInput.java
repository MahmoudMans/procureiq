package com.procureiq.capabilityplanning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapabilitySkillInput(

        @NotBlank
        @Size(max = 80)
        String code,

        @NotBlank
        @Size(max = 220)
        String name,

        @NotBlank
        @Size(max = 120)
        String category,

        @Size(max = 3000)
        String description
) {
}
