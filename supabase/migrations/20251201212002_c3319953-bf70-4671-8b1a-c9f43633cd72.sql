-- Create enums for roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'consumer', 'provider', 'holder');
CREATE TYPE public.transaction_status AS ENUM ('initiated', 'pending_subject', 'pending_holder', 'approved', 'completed', 'rejected');
CREATE TYPE public.data_type AS ENUM ('iot', 'esg', 'financial', 'array');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  org_type TEXT NOT NULL, -- 'consumer', 'provider', 'holder'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations are viewable by all authenticated users"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create user_organizations table (many-to-many)
CREATE TABLE public.user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization memberships"
  ON public.user_organizations FOR SELECT
  USING (auth.uid() = user_id);

-- Create data_assets table (catalog)
CREATE TABLE public.data_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  data_type data_type NOT NULL,
  provider_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  holder_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.data_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Data assets are viewable by all authenticated users"
  ON public.data_assets FOR SELECT
  TO authenticated
  USING (true);

-- Create data_transactions table (the core workflow)
CREATE TABLE public.data_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.data_assets(id) ON DELETE CASCADE NOT NULL,
  consumer_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  provider_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  holder_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status transaction_status NOT NULL DEFAULT 'initiated',
  purpose TEXT,
  data_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject_approved_at TIMESTAMPTZ,
  subject_approved_by UUID REFERENCES auth.users(id),
  holder_approved_at TIMESTAMPTZ,
  holder_approved_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.data_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions for their organizations"
  ON public.data_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
      AND (
        organization_id = consumer_org_id
        OR organization_id = provider_org_id
        OR organization_id = holder_org_id
      )
    )
  );

CREATE POLICY "Users can create transactions for their consumer organizations"
  ON public.data_transactions FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = consumer_org_id
    )
  );

CREATE POLICY "Users can update transactions for their organizations"
  ON public.data_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
      AND (
        organization_id = provider_org_id
        OR organization_id = holder_org_id
      )
    )
  );

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Create trigger function to handle profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_assets_updated_at
  BEFORE UPDATE ON public.data_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_transactions_updated_at
  BEFORE UPDATE ON public.data_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();