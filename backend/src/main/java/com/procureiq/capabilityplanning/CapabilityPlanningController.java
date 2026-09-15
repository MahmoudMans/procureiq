package com.procureiq.capabilityplanning;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/capability-planning")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CapabilityPlanningController {

    private final CapabilityPlanningService service;

    public CapabilityPlanningController(
            CapabilityPlanningService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CapabilityPlanningDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @PostMapping("/skills")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapabilitySkillResponse createSkill(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CapabilitySkillInput input
    ) {
        return service.createSkill(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PutMapping("/users/{userId}/skills/{skillId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public UserCapabilityResponse assessCapability(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID userId,

            @PathVariable
            UUID skillId,

            @Valid
            @RequestBody
            UserCapabilityInput input
    ) {
        return service.assessCapability(
                currentUserId(
                        jwt
                ),
                userId,
                skillId,
                input
        );
    }

    @GetMapping("/work/{sourceType}/{sourceEntityId}")
    public CapabilityWorkItemResponse workItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            CapabilitySourceType sourceType,

            @PathVariable
            UUID sourceEntityId,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.workItem(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear,
                sourceType,
                sourceEntityId
        );
    }

    @PostMapping("/work/{sourceType}/{sourceEntityId}/requirements")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapabilityWorkItemResponse createRequirement(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            CapabilitySourceType sourceType,

            @PathVariable
            UUID sourceEntityId,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear,

            @Valid
            @RequestBody
            WorkCapabilityRequirementInput input
    ) {
        return service.createRequirement(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear,
                sourceType,
                sourceEntityId,
                input
        );
    }

    @DeleteMapping("/requirements/{requirementId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void deleteRequirement(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID requirementId
    ) {
        service.deleteRequirement(
                currentUserId(
                        jwt
                ),
                requirementId
        );
    }

    @PostMapping("/development-actions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapabilityDevelopmentActionResponse createDevelopmentAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear,

            @Valid
            @RequestBody
            CapabilityDevelopmentActionInput input
    ) {
        return service.createDevelopmentAction(
                currentUserId(
                        jwt
                ),
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear,
                input
        );
    }

    @PostMapping("/development-actions/{actionId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapabilityDevelopmentActionResponse startDevelopmentAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId
    ) {
        return service.startDevelopmentAction(
                currentUserId(
                        jwt
                ),
                actionId
        );
    }

    @PostMapping("/development-actions/{actionId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapabilityDevelopmentActionResponse completeDevelopmentAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            CapabilityNoteInput input
    ) {
        return service.completeDevelopmentAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/development-actions/{actionId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapabilityDevelopmentActionResponse cancelDevelopmentAction(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID actionId,

            @Valid
            @RequestBody
            CapabilityNoteInput input
    ) {
        return service.cancelDevelopmentAction(
                currentUserId(
                        jwt
                ),
                actionId,
                input
        );
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapabilitySnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public CapabilitySnapshotDetailResponse snapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID snapshotId
    ) {
        return service.snapshot(
                currentUserId(
                        jwt
                ),
                snapshotId
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
