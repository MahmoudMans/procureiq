package com.procureiq.reinvestmentperformance;

import java.util.List;

public record ReinvestmentPerformanceCaseDetailResponse(
        ReinvestmentPerformanceCaseResponse performanceCase,
        List<ReinvestmentPerformanceUserOptionResponse> users,
        List<ReinvestmentPerformanceObservationResponse> observations,
        List<ReinvestmentPerformanceReviewResponse> reviews
) {
}
