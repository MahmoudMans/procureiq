package com.procureiq.negotiation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record NegotiationRoundInput(

        @NotNull
        NegotiationRoundSide actorSide,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal offerValue,

        @Min(0)
        int paymentTermsDays,

        @Min(0)
        int leadTimeDays,

        @Min(0)
        int warrantyMonths,

        @Min(0)
        Integer volumeCommitment,

        @Size(max = 3000)
        String notes
) {
}
