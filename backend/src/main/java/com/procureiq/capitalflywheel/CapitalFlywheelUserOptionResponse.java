package com.procureiq.capitalflywheel;

import java.util.UUID;

public record CapitalFlywheelUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
