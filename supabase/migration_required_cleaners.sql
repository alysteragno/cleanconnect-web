-- Extend the operational rules trigger to auto-calculate required_cleaners from sqm.
-- Tiers mirror duration_hours so both scale together.
-- The trigger only fires on INSERT or UPDATE OF property_sqm, so a direct
-- admin UPDATE of required_cleaners is never overwritten (override preserved).

CREATE OR REPLACE FUNCTION apply_cleanconnect_operational_rules()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.property_sqm <= 30 THEN
        NEW.duration_hours    := 2.0;
        NEW.base_price        := 1000.00;
        NEW.required_cleaners := 1;
    ELSIF NEW.property_sqm <= 60 THEN
        NEW.duration_hours    := 3.0;
        NEW.base_price        := 1800.00;
        NEW.required_cleaners := 2;
    ELSIF NEW.property_sqm <= 100 THEN
        NEW.duration_hours    := 4.0;
        NEW.base_price        := 2500.00;
        NEW.required_cleaners := 3;
    ELSE
        NEW.duration_hours    := 4.0 + CEIL((NEW.property_sqm - 100) / 50.0);
        NEW.base_price        := 2500.00 + (CEIL((NEW.property_sqm - 100) / 50.0) * 800.00);
        NEW.required_cleaners := 3 + CEIL((NEW.property_sqm - 100) / 50.0)::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
