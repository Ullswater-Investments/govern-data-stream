import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { fiwareApi } from '@/services/fiwareApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Database, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Activity,
  Server
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  pendingApprovals: number;
  activeTransactions: number;
  completedTransactions: number;
  availableAssets: number;
  fiwareEntities: number;
}

const DashboardEnhanced = () => {
  const { currentOrganization } = useOrganizationContext();
  const [stats, setStats] = useState<Stats>({
    pendingApprovals: 0,
    activeTransactions: 0,
    completedTransactions: 0,
    availableAssets: 0,
    fiwareEntities: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Query FIWARE entities for real-time stats
  const { data: fiwareResponse } = useQuery({
    queryKey: ['fiware-entities-count'],
    queryFn: () => fiwareApi.getEntities(),
    refetchInterval: 30000 // Refresh every 30s
  });

  useEffect(() => {
    if (!currentOrganization) return;

    const fetchDashboardData = async () => {
      setLoading(true);

      // Fetch transactions from Supabase
      const { data: transactions } = await supabase
        .from('data_transactions')
        .select('*, asset:data_assets(name), consumer:consumer_org_id(name), provider:provider_org_id(name), holder:holder_org_id(name)')
        .or(
          `consumer_org_id.eq.${currentOrganization.organization_id},provider_org_id.eq.${currentOrganization.organization_id},holder_org_id.eq.${currentOrganization.organization_id}`
        )
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTransactions(transactions || []);

      // Calculate Supabase stats
      const pending = transactions?.filter(
        (t) =>
          (t.status === 'pending_subject' &&
            t.provider_org_id === currentOrganization.organization_id) ||
          (t.status === 'pending_holder' &&
            t.holder_org_id === currentOrganization.organization_id)
      ).length || 0;

      const active =
        transactions?.filter(
          (t) => t.status !== 'completed' && t.status !== 'rejected'
        ).length || 0;

      const completed =
        transactions?.filter((t) => t.status === 'completed').length || 0;

      // Fetch Supabase assets
      const { data: assets } = await supabase
        .from('data_assets')
        .select('id');

      // Get FIWARE entity count
      const fiwareEntitiesCount = fiwareResponse?.success 
        ? fiwareResponse.data.length 
        : 0;

      setStats({
        pendingApprovals: pending,
        activeTransactions: active,
        completedTransactions: completed,
        availableAssets: assets?.length || 0,
        fiwareEntities: fiwareEntitiesCount,
      });

      setLoading(false);
    };

    fetchDashboardData();
  }, [currentOrganization, fiwareResponse]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      initiated: { variant: 'secondary', label: 'Initiated' },
      pending_subject: { variant: 'default', label: 'Pending Subject' },
      pending_holder: { variant: 'default', label: 'Pending Holder' },
      approved: { variant: 'secondary', label: 'Approved' },
      completed: { variant: 'default', label: 'Completed' },
      rejected: { variant: 'destructive', label: 'Rejected' },
    };

    const config = statusConfig[status] || statusConfig.initiated;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard v2</h1>
        <p className="text-muted-foreground">
          PROCUREDATA con integración FIWARE en tiempo real
        </p>
      </div>

      {/* Stats Grid - Enhanced with FIWARE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requiring action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Transactions</CardTitle>
            <AlertCircle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Assets</CardTitle>
            <Database className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.availableAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In catalog
            </p>
          </CardContent>
        </Card>

        {/* NEW: FIWARE Live Entities */}
        <Card className="bg-gradient-subtle border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">FIWARE Entities</CardTitle>
            <Activity className="w-4 h-4 text-primary animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fiwareEntities}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Live in Orion-LD
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest data governance activities</CardDescription>
            </div>
            <Link to="/transactions">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm mt-1">Start by browsing the catalog</p>
              <Link to="/catalog">
                <Button className="mt-4">Browse Catalog</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{transaction.asset?.name || 'Unknown Asset'}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {transaction.purpose || 'No purpose specified'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </div>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 bg-gradient-subtle">
          <CardHeader>
            <CardTitle>Browse Data Catalog</CardTitle>
            <CardDescription>
              Explore available data assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/catalog">
              <Button className="w-full">
                <Database className="w-4 h-4 mr-2" />
                View Catalog
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-gradient-subtle">
          <CardHeader>
            <CardTitle>Manage Transactions</CardTitle>
            <CardDescription>
              Review pending requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/transactions">
              <Button variant="outline" className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                View Transactions
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-subtle">
          <CardHeader>
            <CardTitle>FIWARE Node</CardTitle>
            <CardDescription>
              Manage data space infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/fiware-node">
              <Button variant="outline" className="w-full">
                <Server className="w-4 h-4 mr-2" />
                Admin Panel
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardEnhanced;
