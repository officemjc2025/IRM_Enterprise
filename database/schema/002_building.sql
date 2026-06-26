-- =====================================================
-- IRM Enterprise
-- Module : Building
-- Version: 0.2.1
-- =====================================================

CREATE TABLE building (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    property_id UUID NOT NULL,

    building_code VARCHAR(20) NOT NULL,

    building_name_th VARCHAR(255) NOT NULL,
    building_name_en VARCHAR(255),

    total_floors INTEGER DEFAULT 0,

    total_units INTEGER DEFAULT 0,

    description TEXT,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_building_property
        FOREIGN KEY(property_id)
        REFERENCES property(id)

);

CREATE INDEX idx_building_property
ON building(property_id);

CREATE INDEX idx_building_code
ON building(building_code);