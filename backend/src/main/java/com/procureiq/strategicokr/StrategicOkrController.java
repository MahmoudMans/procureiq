package com.procureiq.strategicokr;

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

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/strategic-okrs")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategicOkrController {

    private final StrategicOkrService service;

    public StrategicOkrController(
            StrategicOkrService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategicOkrDashboardResponse dashboard(
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

    @GetMapping("/context-options")
    public OkrContextResponse contextOptions(
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

    @GetMapping("/objectives/{objectiveId}")
    public StrategicObjectiveDetailResponse objective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.objective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public StrategicObjectiveDetailResponse createObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            StrategicObjectiveInput input
    ) {
        return service.createObjective(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @PostMapping("/objectives/{objectiveId}/key-results")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public KeyResultResponse createKeyResult(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId,

            @Valid
            @RequestBody
            KeyResultInput input
    ) {
        return service.createKeyResult(
                currentUserId(
                        jwt
                ),
                objectiveId,
                input
        );
    }

    @PostMapping("/objectives/{objectiveId}/refresh")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategicObjectiveDetailResponse refreshObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.refreshObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PutMapping("/key-results/{keyResultId}/manual-actual")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public KeyResultResponse updateManualActual(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID keyResultId,

            @Valid
            @RequestBody
            KeyResultManualActualInput input
    ) {
        return service.updateManualActual(
                currentUserId(
                        jwt
                ),
                keyResultId,
                input
        );
    }

    @PostMapping("/key-results/{keyResultId}/contributions")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public OkrContributionResponse createContribution(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID keyResultId,

            @Valid
            @RequestBody
            OkrContributionInput input
    ) {
        return service.createContribution(
                currentUserId(
                        jwt
                ),
                keyResultId,
                input
        );
    }

    @PostMapping("/objectives/{objectiveId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategicObjectiveSummaryResponse startObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.startObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/hold")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategicObjectiveSummaryResponse holdObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.holdObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/resume")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public StrategicObjectiveSummaryResponse resumeObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.resumeObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/achieve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategicObjectiveSummaryResponse achieveObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.achieveObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategicObjectiveSummaryResponse closeObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.closeObjective(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @PostMapping("/objectives/{objectiveId}/cancel")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public StrategicObjectiveSummaryResponse cancelObjective(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId,

            @Valid
            @RequestBody
            OkrCancellationInput input
    ) {
        return service.cancelObjective(
                currentUserId(
                        jwt
                ),
                objectiveId,
                input
        );
    }

    @PostMapping("/objectives/{objectiveId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public OkrSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID objectiveId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                objectiveId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public OkrSnapshotDetailResponse snapshot(
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
