package com.procureiq.sustainability;

import java.util.List;

public record SustainabilityContextResponse(
        List<SustainabilitySupplierOptionResponse> suppliers,
        List<SustainabilityUserOptionResponse> users
) {
}
