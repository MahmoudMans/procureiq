package com.procureiq.categorymanagement;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/category-management")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CategoryManagementController {

    private final CategoryManagementService service;

    public CategoryManagementController(
            CategoryManagementService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CategoryManagementDashboardResponse dashboard(
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
    public CategoryContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/strategies/{strategyId}")
    public CategoryStrategyDetailResponse strategy(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID strategyId
    ) {
        return service.strategy(
                currentUserId(
                        jwt
                ),
                strategyId
        );
    }

    @PostMapping("/strategies")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CategoryStrategyDetailResponse createStrategy(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CategoryStrategyInput input
    ) {
        return service.createStrategy(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PutMapping("/strategies/{strategyId}/status")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CategoryStrategySummaryResponse updateStrategyStatus(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID strategyId,

            @Valid
            @RequestBody
            CategoryStrategyStatusInput input
    ) {
        return service.updateStrategyStatus(
                currentUserId(
                        jwt
                ),
                strategyId,
                input
        );
    }

    @PostMapping("/strategies/{strategyId}/initiatives")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CategoryInitiativeResponse createInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID strategyId,

            @Valid
            @RequestBody
            CategoryInitiativeInput input
    ) {
        return service.createInitiative(
                currentUserId(
                        jwt
                ),
                strategyId,
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/ready")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CategoryInitiativeResponse readyInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.readyInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CategoryInitiativeResponse startInitiative(
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

    @PostMapping("/initiatives/{initiativeId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CategoryInitiativeResponse completeInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            CategoryInitiativeCompletionInput input
    ) {
        return service.completeInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId,
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CategoryInitiativeResponse cancelInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId
    ) {
        return service.cancelInitiative(
                currentUserId(
                        jwt
                ),
                initiativeId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/milestones")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CategoryMilestoneResponse createMilestone(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            CategoryMilestoneInput input
    ) {
        return service.createMilestone(
                currentUserId(
                        jwt
                ),
                initiativeId,
                input
        );
    }

    @PostMapping("/milestones/{milestoneId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CategoryMilestoneResponse completeMilestone(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID milestoneId,

            @Valid
            @RequestBody
            CategoryMilestoneCompletionInput input
    ) {
        return service.completeMilestone(
                currentUserId(
                        jwt
                ),
                milestoneId,
                input
        );
    }

    @PostMapping("/milestones/{milestoneId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CategoryMilestoneResponse cancelMilestone(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID milestoneId
    ) {
        return service.cancelMilestone(
                currentUserId(
                        jwt
                ),
                milestoneId
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
