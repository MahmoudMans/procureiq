package com.procureiq.portfoliooptimization;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record PortfolioUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
