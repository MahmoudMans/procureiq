package com.procureiq.anomaly;

import java.util.List;

public record AnomalyContextResponse(
        List<AnomalyUserOptionResponse> users
) {
}
