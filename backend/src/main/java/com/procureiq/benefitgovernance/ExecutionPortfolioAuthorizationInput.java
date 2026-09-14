package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ExecutionPortfolioAuthorizationInput(

        UUID ownerUserId,

        @Size(max = 3000)
        String notes
) {
}
