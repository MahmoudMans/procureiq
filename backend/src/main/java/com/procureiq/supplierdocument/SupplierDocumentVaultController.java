package com.procureiq.supplierdocument;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-document-vault")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierDocumentVaultController {

    private final SupplierDocumentVaultService service;

    public SupplierDocumentVaultController(
            SupplierDocumentVaultService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public SupplierDocumentVaultDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/requirements")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public SupplierDocumentRequirementResponse createRequirement(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            SupplierDocumentRequirementInput input
    ) {
        return service.createRequirement(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PutMapping("/requirements/{requirementId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public SupplierDocumentRequirementResponse updateRequirement(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID requirementId,

            @Valid
            @RequestBody
            SupplierDocumentRequirementUpdateInput input
    ) {
        return service.updateRequirement(
                currentUserId(
                        jwt
                ),
                requirementId,
                input
        );
    }

    @PostMapping("/versions/{versionId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierDocumentVersionResponse approveVersion(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID versionId,

            @Valid
            @RequestBody
            SupplierDocumentReviewInput input
    ) {
        return service.approveVersion(
                currentUserId(
                        jwt
                ),
                versionId,
                input
        );
    }

    @PostMapping("/versions/{versionId}/reject")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierDocumentVersionResponse rejectVersion(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID versionId,

            @Valid
            @RequestBody
            SupplierDocumentReviewInput input
    ) {
        return service.rejectVersion(
                currentUserId(
                        jwt
                ),
                versionId,
                input
        );
    }

    @GetMapping("/versions/{versionId}/content")
    public SupplierDocumentContentResponse content(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID versionId
    ) {
        return service.content(
                currentUserId(
                        jwt
                ),
                versionId
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
