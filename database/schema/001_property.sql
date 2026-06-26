-- =====================================================
-- IRM Enterprise
-- Module : Property
-- Version: 0.2.1
-- =====================================================

CREATE TABLE property (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    property_code VARCHAR(20) UNIQUE NOT NULL,

    property_name_th VARCHAR(255) NOT NULL,
    property_name_en VARCHAR(255),

    property_type VARCHAR(50) NOT NULL,

    juristic_name_th VARCHAR(255),
    juristic_name_en VARCHAR(255),

    tax_id VARCHAR(20),

    address_th TEXT,
    address_en TEXT,

    province VARCHAR(100),
    district VARCHAR(100),
    subdistrict VARCHAR(100),

    postcode VARCHAR(10),

    telephone VARCHAR(50),
    fax VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),

    logo_url TEXT,

    timezone VARCHAR(100) DEFAULT 'Asia/Bangkok',

    currency VARCHAR(10) DEFAULT 'THB',

    status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP
);

CREATE INDEX idx_property_code
ON property(property_code);

CREATE INDEX idx_property_status
ON property(status);