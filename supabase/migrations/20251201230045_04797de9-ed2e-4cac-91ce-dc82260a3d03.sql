-- Fix the assign_super_admin function with proper variable naming
CREATE OR REPLACE FUNCTION public.assign_super_admin(user_email text)
 RETURNS TABLE(success boolean, message text, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Delete existing user_organizations to avoid conflicts (fixed ambiguous reference)
  DELETE FROM public.user_organizations uo WHERE uo.user_id = v_user_id;
  DELETE FROM public.user_roles ur WHERE ur.user_id = v_user_id;

  -- Assign user to all organizations with admin role
  FOR v_org_id IN SELECT o.id FROM public.organizations o
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

  RETURN QUERY SELECT TRUE, 'Super admin access granted successfully to all organizations', v_user_id;
END;
$function$;