package com.procureiq.savings;

import java.util.UUID;

public record SavingsRfqOptionResponse(
        UUID id,
        String rfqNumber,
        String title,
        String currency,
        String status
) {
}
