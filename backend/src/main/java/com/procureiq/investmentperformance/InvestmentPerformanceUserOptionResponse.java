package com.procureiq.investmentperformance;

import java.util.UUID;

public record InvestmentPerformanceUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
