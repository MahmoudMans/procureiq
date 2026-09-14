package com.procureiq.suppliercollaboration;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class SupplierCollaborationService {

    private final SupplierCollaborationRepository repository;

    private final SupplierCollaborationPolicyService policyService;

    private final AppUserRepository appUserRepository;

    public SupplierCollaborationService(
            SupplierCollaborationRepository repository,
            SupplierCollaborationPolicyService policyService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.policyService =
                policyService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public SupplierCollaborationDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<CollaborationWorkspaceListResponse> workspaces =
                repository
                        .findWorkspaces()
                        .stream()
                        .map(
                                this::workspaceListResponse
                        )
                        .toList();

        return new SupplierCollaborationDashboardResponse(
                summary(
                        workspaces
                ),
                workspaces,
                supplierMetrics(
                        workspaces
                )
        );
    }

    @Transactional(readOnly = true)
    public CollaborationWorkspaceDetailResponse workspace(
            UUID currentUserId,
            UUID workspaceId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        return detailResponse(
                workspace
        );
    }

    public CollaborationWorkspaceDetailResponse createWorkspace(
            UUID currentUserId,
            CollaborationWorkspaceInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SupplierCollaborationRepository.SupplierRow supplier =
                repository
                        .findSupplier(
                                input.supplierId()
                        );

        if (supplier == null) {
            throw new ResourceNotFoundException(
                    "Supplier not found: "
                            + input.supplierId()
            );
        }

        if (
                input.purchaseOrderId()
                        != null
        ) {
            UUID purchaseOrderSupplierId =
                    repository
                            .findPurchaseOrderSupplierId(
                                    input.purchaseOrderId()
                            );

            if (purchaseOrderSupplierId == null) {
                throw new ResourceNotFoundException(
                        "Purchase order not found: "
                                + input.purchaseOrderId()
                );
            }

            if (
                    !purchaseOrderSupplierId.equals(
                            input.supplierId()
                    )
            ) {
                throw new IllegalArgumentException(
                        "Selected purchase order belongs to a different supplier."
                );
            }
        }

        if (
                input.rfqId()
                        != null
                &&
                !repository
                        .rfqExists(
                                input.rfqId()
                        )
        ) {
            throw new ResourceNotFoundException(
                    "RFQ not found: "
                            + input.rfqId()
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireCollaborationUser(
                                input.ownerUserId()
                        )
                                .getId();

        int slaHours =
                input.supplierResponseSlaHours()
                        == null
                        ? policyService
                                .defaultSupplierResponseSlaHours(
                                        input.workspaceType(),
                                        input.priority()
                                )
                        : input.supplierResponseSlaHours();

        UUID workspaceId =
                UUID.randomUUID();

        repository.createWorkspace(
                workspaceId,
                nextWorkspaceNumber(),
                input,
                ownerId,
                slaHours
        );

        return detailResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public CollaborationMessageResponse addInternalMessage(
            UUID currentUserId,
            UUID workspaceId,
            CollaborationMessageInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireActiveWorkspace(
                        workspaceId
                );

        UUID messageId =
                UUID.randomUUID();

        repository.createMessage(
                messageId,
                workspace.id(),
                input.messageType(),
                CollaborationMessageVisibility.INTERNAL_ONLY,
                CollaborationMessageDirection.INTERNAL,
                input.body(),
                input.referenceText(),
                currentUserId,
                null,
                null
        );

        repository.markInternalMessage(
                workspace.id()
        );

        return messageResponse(
                requireMessage(
                        messageId
                )
        );
    }

    public CollaborationMessageResponse sendSupplierMessage(
            UUID currentUserId,
            UUID workspaceId,
            CollaborationMessageInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireActiveWorkspace(
                        workspaceId
                );

        UUID messageId =
                UUID.randomUUID();

        repository.createMessage(
                messageId,
                workspace.id(),
                input.messageType(),
                CollaborationMessageVisibility.SUPPLIER_SHARED,
                CollaborationMessageDirection.TO_SUPPLIER,
                input.body(),
                input.referenceText(),
                currentUserId,
                null,
                null
        );

        repository.markWaitingSupplier(
                workspace.id(),
                Instant.now()
                        .plusSeconds(
                                workspace
                                        .supplierResponseSlaHours()
                                        * 3600L
                        )
        );

        return messageResponse(
                requireMessage(
                        messageId
                )
        );
    }

    public CollaborationMessageResponse recordSupplierResponse(
            UUID currentUserId,
            UUID workspaceId,
            SupplierResponseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireActiveWorkspace(
                        workspaceId
                );

        UUID respondsToMessageId =
                repository
                        .latestAwaitingSupplierMessage(
                                workspace.id()
                        );

        UUID messageId =
                UUID.randomUUID();

        repository.createMessage(
                messageId,
                workspace.id(),
                input.messageType(),
                CollaborationMessageVisibility.SUPPLIER_SHARED,
                CollaborationMessageDirection.FROM_SUPPLIER,
                input.body(),
                input.referenceText(),
                null,
                input.supplierContactName(),
                respondsToMessageId
        );

        repository.markSupplierResponded(
                workspace.id()
        );

        return messageResponse(
                requireMessage(
                        messageId
                )
        );
    }

    public CollaborationActionResponse createAction(
            UUID currentUserId,
            UUID workspaceId,
            CollaborationActionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireActiveWorkspace(
                        workspaceId
                );

        UUID assigneeUserId =
                null;

        String externalAssigneeLabel =
                null;

        if (
                input.audience()
                        == CollaborationActionAudience.INTERNAL
        ) {
            assigneeUserId =
                    input.assigneeUserId()
                            == null
                            ? currentUserId
                            : requireCollaborationUser(
                                    input.assigneeUserId()
                            )
                                    .getId();
        } else {
            externalAssigneeLabel =
                    input.externalAssigneeLabel()
                            == null
                            ||
                            input.externalAssigneeLabel()
                                    .isBlank()
                            ? workspace.supplierName()
                            : input.externalAssigneeLabel()
                                    .trim();
        }

        UUID actionId =
                UUID.randomUUID();

        repository.createAction(
                actionId,
                workspace.id(),
                input,
                assigneeUserId,
                externalAssigneeLabel
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public CollaborationActionResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != CollaborationActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open collaboration actions can be started."
            );
        }

        repository.startAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public CollaborationActionResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            CollaborationActionCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != CollaborationActionStatus.OPEN
                &&
                action.status()
                        != CollaborationActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active collaboration actions can be completed."
            );
        }

        repository.completeAction(
                actionId,
                input.note()
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public CollaborationActionResponse cancelAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        == CollaborationActionStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed collaboration actions cannot be cancelled."
            );
        }

        repository.cancelAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public CollaborationWorkspaceDetailResponse resolveWorkspace(
            UUID currentUserId,
            UUID workspaceId,
            CollaborationDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireActiveWorkspace(
                        workspaceId
                );

        repository.resolveWorkspace(
                workspace.id(),
                input.note()
        );

        return detailResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public CollaborationWorkspaceDetailResponse closeWorkspace(
            UUID currentUserId,
            UUID workspaceId,
            CollaborationDecisionInput input
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        == CollaborationWorkspaceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Collaboration workspace is already closed."
            );
        }

        repository.closeWorkspace(
                workspace.id(),
                input.note()
        );

        return detailResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    @Transactional(readOnly = true)
    public CollaborationContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new CollaborationContextResponse(
                repository.suppliers(),
                repository.users(),
                repository.purchaseOrders(),
                repository.rfqs()
        );
    }

    private CollaborationWorkspaceDetailResponse detailResponse(
            SupplierCollaborationRepository.WorkspaceRow row
    ) {
        return new CollaborationWorkspaceDetailResponse(
                workspaceListResponse(
                        row
                ),
                row.resolutionNote(),
                row.notes(),
                repository
                        .findMessages(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::messageResponse
                        )
                        .toList(),
                repository
                        .findActions(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList()
        );
    }

    private CollaborationWorkspaceListResponse workspaceListResponse(
            SupplierCollaborationRepository.WorkspaceRow row
    ) {
        boolean responseSlaBreached =
                row.status()
                                == CollaborationWorkspaceStatus.WAITING_SUPPLIER
                        &&
                        row.responseDueAt()
                                != null
                        &&
                        row.responseDueAt()
                                .isBefore(
                                        Instant.now()
                                );

        return new CollaborationWorkspaceListResponse(
                row.id(),
                row.workspaceNumber(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.workspaceType(),
                row.status(),
                row.priority(),
                row.title(),
                row.purchaseOrderId(),
                row.purchaseOrderNumber(),
                row.rfqId(),
                row.rfqNumber(),
                row.externalReference(),
                row.ownerUserId(),
                row.ownerName(),
                row.supplierResponseSlaHours(),
                row.responseDueAt(),
                responseSlaBreached,
                row.lastMessageAt(),
                row.openActions(),
                row.overdueActions(),
                row.supplierSharedMessages(),
                row.supplierResponseCount(),
                decimalNullable(
                        row.averageSupplierResponseHours()
                ),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CollaborationMessageResponse messageResponse(
            SupplierCollaborationRepository.MessageRow row
    ) {
        return new CollaborationMessageResponse(
                row.id(),
                row.workspaceId(),
                row.messageType(),
                row.visibility(),
                row.direction(),
                row.body(),
                row.referenceText(),
                row.authorUserId(),
                row.authorName(),
                row.supplierContactName(),
                row.respondsToMessageId(),
                row.createdAt()
        );
    }

    private CollaborationActionResponse actionResponse(
            SupplierCollaborationRepository.ActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == CollaborationActionStatus.OPEN
                        ||
                        row.status()
                                == CollaborationActionStatus.IN_PROGRESS
                )
                &&
                row.dueAt()
                        .isBefore(
                                Instant.now()
                        );

        return new CollaborationActionResponse(
                row.id(),
                row.workspaceId(),
                row.actionType(),
                row.audience(),
                row.title(),
                row.description(),
                row.assigneeUserId(),
                row.assigneeName(),
                row.externalAssigneeLabel(),
                row.dueAt(),
                row.status(),
                overdue,
                row.completionNote(),
                row.completedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CollaborationSummaryResponse summary(
            List<CollaborationWorkspaceListResponse> workspaces
    ) {
        List<CollaborationWorkspaceListResponse> active =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                != CollaborationWorkspaceStatus.RESOLVED
                                        &&
                                        workspace.status()
                                                != CollaborationWorkspaceStatus.CLOSED
                        )
                        .toList();

        long responseCount =
                workspaces.stream()
                        .mapToLong(
                                CollaborationWorkspaceListResponse::
                                        supplierResponseCount
                        )
                        .sum();

        BigDecimal weightedResponseHours =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.averageSupplierResponseHours()
                                                != null
                                        &&
                                        workspace.supplierResponseCount()
                                                > 0
                        )
                        .map(
                                workspace ->
                                        workspace
                                                .averageSupplierResponseHours()
                                                .multiply(
                                                        BigDecimal.valueOf(
                                                                workspace.supplierResponseCount()
                                                        )
                                                )
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal averageResponse =
                responseCount == 0
                        ? BigDecimal.ZERO
                        : weightedResponseHours
                                .divide(
                                        BigDecimal.valueOf(
                                                responseCount
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new CollaborationSummaryResponse(
                active.size(),
                active.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                == CollaborationWorkspaceStatus.WAITING_SUPPLIER
                        )
                        .count(),
                active.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                == CollaborationWorkspaceStatus.WAITING_INTERNAL
                        )
                        .count(),
                active.stream()
                        .filter(
                                CollaborationWorkspaceListResponse::
                                        responseSlaBreached
                        )
                        .count(),
                active.stream()
                        .mapToLong(
                                CollaborationWorkspaceListResponse::
                                        openActions
                        )
                        .sum(),
                active.stream()
                        .mapToLong(
                                CollaborationWorkspaceListResponse::
                                        overdueActions
                        )
                        .sum(),
                workspaces.stream()
                        .mapToLong(
                                CollaborationWorkspaceListResponse::
                                        supplierSharedMessages
                        )
                        .sum(),
                responseCount,
                averageResponse
        );
    }

    private List<SupplierCollaborationMetricResponse> supplierMetrics(
            List<CollaborationWorkspaceListResponse> workspaces
    ) {
        Map<
                UUID,
                List<CollaborationWorkspaceListResponse>
        > grouped =
                new LinkedHashMap<>();

        for (
                CollaborationWorkspaceListResponse workspace
                : workspaces
        ) {
            grouped.computeIfAbsent(
                    workspace.supplierId(),
                    ignored ->
                            new ArrayList<>()
            )
                    .add(
                            workspace
                    );
        }

        return grouped
                .values()
                .stream()
                .map(
                        supplierWorkspaces -> {
                            CollaborationWorkspaceListResponse first =
                                    supplierWorkspaces.get(
                                            0
                                    );

                            List<CollaborationWorkspaceListResponse> active =
                                    supplierWorkspaces.stream()
                                            .filter(
                                                    workspace ->
                                                            workspace.status()
                                                                    != CollaborationWorkspaceStatus.RESOLVED
                                                            &&
                                                            workspace.status()
                                                                    != CollaborationWorkspaceStatus.CLOSED
                                            )
                                            .toList();

                            long responseCount =
                                    supplierWorkspaces.stream()
                                            .mapToLong(
                                                    CollaborationWorkspaceListResponse::
                                                            supplierResponseCount
                                            )
                                            .sum();

                            BigDecimal weighted =
                                    supplierWorkspaces.stream()
                                            .filter(
                                                    workspace ->
                                                            workspace.averageSupplierResponseHours()
                                                                    != null
                                                            &&
                                                            workspace.supplierResponseCount()
                                                                    > 0
                                            )
                                            .map(
                                                    workspace ->
                                                            workspace
                                                                    .averageSupplierResponseHours()
                                                                    .multiply(
                                                                            BigDecimal.valueOf(
                                                                                    workspace.supplierResponseCount()
                                                                            )
                                                                    )
                                            )
                                            .reduce(
                                                    BigDecimal.ZERO,
                                                    BigDecimal::add
                                            );

                            BigDecimal average =
                                    responseCount == 0
                                            ? BigDecimal.ZERO
                                            : weighted.divide(
                                                    BigDecimal.valueOf(
                                                            responseCount
                                                    ),
                                                    2,
                                                    RoundingMode.HALF_UP
                                            );

                            return new SupplierCollaborationMetricResponse(
                                    first.supplierId(),
                                    first.supplierCode(),
                                    first.supplierName(),
                                    active.size(),
                                    active.stream()
                                            .filter(
                                                    workspace ->
                                                            workspace.status()
                                                                    == CollaborationWorkspaceStatus.WAITING_SUPPLIER
                                            )
                                            .count(),
                                    active.stream()
                                            .filter(
                                                    CollaborationWorkspaceListResponse::
                                                            responseSlaBreached
                                            )
                                            .count(),
                                    active.stream()
                                            .mapToLong(
                                                    CollaborationWorkspaceListResponse::
                                                            openActions
                                            )
                                            .sum(),
                                    active.stream()
                                            .mapToLong(
                                                    CollaborationWorkspaceListResponse::
                                                            overdueActions
                                            )
                                            .sum(),
                                    responseCount,
                                    average
                            );
                        }
                )
                .sorted(
                        Comparator
                                .comparingLong(
                                        SupplierCollaborationMetricResponse::
                                                responseSlaBreaches
                                )
                                .thenComparingLong(
                                        SupplierCollaborationMetricResponse::
                                                overdueActions
                                )
                                .reversed()
                )
                .toList();
    }

    private SupplierCollaborationRepository.WorkspaceRow requireWorkspace(
            UUID workspaceId
    ) {
        SupplierCollaborationRepository.WorkspaceRow workspace =
                repository
                        .findWorkspace(
                                workspaceId
                        );

        if (workspace == null) {
            throw new ResourceNotFoundException(
                    "Supplier collaboration workspace not found: "
                            + workspaceId
            );
        }

        return workspace;
    }

    private SupplierCollaborationRepository.WorkspaceRow requireActiveWorkspace(
            UUID workspaceId
    ) {
        SupplierCollaborationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        == CollaborationWorkspaceStatus.RESOLVED
                ||
                workspace.status()
                        == CollaborationWorkspaceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Resolved or closed collaboration workspaces cannot receive new operational activity."
            );
        }

        return workspace;
    }

    private SupplierCollaborationRepository.MessageRow requireMessage(
            UUID messageId
    ) {
        SupplierCollaborationRepository.MessageRow message =
                repository
                        .findMessage(
                                messageId
                        );

        if (message == null) {
            throw new ResourceNotFoundException(
                    "Supplier collaboration message not found: "
                            + messageId
            );
        }

        return message;
    }

    private SupplierCollaborationRepository.ActionRow requireAction(
            UUID actionId
    ) {
        SupplierCollaborationRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Supplier collaboration action not found: "
                            + actionId
            );
        }

        return action;
    }

    private String nextWorkspaceNumber() {
        Long sequence =
                repository
                        .nextWorkspaceSequence();

        return String.format(
                "COLLAB-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private BigDecimal decimalNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
                        )
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

    private AppUserEntity requireCollaborationUser(
            UUID userId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        userId
                );

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Supplier collaboration ownership requires a procurement governance role."
            );
        }

        return user;
    }

    private void assertReadRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access supplier collaboration."
            );
        }
    }

    private void assertWriteRole(
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
                    "Your ProcureIQ role cannot manage supplier collaboration."
            );
        }
    }

    private void assertCloseRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can close supplier collaboration workspaces or cancel governed actions."
            );
        }
    }
}
