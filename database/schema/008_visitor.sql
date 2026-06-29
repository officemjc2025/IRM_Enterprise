CREATE TABLE IF NOT EXISTS visitor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_number VARCHAR(100) UNIQUE NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    purpose VARCHAR(255) NOT NULL,
    vehicle_plate VARCHAR(100),
    company VARCHAR(255),
    unit_id UUID NOT NULL REFERENCES unit(id),
    occupancy_id UUID REFERENCES occupancy(id),
    security_user VARCHAR(255),
    check_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
    expected_checkout_time TIMESTAMP,
    actual_checkout_time TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'CHECKED_IN',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visitor_number ON visitor(visitor_number);
CREATE INDEX IF NOT EXISTS idx_visitor_unit ON visitor(unit_id);
CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor(status);
