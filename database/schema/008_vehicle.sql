-- =====================================================
-- IRM Enterprise
-- Module : Vehicle
-- Version : 0.3.1
-- =====================================================

CREATE TABLE vehicle (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_id UUID NOT NULL,

    unit_id UUID,

    registration_no VARCHAR(30) NOT NULL,

    province VARCHAR(100),

    vehicle_type VARCHAR(30),

    brand VARCHAR(100),

    model VARCHAR(100),

    color VARCHAR(100),

    year INTEGER,

    sticker_no VARCHAR(50),

    rfid_code VARCHAR(100),

    parking_zone VARCHAR(50),

    parking_space VARCHAR(50),

    ownership_type VARCHAR(30) DEFAULT 'PRIVATE',

    is_primary BOOLEAN DEFAULT FALSE,

    lpr_enabled BOOLEAN DEFAULT TRUE,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_vehicle_person
        FOREIGN KEY(person_id)
        REFERENCES person(id),

    CONSTRAINT fk_vehicle_unit
        FOREIGN KEY(unit_id)
        REFERENCES unit(id)

);

CREATE INDEX idx_vehicle_plate
ON vehicle(registration_no);

CREATE INDEX idx_vehicle_person
ON vehicle(person_id);

CREATE INDEX idx_vehicle_unit
ON vehicle(unit_id);

CREATE INDEX idx_vehicle_rfid
ON vehicle(rfid_code);

CREATE INDEX idx_vehicle_status
ON vehicle(status);