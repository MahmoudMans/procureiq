package com.procureiq.supplierportal;

import java.time.Instant;
import java.util.UUID;

/**
 * One outcome update for a supplier. It deliberately carries nothing about other suppliers:
 * no winner, no other bids, no prices.
 *
 * kind is one of AWARDED_TO_YOU, DECISION_MADE, RFQ_CLOSED or RFQ_CANCELLED.
 */
public record SupplierPortalRfqUpdateResponse(
        UUID rfqId,
        String rfqNumber,
        String title,
        String kind,
        String headline,
        String message,
        Instant occurredAt
) {
}
