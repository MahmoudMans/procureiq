package com.procureiq.processmining;

public record ProcessRecommendationResponse(
        String priority,
        String title,
        String details
) {
}
