package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CapitalRedeploymentReleaseInput(

        @NotNull
        LocalDate releasedOn,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal releasedAmount,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote,

        @NotBlank
        @Size(max = 1000)
        String referenceText
) {
}
