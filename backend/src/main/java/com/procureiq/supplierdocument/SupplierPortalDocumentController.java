package com.procureiq.supplierdocument;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplier-portal/documents")
public class SupplierPortalDocumentController {

    private final SupplierPortalDocumentService service;

    public SupplierPortalDocumentController(
            SupplierPortalDocumentService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public SupplierPortalDocumentDashboardResponse dashboard(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.dashboard(
                bearerToken(
                        authorization
                )
        );
    }

    @PostMapping(
            value = "/requirements/{requirementId}/upload",
            consumes = "multipart/form-data"
    )
    public SupplierPortalDocumentDashboardResponse upload(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID requirementId,

            @RequestPart("file")
            MultipartFile file,

            @RequestParam(
                    required = false
            )
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE
            )
            LocalDate expiryDate
    ) {
        return service.upload(
                bearerToken(
                        authorization
                ),
                requirementId,
                file,
                expiryDate
        );
    }

    @GetMapping("/versions/{versionId}/content")
    public SupplierDocumentContentResponse content(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID versionId
    ) {
        return service.content(
                bearerToken(
                        authorization
                ),
                versionId
        );
    }

    private String bearerToken(
            String authorization
    ) {
        if (
                authorization == null
                ||
                !authorization.startsWith(
                        "Bearer "
                )
        ) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        String token =
                authorization
                        .substring(
                                7
                        )
                        .trim();

        if (token.isEmpty()) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        return token;
    }
}
