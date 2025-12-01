import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Organization {
  id: string;
  name: string;
  description: string | null;
  org_type: string;
}

interface UserOrganization {
  id: string;
  organization_id: string;
  role: string;
  organization: Organization;
}

interface OrganizationContextType {
  organizations: UserOrganization[];
  currentOrganization: UserOrganization | null;
  setCurrentOrganization: (org: UserOrganization) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export const OrganizationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [currentOrganization, setCurrentOrganization] =
    useState<UserOrganization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
      return;
    }

    const fetchOrganizations = async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select(
          `
          *,
          organization:organizations(*)
        `
        )
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching organizations:", error);
        setLoading(false);
        return;
      }

      setOrganizations(data || []);
      if (data && data.length > 0 && !currentOrganization) {
        setCurrentOrganization(data[0]);
      }
      setLoading(false);
    };

    fetchOrganizations();
  }, [user]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        setCurrentOrganization,
        loading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganizationContext = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganizationContext must be used within an OrganizationProvider"
    );
  }
  return context;
};