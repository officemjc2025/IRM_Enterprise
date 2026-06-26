-- =====================================================
-- IRM Enterprise
-- Module : Floor
-- Version : 0.2.1
-- =====================================================

CREATE TABLE floor (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    building_id UUID NOT NULL,

    floor_number INTEGER NOT NULL,

    floor_name_th VARCHAR(100),
    floor_name_en VARCHAR(100),

    total_units INTEGER DEFAULT 0,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_floor_building
        FOREIGN KEY (building_id)
        REFERENCES building(id)

);

CREATE INDEX idx_floor_building
ON floor(building_id);

CREATE INDEX idx_floor_number
ON floor(floor_number);
