package com.procureiq.flywheelallocation;

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
@RequestMapping("/api/v1/flywheel-allocation")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FlywheelAllocationController {

    private final FlywheelAllocationService service;

    public FlywheelAllocationController(
            FlywheelAllocationService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FlywheelAllocationDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/mandates")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelAllocationMandateDetailResponse createMandate(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            FlywheelAllocationMandateInput input
    ) {
        return service.createMandate(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/mandates/{mandateId}")
    public FlywheelAllocationMandateDetailResponse mandate(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId
    ) {
        return service.mandate(
                currentUserId(
                        jwt
                ),
                mandateId
        );
    }

    @PostMapping("/mandates/{mandateId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelAllocationMandateDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId,

            @Valid
            @RequestBody
            FlywheelAllocationItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                mandateId,
                input
        );
    }

    @PostMapping("/mandates/{mandateId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FlywheelAllocationMandateDetailResponse submitForReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId
    ) {
        return service.submitForReview(
                currentUserId(
                        jwt
                ),
                mandateId
        );
    }

    @PostMapping("/mandates/{mandateId}/authorize")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelAllocationMandateDetailResponse authorize(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId,

            @Valid
            @RequestBody
            FlywheelAllocationNoteInput input
    ) {
        return service.authorize(
                currentUserId(
                        jwt
                ),
                mandateId,
                input
        );
    }

    @PostMapping("/mandates/{mandateId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelAllocationMandateDetailResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId,

            @Valid
            @RequestBody
            FlywheelAllocationNoteInput input
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                mandateId,
                input
        );
    }

    @PostMapping("/mandates/{mandateId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelAllocationSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID mandateId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                mandateId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FlywheelAllocationSnapshotDetailResponse snapshot(
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
