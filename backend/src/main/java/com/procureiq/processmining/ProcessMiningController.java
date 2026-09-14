package com.procureiq.processmining;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/process-mining")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ProcessMiningController {

    private final ProcessMiningService service;

    public ProcessMiningController(
            ProcessMiningService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ProcessMiningDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/targets")
    public List<ProcessStageTargetResponse> targets(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.targets(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/targets")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ProcessStageTargetResponse upsertTarget(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ProcessStageTargetInput input
    ) {
        return service.upsertTarget(
                currentUserId(
                        jwt
                ),
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
