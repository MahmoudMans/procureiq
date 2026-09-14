package com.procureiq.supplierinsight;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/suppliers")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER','APPROVER')"
)
public class Supplier360Controller {

    private final Supplier360Service
            supplier360Service;

    public Supplier360Controller(
            Supplier360Service supplier360Service
    ) {
        this.supplier360Service =
                supplier360Service;
    }

    @GetMapping("/{supplierId}/360")
    public Supplier360Response find(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId
    ) {
        return supplier360Service
                .find(
                        currentUserId(jwt),
                        supplierId
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
