-- =====================================================
-- IRM Enterprise
-- Module : Occupancy
-- Version : 0.3.0
-- =====================================================

CREATE TABLE IF NOT EXISTS occupancy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    unit_id UUID NOT NULL,
    person_id UUID NOT NULL,

    occupancy_type VARCHAR(30) NOT NULL, -- OWNER, CO_OWNER, TENANT, RESIDENT, COMPANY, VACANT

    start_date DATE NOT NULL,
    end_date DATE,

    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_occupancy_unit
        FOREIGN KEY(unit_id)
        REFERENCES unit(id),

    CONSTRAINT fk_occupancy_person
        FOREIGN KEY(person_id)
        REFERENCES person(id)
);

CREATE INDEX IF NOT EXISTS idx_occupancy_unit
ON occupancy(unit_id);

CREATE INDEX IF NOT EXISTS idx_occupancy_person
ON occupancy(person_id);

CREATE INDEX IF NOT EXISTS idx_occupancy_type
ON occupancy(occupancy_type);

CREATE INDEX IF NOT EXISTS idx_occupancy_status
ON occupancy(status);
