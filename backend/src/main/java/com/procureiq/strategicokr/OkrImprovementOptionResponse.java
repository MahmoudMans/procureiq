package com.procureiq.strategicokr;

import java.util.UUID;

public record OkrImprovementOptionResponse(
        UUID id,
        String initiativeNumber,
        String title,
        String status
) {
}
