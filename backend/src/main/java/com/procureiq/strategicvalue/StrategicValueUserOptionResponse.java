package com.procureiq.strategicvalue;

import java.util.UUID;

public record StrategicValueUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
