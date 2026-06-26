-- =====================================================
-- IRM Enterprise
-- Module : Resident Assignment
-- Version : 0.3.1
-- =====================================================

CREATE TABLE resident_assignment (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_id UUID NOT NULL,

    unit_id UUID NOT NULL,

    resident_type VARCHAR(30) NOT NULL,

    relationship_type VARCHAR(30),

    move_in_date DATE NOT NULL,

    move_out_date DATE,

    is_primary BOOLEAN DEFAULT FALSE,

    can_receive_mail BOOLEAN DEFAULT TRUE,

    can_book_facility BOOLEAN DEFAULT TRUE,

    can_vote BOOLEAN DEFAULT FALSE,

    emergency_contact BOOLEAN DEFAULT FALSE,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_resident_person
        FOREIGN KEY(person_id)
        REFERENCES person(id),

    CONSTRAINT fk_resident_unit
        FOREIGN KEY(unit_id)
        REFERENCES unit(id)

);

CREATE INDEX idx_resident_person
ON resident_assignment(person_id);

CREATE INDEX idx_resident_unit
ON resident_assignment(unit_id);

CREATE INDEX idx_resident_status
ON resident_assignment(status);