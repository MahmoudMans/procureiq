package com.procureiq.investmentintervention;

import java.util.UUID;

public record InvestmentInterventionUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
