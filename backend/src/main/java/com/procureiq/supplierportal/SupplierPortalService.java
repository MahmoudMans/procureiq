package com.procureiq.supplierportal;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.suppliercollaboration.CollaborationActionStatus;
import com.procureiq.suppliercollaboration.CollaborationMessageDirection;
import com.procureiq.suppliercollaboration.CollaborationMessageType;
import com.procureiq.suppliercollaboration.CollaborationWorkspaceStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class SupplierPortalService {

    private final SupplierPortalRepository repository;

    private final SupplierPortalSecurityService securityService;

    public SupplierPortalService(
            SupplierPortalRepository repository,
            SupplierPortalSecurityService securityService
    ) {
        this.repository =
                repository;

        this.securityService =
                securityService;
    }

    public SupplierPortalProfileResponse activate(
            SupplierPortalActivateInput input
    ) {
        String tokenHash =
                securityService
                        .hashToken(
                                input.invitationToken()
                        );

        SupplierPortalRepository.AccountRow account =
                repository
                        .findInvitedAccountByTokenHash(
                                tokenHash
                        );

        if (account == null) {
            throw new IllegalArgumentException(
                    "Supplier portal invitation is invalid or expired."
            );
        }

        String passwordHash =
                securityService
                        .hashPassword(
                                input.password()
                        );

        repository.activateAccount(
                account.id(),
                passwordHash
        );

        repository.writeAudit(
                account.id(),
                account.supplierId(),
                "ACCOUNT_ACTIVATED",
                "Supplier portal account activated."
        );

        return profile(
                requireAccount(
                        account.id()
                )
        );
    }

    public SupplierPortalAuthResponse login(
            SupplierPortalLoginInput input
    ) {
        SupplierPortalRepository.AccountRow account =
                repository
                        .findAccountByEmail(
                                normalizeEmail(
                                        input.email()
                                )
                        );

        if (
                account == null
                ||
                account.status()
                        != SupplierPortalAccountStatus.ACTIVE
                ||
                account.passwordHash()
                        == null
                ||
                !securityService
                        .matchesPassword(
                                input.password(),
                                account.passwordHash()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Invalid supplier portal credentials."
            );
        }

        String rawSessionToken =
                securityService
                        .newOpaqueToken();

        String sessionTokenHash =
                securityService
                        .hashToken(
                                rawSessionToken
                        );

        Instant expiresAt =
                securityService
                        .sessionExpiresAt();

        repository.createSession(
                UUID.randomUUID(),
                account.id(),
                sessionTokenHash,
                expiresAt
        );

        repository.updateLastLogin(
                account.id()
        );

        repository.writeAudit(
                account.id(),
                account.supplierId(),
                "LOGIN_SUCCEEDED",
                "Supplier portal login succeeded."
        );

        return new SupplierPortalAuthResponse(
                rawSessionToken,
                expiresAt,
                profile(
                        account
                )
        );
    }

    public void logout(
            String rawSessionToken
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        repository.revokeSession(
                session.id()
        );

        repository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "LOGOUT",
                "Supplier portal session logged out."
        );
    }

    @Transactional(readOnly = true)
    public SupplierPortalProfileResponse me(
            String rawSessionToken
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        return profile(
                session
        );
    }

    public SupplierPortalDashboardResponse dashboard(
            String rawSessionToken
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        repository.touchSession(
                session.id()
        );

        List<SupplierPortalWorkspaceResponse> workspaces =
                repository
                        .workspacesForSupplier(
                                session.supplierId()
                        )
                        .stream()
                        .map(
                                this::workspaceResponse
                        )
                        .toList();

        List<SupplierPortalWorkspaceResponse> active =
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

        return new SupplierPortalDashboardResponse(
                profile(
                        session
                ),
                new SupplierPortalSummaryResponse(
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
                                        SupplierPortalWorkspaceResponse::
                                                responseSlaBreached
                                )
                                .count(),
                        active.stream()
                                .mapToLong(
                                        SupplierPortalWorkspaceResponse::
                                                openSupplierActions
                                )
                                .sum(),
                        active.stream()
                                .mapToLong(
                                        SupplierPortalWorkspaceResponse::
                                                overdueSupplierActions
                                )
                                .sum()
                ),
                workspaces
        );
    }

    public SupplierPortalWorkspaceDetailResponse workspace(
            String rawSessionToken,
            UUID workspaceId
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        SupplierPortalRepository.PortalWorkspaceRow workspace =
                requireSupplierWorkspace(
                        session.supplierId(),
                        workspaceId
                );

        repository.touchSession(
                session.id()
        );

        repository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "WORKSPACE_VIEWED",
                "Supplier portal workspace viewed: "
                        + workspace.workspaceNumber()
        );

        return workspaceDetail(
                session.supplierId(),
                workspace
        );
    }

    public SupplierPortalWorkspaceDetailResponse respond(
            String rawSessionToken,
            UUID workspaceId,
            SupplierPortalResponseInput input
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        SupplierPortalRepository.PortalWorkspaceRow workspace =
                requireSupplierWorkspace(
                        session.supplierId(),
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
                    "Supplier responses cannot be added to a resolved or closed collaboration workspace."
            );
        }

        UUID respondsTo =
                repository
                        .latestAwaitingSupplierMessage(
                                session.supplierId(),
                                workspace.id()
                        );

        repository.recordSupplierResponse(
                UUID.randomUUID(),
                workspace.id(),
                input.messageType(),
                input.body(),
                input.referenceText(),
                session.displayName(),
                respondsTo
        );

        repository.touchSession(
                session.id()
        );

        repository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "SUPPLIER_RESPONSE_RECORDED",
                "Supplier response recorded in workspace "
                        + workspace.workspaceNumber()
        );

        return workspaceDetail(
                session.supplierId(),
                requireSupplierWorkspace(
                        session.supplierId(),
                        workspaceId
                )
        );
    }

    public SupplierPortalWorkspaceDetailResponse completeAction(
            String rawSessionToken,
            UUID actionId,
            SupplierPortalActionCompletionInput input
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        SupplierPortalRepository.PortalActionScopeRow action =
                repository
                        .findSupplierAction(
                                session.supplierId(),
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Supplier portal action not found."
            );
        }

        if (
                action.workspaceStatus()
                        == CollaborationWorkspaceStatus.RESOLVED
                ||
                action.workspaceStatus()
                        == CollaborationWorkspaceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Actions cannot be completed in a resolved or closed workspace."
            );
        }

        if (
                action.status()
                        != CollaborationActionStatus.OPEN
                &&
                action.status()
                        != CollaborationActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Supplier action is no longer active."
            );
        }

        repository.completeSupplierAction(
                action.id(),
                input.note()
        );

        UUID respondsTo =
                repository
                        .latestAwaitingSupplierMessage(
                                session.supplierId(),
                                action.workspaceId()
                        );

        repository.recordSupplierResponse(
                UUID.randomUUID(),
                action.workspaceId(),
                messageTypeForAction(
                        action.actionType()
                ),
                input.note(),
                input.referenceText(),
                session.displayName(),
                respondsTo
        );

        repository.touchSession(
                session.id()
        );

        repository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "SUPPLIER_ACTION_COMPLETED",
                "Supplier completed collaboration action "
                        + action.id()
        );

        return workspaceDetail(
                session.supplierId(),
                requireSupplierWorkspace(
                        session.supplierId(),
                        action.workspaceId()
                )
        );
    }

    private SupplierPortalWorkspaceDetailResponse workspaceDetail(
            UUID supplierId,
            SupplierPortalRepository.PortalWorkspaceRow workspace
    ) {
        return new SupplierPortalWorkspaceDetailResponse(
                workspaceResponse(
                        workspace
                ),
                repository
                        .sharedMessages(
                                supplierId,
                                workspace.id()
                        )
                        .stream()
                        .map(
                                this::messageResponse
                        )
                        .toList(),
                repository
                        .supplierActions(
                                supplierId,
                                workspace.id()
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList()
        );
    }

    private SupplierPortalWorkspaceResponse workspaceResponse(
            SupplierPortalRepository.PortalWorkspaceRow row
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

        return new SupplierPortalWorkspaceResponse(
                row.id(),
                row.workspaceNumber(),
                row.workspaceType(),
                row.status(),
                row.priority(),
                row.title(),
                row.purchaseOrderNumber(),
                row.rfqNumber(),
                row.externalReference(),
                row.supplierResponseSlaHours(),
                row.responseDueAt(),
                responseSlaBreached,
                row.openSupplierActions(),
                row.overdueSupplierActions(),
                row.lastMessageAt(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    private SupplierPortalMessageResponse messageResponse(
            SupplierPortalRepository.PortalMessageRow row
    ) {
        return new SupplierPortalMessageResponse(
                row.id(),
                row.messageType(),
                row.direction(),
                row.body(),
                row.referenceText(),
                row.senderName(),
                row.respondsToMessageId(),
                row.createdAt()
        );
    }

    private SupplierPortalActionResponse actionResponse(
            SupplierPortalRepository.PortalActionRow row
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

        return new SupplierPortalActionResponse(
                row.id(),
                row.actionType(),
                row.title(),
                row.description(),
                row.assigneeLabel(),
                row.dueAt(),
                row.status(),
                overdue,
                row.completionNote(),
                row.completedAt()
        );
    }

    private CollaborationMessageType messageTypeForAction(
            com.procureiq.suppliercollaboration.CollaborationActionType actionType
    ) {
        return switch (
                actionType
        ) {
            case ACKNOWLEDGE_PO ->
                    CollaborationMessageType.STATUS_UPDATE;

            case CONFIRM_DELIVERY ->
                    CollaborationMessageType.DELIVERY_UPDATE;

            case PROVIDE_DOCUMENT ->
                    CollaborationMessageType.DOCUMENT_REQUEST;

            case ANSWER_CLARIFICATION ->
                    CollaborationMessageType.CLARIFICATION;

            case RESOLVE_ISSUE ->
                    CollaborationMessageType.ISSUE;

            case OTHER ->
                    CollaborationMessageType.COMMENT;
        };
    }

    private SupplierPortalRepository.SessionRow requireSession(
            String rawSessionToken
    ) {
        String tokenHash =
                securityService
                        .hashToken(
                                rawSessionToken
                        );

        SupplierPortalRepository.SessionRow session =
                repository
                        .findActiveSession(
                                tokenHash
                        );

        if (session == null) {
            throw new IllegalArgumentException(
                    "Supplier portal session is invalid or expired."
            );
        }

        return session;
    }

    private SupplierPortalRepository.AccountRow requireAccount(
            UUID accountId
    ) {
        SupplierPortalRepository.AccountRow account =
                repository
                        .findAccount(
                                accountId
                        );

        if (account == null) {
            throw new ResourceNotFoundException(
                    "Supplier portal account not found."
            );
        }

        return account;
    }

    private SupplierPortalRepository.PortalWorkspaceRow requireSupplierWorkspace(
            UUID supplierId,
            UUID workspaceId
    ) {
        SupplierPortalRepository.PortalWorkspaceRow workspace =
                repository
                        .findSupplierWorkspace(
                                supplierId,
                                workspaceId
                        );

        if (workspace == null) {
            throw new ResourceNotFoundException(
                    "Supplier collaboration workspace is unavailable for this supplier account."
            );
        }

        return workspace;
    }

    private SupplierPortalProfileResponse profile(
            SupplierPortalRepository.AccountRow account
    ) {
        return new SupplierPortalProfileResponse(
                account.id(),
                account.supplierId(),
                account.supplierCode(),
                account.supplierName(),
                account.email(),
                account.displayName()
        );
    }

    private SupplierPortalProfileResponse profile(
            SupplierPortalRepository.SessionRow session
    ) {
        return new SupplierPortalProfileResponse(
                session.accountId(),
                session.supplierId(),
                session.supplierCode(),
                session.supplierName(),
                session.email(),
                session.displayName()
        );
    }

    private String normalizeEmail(
            String email
    ) {
        return email
                .trim()
                .toLowerCase(
                        Locale.ROOT
                );
    }
}
