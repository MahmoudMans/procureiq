package com.procureiq.reporting;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ReportingController {

    private final ReportingService
            reportingService;

    public ReportingController(
            ReportingService reportingService
    ) {
        this.reportingService =
                reportingService;
    }

    @GetMapping("/executive")
    public ExecutiveReportResponse executive(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            LocalDate from,

            @RequestParam(required = false)
            LocalDate to
    ) {
        return reportingService
                .executiveReport(
                        currentUserId(jwt),
                        from,
                        to
                );
    }

    @GetMapping("/export")
    public ResponseEntity<String> export(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam
            ReportType type,

            @RequestParam(required = false)
            LocalDate from,

            @RequestParam(required = false)
            LocalDate to
    ) {
        String csv =
                reportingService
                        .exportCsv(
                                currentUserId(jwt),
                                type,
                                from,
                                to
                        );

        String filename =
                "procureiq-"
                        + type.name()
                                .toLowerCase()
                                .replace(
                                        '_',
                                        '-'
                                )
                        + ".csv";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\""
                                + filename
                                + "\""
                )
                .contentType(
                        MediaType.parseMediaType(
                                "text/csv"
                        )
                )
                .body(csv);
    }

    @GetMapping("/snapshots")
    public List<ReportSnapshotResponse> snapshots(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return reportingService
                .snapshots(
                        currentUserId(jwt)
                );
    }

    @PostMapping("/snapshots")
    public ReportSnapshotResponse createSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ReportSnapshotInput input
    ) {
        return reportingService
                .createSnapshot(
                        currentUserId(jwt),
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
