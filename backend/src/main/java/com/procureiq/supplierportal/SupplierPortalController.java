package com.procureiq.supplierportal;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-portal")
public class SupplierPortalController {

    private final SupplierPortalService service;

    public SupplierPortalController(
            SupplierPortalService service
    ) {
        this.service =
                service;
    }

    @PostMapping("/activate")
    public SupplierPortalProfileResponse activate(
            @Valid
            @RequestBody
            SupplierPortalActivateInput input
    ) {
        return service.activate(
                input
        );
    }

    @PostMapping("/login")
    public SupplierPortalAuthResponse login(
            @Valid
            @RequestBody
            SupplierPortalLoginInput input
    ) {
        return service.login(
                input
        );
    }

    @PostMapping("/logout")
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void logout(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        service.logout(
                bearerToken(
                        authorization
                )
        );
    }

    @GetMapping("/me")
    public SupplierPortalProfileResponse me(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.me(
                bearerToken(
                        authorization
                )
        );
    }

    @GetMapping("/dashboard")
    public SupplierPortalDashboardResponse dashboard(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.dashboard(
                bearerToken(
                        authorization
                )
        );
    }

    @GetMapping("/workspaces/{workspaceId}")
    public SupplierPortalWorkspaceDetailResponse workspace(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID workspaceId
    ) {
        return service.workspace(
                bearerToken(
                        authorization
                ),
                workspaceId
        );
    }

    @PostMapping("/workspaces/{workspaceId}/responses")
    public SupplierPortalWorkspaceDetailResponse respond(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            SupplierPortalResponseInput input
    ) {
        return service.respond(
                bearerToken(
                        authorization
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/complete")
    public SupplierPortalWorkspaceDetailResponse completeAction(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            SupplierPortalActionCompletionInput input
    ) {
        return service.completeAction(
                bearerToken(
                        authorization
                ),
                actionId,
                input
        );
    }

    private String bearerToken(
            String authorization
    ) {
        if (
                authorization == null
                ||
                !authorization.startsWith(
                        "Bearer "
                )
        ) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        String token =
                authorization
                        .substring(
                                7
                        )
                        .trim();

        if (token.isEmpty()) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        return token;
    }
}
