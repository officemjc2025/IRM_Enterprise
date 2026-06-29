-- =====================================================
-- IRM Enterprise
-- Module : Unit
-- Version: 0.2.1
-- =====================================================

CREATE TABLE IF NOT EXISTS unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    property_id UUID NOT NULL,

    building_code VARCHAR(20) NOT NULL,
    floor VARCHAR(20) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,

    area NUMERIC(10,2) NOT NULL DEFAULT 0,
    ownership_ratio NUMERIC(10,6) NOT NULL DEFAULT 0,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_unit_property
        FOREIGN KEY(property_id)
        REFERENCES property(id)
);

CREATE INDEX IF NOT EXISTS idx_unit_property
ON unit(property_id);

CREATE INDEX IF NOT EXISTS idx_unit_building
ON unit(building_code);

CREATE INDEX IF NOT EXISTS idx_unit_number
ON unit(unit_number);

CREATE INDEX IF NOT EXISTS idx_unit_status
ON unit(status);
