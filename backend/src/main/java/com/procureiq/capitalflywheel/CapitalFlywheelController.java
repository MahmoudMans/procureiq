package com.procureiq.capitalflywheel;

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
@RequestMapping("/api/v1/capital-flywheel")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class CapitalFlywheelController {

    private final CapitalFlywheelService service;

    public CapitalFlywheelController(
            CapitalFlywheelService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CapitalFlywheelDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/persistence-cases/{persistenceCaseId}/lineages")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalFlywheelLineageDetailResponse createLineage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID persistenceCaseId,

            @Valid
            @RequestBody
            CapitalFlywheelLineageInput input
    ) {
        return service.createLineage(
                currentUserId(
                        jwt
                ),
                persistenceCaseId,
                input
        );
    }

    @GetMapping("/lineages/{lineageId}")
    public CapitalFlywheelLineageDetailResponse lineage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID lineageId
    ) {
        return service.lineage(
                currentUserId(
                        jwt
                ),
                lineageId
        );
    }

    @PostMapping("/lineages/{lineageId}/cycles")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public CapitalFlywheelLineageDetailResponse appendCycle(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID lineageId,

            @Valid
            @RequestBody
            CapitalFlywheelCycleInput input
    ) {
        return service.appendCycle(
                currentUserId(
                        jwt
                ),
                lineageId,
                input
        );
    }

    @PostMapping("/lineages/{lineageId}/review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalFlywheelLineageDetailResponse reviewLineage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID lineageId,

            @Valid
            @RequestBody
            CapitalFlywheelReviewInput input
    ) {
        return service.reviewLineage(
                currentUserId(
                        jwt
                ),
                lineageId,
                input
        );
    }

    @PostMapping("/lineages/{lineageId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public CapitalFlywheelLineageDetailResponse closeLineage(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID lineageId,

            @Valid
            @RequestBody
            CapitalFlywheelNoteInput input
    ) {
        return service.closeLineage(
                currentUserId(
                        jwt
                ),
                lineageId,
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
    public CapitalFlywheelSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public CapitalFlywheelSnapshotDetailResponse snapshot(
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
