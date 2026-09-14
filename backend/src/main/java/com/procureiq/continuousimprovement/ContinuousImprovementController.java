package com.procureiq.continuousimprovement;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/continuous-improvement")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ContinuousImprovementController {

    private final ContinuousImprovementService service;

    public ContinuousImprovementController(
            ContinuousImprovementService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ContinuousImprovementDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public ImprovementContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            UUID snapshotId
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                ),
                currency,
                snapshotId
        );
    }

    @GetMapping("/initiatives/{initiativeId}")
    public ImprovementInitiativeDetailResponse initiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.initiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ImprovementInitiativeDetailResponse createInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ImprovementInitiativeInput input
    ) {
        return service.createInitiative(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ImprovementInitiativeSummaryResponse startInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.startInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/hold")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ImprovementInitiativeSummaryResponse holdInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.holdInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/resume")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ImprovementInitiativeSummaryResponse resumeInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.resumeInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ImprovementInitiativeSummaryResponse completeInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.completeInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ImprovementInitiativeSummaryResponse cancelInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            ImprovementNoteInput input
    ) {
        return service.cancelInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId,
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ImprovementActionResponse createAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            ImprovementActionInput input
    ) {
        return service.createAction(
                currentUserId(
                        jwt
                ),
                initiativeId,
                input
        );
    }

    @PostMapping("/actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ImprovementActionResponse startAction(
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
    public ImprovementActionResponse completeAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            ImprovementNoteInput input
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
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ImprovementActionResponse cancelAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            ImprovementNoteInput input
    ) {
        return service.cancelAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/checkpoints")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ImprovementCheckpointResponse createCheckpoint(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            ImprovementCheckpointInput input
    ) {
        return service.createCheckpoint(
                currentUserId(
                        jwt
                ),
                initiativeId,
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
