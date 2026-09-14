package com.procureiq.negotiation;

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
@RequestMapping("/api/v1/negotiations")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class NegotiationController {

    private final NegotiationService service;

    public NegotiationController(
            NegotiationService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<NegotiationWorkspaceResponse> workspaces(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.workspaces(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/{workspaceId}")
    public NegotiationWorkspaceResponse workspace(
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

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public NegotiationWorkspaceResponse createWorkspace(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            NegotiationWorkspaceInput input
    ) {
        return service.createWorkspace(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/{workspaceId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public NegotiationWorkspaceResponse activate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId
    ) {
        return service.activate(
                currentUserId(
                        jwt
                ),
                workspaceId
        );
    }

    @PostMapping("/{workspaceId}/scenarios")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public NegotiationScenarioResponse addScenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            NegotiationScenarioInput input
    ) {
        return service.addScenario(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/{workspaceId}/rounds")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public NegotiationRoundResponse addRound(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @Valid
            @RequestBody
            NegotiationRoundInput input
    ) {
        return service.addRound(
                currentUserId(
                        jwt
                ),
                workspaceId,
                input
        );
    }

    @PostMapping("/{workspaceId}/agree/{scenarioId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public NegotiationWorkspaceResponse agreeScenario(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId,

            @PathVariable
            UUID scenarioId
    ) {
        return service.agreeScenario(
                currentUserId(
                        jwt
                ),
                workspaceId,
                scenarioId
        );
    }

    @PostMapping("/{workspaceId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public NegotiationWorkspaceResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                workspaceId
        );
    }

    @PostMapping("/{workspaceId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public NegotiationWorkspaceResponse cancel(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID workspaceId
    ) {
        return service.cancel(
                currentUserId(
                        jwt
                ),
                workspaceId
        );
    }

    @GetMapping("/summary")
    public NegotiationSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.summary(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/context-options")
    public NegotiationContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
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
