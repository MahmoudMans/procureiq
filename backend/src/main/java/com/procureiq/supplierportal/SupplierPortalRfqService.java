package com.procureiq.supplierportal;

import com.procureiq.quotation.QuotationCreateInput;
import com.procureiq.quotation.QuotationResponse;
import com.procureiq.quotation.QuotationService;
import com.procureiq.quotation.QuotationStatus;
import com.procureiq.quotation.QuotationUpdateInput;
import com.procureiq.rfq.RfqInvitationStatus;
import com.procureiq.rfq.RfqResponse;
import com.procureiq.rfq.RfqService;
import com.procureiq.rfq.RfqStatus;
import com.procureiq.rfq.RfqSupplierInvitationResponse;
import com.procureiq.supplierportal.SupplierPortalRfqRepository.PortalSession;
import com.procureiq.supplierportal.SupplierPortalRfqRepository.QuotationRef;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Lets an invited supplier respond to an RFQ through the portal.
 *
 * The existing quotation and RFQ services hold the commercial rules, so they are reused
 * unchanged. They act as an internal user, so each call runs as the RFQ owner (or, if that
 * user can no longer act, the user who invited the portal account). The portal audit trail
 * records which portal account really made each change.
 *
 * This class is deliberately not transactional as a whole: finding a usable internal user
 * may involve a call that fails and is retried, which must not poison a shared transaction.
 * Changes are made inside an explicit transaction instead.
 */
@Service
public class SupplierPortalRfqService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SupplierPortalRfqService.class
            );

    private static final String NOT_AVAILABLE =
            "This RFQ was not found or is not available to your account.";

    // Existing audit event type; the database restricts which types are allowed.
    private static final String AUDIT_EVENT =
            "SUPPLIER_RESPONSE_RECORDED";

    private static final Set<String> INELIGIBLE_SUPPLIER_STATUSES =
            Set.of(
                    "SUSPENDED",
                    "INACTIVE"
            );

    private record RfqContext(
            UUID actorUserId,
            RfqResponse rfq
    ) {
    }

    private final SupplierPortalRfqRepository repository;

    private final SupplierPortalSecurityService securityService;

    private final RfqService rfqService;

    private final QuotationService quotationService;

    private final TransactionTemplate transactions;

    public SupplierPortalRfqService(
            SupplierPortalRfqRepository repository,
            SupplierPortalSecurityService securityService,
            RfqService rfqService,
            QuotationService quotationService,
            PlatformTransactionManager transactionManager
    ) {
        this.repository =
                repository;

        this.securityService =
                securityService;

        this.rfqService =
                rfqService;

        this.quotationService =
                quotationService;

        this.transactions =
                new TransactionTemplate(
                        transactionManager
                );
    }

    public List<SupplierPortalRfqSummaryResponse> rfqs(
            String rawToken
    ) {
        PortalSession session =
                requireSession(
                        rawToken
                );

        repository.touchSession(
                session.sessionId()
        );

        LocalDateTime now =
                LocalDateTime.now();

        List<SupplierPortalRfqSummaryResponse> open =
                new ArrayList<>();

        List<SupplierPortalRfqSummaryResponse> other =
                new ArrayList<>();

        for (
                SupplierPortalRfqRepository.InvitedRfq row
                : repository.findInvitedRfqs(
                        session.supplierId()
                )
        ) {
            RfqContext context =
                    resolveContext(
                            session,
                            row.rfqId(),
                            row.ownerUserId()
                    );

            if (context == null) {
                log.warn(
                        "Skipping RFQ {} for supplier {}: no internal user could load it.",
                        row.rfqId(),
                        session.supplierId()
                );

                continue;
            }

            RfqResponse rfq =
                    context.rfq();

            boolean isOpen =
                    isOpen(
                            rfq,
                            now
                    );

            SupplierPortalRfqSummaryResponse summary =
                    new SupplierPortalRfqSummaryResponse(
                            row.rfqId(),
                            rfq.rfqNumber(),
                            rfq.title(),
                            rfq.currency(),
                            rfq.responseDeadline(),
                            rfq.status(),
                            invitationStatus(
                                    rfq,
                                    session.supplierId()
                            ),
                            isOpen,
                            rfq.lineItems().size(),
                            quotationSummary(
                                    row
                            )
                    );

            if (isOpen) {
                open.add(
                        summary
                );
            } else {
                other.add(
                        summary
                );
            }
        }

        open.sort(
                Comparator.comparing(
                        SupplierPortalRfqSummaryResponse::responseDeadline
                )
        );

        other.sort(
                Comparator.comparing(
                        SupplierPortalRfqSummaryResponse::responseDeadline,
                        Comparator.reverseOrder()
                )
        );

        List<SupplierPortalRfqSummaryResponse> result =
                new ArrayList<>(
                        open
                );

        result.addAll(
                other
        );

        return result;
    }

    public SupplierPortalRfqDetailResponse rfq(
            String rawToken,
            UUID rfqId
    ) {
        PortalSession session =
                requireSession(
                        rawToken
                );

        repository.touchSession(
                session.sessionId()
        );

        return buildDetail(
                session,
                rfqId
        );
    }

    public SupplierPortalRfqDetailResponse saveQuotation(
            String rawToken,
            UUID rfqId,
            SupplierPortalQuotationInput input
    ) {
        PortalSession session =
                requireSession(
                        rawToken
                );

        RfqContext context =
                requireContext(
                        session,
                        rfqId
                );

        assertMayRespond(
                session,
                context.rfq()
        );

        transactions.executeWithoutResult(
                transaction -> {
                    QuotationRef existing =
                            repository.findQuotationRef(
                                    rfqId,
                                    session.supplierId()
                            );

                    QuotationResponse saved;

                    if (existing == null) {
                        saved =
                                quotationService
                                        .createQuotation(
                                                context.actorUserId(),
                                                rfqId,
                                                new QuotationCreateInput(
                                                        session.supplierId(),
                                                        input.leadTimeDays(),
                                                        input.paymentTerms()
                                                                .trim(),
                                                        input.validityDate(),
                                                        input.discountAmount(),
                                                        input.shippingAmount(),
                                                        input.taxAmount(),
                                                        input.lines()
                                                )
                                        );
                    } else if (
                            "DRAFT".equals(
                                    existing.status()
                            )
                            ||
                            "WITHDRAWN".equals(
                                    existing.status()
                            )
                    ) {
                        if (
                                "WITHDRAWN".equals(
                                        existing.status()
                                )
                        ) {
                            repository.reopenWithdrawnQuotation(
                                    existing.id()
                            );
                        }

                        saved =
                                quotationService
                                        .updateQuotation(
                                                context.actorUserId(),
                                                existing.id(),
                                                new QuotationUpdateInput(
                                                        input.leadTimeDays(),
                                                        input.paymentTerms()
                                                                .trim(),
                                                        input.validityDate(),
                                                        input.discountAmount(),
                                                        input.shippingAmount(),
                                                        input.taxAmount(),
                                                        input.lines()
                                                )
                                        );
                    } else {
                        throw new IllegalArgumentException(
                                "Your quotation has already been submitted. Withdraw it first if you need to change it."
                        );
                    }

                    repository.touchSession(
                            session.sessionId()
                    );

                    audit(
                            session,
                            "Quotation "
                                    + saved.quotationNumber()
                                    + " saved as a draft for RFQ "
                                    + context.rfq()
                                            .rfqNumber()
                    );
                }
        );

        return buildDetail(
                session,
                rfqId
        );
    }

    public SupplierPortalRfqDetailResponse submitQuotation(
            String rawToken,
            UUID rfqId
    ) {
        PortalSession session =
                requireSession(
                        rawToken
                );

        RfqContext context =
                requireContext(
                        session,
                        rfqId
                );

        assertMayRespond(
                session,
                context.rfq()
        );

        transactions.executeWithoutResult(
                transaction -> {
                    QuotationRef existing =
                            repository.findQuotationRef(
                                    rfqId,
                                    session.supplierId()
                            );

                    if (existing == null) {
                        throw new IllegalArgumentException(
                                "Save your quotation as a draft before submitting it."
                        );
                    }

                    if (
                            "SUBMITTED".equals(
                                    existing.status()
                            )
                    ) {
                        throw new IllegalArgumentException(
                                "This quotation has already been submitted."
                        );
                    }

                    if (
                            !"DRAFT".equals(
                                    existing.status()
                            )
                    ) {
                        throw new IllegalArgumentException(
                                "Save your revised quotation before submitting it."
                        );
                    }

                    QuotationResponse submitted =
                            quotationService
                                    .submitQuotation(
                                            context.actorUserId(),
                                            existing.id()
                                    );

                    repository.touchSession(
                            session.sessionId()
                    );

                    audit(
                            session,
                            "Quotation "
                                    + submitted.quotationNumber()
                                    + " submitted for RFQ "
                                    + context.rfq()
                                            .rfqNumber()
                    );
                }
        );

        return buildDetail(
                session,
                rfqId
        );
    }

    public SupplierPortalRfqDetailResponse withdrawQuotation(
            String rawToken,
            UUID rfqId
    ) {
        PortalSession session =
                requireSession(
                        rawToken
                );

        RfqContext context =
                requireContext(
                        session,
                        rfqId
                );

        assertMayRespond(
                session,
                context.rfq()
        );

        transactions.executeWithoutResult(
                transaction -> {
                    QuotationRef existing =
                            repository.findQuotationRef(
                                    rfqId,
                                    session.supplierId()
                            );

                    if (
                            existing == null
                            ||
                            !"SUBMITTED".equals(
                                    existing.status()
                            )
                    ) {
                        throw new IllegalArgumentException(
                                "Only a submitted quotation can be withdrawn."
                        );
                    }

                    QuotationResponse withdrawn =
                            quotationService
                                    .withdrawQuotation(
                                            context.actorUserId(),
                                            existing.id()
                                    );

                    repository.touchSession(
                            session.sessionId()
                    );

                    audit(
                            session,
                            "Quotation "
                                    + withdrawn.quotationNumber()
                                    + " withdrawn for RFQ "
                                    + context.rfq()
                                            .rfqNumber()
                    );
                }
        );

        return buildDetail(
                session,
                rfqId
        );
    }

    private SupplierPortalRfqDetailResponse buildDetail(
            PortalSession session,
            UUID rfqId
    ) {
        RfqContext context =
                requireContext(
                        session,
                        rfqId
                );

        RfqResponse rfq =
                context.rfq();

        // Only this supplier's own quotation is ever returned.
        SupplierPortalQuotationResponse quotation =
                quotationService
                        .findRfqQuotations(
                                context.actorUserId(),
                                rfqId
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        session.supplierId()
                                                .equals(
                                                        candidate.supplierId()
                                                )
                        )
                        .findFirst()
                        .map(
                                SupplierPortalRfqService::quotationResponse
                        )
                        .orElse(
                                null
                        );

        return new SupplierPortalRfqDetailResponse(
                rfqId,
                rfq.rfqNumber(),
                rfq.title(),
                rfq.description(),
                rfq.currency(),
                rfq.responseDeadline(),
                rfq.status(),
                invitationStatus(
                        rfq,
                        session.supplierId()
                ),
                isOpen(
                        rfq,
                        LocalDateTime.now()
                ),
                biddingBlockedReason(
                        session.supplierId()
                ),
                rfq.lineItems(),
                quotation
        );
    }

    private PortalSession requireSession(
            String rawToken
    ) {
        PortalSession session =
                repository.findActiveSession(
                        securityService.hashToken(
                                rawToken
                        )
                );

        if (session == null) {
            throw new IllegalArgumentException(
                    "Supplier portal session is invalid or has expired. Please sign in again."
            );
        }

        return session;
    }

    private RfqContext requireContext(
            PortalSession session,
            UUID rfqId
    ) {
        UUID owner =
                repository.findInvitedRfqOwner(
                        session.supplierId(),
                        rfqId
                );

        if (owner == null) {
            // Same answer whether the RFQ does not exist or the supplier was not invited.
            throw new IllegalArgumentException(
                    NOT_AVAILABLE
            );
        }

        RfqContext context =
                resolveContext(
                        session,
                        rfqId,
                        owner
                );

        if (context == null) {
            throw new IllegalArgumentException(
                    "This RFQ cannot be opened right now. Please contact procurement."
            );
        }

        return context;
    }

    /** Finds an internal user that the RFQ and quotation services accept as the actor. */
    private RfqContext resolveContext(
            PortalSession session,
            UUID rfqId,
            UUID ownerUserId
    ) {
        List<UUID> candidates =
                java.util.stream.Stream.of(
                                ownerUserId,
                                session.invitedByUserId()
                        )
                        .filter(
                                Objects::nonNull
                        )
                        .distinct()
                        .toList();

        for (
                UUID candidate
                : candidates
        ) {
            try {
                return new RfqContext(
                        candidate,
                        rfqService.findRfq(
                                candidate,
                                rfqId
                        )
                );
            } catch (
                    RuntimeException exception
            ) {
                log.warn(
                        "Internal user {} could not load RFQ {}: {}",
                        candidate,
                        rfqId,
                        exception.toString()
                );
            }
        }

        return null;
    }

    private void assertMayRespond(
            PortalSession session,
            RfqResponse rfq
    ) {
        String blocked =
                biddingBlockedReason(
                        session.supplierId()
                );

        if (blocked != null) {
            throw new IllegalArgumentException(
                    blocked
            );
        }

        if (
                !isOpen(
                        rfq,
                        LocalDateTime.now()
                )
        ) {
            throw new IllegalArgumentException(
                    "This RFQ is no longer accepting responses."
            );
        }
    }

    private String biddingBlockedReason(
            UUID supplierId
    ) {
        String status =
                repository.findSupplierStatus(
                        supplierId
                );

        if (
                status != null
                &&
                INELIGIBLE_SUPPLIER_STATUSES.contains(
                        status
                )
        ) {
            return "Your supplier account is not currently eligible to submit quotations. Please contact procurement.";
        }

        return null;
    }

    private static boolean isOpen(
            RfqResponse rfq,
            LocalDateTime now
    ) {
        return rfq.status()
                == RfqStatus.PUBLISHED
                &&
                rfq.responseDeadline()
                        .isAfter(
                                now
                        );
    }

    private static RfqInvitationStatus invitationStatus(
            RfqResponse rfq,
            UUID supplierId
    ) {
        return rfq.invitations()
                .stream()
                .filter(
                        invitation ->
                                supplierId.equals(
                                        invitation.supplierId()
                                )
                )
                .map(
                        RfqSupplierInvitationResponse::status
                )
                .findFirst()
                .orElse(
                        RfqInvitationStatus.INVITED
                );
    }

    private static SupplierPortalQuotationSummaryResponse quotationSummary(
            SupplierPortalRfqRepository.InvitedRfq row
    ) {
        if (row.quotationId() == null) {
            return null;
        }

        return new SupplierPortalQuotationSummaryResponse(
                row.quotationId(),
                row.quotationNumber(),
                QuotationStatus.valueOf(
                        row.quotationStatus()
                ),
                row.quotationTotal(),
                row.quotationSubmittedAt()
        );
    }

    private static SupplierPortalQuotationResponse quotationResponse(
            QuotationResponse quotation
    ) {
        return new SupplierPortalQuotationResponse(
                quotation.id(),
                quotation.quotationNumber(),
                quotation.status(),
                quotation.currency(),
                quotation.leadTimeDays(),
                quotation.paymentTerms(),
                quotation.validityDate(),
                quotation.subtotal(),
                quotation.discountAmount(),
                quotation.shippingAmount(),
                quotation.taxAmount(),
                quotation.totalAmount(),
                quotation.lines(),
                quotation.submittedAt(),
                quotation.withdrawnAt(),
                quotation.updatedAt()
        );
    }

    private void audit(
            PortalSession session,
            String details
    ) {
        repository.writeAudit(
                session.accountId(),
                session.supplierId(),
                AUDIT_EVENT,
                details
                        + " by portal account "
                        + session.email()
                        + "."
        );
    }
}
