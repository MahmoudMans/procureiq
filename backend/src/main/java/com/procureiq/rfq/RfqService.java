package com.procureiq.rfq;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.purchaserequest.PurchaseRequestItemEntity;
import com.procureiq.purchaserequest.PurchaseRequestRepository;
import com.procureiq.purchaserequest.PurchaseRequestStatus;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.supplier.SupplierRepository;
import com.procureiq.supplier.SupplierStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class RfqService {

    private final RfqRepository rfqRepository;

    private final PurchaseRequestRepository
            purchaseRequestRepository;

    private final SupplierRepository supplierRepository;

    private final AppUserRepository appUserRepository;

    public RfqService(
            RfqRepository rfqRepository,
            PurchaseRequestRepository purchaseRequestRepository,
            SupplierRepository supplierRepository,
            AppUserRepository appUserRepository
    ) {
        this.rfqRepository =
                rfqRepository;

        this.purchaseRequestRepository =
                purchaseRequestRepository;

        this.supplierRepository =
                supplierRepository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<RfqResponse> findRfqs(
            UUID currentUserId,
            String query,
            RfqStatus status
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        return rfqRepository
                .search(
                        normalizeOptional(query),
                        status
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RfqResponse findRfq(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        return toResponse(
                findRfqEntity(
                        rfqId
                )
        );
    }

    public RfqResponse createRfq(
            UUID currentUserId,
            RfqCreateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        PurchaseRequestEntity purchaseRequest =
                purchaseRequestRepository
                        .findDetailedById(
                                input.purchaseRequestId()
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Purchase request not found: "
                                                        + input.purchaseRequestId()
                                        )
                        );

        if (
                purchaseRequest.getStatus()
                        != PurchaseRequestStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only approved purchase requests can be converted into RFQs."
            );
        }

        if (
                rfqRepository
                        .existsBySourcePurchaseRequest_Id(
                                purchaseRequest.getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "An RFQ already exists for this purchase request."
            );
        }

        RfqEntity rfq =
                new RfqEntity();

        rfq.setRfqNumber(
                generateRfqNumber()
        );

        rfq.setSourcePurchaseRequest(
                purchaseRequest
        );

        rfq.setCurrency(
                purchaseRequest.getCurrency()
        );

        rfq.setCreatedBy(
                user
        );

        rfq.setStatus(
                RfqStatus.DRAFT
        );

        applyDraftFields(
                rfq,
                input.title(),
                input.description(),
                input.responseDeadline(),
                input.supplierIds()
        );

        copyPurchaseRequestLines(
                rfq,
                purchaseRequest
        );

        return toResponse(
                rfqRepository.save(rfq)
        );
    }

    public RfqResponse updateRfq(
            UUID currentUserId,
            UUID rfqId,
            RfqUpdateInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfqEntity(
                        rfqId
                );

        assertDraft(rfq);

        applyDraftFields(
                rfq,
                input.title(),
                input.description(),
                input.responseDeadline(),
                input.supplierIds()
        );

        return toResponse(
                rfqRepository.save(rfq)
        );
    }

    public RfqResponse publishRfq(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfqEntity(
                        rfqId
                );

        assertDraft(rfq);

        if (
                rfq.getInvitations().isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one supplier must be invited before publishing an RFQ."
            );
        }

        if (
                !rfq.getResponseDeadline()
                        .isAfter(
                                LocalDateTime.now()
                        )
        ) {
            throw new IllegalArgumentException(
                    "RFQ response deadline must be in the future."
            );
        }

        rfq.setStatus(
                RfqStatus.PUBLISHED
        );

        rfq.setPublishedAt(
                Instant.now()
        );

        return toResponse(
                rfqRepository.save(rfq)
        );
    }

    public RfqResponse closeRfq(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfqEntity(
                        rfqId
                );

        if (
                rfq.getStatus()
                        != RfqStatus.PUBLISHED
        ) {
            throw new IllegalArgumentException(
                    "Only published RFQs can be closed."
            );
        }

        rfq.setStatus(
                RfqStatus.CLOSED
        );

        rfq.setClosedAt(
                Instant.now()
        );

        return toResponse(
                rfqRepository.save(rfq)
        );
    }

    public RfqResponse cancelRfq(
            UUID currentUserId,
            UUID rfqId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        RfqEntity rfq =
                findRfqEntity(
                        rfqId
                );

        if (
                rfq.getStatus()
                        != RfqStatus.DRAFT
                &&
                rfq.getStatus()
                        != RfqStatus.PUBLISHED
        ) {
            throw new IllegalArgumentException(
                    "Only draft or published RFQs can be cancelled."
            );
        }

        rfq.setStatus(
                RfqStatus.CANCELLED
        );

        rfq.setCancelledAt(
                Instant.now()
        );

        return toResponse(
                rfqRepository.save(rfq)
        );
    }

    @Transactional(readOnly = true)
    public RfqSummaryResponse getSummary(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertSourcingRole(
                user.getRole()
        );

        List<RfqEntity> rfqs =
                rfqRepository.search(
                        null,
                        null
                );

        long drafts =
                countStatus(
                        rfqs,
                        RfqStatus.DRAFT
                );

        long published =
                countStatus(
                        rfqs,
                        RfqStatus.PUBLISHED
                );

        long closed =
                countStatus(
                        rfqs,
                        RfqStatus.CLOSED
                );

        long cancelled =
                countStatus(
                        rfqs,
                        RfqStatus.CANCELLED
                );

        long invitations =
                rfqs.stream()
                        .mapToLong(
                                rfq ->
                                        rfq.getInvitations()
                                                .size()
                        )
                        .sum();

        BigDecimal activeValue =
                rfqs.stream()
                        .filter(
                                rfq ->
                                        rfq.getStatus()
                                                == RfqStatus.PUBLISHED
                        )
                        .map(
                                rfq ->
                                        rfq.getSourcePurchaseRequest()
                                                .getEstimatedTotalAmount()
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new RfqSummaryResponse(
                rfqs.size(),
                drafts,
                published,
                closed,
                cancelled,
                invitations,
                activeValue
        );
    }

    private void applyDraftFields(
            RfqEntity rfq,
            String title,
            String description,
            LocalDateTime responseDeadline,
            List<UUID> supplierIds
    ) {
        rfq.setTitle(
                normalizeRequired(
                        title
                )
        );

        rfq.setDescription(
                normalizeOptional(
                        description
                )
        );

        rfq.setResponseDeadline(
                responseDeadline
        );

        rfq.replaceInvitations(
                buildInvitations(
                        supplierIds
                )
        );
    }

    private void copyPurchaseRequestLines(
            RfqEntity rfq,
            PurchaseRequestEntity purchaseRequest
    ) {
        List<RfqLineItemEntity> lines =
                new ArrayList<>();

        int lineNumber = 1;

        for (
                PurchaseRequestItemEntity item
                : purchaseRequest.getItems()
        ) {
            RfqLineItemEntity line =
                    new RfqLineItemEntity();

            line.setLineNumber(
                    lineNumber++
            );

            line.setItemName(
                    item.getItemName()
            );

            line.setDescription(
                    item.getDescription()
            );

            line.setCategory(
                    item.getCategory()
            );

            line.setQuantity(
                    item.getQuantity()
            );

            line.setUnit(
                    item.getUnit()
            );

            lines.add(line);
        }

        if (lines.isEmpty()) {
            throw new IllegalArgumentException(
                    "The approved purchase request does not contain any line items."
            );
        }

        rfq.replaceLineItems(
                lines
        );
    }

    private List<RfqSupplierInvitationEntity>
    buildInvitations(
            List<UUID> supplierIds
    ) {
        Set<UUID> uniqueIds =
                new LinkedHashSet<>(
                        supplierIds
                );

        if (
                uniqueIds.size()
                        != supplierIds.size()
        ) {
            throw new IllegalArgumentException(
                    "The RFQ supplier list contains duplicates."
            );
        }

        List<RfqSupplierInvitationEntity>
                invitations =
                new ArrayList<>();

        for (UUID supplierId : uniqueIds) {
            SupplierEntity supplier =
                    supplierRepository
                            .findByIdAndActiveTrue(
                                    supplierId
                            )
                            .orElseThrow(
                                    () ->
                                            new ResourceNotFoundException(
                                                    "Supplier not found: "
                                                            + supplierId
                                            )
                            );

            if (
                    supplier.getStatus()
                            != SupplierStatus.ACTIVE
            ) {
                throw new IllegalArgumentException(
                        "Only active suppliers can be invited to an RFQ."
                );
            }

            RfqSupplierInvitationEntity invitation =
                    new RfqSupplierInvitationEntity();

            invitation.setSupplier(
                    supplier
            );

            invitation.setStatus(
                    RfqInvitationStatus.INVITED
            );

            invitations.add(
                    invitation
            );
        }

        return invitations;
    }

    private RfqEntity findRfqEntity(
            UUID rfqId
    ) {
        return rfqRepository
                .findById(rfqId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "RFQ not found: "
                                                + rfqId
                                )
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(userId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private void assertSourcingRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot manage sourcing events."
            );
        }
    }

    private void assertDraft(
            RfqEntity rfq
    ) {
        if (
                rfq.getStatus()
                        != RfqStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft RFQs can be edited."
            );
        }
    }

    private long countStatus(
            List<RfqEntity> rfqs,
            RfqStatus status
    ) {
        return rfqs.stream()
                .filter(
                        rfq ->
                                rfq.getStatus()
                                        == status
                )
                .count();
    }

    private String generateRfqNumber() {
        Long sequence =
                rfqRepository
                        .nextRfqSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "RFQ-%d-%05d",
                year,
                sequence
        );
    }

    private RfqResponse toResponse(
            RfqEntity rfq
    ) {
        PurchaseRequestEntity purchaseRequest =
                rfq.getSourcePurchaseRequest();

        List<RfqLineItemResponse> lines =
                rfq.getLineItems()
                        .stream()
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                RfqLineItemEntity::
                                                        getLineNumber
                                        )
                        )
                        .map(
                                line ->
                                        new RfqLineItemResponse(
                                                line.getId(),
                                                line.getLineNumber(),
                                                line.getItemName(),
                                                line.getDescription(),
                                                line.getCategory(),
                                                line.getQuantity(),
                                                line.getUnit()
                                        )
                        )
                        .toList();

        List<RfqSupplierInvitationResponse>
                invitations =
                rfq.getInvitations()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        invitation ->
                                                invitation.getSupplier()
                                                        .getLegalName()
                                )
                        )
                        .map(
                                invitation ->
                                        new RfqSupplierInvitationResponse(
                                                invitation.getId(),
                                                invitation.getSupplier()
                                                        .getId(),
                                                invitation.getSupplier()
                                                        .getSupplierCode(),
                                                invitation.getSupplier()
                                                        .getLegalName(),
                                                invitation.getSupplier()
                                                        .getCategory(),
                                                invitation.getSupplier()
                                                        .getCountry(),
                                                invitation.getStatus(),
                                                invitation.getInvitedAt(),
                                                invitation.getRespondedAt()
                                        )
                        )
                        .toList();

        return new RfqResponse(
                rfq.getId(),
                rfq.getRfqNumber(),
                purchaseRequest.getId(),
                purchaseRequest.getRequestNumber(),
                purchaseRequest.getTitle(),
                purchaseRequest.getRequester()
                        .getFullName(),
                purchaseRequest.getDepartment()
                        .getName(),
                purchaseRequest.getEstimatedTotalAmount(),
                rfq.getTitle(),
                rfq.getDescription(),
                rfq.getCurrency(),
                rfq.getResponseDeadline(),
                rfq.getStatus(),
                rfq.getCreatedBy()
                        .getId(),
                rfq.getCreatedBy()
                        .getFullName(),
                lines,
                invitations,
                rfq.getPublishedAt(),
                rfq.getClosedAt(),
                rfq.getCancelledAt(),
                rfq.getCreatedAt(),
                rfq.getUpdatedAt(),
                rfq.getVersion()
        );
    }

    private String normalizeRequired(
            String value
    ) {
        return value.trim();
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}
