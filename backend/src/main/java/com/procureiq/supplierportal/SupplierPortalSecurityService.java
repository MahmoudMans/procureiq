package com.procureiq.supplierportal;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Component
public class SupplierPortalSecurityService {

    private static final int TOKEN_BYTES =
            32;

    private static final int BCRYPT_STRENGTH =
            12;

    private final SecureRandom secureRandom =
            new SecureRandom();

    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder(
                    BCRYPT_STRENGTH
            );

    public String newOpaqueToken() {
        byte[] bytes =
                new byte[
                        TOKEN_BYTES
                ];

        secureRandom.nextBytes(
                bytes
        );

        return Base64
                .getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        bytes
                );
    }

    public String hashToken(
            String rawToken
    ) {
        if (
                rawToken == null
                ||
                rawToken.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Portal token cannot be blank."
            );
        }

        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            byte[] hash =
                    digest.digest(
                            rawToken
                                    .getBytes(
                                            StandardCharsets.UTF_8
                                    )
                    );

            StringBuilder builder =
                    new StringBuilder(
                            hash.length * 2
                    );

            for (
                    byte value
                    : hash
            ) {
                builder.append(
                        String.format(
                                "%02x",
                                value
                        )
                );
            }

            return builder.toString();
        } catch (
                NoSuchAlgorithmException exception
        ) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable.",
                    exception
            );
        }
    }

    public String hashPassword(
            String password
    ) {
        return passwordEncoder.encode(
                password
        );
    }

    public boolean matchesPassword(
            String password,
            String hash
    ) {
        return passwordEncoder.matches(
                password,
                hash
        );
    }

    public Instant invitationExpiresAt() {
        return Instant.now()
                .plus(
                        48,
                        ChronoUnit.HOURS
                );
    }

    public Instant sessionExpiresAt() {
        return Instant.now()
                .plus(
                        12,
                        ChronoUnit.HOURS
                );
    }
}
