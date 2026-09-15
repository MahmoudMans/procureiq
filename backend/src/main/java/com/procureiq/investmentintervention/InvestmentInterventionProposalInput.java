package com.procureiq.investmentintervention;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record InvestmentInterventionProposalInput(

        @NotNull
        InvestmentInterventionAction actionType,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal affectedCapitalAmount,

        UUID targetValueCaseId,

        @NotBlank
        @Size(max = 5000)
        String proposalRationale
) {
}
