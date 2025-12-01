import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, LayoutDashboard, Database, FileText, LogOut, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut, loading } = useAuth();
  const { currentOrganization, organizations, setCurrentOrganization } =
    useOrganizationContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navigationItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/catalog", label: "Catalog", icon: Database },
    { path: "/transactions", label: "Transactions", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">PROCUREDATA</h1>
              <p className="text-xs text-sidebar-foreground/70">Data Governance</p>
            </div>
          </Link>
        </div>

        {/* Organization Switcher */}
        {organizations.length > 0 && currentOrganization && (
          <div className="p-4 border-b border-sidebar-border">
            <label className="text-xs font-medium text-sidebar-foreground/70 mb-2 block">
              Current Organization
            </label>
            <Select
              value={currentOrganization.organization_id}
              onValueChange={(value) => {
                const org = organizations.find((o) => o.organization_id === value);
                if (org) setCurrentOrganization(org);
              }}
            >
              <SelectTrigger className="bg-sidebar-accent text-sidebar-accent-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.organization_id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{org.organization.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {org.organization.org_type}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentOrganization && (
              <Badge
                variant="secondary"
                className="mt-2 text-xs capitalize"
              >
                {currentOrganization.role}
              </Badge>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link to={item.path}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.user_metadata?.full_name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {user.user_metadata?.full_name || "User"}
              </div>
              <div className="text-xs text-sidebar-foreground/70 truncate">
                {user.email}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;