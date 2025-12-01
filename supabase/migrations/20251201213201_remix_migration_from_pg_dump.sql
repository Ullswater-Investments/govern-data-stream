CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'consumer',
    'provider',
    'holder'
);


--
-- Name: data_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.data_type AS ENUM (
    'iot',
    'esg',
    'financial',
    'array'
);


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_status AS ENUM (
    'initiated',
    'pending_subject',
    'pending_holder',
    'approved',
    'completed',
    'rejected'
);


--
-- Name: assign_super_admin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_super_admin(user_email text) RETURNS TABLE(success boolean, message text, user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: data_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    data_type public.data_type NOT NULL,
    provider_org_id uuid NOT NULL,
    holder_org_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    consumer_org_id uuid NOT NULL,
    provider_org_id uuid NOT NULL,
    holder_org_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    status public.transaction_status DEFAULT 'initiated'::public.transaction_status NOT NULL,
    purpose text,
    data_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_approved_at timestamp with time zone,
    subject_approved_by uuid,
    holder_approved_at timestamp with time zone,
    holder_approved_by uuid,
    completed_at timestamp with time zone
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    org_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: data_assets data_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_assets
    ADD CONSTRAINT data_assets_pkey PRIMARY KEY (id);


--
-- Name: data_transactions data_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: data_assets update_data_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_data_assets_updated_at BEFORE UPDATE ON public.data_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: data_transactions update_data_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_data_transactions_updated_at BEFORE UPDATE ON public.data_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: data_assets data_assets_holder_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_assets
    ADD CONSTRAINT data_assets_holder_org_id_fkey FOREIGN KEY (holder_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_assets data_assets_provider_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_assets
    ADD CONSTRAINT data_assets_provider_org_id_fkey FOREIGN KEY (provider_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.data_assets(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_consumer_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_consumer_org_id_fkey FOREIGN KEY (consumer_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_holder_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_holder_approved_by_fkey FOREIGN KEY (holder_approved_by) REFERENCES auth.users(id);


--
-- Name: data_transactions data_transactions_holder_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_holder_org_id_fkey FOREIGN KEY (holder_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_provider_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_provider_org_id_fkey FOREIGN KEY (provider_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: data_transactions data_transactions_subject_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transactions
    ADD CONSTRAINT data_transactions_subject_approved_by_fkey FOREIGN KEY (subject_approved_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: data_assets Data assets are viewable by all authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Data assets are viewable by all authenticated users" ON public.data_assets FOR SELECT TO authenticated USING (true);


--
-- Name: organizations Organizations are viewable by all authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Organizations are viewable by all authenticated users" ON public.organizations FOR SELECT TO authenticated USING (true);


--
-- Name: data_transactions Users can create transactions for their consumer organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create transactions for their consumer organizations" ON public.data_transactions FOR INSERT WITH CHECK (((auth.uid() = requested_by) AND (EXISTS ( SELECT 1
   FROM public.user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = data_transactions.consumer_org_id))))));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: data_transactions Users can update transactions for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update transactions for their organizations" ON public.data_transactions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND ((user_organizations.organization_id = data_transactions.provider_org_id) OR (user_organizations.organization_id = data_transactions.holder_org_id))))));


--
-- Name: user_organizations Users can view their own organization memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own organization memberships" ON public.user_organizations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: data_transactions Users can view transactions for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view transactions for their organizations" ON public.data_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND ((user_organizations.organization_id = data_transactions.consumer_org_id) OR (user_organizations.organization_id = data_transactions.provider_org_id) OR (user_organizations.organization_id = data_transactions.holder_org_id))))));


--
-- Name: data_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: data_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


