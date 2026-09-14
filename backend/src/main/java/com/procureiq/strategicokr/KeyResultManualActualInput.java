package com.procureiq.strategicokr;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record KeyResultManualActualInput(

        @NotNull
        BigDecimal actualValue,

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
