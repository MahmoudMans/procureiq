package com.procureiq.supplierportal;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class SupplierPortalAdminService {

    private final SupplierPortalRepository repository;

    private final SupplierPortalSecurityService securityService;

    private final AppUserRepository appUserRepository;

    public SupplierPortalAdminService(
            SupplierPortalRepository repository,
            SupplierPortalSecurityService securityService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.securityService =
                securityService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierPortalAccountResponse> accounts(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .accounts()
                .stream()
                .map(
                        this::accountResponse
                )
                .toList();
    }

    public SupplierPortalInvitationResponse invite(
            UUID currentUserId,
            SupplierPortalInviteInput input
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierPortalRepository.SupplierRow supplier =
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
                repository
                        .findAccountByEmail(
                                normalizeEmail(
                                        input.email()
                                )
                        )
                        != null
        ) {
            throw new IllegalArgumentException(
                    "A supplier portal account already exists for this email address."
            );
        }

        String rawToken =
                securityService
                        .newOpaqueToken();

        String tokenHash =
                securityService
                        .hashToken(
                                rawToken
                        );

        Instant expiresAt =
                securityService
                        .invitationExpiresAt();

        UUID accountId =
                UUID.randomUUID();

        repository.createInvitation(
                accountId,
                new SupplierPortalInviteInput(
                        input.supplierId(),
                        normalizeEmail(
                                input.email()
                        ),
                        input.displayName()
                                .trim()
                ),
                tokenHash,
                expiresAt,
                currentUserId
        );

        repository.writeAudit(
                accountId,
                input.supplierId(),
                "INVITATION_CREATED",
                "Supplier portal invitation created for "
                        + normalizeEmail(
                                input.email()
                        )
        );

        SupplierPortalRepository.AccountRow account =
                requireAccount(
                        accountId
                );

        return new SupplierPortalInvitationResponse(
                accountResponse(
                        account
                ),
                rawToken,
                expiresAt
        );
    }

    public SupplierPortalAccountResponse suspend(
            UUID currentUserId,
            UUID accountId
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierPortalRepository.AccountRow account =
                requireAccount(
                        accountId
                );

        if (
                account.status()
                        != SupplierPortalAccountStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active supplier portal accounts can be suspended."
            );
        }

        repository.suspendAccount(
                accountId
        );

        repository.revokeSessionsForAccount(
                accountId
        );

        repository.writeAudit(
                account.id(),
                account.supplierId(),
                "ACCOUNT_SUSPENDED",
                "Supplier portal account suspended by internal governance."
        );

        return accountResponse(
                requireAccount(
                        accountId
                )
        );
    }

    public SupplierPortalAccountResponse reinstate(
            UUID currentUserId,
            UUID accountId
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierPortalRepository.AccountRow account =
                requireAccount(
                        accountId
                );

        if (
                account.status()
                        != SupplierPortalAccountStatus.SUSPENDED
        ) {
            throw new IllegalArgumentException(
                    "Only suspended supplier portal accounts can be reinstated."
            );
        }

        repository.reinstateAccount(
                accountId
        );

        repository.writeAudit(
                account.id(),
                account.supplierId(),
                "ACCOUNT_REINSTATED",
                "Supplier portal account reinstated by internal governance."
        );

        return accountResponse(
                requireAccount(
                        accountId
                )
        );
    }

    public SupplierPortalAccountResponse revoke(
            UUID currentUserId,
            UUID accountId
    ) {
        assertAdminRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierPortalRepository.AccountRow account =
                requireAccount(
                        accountId
                );

        if (
                account.status()
                        == SupplierPortalAccountStatus.REVOKED
        ) {
            throw new IllegalArgumentException(
                    "Supplier portal account is already revoked."
            );
        }

        repository.revokeAccount(
                accountId
        );

        repository.revokeSessionsForAccount(
                accountId
        );

        repository.writeAudit(
                account.id(),
                account.supplierId(),
                "ACCOUNT_REVOKED",
                "Supplier portal account permanently revoked."
        );

        return accountResponse(
                requireAccount(
                        accountId
                )
        );
    }

    private SupplierPortalAccountResponse accountResponse(
            SupplierPortalRepository.AccountRow row
    ) {
        return new SupplierPortalAccountResponse(
                row.id(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.email(),
                row.displayName(),
                row.status(),
                row.invitationExpiresAt(),
                row.activatedAt(),
                row.lastLoginAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
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
                    "Supplier portal account not found: "
                            + accountId
            );
        }

        return account;
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

    private void assertReadRole(
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
                    "Your ProcureIQ role cannot access supplier portal administration."
            );
        }
    }

    private void assertAdminRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can administer external supplier portal accounts."
            );
        }
    }
}
