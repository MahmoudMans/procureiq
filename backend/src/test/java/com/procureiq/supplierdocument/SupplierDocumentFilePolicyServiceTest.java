package com.procureiq.supplierdocument;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupplierDocumentFilePolicyServiceTest {

    private SupplierDocumentFilePolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierDocumentFilePolicyService();
    }

    @Test
    void shouldValidatePdfAndCalculateChecksum() {
        byte[] content =
                "procureiq-compliance"
                        .getBytes(
                                StandardCharsets.UTF_8
                        );

        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "certificate.pdf",
                        "application/pdf",
                        content
                );

        SupplierDocumentFilePolicyService.ValidatedFile result =
                service.validate(
                        file
                );

        assertEquals(
                "certificate.pdf",
                result.originalFileName()
        );

        assertEquals(
                content.length,
                result.fileSizeBytes()
        );

        assertEquals(
                64,
                result.sha256Checksum()
                        .length()
        );
    }

    @Test
    void shouldRejectUnsupportedMimeType() {
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "script.sh",
                        "text/x-shellscript",
                        "echo bad"
                                .getBytes(
                                        StandardCharsets.UTF_8
                                )
                );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.validate(
                                file
                        )
        );
    }
}
