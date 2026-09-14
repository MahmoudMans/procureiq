package com.procureiq.purchaserequest;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PurchaseRequestService {

    private final PurchaseRequestRepository
            purchaseRequestRepository;

    private final AppUserRepository
            appUserRepository;

    public PurchaseRequestService(
            PurchaseRequestRepository
                    purchaseRequestRepository,

            AppUserRepository
                    appUserRepository
    ) {
        this.purchaseRequestRepository =
                purchaseRequestRepository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<PurchaseRequestResponse>
    findRequests(
            UUID currentUserId,
            String query,
            PurchaseRequestStatus status
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        boolean privileged =
                canViewAllRequests(
                        currentUser.getRole()
                );

        String normalizedQuery =
                normalizeOptional(query);

        return purchaseRequestRepository
                .searchVisible(
                        currentUserId,
                        privileged,
                        normalizedQuery,
                        status
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseRequestResponse
    findRequest(
            UUID currentUserId,
            UUID requestId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        PurchaseRequestEntity request =
                findVisibleRequest(
                        currentUser,
                        requestId
                );

        return toResponse(request);
    }

    public PurchaseRequestResponse
    createRequest(
            UUID currentUserId,
            PurchaseRequestInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        if (
                !canCreateRequest(
                        currentUser.getRole()
                )
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot create purchase requests."
            );
        }

        PurchaseRequestEntity request =
                new PurchaseRequestEntity();

        request.setRequestNumber(
                generateRequestNumber()
        );

        request.setRequester(
                currentUser
        );

        request.setDepartment(
                currentUser.getDepartment()
        );

        request.setStatus(
                PurchaseRequestStatus.DRAFT
        );

        applyEditableFields(
                request,
                input
        );

        PurchaseRequestEntity saved =
                purchaseRequestRepository
                        .save(request);

        return toResponse(saved);
    }

    public PurchaseRequestResponse
    updateRequest(
            UUID currentUserId,
            UUID requestId,
            PurchaseRequestInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        PurchaseRequestEntity request =
                findVisibleRequest(
                        currentUser,
                        requestId
                );

        assertCanModify(
                currentUser,
                request
        );

        if (
                request.getStatus()
                        != PurchaseRequestStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft purchase requests can be edited."
            );
        }

        applyEditableFields(
                request,
                input
        );

        return toResponse(
                purchaseRequestRepository
                        .save(request)
        );
    }

    public PurchaseRequestResponse
    submitRequest(
            UUID currentUserId,
            UUID requestId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        PurchaseRequestEntity request =
                findVisibleRequest(
                        currentUser,
                        requestId
                );

        assertCanModify(
                currentUser,
                request
        );

        if (
                request.getStatus()
                        != PurchaseRequestStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft purchase requests can be submitted."
            );
        }

        if (
                request.getItems() == null
                || request.getItems().isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "A purchase request requires at least one line item before submission."
            );
        }

        request.setStatus(
                PurchaseRequestStatus.SUBMITTED
        );

        request.setSubmittedAt(
                Instant.now()
        );

        return toResponse(
                purchaseRequestRepository
                        .save(request)
        );
    }

    public PurchaseRequestResponse
    cancelRequest(
            UUID currentUserId,
            UUID requestId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        PurchaseRequestEntity request =
                findVisibleRequest(
                        currentUser,
                        requestId
                );

        assertCanModify(
                currentUser,
                request
        );

        if (
                request.getStatus()
                        != PurchaseRequestStatus.DRAFT
                &&
                request.getStatus()
                        != PurchaseRequestStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only draft or submitted purchase requests can be cancelled."
            );
        }

        request.setStatus(
                PurchaseRequestStatus.CANCELLED
        );

        request.setCancelledAt(
                Instant.now()
        );

        return toResponse(
                purchaseRequestRepository
                        .save(request)
        );
    }

    @Transactional(readOnly = true)
    public PurchaseRequestSummaryResponse
    getSummary(
            UUID currentUserId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        boolean privileged =
                canViewAllRequests(
                        currentUser.getRole()
                );

        List<PurchaseRequestEntity> requests =
                purchaseRequestRepository
                        .searchVisible(
                                currentUserId,
                                privileged,
                                null,
                                null
                        );

        long drafts =
                countStatus(
                        requests,
                        PurchaseRequestStatus.DRAFT
                );

        long submitted =
                countStatus(
                        requests,
                        PurchaseRequestStatus.SUBMITTED
                );

        long approved =
                countStatus(
                        requests,
                        PurchaseRequestStatus.APPROVED
                );

        long rejected =
                countStatus(
                        requests,
                        PurchaseRequestStatus.REJECTED
                );

        long cancelled =
                countStatus(
                        requests,
                        PurchaseRequestStatus.CANCELLED
                );

        BigDecimal submittedValue =
                requests.stream()
                        .filter(
                                request ->
                                        request.getStatus()
                                                == PurchaseRequestStatus.SUBMITTED
                                                ||
                                        request.getStatus()
                                                == PurchaseRequestStatus.APPROVED
                        )
                        .map(
                                PurchaseRequestEntity::
                                        getEstimatedTotalAmount
                        )
                        .filter(
                                amount ->
                                        amount != null
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new PurchaseRequestSummaryResponse(
                requests.size(),
                drafts,
                submitted,
                approved,
                rejected,
                cancelled,
                submittedValue
        );
    }

    private void applyEditableFields(
            PurchaseRequestEntity request,
            PurchaseRequestInput input
    ) {
        request.setTitle(
                normalizeRequired(
                        input.title()
                )
        );

        request.setDescription(
                normalizeOptional(
                        input.description()
                )
        );

        request.setBusinessJustification(
                normalizeRequired(
                        input.businessJustification()
                )
        );

        request.setCostCenter(
                normalizeRequired(
                        input.costCenter()
                )
        );

        request.setCurrency(
                normalizeRequired(
                        input.currency()
                ).toUpperCase()
        );

        request.setDesiredDeliveryDate(
                input.desiredDeliveryDate()
        );

        List<PurchaseRequestItemEntity>
                items =
                new ArrayList<>();

        BigDecimal total =
                BigDecimal.ZERO;

        int lineNumber = 1;

        for (
                PurchaseRequestItemInput itemInput
                : input.items()
        ) {
            PurchaseRequestItemEntity item =
                    new PurchaseRequestItemEntity();

            BigDecimal quantity =
                    itemInput.quantity()
                            .setScale(
                                    3,
                                    RoundingMode.HALF_UP
                            );

            BigDecimal unitPrice =
                    itemInput
                            .estimatedUnitPrice()
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            BigDecimal lineTotal =
                    quantity
                            .multiply(unitPrice)
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            item.setLineNumber(
                    lineNumber++
            );

            item.setItemName(
                    normalizeRequired(
                            itemInput.itemName()
                    )
            );

            item.setDescription(
                    normalizeOptional(
                            itemInput.description()
                    )
            );

            item.setCategory(
                    normalizeRequired(
                            itemInput.category()
                    )
            );

            item.setQuantity(quantity);

            item.setUnit(
                    normalizeRequired(
                            itemInput.unit()
                    )
            );

            item.setEstimatedUnitPrice(
                    unitPrice
            );

            item.setEstimatedLineTotal(
                    lineTotal
            );

            items.add(item);

            total =
                    total.add(
                            lineTotal
                    );
        }

        request.replaceItems(items);

        request.setEstimatedTotalAmount(
                total.setScale(
                        2,
                        RoundingMode.HALF_UP
                )
        );
    }

    private PurchaseRequestEntity
    findVisibleRequest(
            AppUserEntity currentUser,
            UUID requestId
    ) {
        PurchaseRequestEntity request =
                purchaseRequestRepository
                        .findDetailedById(
                                requestId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Purchase request not found: "
                                                        + requestId
                                        )
                        );

        if (
                !canViewAllRequests(
                        currentUser.getRole()
                )
                &&
                !request.getRequester()
                        .getId()
                        .equals(
                                currentUser.getId()
                        )
        ) {
            throw new ResourceNotFoundException(
                    "Purchase request not found: "
                            + requestId
            );
        }

        return request;
    }

    private void assertCanModify(
            AppUserEntity currentUser,
            PurchaseRequestEntity request
    ) {
        boolean owner =
                request.getRequester()
                        .getId()
                        .equals(
                                currentUser.getId()
                        );

        boolean manager =
                currentUser.getRole()
                        == ProcurementRole.ADMIN
                        ||
                currentUser.getRole()
                        == ProcurementRole.PROCUREMENT_MANAGER;

        if (!owner && !manager) {
            throw new IllegalArgumentException(
                    "You cannot modify this purchase request."
            );
        }
    }

    private AppUserEntity
    findCurrentUser(
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

    private boolean canViewAllRequests(
            ProcurementRole role
    ) {
        return role
                == ProcurementRole.ADMIN
                ||
                role
                        == ProcurementRole.PROCUREMENT_MANAGER
                ||
                role
                        == ProcurementRole.BUYER
                ||
                role
                        == ProcurementRole.APPROVER;
    }

    private boolean canCreateRequest(
            ProcurementRole role
    ) {
        return role
                == ProcurementRole.ADMIN
                ||
                role
                        == ProcurementRole.PROCUREMENT_MANAGER
                ||
                role
                        == ProcurementRole.BUYER
                ||
                role
                        == ProcurementRole.REQUESTER;
    }

    private long countStatus(
            List<PurchaseRequestEntity> requests,
            PurchaseRequestStatus status
    ) {
        return requests.stream()
                .filter(
                        request ->
                                request.getStatus()
                                        == status
                )
                .count();
    }

    private String generateRequestNumber() {
        Long sequence =
                purchaseRequestRepository
                        .nextRequestSequence();

        int year =
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue();

        return String.format(
                "PR-%d-%05d",
                year,
                sequence
        );
    }

    private PurchaseRequestResponse
    toResponse(
            PurchaseRequestEntity request
    ) {
        List<PurchaseRequestItemResponse>
                items =
                request.getItems()
                        .stream()
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                PurchaseRequestItemEntity::
                                                        getLineNumber
                                        )
                        )
                        .map(
                                item ->
                                        new PurchaseRequestItemResponse(
                                                item.getId(),
                                                item.getLineNumber(),
                                                item.getItemName(),
                                                item.getDescription(),
                                                item.getCategory(),
                                                item.getQuantity(),
                                                item.getUnit(),
                                                item.getEstimatedUnitPrice(),
                                                item.getEstimatedLineTotal()
                                        )
                        )
                        .toList();

        return new PurchaseRequestResponse(
                request.getId(),
                request.getRequestNumber(),
                request.getTitle(),
                request.getDescription(),
                request.getBusinessJustification(),
                request.getRequester().getId(),
                request.getRequester().getFullName(),
                request.getRequester().getEmail(),
                request.getDepartment().getId(),
                request.getDepartment().getCode(),
                request.getDepartment().getName(),
                request.getCostCenter(),
                request.getCurrency(),
                request.getDesiredDeliveryDate(),
                request.getStatus(),
                request.getEstimatedTotalAmount(),
                items,
                request.getSubmittedAt(),
                request.getCancelledAt(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                request.getVersion()
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
