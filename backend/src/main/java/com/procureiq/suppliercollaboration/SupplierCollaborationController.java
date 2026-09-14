package com.procureiq.suppliercollaboration;

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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-collaboration")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class SupplierCollaborationController {

    private final SupplierCollaborationService service;

    public SupplierCollaborationController(
            SupplierCollaborationService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public SupplierCollaborationDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/context-options")
    public CollaborationContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/workspaces/{workspaceId}")
    public CollaborationWorkspaceDetailResponse workspace(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId
    ) {
        return service.workspace(
                currentUserId(
                        jwt
                ),
                workspaceId
        );
    }

    @PostMapping("/workspaces")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CollaborationWorkspaceDetailResponse createWorkspace(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CollaborationWorkspaceInput input
    ) {
        return service.createWorkspace(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/workspaces/{workspaceId}/messages/internal")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationMessageResponse addInternalMessage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            CollaborationMessageInput input
    ) {
        return service.addInternalMessage(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/workspaces/{workspaceId}/messages/to-supplier")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationMessageResponse sendSupplierMessage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            CollaborationMessageInput input
    ) {
        return service.sendSupplierMessage(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/workspaces/{workspaceId}/messages/from-supplier")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationMessageResponse recordSupplierResponse(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            SupplierResponseInput input
    ) {
        return service.recordSupplierResponse(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/workspaces/{workspaceId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CollaborationActionResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            CollaborationActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationActionResponse startAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.startAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/actions/{actionId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationActionResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            CollaborationActionCompletionInput input
    ) {
        return service.completeAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CollaborationActionResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/workspaces/{workspaceId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CollaborationWorkspaceDetailResponse resolveWorkspace(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            CollaborationDecisionInput input
    ) {
        return service.resolveWorkspace(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/workspaces/{workspaceId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CollaborationWorkspaceDetailResponse closeWorkspace(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            CollaborationDecisionInput input
    ) {
        return service.closeWorkspace(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
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
