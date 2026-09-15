package com.procureiq.interventionexecution;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InterventionExecutionEvidenceInput(

        @NotNull
        LocalDate implementedOn,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal implementedCapitalAmount,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote,

        @NotBlank
        @Size(max = 1000)
        String referenceText
) {
}
