package com.procureiq.supplierportal;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-portal-admin")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
)
public class SupplierPortalAdminController {

    private final SupplierPortalAdminService service;

    public SupplierPortalAdminController(
            SupplierPortalAdminService service
    ) {
        this.service =
                service;
    }

    @GetMapping("/accounts")
    public List<SupplierPortalAccountResponse> accounts(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.accounts(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/invitations")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SupplierPortalInvitationResponse invite(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SupplierPortalInviteInput input
    ) {
        return service.invite(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/accounts/{accountId}/suspend")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierPortalAccountResponse suspend(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID accountId
    ) {
        return service.suspend(
                currentUserId(
                        jwt
                ),
                accountId
        );
    }

    @PostMapping("/accounts/{accountId}/reinstate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierPortalAccountResponse reinstate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID accountId
    ) {
        return service.reinstate(
                currentUserId(
                        jwt
                ),
                accountId
        );
    }

    @PostMapping("/accounts/{accountId}/revoke")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierPortalAccountResponse revoke(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID accountId
    ) {
        return service.revoke(
                currentUserId(
                        jwt
                ),
                accountId
        );
    }

    private UUID currentUserId(
            Jwt jwt
    ) {
        try {
            return UUID.fromString(
                    jwt.getSubject()
            );
        } catch (
                IllegalArgumentException exception
        ) {
            throw new IllegalArgumentException(
                    "Invalid authenticated ProcureIQ identity."
            );
        }
    }
}
