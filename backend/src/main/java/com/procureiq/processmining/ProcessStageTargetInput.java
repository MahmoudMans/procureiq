package com.procureiq.processmining;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProcessStageTargetInput(

        @NotNull
        ProcessEntityType entityType,

        @NotBlank
        @Size(max = 80)
        String status,

        @Min(1)
        @Max(8760)
        int targetHours
) {
}
