package com.procureiq.risk;

import java.util.UUID;

public record RiskRfqOptionResponse(
        UUID id,
        String rfqNumber,
        String title,
        String status
) {
}
