package com.procureiq.investmentintervention;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record InvestmentInterventionCaseInput(

        @NotNull
        UUID interventionOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String interventionRationale
) {
}
