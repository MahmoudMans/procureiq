package com.procureiq.outcomepersistence;

import java.util.List;

public record PersistencePlanDetailResponse(
        PersistencePlanResponse plan,
        List<PersistenceUserOptionResponse> users,
        List<PersistenceObservationResponse> observations,
        List<PersistenceControlResponse> controls,
        List<PersistenceVerificationResponse> verifications
) {
}
