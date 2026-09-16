package com.procureiq.rolloverevidence;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class RolloverEvidencePostgresTest {
    private static String url, user, password, schema;
    private static UUID buyer, manager, approver;
    private Connection db;

    @BeforeAll
    static void migrate() throws Exception {
        url=required("PROCUREIQ_STEP91_DB_URL");
        user=required("PROCUREIQ_STEP91_DB_USER");
        password=required("PROCUREIQ_STEP91_DB_PASSWORD");

        if (!url.matches(
            "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/procureiq_step70"
        )) {
            throw new IllegalStateException(
                "A disposable loopback test database is required."
            );
        }

        schema="step91_"+UUID.randomUUID().toString().replace("-","");

        try (
            Connection c=DriverManager.getConnection(url,user,password);
            Statement s=c.createStatement()
        ) {
            s.execute("CREATE SCHEMA \""+schema+"\"");
        }

        Flyway.configure()
            .dataSource(url,user,password)
            .schemas(schema)
            .defaultSchema(schema)
            .locations("classpath:db/migration")
            .load()
            .migrate();

        try (Connection c=connect()) {
            buyer=seedUser(c,"BUYER");
            manager=seedUser(c,"PROCUREMENT_MANAGER");
            approver=seedUser(c,"APPROVER");
        }
    }

    @AfterAll
    static void dropSchema() throws Exception {
        if (schema==null || url==null) return;

        try (
            Connection c=DriverManager.getConnection(url,user,password);
            Statement s=c.createStatement()
        ) {
            s.execute("DROP SCHEMA IF EXISTS \""+schema+"\" CASCADE");
        }
    }

    @BeforeEach
    void connectAndClear() throws Exception {
        db=connect();

        try (Statement s=db.createStatement()) {
            s.execute(
                "TRUNCATE procurement_rollover_evidence_cycles CASCADE"
            );
            s.execute(
                "TRUNCATE procurement_remediation_continuation_rollover_cases CASCADE"
            );
        }
    }

    @AfterEach
    void disconnect() throws Exception {
        if (db!=null) db.close();
    }

    @Test void requiresClosedRollover() throws Exception {
        UUID root=root("APPROVED","RECOVERY_RETRY");
        expect("55000",()->open(root,null));
    }

    @Test void importsExactSourceBaseline() throws Exception {
        UUID id=open(
            root("CLOSED","RECOVERY_RETRY","WRITE_OFF_ESCALATION"),
            null
        );

        assertEquals(
            "200",
            new BigDecimal(metric(id,"opening"))
                .stripTrailingZeros()
                .toPlainString()
        );

        assertEquals(2,items(id).size());
        assertEquals("OBSERVING",status(id));
    }

    @Test void preventsDuplicateRootImport() throws Exception {
        UUID source=root("CLOSED","RECOVERY_RETRY");
        open(source,null);

        expect("23505",()->open(source,null));

        assertEquals(
            "1",
            scalar("SELECT count(*) FROM procurement_rollover_evidence_cycles")
        );
    }

    @Test void rejectsExcessAndSubCentReduction() throws Exception {
        UUID id=open(root("CLOSED","RECOVERY_RETRY"),null);
        UUID item=items(id).getFirst();

        expect(
            "P0001",
            ()->observe(id,item,"RECOVERY_CONFIRMED","100.01",today())
        );

        expect(
            "23514",
            ()->observe(id,item,"PARTIAL","0.001",today())
        );

        assertEquals(0,version(id));
    }

    @Test void rejectsIncompatibleResolution() throws Exception {
        UUID id=open(root("CLOSED","RECOVERY_RETRY"),null);

        expect(
            "P0001",
            ()->observe(
                id,items(id).getFirst(),"WRITE_OFF_CONFIRMED","20",today()
            )
        );
    }

    @Test void rejectsFutureAndBlankEvidence() throws Exception {
        UUID id=open(root("CLOSED","RECOVERY_RETRY"),null);
        UUID item=items(id).getFirst();

        expect(
            "P0001",
            ()->observe(id,item,"PARTIAL","20",today().plusDays(1))
        );

        expect(
            "P0001",
            ()->call(
                "SELECT procureiq_rce91_observe(?::uuid,?::uuid,?::bigint,?::uuid,?::text,?::numeric,?::date,?::text,?::text)",
                id,item,version(id),buyer,
                "PARTIAL",new BigDecimal("20"),today()," ","Evidence"
            )
        );
    }

    @Test void riskAcceptanceNeverReducesResidual() throws Exception {
        UUID id=open(
            root("CLOSED","RISK_ACCEPTANCE_ESCALATION"),
            null
        );
        UUID item=items(id).getFirst();

        expect(
            "P0001",
            ()->observe(id,item,"RISK_ACCEPTANCE_CONFIRMED","1",today())
        );

        observe(id,item,"RISK_ACCEPTANCE_CONFIRMED","0",today());
        verify(id);

        assertMoney("100",metric(id,"remaining"));
        assertEquals(
            "FURTHER_GOVERNANCE_REQUIRED",
            metric(id,"disposition")
        );
    }

    @Test void incompleteEvidenceKeepsUnobservedExposureOutstanding()
        throws Exception {
        UUID id=open(
            root("CLOSED","RECOVERY_RETRY","RECOVERY_RETRY"),
            null
        );

        observe(id,items(id).getFirst(),"PARTIAL","30",today());

        assertMoney("170",metric(id,"remaining"));
        expect("55000",()->transition(id,buyer,"submit-evidence"));
        assertEquals("OBSERVING",status(id));
    }

    @Test void databaseRoleBlocksBuyerVerification() throws Exception {
        UUID id=observedRoot("60");
        transition(id,buyer,"submit-evidence");

        expect("42501",()->transition(id,buyer,"verify-evidence"));
        assertEquals("EVIDENCE_REVIEW",status(id));

        transition(id,manager,"verify-evidence");
        assertEquals("VERIFIED",status(id));
    }

    @Test void positiveResidualCannotBeFalselyClosed() throws Exception {
        UUID id=observedRoot("60");
        verify(id);

        expect("55000",()->transition(id,manager,"close-evidence"));
        assertMoney("40",metric(id,"remaining"));
    }

    @Test void fullyResolvedEvidenceClosesAndCannotRollForward()
        throws Exception {
        UUID id=observedRoot("100");
        verify(id);
        transition(id,manager,"close-evidence");

        assertEquals("CLOSED",status(id));
        expect("55000",()->open(null,id));
    }

    @Test void childRequiresPlanningAndManagerGovernanceBeforeObservation()
        throws Exception {
        UUID parent=observedRoot("60");
        verify(parent);

        UUID child=open(null,parent);
        UUID item=items(child).getFirst();

        assertEquals("PLAN_DRAFT",status(child));

        expect(
            "P0001",
            ()->observe(child,item,"PARTIAL","10",today())
        );

        expect("55000",()->transition(child,buyer,"submit-plan"));

        plan(child,item);
        transition(child,buyer,"submit-plan");

        expect("42501",()->transition(child,buyer,"approve-plan"));

        transition(child,manager,"approve-plan");
        transition(child,manager,"close-governance");
        observe(child,item,"PARTIAL","10",today());

        assertMoney("30",metric(child,"remaining"));
    }

    @Test void supportsThreeGenerationsWithoutDoubleCountingExposure()
        throws Exception {
        UUID first=observedRoot("60");
        verify(first);

        String frozen=scalar(
            "SELECT document::text FROM procurement_rollover_evidence_snapshots WHERE cycle_id=? AND captured_version=?",
            first,version(first)
        );

        UUID second=open(null,first);
        govern(second);
        observe(second,items(second).getFirst(),"PARTIAL","15",today());
        verify(second);

        UUID third=open(null,second);
        govern(third);
        observe(
            third,items(third).getFirst(),
            "RECOVERY_CONFIRMED","25",today()
        );
        verify(third);
        transition(third,manager,"close-evidence");

        assertEquals(
            "3",
            scalar(
                "SELECT cycle_no FROM procurement_rollover_evidence_cycles WHERE id=?",
                third
            )
        );

        assertMoney(
            "0",
            scalar(
                "SELECT procureiq_rce91_dashboard(?::uuid)#>>'{exposure,0,remaining}'",
                buyer
            )
        );

        assertMoney(
            "100",
            scalar(
                "SELECT procureiq_rce91_dashboard(?::uuid)#>>'{exposure,0,cumulativeReduction}'",
                buyer
            )
        );

        assertEquals(
            frozen,
            scalar(
                "SELECT document::text FROM procurement_rollover_evidence_snapshots WHERE cycle_id=? AND captured_version=?",
                first,version(first)
            )
        );
    }

    @Test void snapshotCaptureIsIdempotentPerVersionAndImmutable()
        throws Exception {
        UUID id=open(root("CLOSED","RECOVERY_RETRY"),null);

        UUID one=UUID.fromString(
            scalar(
                "SELECT procureiq_rce91_capture(?::uuid,?::uuid)",
                id,buyer
            )
        );

        assertEquals(
            one.toString(),
            scalar(
                "SELECT procureiq_rce91_capture(?::uuid,?::uuid)",
                id,buyer
            )
        );

        observe(id,items(id).getFirst(),"PARTIAL","60",today());

        assertMoney(
            "100",
            scalar(
                "SELECT document#>>'{metrics,remaining}' FROM procurement_rollover_evidence_snapshots WHERE id=?",
                one
            )
        );

        expect(
            "P0001",
            ()->update(
                "UPDATE procurement_rollover_evidence_snapshots SET document='{}'::jsonb WHERE id=?",
                one
            )
        );
    }

    @Test void staleVersionCannotAppendAnotherObservation()
        throws Exception {
        UUID id=open(
            root("CLOSED","RECOVERY_RETRY","RECOVERY_RETRY"),
            null
        );

        List<UUID> itemIds=items(id);
        observe(id,itemIds.getFirst(),"PARTIAL","20",today());

        expect(
            "55000",
            ()->call(
                "SELECT procureiq_rce91_observe(?::uuid,?::uuid,0,?::uuid,'PARTIAL',20,CURRENT_DATE,'REF','NOTE')",
                id,itemIds.get(1),buyer
            )
        );

        assertEquals("1",metric(id,"observedCount"));
    }

    @Test void sourceItemsAndObservedEvidenceCannotBeEdited()
        throws Exception {
        UUID id=observedRoot("60");
        UUID item=items(id).getFirst();

        expect(
            "P0001",
            ()->update(
                "UPDATE procurement_rollover_evidence_items SET opening_amount=1 WHERE id=?",
                item
            )
        );

        expect(
            "P0001",
            ()->update(
                "DELETE FROM procurement_rollover_evidence_observations WHERE item_id=?",
                item
            )
        );
    }

    @Test void failedMultiOperationTransactionLeavesNoPartialCycle()
        throws Exception {
        UUID source=root("CLOSED","RECOVERY_RETRY");

        db.setAutoCommit(false);

        try {
            UUID id=open(source,null);

            expect(
                "P0001",
                ()->observe(
                    id,items(id).getFirst(),
                    "RECOVERY_CONFIRMED","101",today()
                )
            );
        } finally {
            db.rollback();
            db.setAutoCommit(true);
        }

        assertEquals(
            "0",
            scalar("SELECT count(*) FROM procurement_rollover_evidence_cycles")
        );

        assertEquals(
            "0",
            scalar("SELECT count(*) FROM procurement_rollover_evidence_events")
        );
    }

    @Test void preventsDuplicateChildAndBlocksApproverWrites()
        throws Exception {
        UUID parent=observedRoot("60");
        verify(parent);

        UUID child=open(null,parent);

        expect("23505",()->open(null,parent));

        expect(
            "42501",
            ()->call(
                "SELECT procureiq_rce91_plan(?::uuid,?::uuid,?::bigint,?::uuid,CURRENT_DATE,'Plan')",
                child,items(child).getFirst(),version(child),approver
            )
        );
    }

    @Test void separatesRecoveryWriteOffAndOtherReduction()
        throws Exception {
        UUID id=open(
            root(
                "CLOSED",
                "RECOVERY_RETRY",
                "WRITE_OFF_ESCALATION",
                "INVESTIGATION_ESCALATION"
            ),
            null
        );

        for (UUID item:items(id)) {
            String action=scalar(
                "SELECT action FROM procurement_rollover_evidence_items WHERE id=?",
                item
            );

            String[] input=switch(action) {
                case "RECOVERY_RETRY" ->
                    new String[]{"RECOVERY_CONFIRMED","40"};
                case "WRITE_OFF_ESCALATION" ->
                    new String[]{"WRITE_OFF_CONFIRMED","20"};
                case "INVESTIGATION_ESCALATION" ->
                    new String[]{"INVESTIGATION_CONCLUDED","10"};
                default ->
                    throw new AssertionError(action);
            };

            observe(id,item,input[0],input[1],today());
        }

        verify(id);

        assertMoney("40",metric(id,"recovered"));
        assertMoney("20",metric(id,"writeOff"));
        assertMoney("10",metric(id,"otherReduction"));
        assertMoney("230",metric(id,"remaining"));
        assertMoney("23.33",metric(id,"reductionPercent"));
    }

    @Test void rejectsAChildLinkedToAnotherParentsVerifiedSnapshot()
        throws Exception {
        UUID first=observedRoot("60");
        verify(first);

        UUID second=observedRoot("50");
        verify(second);

        UUID wrong=UUID.fromString(
            scalar(
                "SELECT id FROM procurement_rollover_evidence_snapshots WHERE cycle_id=? AND captured_version=?",
                second,version(second)
            )
        );

        expect(
            "P0001",
            ()->update(
                """
                INSERT INTO procurement_rollover_evidence_cycles(
                    root_rollover_id,parent_id,source_snapshot_id,cycle_no,
                    title,currency,fiscal_year,opening_amount,expected_items,
                    status,created_by,last_actor,last_event,last_note
                )
                SELECT
                    root_rollover_id,id,?::uuid,cycle_no+1,
                    title,currency,fiscal_year,40,1,
                    'PLAN_DRAFT',?,?,'OPENED','Forged snapshot'
                FROM procurement_rollover_evidence_cycles
                WHERE id=?
                """,
                wrong,buyer,buyer,first
            )
        );

        assertEquals(
            "2",
            scalar("SELECT count(*) FROM procurement_rollover_evidence_cycles")
        );
    }

    private UUID observedRoot(String reduction) throws Exception {
        UUID id=open(root("CLOSED","RECOVERY_RETRY"),null);

        observe(
            id,items(id).getFirst(),
            "RECOVERY_CONFIRMED",reduction,today()
        );

        return id;
    }

    private void verify(UUID id) throws Exception {
        transition(id,buyer,"submit-evidence");
        transition(id,manager,"verify-evidence");
    }

    private void govern(UUID id) throws Exception {
        for (UUID item:items(id)) plan(id,item);
        transition(id,buyer,"submit-plan");
        transition(id,manager,"approve-plan");
        transition(id,manager,"close-governance");
    }

    private void plan(UUID id,UUID item) throws Exception {
        call(
            "SELECT procureiq_rce91_plan(?::uuid,?::uuid,?::bigint,?::uuid,?::date,'Govern remaining exposure')",
            id,item,version(id),buyer,today().plusDays(30)
        );
    }

    private void observe(
        UUID id,
        UUID item,
        String resolution,
        String reduction,
        LocalDate date
    ) throws Exception {
        call(
            "SELECT procureiq_rce91_observe(?::uuid,?::uuid,?::bigint,?::uuid,?::text,?::numeric,?::date,'EVIDENCE-91','Observed evidence')",
            id,item,version(id),buyer,
            resolution,new BigDecimal(reduction),date
        );
    }

    private void transition(
        UUID id,
        UUID actor,
        String operation
    ) throws Exception {
        call(
            "SELECT procureiq_rce91_transition(?::uuid,?::bigint,?::uuid,?::text,'Reviewed evidence and authorized operation')",
            id,version(id),actor,operation
        );
    }

    private UUID open(UUID root,UUID parent) throws Exception {
        return UUID.fromString(
            scalar(
                "SELECT procureiq_rce91_open(?::uuid,?::uuid,?::uuid)",
                root,parent,buyer
            )
        );
    }

    private LocalDate today() throws Exception {
        return LocalDate.parse(scalar("SELECT CURRENT_DATE"));
    }

    private long version(UUID id) throws Exception {
        return Long.parseLong(
            scalar(
                "SELECT version FROM procurement_rollover_evidence_cycles WHERE id=?",
                id
            )
        );
    }

    private String status(UUID id) throws Exception {
        return scalar(
            "SELECT status FROM procurement_rollover_evidence_cycles WHERE id=?",
            id
        );
    }

    private String metric(UUID id,String key) throws Exception {
        return scalar(
            "SELECT procureiq_rce91_metrics(?::uuid)->>?::text",
            id,key
        );
    }

    private List<UUID> items(UUID id) throws Exception {
        try (
            PreparedStatement p=db.prepareStatement(
                "SELECT id FROM procurement_rollover_evidence_items WHERE cycle_id=? ORDER BY id"
            )
        ) {
            p.setObject(1,id);

            try (ResultSet rs=p.executeQuery()) {
                List<UUID> values=new ArrayList<>();

                while (rs.next()) {
                    values.add(rs.getObject(1,UUID.class));
                }

                return values;
            }
        }
    }

    private UUID root(String status,String... actions) throws Exception {
        UUID id=UUID.randomUUID();

        // Only upstream fixtures bypass historic trigger/FK chains.
        // Every new Step 91 operation runs with replication role origin.
        try (Statement s=db.createStatement()) {
            s.execute("SET session_replication_role=replica");
        }

        try {
            update(
                """
                INSERT INTO procurement_remediation_continuation_rollover_cases
                (
                    id,rollover_number,
                    source_continuation_outcome_case_id,
                    source_continuation_outcome_number,
                    parent_continuation_case_id,parent_continuation_number,
                    title,currency,fiscal_year,
                    source_remaining_residual_amount,source_residual_item_count,
                    owner_user_id,owner_name,status,
                    closed_by_user_id,closed_at,close_note,
                    version,created_by_user_id
                )
                VALUES(
                    ?,?,?,'RCO-91',?,'RCC-91',
                    'Step 91 source','USD',2026,
                    ?,?,?,'Buyer',?,
                    ?,CURRENT_TIMESTAMP,'Closed',3,?
                )
                """,
                id,
                "RCR91-"+UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                new BigDecimal(100*actions.length),
                actions.length,
                buyer,
                status,
                manager,
                buyer
            );

            for (String action:actions) {
                update(
                    """
                    INSERT INTO procurement_remediation_continuation_rollover_items
                    (
                        id,rollover_case_id,
                        source_continuation_outcome_item_id,
                        source_continuation_item_id,
                        source_continuation_action,source_resolution_type,
                        source_remaining_residual_amount,
                        continuation_action,target_date,rationale,
                        created_by_user_id
                    )
                    VALUES(
                        ?,?,?,?,?,'UNRESOLVED',100,?,
                        CURRENT_DATE,'Source governance',?
                    )
                    """,
                    UUID.randomUUID(),
                    id,
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    action,
                    action,
                    buyer
                );
            }
        } finally {
            try (Statement s=db.createStatement()) {
                s.execute("SET session_replication_role=origin");
            }
        }

        return id;
    }

    private String scalar(String sql,Object... values) throws Exception {
        try (PreparedStatement p=db.prepareStatement(sql)) {
            bind(p,values);

            try (ResultSet rs=p.executeQuery()) {
                assertTrue(rs.next());
                return rs.getString(1);
            }
        }
    }

    private void call(String sql,Object... values) throws Exception {
        scalar(sql,values);
    }

    private void update(String sql,Object... values) throws Exception {
        try (PreparedStatement p=db.prepareStatement(sql)) {
            bind(p,values);
            p.executeUpdate();
        }
    }

    private static void bind(
        PreparedStatement p,
        Object[] values
    ) throws SQLException {
        for (int i=0;i<values.length;i++) {
            p.setObject(i+1,values[i]);
        }
    }

    private static void assertMoney(String expected,String actual) {
        assertEquals(
            0,
            new BigDecimal(expected).compareTo(new BigDecimal(actual))
        );
    }

    @FunctionalInterface
    private interface SqlAction {
        void run() throws Exception;
    }

    private static void expect(String state,SqlAction action) {
        SQLException error=assertThrows(SQLException.class,action::run);
        assertEquals(state,error.getSQLState(),error.getMessage());
    }

    private static Connection connect() throws SQLException {
        Connection c=DriverManager.getConnection(url,user,password);

        try (Statement s=c.createStatement()) {
            s.execute("SET search_path TO \""+schema+"\"");
            s.execute("SET statement_timeout='20s'");
        }

        return c;
    }

    private static String required(String key) {
        String value=System.getenv(key);

        if (value==null || value.isBlank()) {
            throw new IllegalStateException("Missing "+key);
        }

        return value;
    }

    private static UUID seedUser(Connection c,String role)
        throws SQLException {
        UUID id=UUID.randomUUID();
        List<String> columns=new ArrayList<>();
        List<Object> values=new ArrayList<>();
        List<Boolean> otherTypes=new ArrayList<>();

        try (
            PreparedStatement p=c.prepareStatement(
                """
                SELECT
                    column_name,data_type,is_nullable,column_default,
                    is_identity,is_generated
                FROM information_schema.columns
                WHERE table_schema=?
                  AND table_name='app_users'
                ORDER BY ordinal_position
                """
            )
        ) {
            p.setString(1,schema);

            try (ResultSet r=p.executeQuery()) {
                while (r.next()) {
                    String name=r.getString(1);
                    String type=r.getString(2);
                    Object value;

                    if (
                        "YES".equals(r.getString(5))
                        || !"NEVER".equals(r.getString(6))
                    ) {
                        continue;
                    }

                    switch(name) {
                        case "id" ->
                            value=id;
                        case "email" ->
                            value="rce91-"+id+"@example.test";
                        case "full_name","name" ->
                            value="Step 91 "+role;
                        case "password_hash" ->
                            value="not-a-login-password";
                        case "role" ->
                            value=role;
                        case "active" ->
                            value=true;
                        default -> {
                            if (
                                !"NO".equals(r.getString(3))
                                || r.getString(4)!=null
                            ) {
                                continue;
                            }

                            value=switch(type) {
                                case "uuid" ->
                                    UUID.randomUUID();
                                case "boolean" ->
                                    true;
                                case "integer","smallint" ->
                                    1;
                                case "bigint" ->
                                    1L;
                                case "numeric","decimal" ->
                                    BigDecimal.ONE;
                                case "timestamp with time zone",
                                     "timestamp without time zone" ->
                                    new Timestamp(System.currentTimeMillis());
                                case "character varying","text","character" ->
                                    "STEP91-"+id.toString().substring(0,8);
                                default ->
                                    throw new SQLException(
                                        "Unknown mandatory app_users column "
                                        +name+" type="+type
                                    );
                            };
                        }
                    }

                    columns.add(
                        "\""+name.replace("\"","\"\"")+"\""
                    );
                    values.add(value);
                    otherTypes.add("USER-DEFINED".equals(type));
                }
            }
        }

        try (Statement s=c.createStatement()) {
            s.execute("SET session_replication_role=replica");
        }

        try (
            PreparedStatement p=c.prepareStatement(
                "INSERT INTO app_users ("
                +String.join(",",columns)
                +") VALUES ("
                +String.join(",",Collections.nCopies(values.size(),"?"))
                +")"
            )
        ) {
            for (int i=0;i<values.size();i++) {
                if (otherTypes.get(i)) {
                    p.setObject(i+1,values.get(i),Types.OTHER);
                } else {
                    p.setObject(i+1,values.get(i));
                }
            }

            p.executeUpdate();
        } finally {
            try (Statement s=c.createStatement()) {
                s.execute("SET session_replication_role=origin");
            }
        }

        return id;
    }
}
