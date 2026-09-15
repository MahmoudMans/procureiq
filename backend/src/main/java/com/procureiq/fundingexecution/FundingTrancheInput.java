package com.procureiq.fundingexecution;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FundingTrancheInput(

        @Min(1)
        int sequenceNo,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal plannedReleaseAmount,

        @NotNull
        LocalDate targetDate
) {
}
