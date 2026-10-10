package com.procureiq.supplierportal;

import com.procureiq.supplierportal.SupplierPortalRfqRepository.PortalSession;
import com.procureiq.supplierportal.SupplierPortalUpdateRepository.UpdateRow;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Tells a supplier what happened to RFQs it was invited to: closed, cancelled, awarded to it,
 * or decided in someone else's favour.
 *
 * The wording for an unsuccessful supplier is intentionally neutral. It confirms that a
 * decision was made, and nothing about who won or on what terms.
 */
@Service
public class SupplierPortalRfqUpdateService {

    static final int WINDOW_DAYS = 30;

    static final int MAX_UPDATES = 10;

    private final SupplierPortalRfqRepository sessionRepository;

    private final SupplierPortalUpdateRepository updateRepository;

    private final SupplierPortalSecurityService securityService;

    public SupplierPortalRfqUpdateService(
            SupplierPortalRfqRepository sessionRepository,
            SupplierPortalUpdateRepository updateRepository,
            SupplierPortalSecurityService securityService
    ) {
        this.sessionRepository =
                sessionRepository;

        this.updateRepository =
                updateRepository;

        this.securityService =
                securityService;
    }

    public List<SupplierPortalRfqUpdateResponse> updates(
            String rawToken
    ) {
        PortalSession session =
                sessionRepository.findActiveSession(
                        securityService.hashToken(
                                rawToken
                        )
                );

        if (session == null) {
            throw new IllegalArgumentException(
                    "Supplier portal session is invalid or has expired. Please sign in again."
            );
        }

        sessionRepository.touchSession(
                session.sessionId()
        );

        return updateRepository
                .findRecent(
                        session.supplierId(),
                        WINDOW_DAYS,
                        MAX_UPDATES
                )
                .stream()
                .map(
                        SupplierPortalRfqUpdateService::toResponse
                )
                .toList();
    }

    private static SupplierPortalRfqUpdateResponse toResponse(
            UpdateRow row
    ) {
        String label =
                row.rfqNumber()
                        + " ("
                        + row.title()
                        + ")";

        String kind;
        String headline;
        String message;

        if ("AWARDED".equals(row.rfqStatus())) {
            if (row.awardedToYou()) {
                kind =
                        "AWARDED_TO_YOU";

                headline =
                        "Awarded to you";

                message =
                        "Procurement selected your quotation"
                                + (
                                row.quotationNumber() == null
                                        ? ""
                                        : " "
                                        + row.quotationNumber()
                        )
                                + " for "
                                + label
                                + ".";
            } else {
                kind =
                        "DECISION_MADE";

                headline =
                        "A decision has been made";

                message =
                        "Procurement has made a decision on "
                                + label
                                + ". This RFQ is now closed.";
            }
        } else if ("CANCELLED".equals(row.rfqStatus())) {
            kind =
                    "RFQ_CANCELLED";

            headline =
                    "RFQ cancelled";

            message =
                    label
                            + " was cancelled by procurement. No further response is needed.";
        } else {
            kind =
                    "RFQ_CLOSED";

            headline =
                    "RFQ closed";

            message =
                    label
                            + " is closed to responses."
                            + (
                            row.quotationSubmitted()
                                    ? " Your quotation is being evaluated."
                                    : " You did not submit a quotation."
                    );
        }

        return new SupplierPortalRfqUpdateResponse(
                row.rfqId(),
                row.rfqNumber(),
                row.title(),
                kind,
                headline,
                message,
                row.occurredAt()
        );
    }
}
