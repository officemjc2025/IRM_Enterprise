-- =====================================================
-- IRM Enterprise
-- Module : Person
-- Version : 0.3.0
-- =====================================================

CREATE TABLE IF NOT EXISTS person (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_code VARCHAR(30) UNIQUE,

    title VARCHAR(30),

    first_name VARCHAR(255) NOT NULL,

    last_name VARCHAR(255) NOT NULL,

    display_name VARCHAR(255),

    gender VARCHAR(30),

    date_of_birth DATE,

    nationality VARCHAR(100),

    phone VARCHAR(100),

    email VARCHAR(255),

    id_card VARCHAR(30),

    passport VARCHAR(50),

    photo TEXT,

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_person_code
ON person(person_code);

CREATE INDEX IF NOT EXISTS idx_person_name
ON person(first_name, last_name);

CREATE INDEX IF NOT EXISTS idx_person_status
ON person(status);