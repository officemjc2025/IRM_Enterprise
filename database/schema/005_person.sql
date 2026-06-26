-- =====================================================
-- IRM Enterprise
-- Module : Person
-- Version : 0.3.1
-- =====================================================

CREATE TABLE person (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person_code VARCHAR(30) UNIQUE,

    person_type VARCHAR(30) DEFAULT 'PERSON',

    title VARCHAR(30),

    first_name VARCHAR(150) NOT NULL,

    last_name VARCHAR(150),

    first_name_en VARCHAR(150),

    last_name_en VARCHAR(150),

    nickname VARCHAR(100),

    gender VARCHAR(20),

    birth_date DATE,

    nationality VARCHAR(100),

    id_card VARCHAR(30),

    passport_no VARCHAR(50),

    tax_id VARCHAR(30),

    mobile VARCHAR(50),

    phone VARCHAR(50),

    email VARCHAR(255),

    line_id VARCHAR(100),

    photo_url TEXT,

    preferred_language VARCHAR(10) DEFAULT 'th',

    status VARCHAR(30) DEFAULT 'ACTIVE',

    remarks TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP
);

CREATE INDEX idx_person_code
ON person(person_code);

CREATE INDEX idx_person_name
ON person(first_name,last_name);

CREATE INDEX idx_person_email
ON person(email);

CREATE INDEX idx_person_mobile
ON person(mobile);