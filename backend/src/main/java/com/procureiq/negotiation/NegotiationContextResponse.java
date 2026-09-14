package com.procureiq.negotiation;

import java.util.List;

public record NegotiationContextResponse(
        List<NegotiationQuotationOptionResponse> quotations,
        List<NegotiationUserOptionResponse> users
) {
}
