package com.procureiq.investmentperformance;

import java.util.List;

public record InvestmentPerformanceCaseDetailResponse(
        InvestmentPerformanceCaseResponse performanceCase,
        List<InvestmentPerformanceUserOptionResponse> users,
        List<InvestmentPerformanceObservationResponse> observations,
        List<InvestmentPerformanceDecisionResponse> decisions
) {
}
