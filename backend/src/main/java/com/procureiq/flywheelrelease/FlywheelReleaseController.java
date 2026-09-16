package com.procureiq.flywheelrelease;

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
@RequestMapping("/api/v1/flywheel-release")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FlywheelReleaseController {

    private final FlywheelReleaseService service;

    public FlywheelReleaseController(
            FlywheelReleaseService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FlywheelReleaseDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/batches")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelReleaseBatchDetailResponse createBatch(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            FlywheelReleaseBatchInput input
    ) {
        return service.createBatch(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/batches/{batchId}")
    public FlywheelReleaseBatchDetailResponse batch(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId
    ) {
        return service.batch(
                currentUserId(
                        jwt
                ),
                batchId
        );
    }

    @PostMapping("/batches/{batchId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelReleaseBatchDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId,

            @Valid
            @RequestBody
            FlywheelReleaseItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                batchId,
                input
        );
    }

    @PostMapping("/batches/{batchId}/ready-for-execution")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FlywheelReleaseBatchDetailResponse submitForExecution(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId
    ) {
        return service.submitForExecution(
                currentUserId(
                        jwt
                ),
                batchId
        );
    }

    @PostMapping("/items/{itemId}/release")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelReleaseBatchDetailResponse releaseItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            FlywheelReleaseExecutionInput input
    ) {
        return service.releaseItem(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelReleaseBatchDetailResponse cancelItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            FlywheelReleaseNoteInput input
    ) {
        return service.cancelItem(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/batches/{batchId}/executed")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelReleaseBatchDetailResponse markExecuted(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId,

            @Valid
            @RequestBody
            FlywheelReleaseNoteInput input
    ) {
        return service.markExecuted(
                currentUserId(
                        jwt
                ),
                batchId,
                input
        );
    }

    @PostMapping("/batches/{batchId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelReleaseBatchDetailResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId,

            @Valid
            @RequestBody
            FlywheelReleaseNoteInput input
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                batchId,
                input
        );
    }

    @PostMapping("/batches/{batchId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelReleaseSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID batchId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                batchId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FlywheelReleaseSnapshotDetailResponse snapshot(
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
