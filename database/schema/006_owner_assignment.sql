-- =====================================================
-- IRM Enterprise
-- Module : Owner Assignment
-- Version : 0.3.1
-- =====================================================

CREATE TABLE owner_assignment (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_id UUID NOT NULL,

    unit_id UUID NOT NULL,

    ownership_type VARCHAR(30) DEFAULT 'OWNER',

    ownership_percent NUMERIC(5,2) DEFAULT 100,

    start_date DATE NOT NULL,

    end_date DATE,

    is_primary BOOLEAN DEFAULT TRUE,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_owner_person
        FOREIGN KEY(person_id)
        REFERENCES person(id),

    CONSTRAINT fk_owner_unit
        FOREIGN KEY(unit_id)
        REFERENCES unit(id)

);

CREATE INDEX idx_owner_person
ON owner_assignment(person_id);

CREATE INDEX idx_owner_unit
ON owner_assignment(unit_id);

CREATE INDEX idx_owner_status
ON owner_assignment(status);