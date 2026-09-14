package com.procureiq.guidedbuying;

import java.util.List;

public record GuidedBuyingRecommendationResponse(
        GuidedBuyingRoute route,
        String summary,
        List<String> signals,
        List<PreferredSupplierResponse> preferredSuppliers
) {
}
