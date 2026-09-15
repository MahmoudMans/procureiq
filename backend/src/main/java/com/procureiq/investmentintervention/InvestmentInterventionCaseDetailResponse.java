package com.procureiq.investmentintervention;

import com.procureiq.strategicvalue.StrategicValueCaseResponse;

import java.util.List;

public record InvestmentInterventionCaseDetailResponse(
        InvestmentInterventionCaseResponse interventionCase,
        List<InvestmentInterventionUserOptionResponse> users,
        List<StrategicValueCaseResponse> reallocationTargets,
        List<InvestmentInterventionProposalResponse> proposals
) {
}
