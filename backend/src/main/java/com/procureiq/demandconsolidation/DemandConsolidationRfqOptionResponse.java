package com.procureiq.demandconsolidation;

import java.util.UUID;

public record DemandConsolidationRfqOptionResponse(
        UUID id,
        String rfqNumber,
        String title,
        String currency,
        String status
) {
}
