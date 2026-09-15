package com.procureiq.strategyroadmap;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/strategy-roadmaps")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategyRoadmapController {

    private final StrategyRoadmapService service;

    public StrategyRoadmapController(
            StrategyRoadmapService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategyRoadmapDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapDetailResponse createRoadmap(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            StrategyRoadmapInput input
    ) {
        return service.createRoadmap(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/{roadmapId}")
    public StrategyRoadmapDetailResponse roadmap(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.roadmap(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @PostMapping("/{roadmapId}/activate")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyRoadmapDetailResponse activate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.activate(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @PostMapping("/{roadmapId}/hold")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyRoadmapDetailResponse hold(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.hold(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @PostMapping("/{roadmapId}/complete")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategyRoadmapDetailResponse complete(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.complete(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @PostMapping("/{roadmapId}/archive")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategyRoadmapDetailResponse archive(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.archive(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @PostMapping("/{roadmapId}/initiatives")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapDetailResponse createInitiative(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId,

            @Valid
            @RequestBody
            RoadmapInitiativeInput input
    ) {
        return service.createInitiative(
                currentUserId(
                        jwt
                ),
                roadmapId,
                input
        );
    }

    @PostMapping("/initiatives/{initiativeId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyRoadmapDetailResponse startInitiative(
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
    public StrategyRoadmapDetailResponse completeInitiative(
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
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyRoadmapDetailResponse cancelInitiative(
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

    @PostMapping("/{roadmapId}/dependencies")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapDetailResponse createDependency(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId,

            @Valid
            @RequestBody
            RoadmapDependencyInput input
    ) {
        return service.createDependency(
                currentUserId(
                        jwt
                ),
                roadmapId,
                input
        );
    }

    @DeleteMapping("/dependencies/{dependencyId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void deleteDependency(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID dependencyId
    ) {
        service.deleteDependency(
                currentUserId(
                        jwt
                ),
                dependencyId
        );
    }

    @PostMapping("/initiatives/{initiativeId}/milestones")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapDetailResponse createMilestone(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            RoadmapMilestoneInput input
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
    public StrategyRoadmapDetailResponse completeMilestone(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID milestoneId
    ) {
        return service.completeMilestone(
                currentUserId(
                        jwt
                ),
                milestoneId
        );
    }

    @PostMapping("/milestones/{milestoneId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategyRoadmapDetailResponse cancelMilestone(
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

    @PostMapping("/initiatives/{initiativeId}/gates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapDetailResponse createGate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID initiativeId,

            @Valid
            @RequestBody
            RoadmapGateInput input
    ) {
        return service.createGate(
                currentUserId(
                        jwt
                ),
                initiativeId,
                input
        );
    }

    @PostMapping("/gates/{gateId}/decide")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategyRoadmapDetailResponse decideGate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID gateId,

            @RequestParam
            RoadmapGateStatus decision,

            @Valid
            @RequestBody
            RoadmapDecisionInput input
    ) {
        return service.decideGate(
                currentUserId(
                        jwt
                ),
                gateId,
                decision,
                input
        );
    }

    @PostMapping("/{roadmapId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategyRoadmapSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID roadmapId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                roadmapId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public StrategyRoadmapSnapshotDetailResponse snapshot(
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
