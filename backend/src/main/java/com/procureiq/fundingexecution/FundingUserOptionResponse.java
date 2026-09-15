package com.procureiq.fundingexecution;

import java.util.UUID;

public record FundingUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
