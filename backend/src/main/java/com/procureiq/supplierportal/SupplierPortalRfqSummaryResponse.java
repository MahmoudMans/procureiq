package com.procureiq.supplierportal;

import com.procureiq.rfq.RfqInvitationStatus;
import com.procureiq.rfq.RfqStatus;
import java.time.LocalDateTime;
import java.util.UUID;

public record SupplierPortalRfqSummaryResponse(
        UUID id,
        String rfqNumber,
        String title,
        String currency,
        LocalDateTime responseDeadline,
        RfqStatus rfqStatus,
        RfqInvitationStatus invitationStatus,
        boolean open,
        int lineCount,
        SupplierPortalQuotationSummaryResponse quotation
) {
}
