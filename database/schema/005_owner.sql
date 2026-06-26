-- =====================================================
-- IRM Enterprise
-- Module : Owner
-- Version : 0.3.0
-- =====================================================

CREATE TABLE owner (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    unit_id UUID NOT NULL,

    owner_type VARCHAR(30) DEFAULT 'PERSON',

    title VARCHAR(30),

    first_name VARCHAR(255) NOT NULL,

    last_name VARCHAR(255),

    company_name VARCHAR(255),

    id_card VARCHAR(30),

    passport_no VARCHAR(30),

    nationality VARCHAR(100),

    phone VARCHAR(100),

    email VARCHAR(255),

    ownership_percent NUMERIC(5,2) DEFAULT 100,

    start_date DATE,

    end_date DATE,

    is_primary BOOLEAN DEFAULT TRUE,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP,

    CONSTRAINT fk_owner_unit
        FOREIGN KEY(unit_id)
        REFERENCES unit(id)

);

CREATE INDEX idx_owner_unit
ON owner(unit_id);

CREATE INDEX idx_owner_status
ON owner(status);