package com.procureiq.approval;

import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.purchaserequest.PurchaseRequestRepository;
import com.procureiq.purchaserequest.PurchaseRequestStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApprovalWorkflowServiceTest {

    private ApprovalPolicyRepository
            approvalPolicyRepository;

    private ApprovalTaskRepository
            approvalTaskRepository;

    private AppUserRepository
            appUserRepository;

    private PurchaseRequestRepository
            purchaseRequestRepository;

    private ApprovalWorkflowService
            approvalWorkflowService;

    @BeforeEach
    void setUp() {
        approvalPolicyRepository =
                mock(
                        ApprovalPolicyRepository.class
                );

        approvalTaskRepository =
                mock(
                        ApprovalTaskRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        purchaseRequestRepository =
                mock(
                        PurchaseRequestRepository.class
                );

        approvalWorkflowService =
                new ApprovalWorkflowService(
                        approvalPolicyRepository,
                        approvalTaskRepository,
                        appUserRepository,
                        purchaseRequestRepository
                );
    }

    @Test
    void startApprovalShouldUseMatchingPolicy() {
        PurchaseRequestEntity request =
                mock(
                        PurchaseRequestEntity.class
                );

        ApprovalPolicyEntity policy =
                mock(
                        ApprovalPolicyEntity.class
                );

        UUID requestId =
                UUID.randomUUID();

        when(
                request.getId()
        ).thenReturn(
                requestId
        );

        when(
                request.getEstimatedTotalAmount()
        ).thenReturn(
                new BigDecimal("4500.00")
        );

        when(
                approvalTaskRepository
                        .existsByPurchaseRequest_IdAndStatus(
                                requestId,
                                ApprovalTaskStatus.PENDING
                        )
        ).thenReturn(false);

        when(
                approvalPolicyRepository
                        .findMatchingPolicies(
                                new BigDecimal("4500.00")
                        )
        ).thenReturn(
                List.of(policy)
        );

        when(
                policy.getRequiredRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        when(
                approvalTaskRepository
                        .save(
                                any(
                                        ApprovalTaskEntity.class
                                )
                        )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        approvalWorkflowService
                .startApproval(request);

        verify(
                approvalTaskRepository
        ).save(
                any(
                        ApprovalTaskEntity.class
                )
        );
    }

    @Test
    void rejectShouldRequireComment() {
        UUID userId =
                UUID.randomUUID();

        UUID requesterId =
                UUID.randomUUID();

        UUID taskId =
                UUID.randomUUID();

        AppUserEntity approver =
                mock(
                        AppUserEntity.class
                );

        AppUserEntity requester =
                mock(
                        AppUserEntity.class
                );

        ApprovalTaskEntity task =
                mock(
                        ApprovalTaskEntity.class
                );

        PurchaseRequestEntity request =
                mock(
                        PurchaseRequestEntity.class
                );

        when(
                approver.getId()
        ).thenReturn(
                userId
        );

        when(
                approver.getRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        when(
                approver.isActive()
        ).thenReturn(true);

        when(
                requester.getId()
        ).thenReturn(
                requesterId
        );

        when(
                task.getRequiredRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        when(
                task.getStatus()
        ).thenReturn(
                ApprovalTaskStatus.PENDING
        );

        when(
                task.getPurchaseRequest()
        ).thenReturn(
                request
        );

        when(
                request.getRequester()
        ).thenReturn(
                requester
        );

        when(
                request.getStatus()
        ).thenReturn(
                PurchaseRequestStatus.SUBMITTED
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(approver)
        );

        when(
                approvalTaskRepository
                        .findById(taskId)
        ).thenReturn(
                Optional.of(task)
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                approvalWorkflowService
                                        .reject(
                                                userId,
                                                taskId,
                                                new ApprovalDecisionInput(
                                                        "   "
                                                )
                                        )
                );

        assertEquals(
                "A rejection comment is required.",
                exception.getMessage()
        );
    }

    @Test
    void approverCannotApproveOwnRequest() {
        UUID userId =
                UUID.randomUUID();

        UUID taskId =
                UUID.randomUUID();

        AppUserEntity approver =
                mock(
                        AppUserEntity.class
                );

        ApprovalTaskEntity task =
                mock(
                        ApprovalTaskEntity.class
                );

        PurchaseRequestEntity request =
                mock(
                        PurchaseRequestEntity.class
                );

        when(
                approver.getId()
        ).thenReturn(
                userId
        );

        when(
                approver.getRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        when(
                approver.isActive()
        ).thenReturn(true);

        when(
                task.getRequiredRole()
        ).thenReturn(
                ProcurementRole.APPROVER
        );

        when(
                task.getStatus()
        ).thenReturn(
                ApprovalTaskStatus.PENDING
        );

        when(
                task.getPurchaseRequest()
        ).thenReturn(
                request
        );

        when(
                request.getRequester()
        ).thenReturn(
                approver
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(approver)
        );

        when(
                approvalTaskRepository
                        .findById(taskId)
        ).thenReturn(
                Optional.of(task)
        );

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                approvalWorkflowService
                                        .approve(
                                                userId,
                                                taskId,
                                                new ApprovalDecisionInput(
                                                        "Approved"
                                                )
                                        )
                );

        assertEquals(
                "ProcureIQ does not allow self-approval of purchase requests.",
                exception.getMessage()
        );
    }
}
