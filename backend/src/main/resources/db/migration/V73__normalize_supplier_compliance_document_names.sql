/*
 * Forward validation/normalization for databases that existed before the
 * supplier-compliance naming collision was repaired.
 *
 * Desired final state:
 *
 * supplier_compliance_documents
 *   -> V13 contract/compliance authority (contract_id)
 *
 * supplier_document_vault_documents
 *   -> V34 vault authority (requirement_id)
 *
 * The migration repairs only recognized states. It never silently creates an
 * empty replacement for unidentified historical data.
 */

DO $$
DECLARE
    old_exists BOOLEAN;

    temp_exists BOOLEAN;

    vault_exists BOOLEAN;

    alternative_legacy_exists BOOLEAN;

    old_has_contract_id BOOLEAN := FALSE;

    old_has_requirement_id BOOLEAN := FALSE;

    temp_has_contract_id BOOLEAN := FALSE;

    alternative_has_contract_id BOOLEAN := FALSE;

    vault_has_requirement_id BOOLEAN := FALSE;
BEGIN
    old_exists :=
        to_regclass(
            current_schema()
            || '.supplier_compliance_documents'
        ) IS NOT NULL;

    temp_exists :=
        to_regclass(
            current_schema()
            || '.supplier_compliance_documents_v13_legacy'
        ) IS NOT NULL;

    vault_exists :=
        to_regclass(
            current_schema()
            || '.supplier_document_vault_documents'
        ) IS NOT NULL;

    alternative_legacy_exists :=
        to_regclass(
            current_schema()
            || '.supplier_contract_compliance_documents'
        ) IS NOT NULL;


    IF old_exists THEN
        SELECT EXISTS (
            SELECT 1

            FROM information_schema.columns

            WHERE table_schema =
                current_schema()

            AND table_name =
                'supplier_compliance_documents'

            AND column_name =
                'contract_id'
        )
        INTO old_has_contract_id;


        SELECT EXISTS (
            SELECT 1

            FROM information_schema.columns

            WHERE table_schema =
                current_schema()

            AND table_name =
                'supplier_compliance_documents'

            AND column_name =
                'requirement_id'
        )
        INTO old_has_requirement_id;
    END IF;


    IF temp_exists THEN
        SELECT EXISTS (
            SELECT 1

            FROM information_schema.columns

            WHERE table_schema =
                current_schema()

            AND table_name =
                'supplier_compliance_documents_v13_legacy'

            AND column_name =
                'contract_id'
        )
        INTO temp_has_contract_id;
    END IF;


    IF alternative_legacy_exists THEN
        SELECT EXISTS (
            SELECT 1

            FROM information_schema.columns

            WHERE table_schema =
                current_schema()

            AND table_name =
                'supplier_contract_compliance_documents'

            AND column_name =
                'contract_id'
        )
        INTO alternative_has_contract_id;
    END IF;


    IF vault_exists THEN
        SELECT EXISTS (
            SELECT 1

            FROM information_schema.columns

            WHERE table_schema =
                current_schema()

            AND table_name =
                'supplier_document_vault_documents'

            AND column_name =
                'requirement_id'
        )
        INTO vault_has_requirement_id;
    END IF;


    /*
     * Correct final state.
     */
    IF
        old_exists
        AND
        old_has_contract_id
        AND
        NOT old_has_requirement_id
        AND
        vault_exists
        AND
        vault_has_requirement_id
        AND
        NOT temp_exists
    THEN
        RETURN;
    END IF;


    /*
     * V34 table still owns the historical name while the V13 relation is
     * preserved under our bridge name.
     */
    IF
        old_exists
        AND
        old_has_requirement_id
        AND
        NOT old_has_contract_id
        AND
        NOT vault_exists
        AND
        temp_exists
        AND
        temp_has_contract_id
    THEN
        EXECUTE
            'ALTER TABLE supplier_compliance_documents '
            'RENAME TO supplier_document_vault_documents';


        IF EXISTS (
            SELECT 1

            FROM pg_constraint

            WHERE conrelid =
                'supplier_document_vault_documents'::regclass

            AND conname =
                'supplier_compliance_documents_pkey'
        ) THEN
            EXECUTE
                'ALTER TABLE supplier_document_vault_documents '
                'RENAME CONSTRAINT supplier_compliance_documents_pkey '
                'TO supplier_document_vault_documents_pkey';
        END IF;


        EXECUTE
            'ALTER TABLE supplier_compliance_documents_v13_legacy '
            'RENAME TO supplier_compliance_documents';


        IF EXISTS (
            SELECT 1

            FROM pg_constraint

            WHERE conrelid =
                'supplier_compliance_documents'::regclass

            AND conname =
                'supplier_compliance_documents_v13_legacy_pkey'
        ) THEN
            EXECUTE
                'ALTER TABLE supplier_compliance_documents '
                'RENAME CONSTRAINT supplier_compliance_documents_v13_legacy_pkey '
                'TO supplier_compliance_documents_pkey';
        END IF;

        RETURN;
    END IF;


    /*
     * Same recognizable state with an alternate explicitly named legacy table.
     */
    IF
        old_exists
        AND
        old_has_requirement_id
        AND
        NOT old_has_contract_id
        AND
        NOT vault_exists
        AND
        alternative_legacy_exists
        AND
        alternative_has_contract_id
    THEN
        EXECUTE
            'ALTER TABLE supplier_compliance_documents '
            'RENAME TO supplier_document_vault_documents';

        EXECUTE
            'ALTER TABLE supplier_contract_compliance_documents '
            'RENAME TO supplier_compliance_documents';

        RETURN;
    END IF;


    /*
     * Vault already separated but V13 is still under the temporary bridge.
     */
    IF
        NOT old_exists
        AND
        vault_exists
        AND
        vault_has_requirement_id
        AND
        temp_exists
        AND
        temp_has_contract_id
    THEN
        EXECUTE
            'ALTER TABLE supplier_compliance_documents_v13_legacy '
            'RENAME TO supplier_compliance_documents';

        RETURN;
    END IF;


    RAISE EXCEPTION
        'Unable to safely normalize supplier compliance document authorities. '
        'old_exists=%, temp_exists=%, vault_exists=%, '
        'alternative_legacy_exists=%, old_has_contract_id=%, '
        'old_has_requirement_id=%, temp_has_contract_id=%, '
        'alternative_has_contract_id=%, vault_has_requirement_id=%',
        old_exists,
        temp_exists,
        vault_exists,
        alternative_legacy_exists,
        old_has_contract_id,
        old_has_requirement_id,
        temp_has_contract_id,
        alternative_has_contract_id,
        vault_has_requirement_id;
END;
$$;


/*
 * Final authority assertions.
 */

DO $$
BEGIN
    IF to_regclass(
        current_schema()
        || '.supplier_compliance_documents'
    ) IS NULL THEN
        RAISE EXCEPTION
            'V73 missing V13 supplier_compliance_documents';
    END IF;


    IF to_regclass(
        current_schema()
        || '.supplier_document_vault_documents'
    ) IS NULL THEN
        RAISE EXCEPTION
            'V73 missing V34 supplier_document_vault_documents';
    END IF;


    IF NOT EXISTS (
        SELECT 1

        FROM information_schema.columns

        WHERE table_schema =
            current_schema()

        AND table_name =
            'supplier_compliance_documents'

        AND column_name =
            'contract_id'
    ) THEN
        RAISE EXCEPTION
            'V73 legacy compliance authority lacks contract_id';
    END IF;


    IF EXISTS (
        SELECT 1

        FROM information_schema.columns

        WHERE table_schema =
            current_schema()

        AND table_name =
            'supplier_compliance_documents'

        AND column_name =
            'requirement_id'
    ) THEN
        RAISE EXCEPTION
            'V73 legacy authority incorrectly exposes requirement_id';
    END IF;


    IF NOT EXISTS (
        SELECT 1

        FROM information_schema.columns

        WHERE table_schema =
            current_schema()

        AND table_name =
            'supplier_document_vault_documents'

        AND column_name =
            'requirement_id'
    ) THEN
        RAISE EXCEPTION
            'V73 vault authority lacks requirement_id';
    END IF;


    IF EXISTS (
        SELECT 1

        FROM information_schema.columns

        WHERE table_schema =
            current_schema()

        AND table_name =
            'supplier_document_vault_documents'

        AND column_name =
            'contract_id'
    ) THEN
        RAISE EXCEPTION
            'V73 vault authority incorrectly exposes contract_id';
    END IF;


    IF to_regclass(
        current_schema()
        || '.supplier_compliance_documents_v13_legacy'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'V73 temporary legacy table remains';
    END IF;
END;
$$;
