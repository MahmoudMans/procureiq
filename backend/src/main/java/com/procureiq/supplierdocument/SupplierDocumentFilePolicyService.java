package com.procureiq.supplierdocument;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

@Component
public class SupplierDocumentFilePolicyService {

    public static final long MAX_FILE_BYTES =
            5L
            * 1024L
            * 1024L;

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of(
                    "application/pdf",
                    "image/png",
                    "image/jpeg",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            );

    public ValidatedFile validate(
            MultipartFile file
    ) {
        if (
                file == null
                ||
                file.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Compliance document file is required."
            );
        }

        if (
                file.getSize()
                        > MAX_FILE_BYTES
        ) {
            throw new IllegalArgumentException(
                    "Compliance document exceeds the 5 MB file-size limit."
            );
        }

        String contentType =
                file.getContentType();

        if (
                contentType == null
                ||
                !ALLOWED_CONTENT_TYPES.contains(
                        contentType
                )
        ) {
            throw new IllegalArgumentException(
                    "Supported compliance-document formats are PDF, PNG, JPEG and DOCX."
            );
        }

        String originalFileName =
                safeFileName(
                        file.getOriginalFilename()
                );

        try {
            byte[] content =
                    file.getBytes();

            return new ValidatedFile(
                    originalFileName,
                    contentType,
                    content.length,
                    sha256(
                            content
                    ),
                    content
            );
        } catch (
                java.io.IOException exception
        ) {
            throw new IllegalArgumentException(
                    "Compliance document could not be read.",
                    exception
            );
        }
    }

    public String sha256(
            byte[] content
    ) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            return HexFormat
                    .of()
                    .formatHex(
                            digest.digest(
                                    content
                            )
                    );
        } catch (
                NoSuchAlgorithmException exception
        ) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable.",
                    exception
            );
        }
    }

    private String safeFileName(
            String originalFileName
    ) {
        String candidate =
                originalFileName == null
                        ? "document"
                        : originalFileName
                                .replace(
                                        '\\',
                                        '/'
                                );

        int separator =
                candidate.lastIndexOf(
                        '/'
                );

        if (separator >= 0) {
            candidate =
                    candidate.substring(
                            separator + 1
                    );
        }

        candidate =
                candidate
                        .replaceAll(
                                "[\\r\\n\\t]",
                                "_"
                        )
                        .trim();

        if (candidate.isEmpty()) {
            candidate =
                    "document";
        }

        if (candidate.length() > 500) {
            candidate =
                    candidate.substring(
                            0,
                            500
                    );
        }

        return candidate;
    }

    public record ValidatedFile(
            String originalFileName,
            String contentType,
            long fileSizeBytes,
            String sha256Checksum,
            byte[] content
    ) {
    }
}
