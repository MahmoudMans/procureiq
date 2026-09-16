package com.procureiq.flywheelstrategy;

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
@RequestMapping("/api/v1/flywheel-strategy")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FlywheelStrategyController {

    private final FlywheelStrategyService service;

    public FlywheelStrategyController(
            FlywheelStrategyService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FlywheelStrategyDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/portfolios")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelStrategyPortfolioDetailResponse createPortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            FlywheelStrategyPortfolioInput input
    ) {
        return service.createPortfolio(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/portfolios/{portfolioId}")
    public FlywheelStrategyPortfolioDetailResponse portfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.portfolio(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PostMapping("/portfolios/{portfolioId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelStrategyPortfolioDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId,

            @Valid
            @RequestBody
            FlywheelStrategyItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                portfolioId,
                input
        );
    }

    @PostMapping("/portfolios/{portfolioId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FlywheelStrategyPortfolioDetailResponse submitForReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.submitForReview(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @PostMapping("/items/{itemId}/decide")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelStrategyPortfolioDetailResponse decideItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            FlywheelStrategyDecisionInput input
    ) {
        return service.decideItem(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/portfolios/{portfolioId}/approve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelStrategyPortfolioDetailResponse approvePortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId,

            @Valid
            @RequestBody
            FlywheelStrategyNoteInput input
    ) {
        return service.approvePortfolio(
                currentUserId(
                        jwt
                ),
                portfolioId,
                input
        );
    }

    @PostMapping("/portfolios/{portfolioId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelStrategyPortfolioDetailResponse closePortfolio(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId,

            @Valid
            @RequestBody
            FlywheelStrategyNoteInput input
    ) {
        return service.closePortfolio(
                currentUserId(
                        jwt
                ),
                portfolioId,
                input
        );
    }

    @PostMapping("/portfolios/{portfolioId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelStrategySnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID portfolioId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                portfolioId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FlywheelStrategySnapshotDetailResponse snapshot(
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
