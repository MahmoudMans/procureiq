package com.procureiq.startup;

import com.procureiq.ProcureiqApplication;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;


/**
 * Step 93 regression authority.
 *
 * This deliberately boots the real ProcureiqApplication rather than a
 * feature-focused test configuration.
 *
 * The historical defect occurred while Hibernate created the complete
 * application metamodel:
 *
 *     PathResolutionException:
 *         purchaseOrderLine.lineNumber
 *
 * A successful test therefore proves that the real application
 * EntityManagerFactory can build against the full migrated V83 schema.
 */
@SpringBootTest(
        classes = ProcureiqApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "spring.flyway.enabled=false",
                "spring.sql.init.mode=never",
                "spring.jpa.hibernate.ddl-auto=none",
                "spring.jpa.open-in-view=false",
                "spring.task.scheduling.enabled=false",
                "management.endpoints.enabled-by-default=false"
        }
)
@Import(
        ProcureiqApplicationJpaBootstrapPostgresTest
                .Step93JwtDependencyConfiguration.class
)
class ProcureiqApplicationJpaBootstrapPostgresTest {

    private static final String JDBC_URL =
            requiredEnvironment(
                    "PROCUREIQ_STEP93_DB_URL"
            );

    private static final String JDBC_USER =
            requiredEnvironment(
                    "PROCUREIQ_STEP93_DB_USER"
            );

    private static final String JDBC_PASSWORD =
            requiredEnvironment(
                    "PROCUREIQ_STEP93_DB_PASSWORD"
            );

    private static final String SCHEMA =
            "step93_full_application_"
            + UUID.randomUUID()
                    .toString()
                    .replace(
                            "-",
                            ""
                    );


    static {
        prepareDatabase();
    }


    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private EntityManagerFactory entityManagerFactory;


    @DynamicPropertySource
    static void databaseProperties(
            DynamicPropertyRegistry registry
    ) {
        registry.add(
                "spring.datasource.url",
                () ->
                        JDBC_URL
                        + "?currentSchema="
                        + SCHEMA
        );

        registry.add(
                "spring.datasource.username",
                () -> JDBC_USER
        );

        registry.add(
                "spring.datasource.password",
                () -> JDBC_PASSWORD
        );

        registry.add(
                "spring.datasource.hikari.schema",
                () -> SCHEMA
        );

        registry.add(
                "spring.jpa.properties.hibernate.default_schema",
                () -> SCHEMA
        );

        registry.add(
                "spring.flyway.enabled",
                () -> "false"
        );
    }


    @Test
    void wholeApplicationBuildsJpaMetamodelAgainstMigratedV83Schema() {
        assertNotNull(
                applicationContext
        );

        assertNotNull(
                applicationContext.getBean(
                        "entityManagerFactory"
                )
        );

        assertTrue(
                entityManagerFactory.isOpen(),
                "The real ProcureIQ EntityManagerFactory must be open."
        );

        assertTrue(
                entityManagerFactory
                        .getMetamodel()
                        .getEntities()
                        .size()
                > 0,
                "The real application JPA metamodel must contain entities."
        );
    }


    private static void prepareDatabase() {
        validateDisposableDatabase(
                JDBC_URL
        );


        try (
                Connection connection =
                        DriverManager.getConnection(
                                JDBC_URL,
                                JDBC_USER,
                                JDBC_PASSWORD
                        );

                Statement statement =
                        connection.createStatement()
        ) {
            statement.execute(
                    "CREATE SCHEMA "
                    + quoteIdentifier(
                            SCHEMA
                    )
            );

        } catch (Exception exception) {
            throw new ExceptionInInitializerError(
                    exception
            );
        }


        Flyway.configure()
                .dataSource(
                        JDBC_URL,
                        JDBC_USER,
                        JDBC_PASSWORD
                )
                .schemas(
                        SCHEMA
                )
                .defaultSchema(
                        SCHEMA
                )
                .locations(
                        "classpath:db/migration"
                )
                .load()
                .migrate();
    }


    private static void validateDisposableDatabase(
            String value
    ) {
        if (
                !value.matches(
                        "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
                )
        ) {
            throw new IllegalStateException(
                    "Step 93 requires disposable loopback PostgreSQL."
            );
        }
    }


    private static String requiredEnvironment(
            String name
    ) {
        String value =
                System.getenv(
                        name
                );


        if (
                value == null
                ||
                value.isBlank()
        ) {
            throw new IllegalStateException(
                    "Missing environment variable: "
                    + name
            );
        }


        return value;
    }


    private static String quoteIdentifier(
            String value
    ) {
        return "\""
               + value.replace(
                        "\"",
                        "\"\""
                )
               + "\"";
    }


    /**
     * The regression is about the real application JPA bootstrap.
     *
     * Supplying a deterministic test decoder prevents an unrelated token
     * dependency from obscuring Hibernate startup authority.
     */
    @TestConfiguration(proxyBeanMethods = false)
    static class Step93JwtDependencyConfiguration {

        @Bean
        @Primary
        JwtDecoder step93JwtDecoder() {
            return encoded ->
                    new Jwt(
                            encoded,
                            Instant.now(),
                            Instant.now()
                                    .plusSeconds(
                                            60
                                    ),
                            Map.of(
                                    "alg",
                                    "none"
                            ),
                            Map.of(
                                    "sub",
                                    UUID.randomUUID()
                                            .toString()
                            )
                    );
        }
    }
}
