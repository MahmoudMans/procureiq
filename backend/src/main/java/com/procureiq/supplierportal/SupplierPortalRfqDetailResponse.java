package com.procureiq.supplierportal;

import com.procureiq.rfq.RfqInvitationStatus;
import com.procureiq.rfq.RfqLineItemResponse;
import com.procureiq.rfq.RfqStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * What a supplier may see of an RFQ it was invited to. It never includes the purchase
 * request, requester, budget value, other invited suppliers or other quotations.
 */
public record SupplierPortalRfqDetailResponse(
        UUID id,
        String rfqNumber,
        String title,
        String description,
        String currency,
        LocalDateTime responseDeadline,
        RfqStatus rfqStatus,
        RfqInvitationStatus invitationStatus,
        boolean open,
        String biddingBlockedReason,
        List<RfqLineItemResponse> lineItems,
        SupplierPortalQuotationResponse quotation
) {
}
