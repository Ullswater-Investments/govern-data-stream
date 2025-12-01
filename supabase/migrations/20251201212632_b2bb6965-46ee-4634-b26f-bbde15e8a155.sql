-- Create demo organizations
INSERT INTO public.organizations (id, name, description, org_type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'NovaTech Industries', 'Technology consumer seeking IoT and operational data', 'consumer'),
  ('22222222-2222-2222-2222-222222222222', 'GreenCorp Manufacturing', 'Manufacturing provider - data subject for ESG compliance', 'provider'),
  ('33333333-3333-3333-3333-333333333333', 'DataVault Solutions', 'Enterprise data holder and custodian', 'holder'),
  ('44444444-4444-4444-4444-444444444444', 'ACME Industrial', 'Multi-role industrial conglomerate', 'consumer'),
  ('55555555-5555-5555-5555-555555555555', 'EcoMetrics Inc', 'Environmental data provider', 'provider'),
  ('66666666-6666-6666-6666-666666666666', 'SecureData Corp', 'Secure data holder and processor', 'holder')
ON CONFLICT (id) DO NOTHING;

-- Create sample data assets
INSERT INTO public.data_assets (id, name, description, data_type, provider_org_id, holder_org_id, metadata) VALUES
  (
    '77777777-7777-7777-7777-777777777777',
    'Manufacturing IoT Telemetry',
    'Real-time sensor data from manufacturing floor including temperature, pressure, and vibration metrics',
    'iot',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '{"sensors": ["temperature", "pressure", "vibration"], "frequency": "1Hz", "retention": "90 days"}'::jsonb
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'ESG Compliance Reports',
    'Quarterly environmental, social, and governance metrics including carbon emissions and energy consumption',
    'esg',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '{"scope": ["scope1", "scope2", "scope3"], "certifications": ["ISO14001", "B-Corp"], "reporting_period": "quarterly"}'::jsonb
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Financial Performance Data',
    'Monthly financial statements and performance indicators for supply chain analysis',
    'financial',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '{"metrics": ["revenue", "costs", "margins"], "currency": "USD", "granularity": "monthly"}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Production Quality Metrics',
    'Defect rates, quality scores, and inspection results from production lines',
    'array',
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666666',
    '{"quality_standards": ["ISO9001", "Six Sigma"], "measurement_frequency": "continuous"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Energy Consumption Data',
    'Hourly energy usage across facilities with breakdown by source and department',
    'iot',
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    '{"sources": ["grid", "solar", "backup"], "granularity": "hourly", "locations": ["facility-a", "facility-b"]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Function to assign super admin access to a user
CREATE OR REPLACE FUNCTION public.assign_super_admin(user_email TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found with email: ' || user_email, NULL::UUID;
    RETURN;
  END IF;

  -- Delete existing user_organizations to avoid conflicts
  DELETE FROM public.user_organizations WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;

  -- Assign user to all organizations with admin role
  FOR v_org_id IN SELECT id FROM public.organizations
  LOOP
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (v_user_id, v_org_id, 'admin')
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = 'admin';
  END LOOP;

  -- Add all roles to user_roles table
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_user_id, 'admin'),
    (v_user_id, 'consumer'),
    (v_user_id, 'provider'),
    (v_user_id, 'holder')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY SELECT TRUE, 'Super admin access granted successfully to all 6 organizations', v_user_id;
END;
$$;

-- Create some sample transactions to demonstrate the workflow
-- Note: These will need a valid user_id, so we'll create them with a placeholder
-- They can be updated later with real user IDs