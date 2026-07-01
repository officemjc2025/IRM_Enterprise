-- Helper function to perform bulk insert/update of units within a transaction-safe context
CREATE OR REPLACE FUNCTION public.import_units(payload jsonb)
RETURNS jsonb AS $$
DECLARE
  item jsonb;
  v_property_id UUID;
  v_building_code VARCHAR;
  v_floor VARCHAR;
  v_unit_number VARCHAR;
  v_area NUMERIC;
  v_ownership_ratio NUMERIC;
  v_status VARCHAR;
  v_unit_id UUID;
  
  inserted_count INT := 0;
  updated_count INT := 0;
BEGIN
  -- Iterate through each item in the payload array
  FOR item IN SELECT * FROM jsonb_array_elements(payload) LOOP
    v_property_id := (item->>'property_id')::UUID;
    v_building_code := item->>'building_code';
    v_floor := item->>'floor';
    v_unit_number := item->>'unit_number';
    v_area := (item->>'area')::NUMERIC;
    v_ownership_ratio := (item->>'ownership_ratio')::NUMERIC;
    v_status := COALESCE(item->>'status', 'ACTIVE');

    -- Check if the unit already exists for this property and unit number
    SELECT id INTO v_unit_id 
    FROM public.units 
    WHERE property_id = v_property_id AND unit_number = v_unit_number;

    IF v_unit_id IS NOT NULL THEN
      -- Update existing unit
      UPDATE public.units
      SET 
        building_code = v_building_code,
        floor = v_floor,
        area = v_area,
        ownership_ratio = v_ownership_ratio,
        status = v_status,
        updated_at = NOW()
      WHERE id = v_unit_id;
      
      updated_count := updated_count + 1;
    ELSE
      -- Insert new unit
      INSERT INTO public.units (
        property_id,
        building_code,
        floor,
        unit_number,
        area,
        ownership_ratio,
        status
      ) VALUES (
        v_property_id,
        v_building_code,
        v_floor,
        v_unit_number,
        v_area,
        v_ownership_ratio,
        v_status
      );
      
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
