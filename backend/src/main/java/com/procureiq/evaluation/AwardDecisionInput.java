package com.procureiq.evaluation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record AwardDecisionInput(

        @NotNull
        UUID selectedQuotationId,

        @NotBlank
        @Size(max = 3000)
        String rationale
) {
}
