package com.procureiq.reinvestmentpersistence;

import java.util.List;

public record ReinvestmentPersistenceCaseDetailResponse(
        ReinvestmentPersistenceCaseResponse persistenceCase,
        List<ReinvestmentPersistenceUserOptionResponse> users,
        List<ReinvestmentPersistenceObservationResponse> observations,
        List<ReinvestmentPersistenceReviewResponse> reviews
) {
}
