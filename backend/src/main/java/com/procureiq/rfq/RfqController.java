package com.procureiq.rfq;

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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rfqs")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
)
public class RfqController {

    private final RfqService rfqService;

    public RfqController(
            RfqService rfqService
    ) {
        this.rfqService =
                rfqService;
    }

    @GetMapping
    public List<RfqResponse> findRfqs(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            RfqStatus status
    ) {
        return rfqService
                .findRfqs(
                        currentUserId(jwt),
                        query,
                        status
                );
    }

    @GetMapping("/summary")
    public RfqSummaryResponse getSummary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return rfqService
                .getSummary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/{id}")
    public RfqResponse findRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return rfqService
                .findRfq(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public RfqResponse createRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            RfqCreateInput input
    ) {
        return rfqService
                .createRfq(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/{id}")
    public RfqResponse updateRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id,

            @Valid
            @RequestBody
            RfqUpdateInput input
    ) {
        return rfqService
                .updateRfq(
                        currentUserId(jwt),
                        id,
                        input
                );
    }

    @PostMapping("/{id}/publish")
    public RfqResponse publishRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return rfqService
                .publishRfq(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping("/{id}/close")
    public RfqResponse closeRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return rfqService
                .closeRfq(
                        currentUserId(jwt),
                        id
                );
    }

    @PostMapping("/{id}/cancel")
    public RfqResponse cancelRfq(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID id
    ) {
        return rfqService
                .cancelRfq(
                        currentUserId(jwt),
                        id
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
