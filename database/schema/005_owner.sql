-- =====================================================
-- IRM Enterprise
-- Module : Owner
-- Version : 0.3.0
-- =====================================================

CREATE TABLE IF NOT EXISTS owner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_code VARCHAR(30) UNIQUE NOT NULL,

    full_name VARCHAR(255) NOT NULL,

    phone VARCHAR(100),

    email VARCHAR(255),

    nationality VARCHAR(100),

    tax_id VARCHAR(30),

    status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    created_by UUID,
    updated_by UUID,

    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_code
ON owner(owner_code);

CREATE INDEX IF NOT EXISTS idx_owner_status
ON owner(status);