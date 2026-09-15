package com.procureiq.capitalallocation;

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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/capital-allocation")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CapitalAllocationController {

    private final CapitalAllocationService service;

    public CapitalAllocationController(
            CapitalAllocationService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CapitalAllocationDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/cycles")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalAllocationCycleDetailResponse createCycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            CapitalAllocationCycleInput input
    ) {
        return service.createCycle(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/cycles/{cycleId}")
    public CapitalAllocationCycleDetailResponse cycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId
    ) {
        return service.cycle(
                currentUserId(
                        jwt
                ),
                cycleId
        );
    }

    @PostMapping("/cycles/{cycleId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalAllocationCycleDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId,

            @Valid
            @RequestBody
            CapitalAllocationItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                cycleId,
                input
        );
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapitalAllocationCycleDetailResponse removeItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.removeItem(
                currentUserId(
                        jwt
                ),
                itemId
        );
    }

    @PostMapping("/cycles/{cycleId}/submit")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public CapitalAllocationCycleDetailResponse submitCycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId
    ) {
        return service.submitCycle(
                currentUserId(
                        jwt
                ),
                cycleId
        );
    }

    @PostMapping("/items/{itemId}/decision")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalAllocationCycleDetailResponse decideItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            CapitalAllocationDecisionInput input
    ) {
        return service.decideItem(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/cycles/{cycleId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalAllocationCycleDetailResponse approveCycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId,

            @Valid
            @RequestBody
            CapitalAllocationNoteInput input
    ) {
        return service.approveCycle(
                currentUserId(
                        jwt
                ),
                cycleId,
                input
        );
    }

    @PostMapping("/cycles/{cycleId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalAllocationCycleDetailResponse closeCycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId,

            @Valid
            @RequestBody
            CapitalAllocationNoteInput input
    ) {
        return service.closeCycle(
                currentUserId(
                        jwt
                ),
                cycleId,
                input
        );
    }

    @PostMapping("/cycles/{cycleId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalAllocationSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID cycleId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                cycleId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public CapitalAllocationSnapshotDetailResponse snapshot(
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
