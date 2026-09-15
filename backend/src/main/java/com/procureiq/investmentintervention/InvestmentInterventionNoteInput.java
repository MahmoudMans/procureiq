package com.procureiq.investmentintervention;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvestmentInterventionNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
