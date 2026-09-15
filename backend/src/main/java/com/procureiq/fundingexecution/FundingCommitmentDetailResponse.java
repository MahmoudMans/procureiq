package com.procureiq.fundingexecution;

import java.util.List;

public record FundingCommitmentDetailResponse(
        FundingCommitmentResponse commitment,
        List<FundingUserOptionResponse> users,
        List<FundingTrancheResponse> tranches
) {
}
