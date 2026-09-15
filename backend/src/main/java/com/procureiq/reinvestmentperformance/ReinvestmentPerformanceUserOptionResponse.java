package com.procureiq.reinvestmentperformance;

import java.util.UUID;

public record ReinvestmentPerformanceUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
