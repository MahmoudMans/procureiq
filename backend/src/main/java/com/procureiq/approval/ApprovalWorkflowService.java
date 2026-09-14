package com.procureiq.approval;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.purchaserequest.PurchaseRequestRepository;
import com.procureiq.purchaserequest.PurchaseRequestStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ApprovalWorkflowService {

    private final ApprovalPolicyRepository
            approvalPolicyRepository;

    private final ApprovalTaskRepository
            approvalTaskRepository;

    private final AppUserRepository
            appUserRepository;

    private final PurchaseRequestRepository
            purchaseRequestRepository;

    public ApprovalWorkflowService(
            ApprovalPolicyRepository approvalPolicyRepository,
            ApprovalTaskRepository approvalTaskRepository,
            AppUserRepository appUserRepository,
            PurchaseRequestRepository purchaseRequestRepository
    ) {
        this.approvalPolicyRepository =
                approvalPolicyRepository;

        this.approvalTaskRepository =
                approvalTaskRepository;

        this.appUserRepository =
                appUserRepository;

        this.purchaseRequestRepository =
                purchaseRequestRepository;
    }

    public void startApproval(
            PurchaseRequestEntity purchaseRequest
    ) {
        if (
                approvalTaskRepository
                        .existsByPurchaseRequest_IdAndStatus(
                                purchaseRequest.getId(),
                                ApprovalTaskStatus.PENDING
                        )
        ) {
            throw new IllegalArgumentException(
                    "This purchase request already has a pending approval task."
            );
        }

        ApprovalPolicyEntity policy =
                approvalPolicyRepository
                        .findMatchingPolicies(
                                purchaseRequest
                                        .getEstimatedTotalAmount()
                        )
                        .stream()
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "No active approval policy matches this purchase request amount."
                                        )
                        );

        ApprovalTaskEntity task =
                new ApprovalTaskEntity();

        task.setPurchaseRequest(
                purchaseRequest
        );

        task.setPolicy(
                policy
        );

        task.setRequiredRole(
                policy.getRequiredRole()
        );

        task.setStatus(
                ApprovalTaskStatus.PENDING
        );

        approvalTaskRepository
                .save(task);
    }

    public void cancelPendingApproval(
            PurchaseRequestEntity purchaseRequest
    ) {
        approvalTaskRepository
                .findFirstByPurchaseRequest_IdAndStatus(
                        purchaseRequest.getId(),
                        ApprovalTaskStatus.PENDING
                )
                .ifPresent(
                        task -> {
                            task.setStatus(
                                    ApprovalTaskStatus.CANCELLED
                            );

                            task.setDecisionComment(
                                    "Approval cancelled because the purchase request was cancelled."
                            );

                            task.setDecidedAt(
                                    Instant.now()
                            );

                            approvalTaskRepository
                                    .save(task);
                        }
                );
    }

    @Transactional(readOnly = true)
    public List<ApprovalTaskResponse> findQueue(
            UUID currentUserId,
            ApprovalTaskStatus status
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertQueueRole(
                user.getRole()
        );

        boolean admin =
                user.getRole()
                        == ProcurementRole.ADMIN;

        return approvalTaskRepository
                .findQueue(
                        user.getRole(),
                        admin,
                        status
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ApprovalSummaryResponse getSummary(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        assertQueueRole(
                user.getRole()
        );

        boolean admin =
                user.getRole()
                        == ProcurementRole.ADMIN;

        List<ApprovalTaskEntity> tasks =
                approvalTaskRepository
                        .findQueue(
                                user.getRole(),
                                admin,
                                null
                        );

        long pending =
                countStatus(
                        tasks,
                        ApprovalTaskStatus.PENDING
                );

        long approved =
                countStatus(
                        tasks,
                        ApprovalTaskStatus.APPROVED
                );

        long rejected =
                countStatus(
                        tasks,
                        ApprovalTaskStatus.REJECTED
                );

        long cancelled =
                countStatus(
                        tasks,
                        ApprovalTaskStatus.CANCELLED
                );

        BigDecimal pendingValue =
                tasks.stream()
                        .filter(
                                task ->
                                        task.getStatus()
                                                == ApprovalTaskStatus.PENDING
                        )
                        .map(
                                task ->
                                        task.getPurchaseRequest()
                                                .getEstimatedTotalAmount()
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new ApprovalSummaryResponse(
                tasks.size(),
                pending,
                approved,
                rejected,
                cancelled,
                pendingValue
        );
    }

    @Transactional(readOnly = true)
    public List<ApprovalTaskResponse>
    findRequestHistory(
            UUID currentUserId,
            UUID purchaseRequestId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        PurchaseRequestEntity request =
                purchaseRequestRepository
                        .findDetailedById(
                                purchaseRequestId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Purchase request not found: "
                                                        + purchaseRequestId
                                        )
                        );

        if (
                !canViewAllRequests(
                        user.getRole()
                )
                &&
                !request.getRequester()
                        .getId()
                        .equals(
                                user.getId()
                        )
        ) {
            throw new ResourceNotFoundException(
                    "Purchase request not found: "
                            + purchaseRequestId
            );
        }

        return approvalTaskRepository
                .findAllByPurchaseRequest_IdOrderByRequestedAtAsc(
                        purchaseRequestId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ApprovalTaskResponse approve(
            UUID currentUserId,
            UUID taskId,
            ApprovalDecisionInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        ApprovalTaskEntity task =
                findTask(
                        taskId
                );

        assertCanDecide(
                user,
                task
        );

        assertPending(task);

        assertNoSelfApproval(
                user,
                task
        );

        PurchaseRequestEntity request =
                task.getPurchaseRequest();

        if (
                request.getStatus()
                        != PurchaseRequestStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted purchase requests can be approved."
            );
        }

        task.setStatus(
                ApprovalTaskStatus.APPROVED
        );

        task.setDecidedBy(
                user
        );

        task.setDecisionComment(
                normalizeOptional(
                        input.comment()
                )
        );

        task.setDecidedAt(
                Instant.now()
        );

        request.setStatus(
                PurchaseRequestStatus.APPROVED
        );

        purchaseRequestRepository
                .save(request);

        return toResponse(
                approvalTaskRepository
                        .save(task)
        );
    }

    public ApprovalTaskResponse reject(
            UUID currentUserId,
            UUID taskId,
            ApprovalDecisionInput input
    ) {
        AppUserEntity user =
                findCurrentUser(
                        currentUserId
                );

        ApprovalTaskEntity task =
                findTask(
                        taskId
                );

        assertCanDecide(
                user,
                task
        );

        assertPending(task);

        assertNoSelfApproval(
                user,
                task
        );

        String comment =
                normalizeOptional(
                        input.comment()
                );

        if (comment == null) {
            throw new IllegalArgumentException(
                    "A rejection comment is required."
            );
        }

        PurchaseRequestEntity request =
                task.getPurchaseRequest();

        if (
                request.getStatus()
                        != PurchaseRequestStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted purchase requests can be rejected."
            );
        }

        task.setStatus(
                ApprovalTaskStatus.REJECTED
        );

        task.setDecidedBy(
                user
        );

        task.setDecisionComment(
                comment
        );

        task.setDecidedAt(
                Instant.now()
        );

        request.setStatus(
                PurchaseRequestStatus.REJECTED
        );

        purchaseRequestRepository
                .save(request);

        return toResponse(
                approvalTaskRepository
                        .save(task)
        );
    }

    private ApprovalTaskEntity findTask(
            UUID taskId
    ) {
        return approvalTaskRepository
                .findById(taskId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Approval task not found: "
                                                + taskId
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

    private void assertQueueRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access the approval queue."
            );
        }
    }

    private void assertCanDecide(
            AppUserEntity user,
            ApprovalTaskEntity task
    ) {
        if (
                user.getRole()
                        == ProcurementRole.ADMIN
        ) {
            return;
        }

        if (
                user.getRole()
                        != task.getRequiredRole()
        ) {
            throw new IllegalArgumentException(
                    "This approval task is assigned to a different ProcureIQ role."
            );
        }
    }

    private void assertPending(
            ApprovalTaskEntity task
    ) {
        if (
                task.getStatus()
                        != ApprovalTaskStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Only pending approval tasks can be decided."
            );
        }
    }

    private void assertNoSelfApproval(
            AppUserEntity user,
            ApprovalTaskEntity task
    ) {
        if (
                task.getPurchaseRequest()
                        .getRequester()
                        .getId()
                        .equals(
                                user.getId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "ProcureIQ does not allow self-approval of purchase requests."
            );
        }
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

    private long countStatus(
            List<ApprovalTaskEntity> tasks,
            ApprovalTaskStatus status
    ) {
        return tasks.stream()
                .filter(
                        task ->
                                task.getStatus()
                                        == status
                )
                .count();
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

    private ApprovalTaskResponse toResponse(
            ApprovalTaskEntity task
    ) {
        PurchaseRequestEntity request =
                task.getPurchaseRequest();

        AppUserEntity decidedBy =
                task.getDecidedBy();

        return new ApprovalTaskResponse(
                task.getId(),
                request.getId(),
                request.getRequestNumber(),
                request.getTitle(),
                request.getRequester().getFullName(),
                request.getRequester().getEmail(),
                request.getDepartment().getName(),
                request.getCostCenter(),
                request.getCurrency(),
                request.getEstimatedTotalAmount(),
                request.getDesiredDeliveryDate(),
                task.getPolicy().getId(),
                task.getPolicy().getPolicyCode(),
                task.getPolicy().getPolicyName(),
                task.getRequiredRole(),
                task.getStatus(),
                decidedBy == null
                        ? null
                        : decidedBy.getId(),
                decidedBy == null
                        ? null
                        : decidedBy.getFullName(),
                task.getDecisionComment(),
                task.getRequestedAt(),
                task.getDecidedAt(),
                task.getVersion()
        );
    }
}
