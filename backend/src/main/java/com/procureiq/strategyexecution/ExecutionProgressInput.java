package com.procureiq.strategyexecution;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExecutionProgressInput(

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal progressPct,

        @NotNull
        LocalDate forecastEndDate,

        @Min(0)
        int blockerCount,

        @Size(max = 3000)
        String blockerSummary,

        @NotBlank
        @Size(max = 3000)
        String updateNote
) {
}
