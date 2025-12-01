-- Completely fix assign_super_admin function
DROP FUNCTION IF EXISTS public.assign_super_admin(text);

CREATE OR REPLACE FUNCTION public.assign_super_admin(p_user_email text)
 RETURNS TABLE(success boolean, message text, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_user_id UUID;
  org_record RECORD;
BEGIN
  -- Find user by email
  SELECT u.id INTO found_user_id
  FROM auth.users u
  WHERE u.email = p_user_email;

  IF found_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found with email: ' || p_user_email, NULL::UUID;
    RETURN;
  END IF;

  -- Delete existing memberships
  DELETE FROM public.user_organizations WHERE public.user_organizations.user_id = found_user_id;
  DELETE FROM public.user_roles WHERE public.user_roles.user_id = found_user_id;

  -- Assign user to all organizations with admin role
  FOR org_record IN SELECT o.id FROM public.organizations o
  LOOP
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (found_user_id, org_record.id, 'admin');
  END LOOP;

  -- Add all roles
  INSERT INTO public.user_roles (user_id, role) VALUES (found_user_id, 'admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (found_user_id, 'consumer');
  INSERT INTO public.user_roles (user_id, role) VALUES (found_user_id, 'provider');
  INSERT INTO public.user_roles (user_id, role) VALUES (found_user_id, 'holder');

  RETURN QUERY SELECT TRUE, 'Super admin access granted successfully', found_user_id;
END;
$function$;