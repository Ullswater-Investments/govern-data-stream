import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  asset_id: string;
  status: string;
  purpose: string | null;
  created_at: string;
  consumer_org_id: string;
  provider_org_id: string;
  holder_org_id: string;
  asset: any;
  consumer: any;
  provider: any;
  holder: any;
}

const Transactions = () => {
  const { user } = useAuth();
  const { currentOrganization } = useOrganizationContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      fetchTransactions();
    }
  }, [currentOrganization]);

  const fetchTransactions = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("data_transactions")
      .select(`
        *,
        asset:data_assets(name, data_type),
        consumer:consumer_org_id(name),
        provider:provider_org_id(name),
        holder:holder_org_id(name)
      `)
      .or(
        `consumer_org_id.eq.${currentOrganization.organization_id},provider_org_id.eq.${currentOrganization.organization_id},holder_org_id.eq.${currentOrganization.organization_id}`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (transaction: Transaction) => {
    if (!user || !currentOrganization) return;

    let updateData: any = {};

    if (
      transaction.status === "pending_subject" &&
      transaction.provider_org_id === currentOrganization.organization_id
    ) {
      updateData = {
        status: "pending_holder",
        subject_approved_at: new Date().toISOString(),
        subject_approved_by: user.id,
      };
    } else if (
      transaction.status === "pending_holder" &&
      transaction.holder_org_id === currentOrganization.organization_id
    ) {
      updateData = {
        status: "completed",
        holder_approved_at: new Date().toISOString(),
        holder_approved_by: user.id,
        completed_at: new Date().toISOString(),
      };
    } else {
      toast.error("You don't have permission to approve this transaction");
      return;
    }

    const { error } = await supabase
      .from("data_transactions")
      .update(updateData)
      .eq("id", transaction.id);

    if (error) {
      console.error("Error approving transaction:", error);
      toast.error("Failed to approve transaction");
    } else {
      toast.success("Transaction approved successfully!");
      fetchTransactions();
    }
  };

  const handleReject = async (transaction: Transaction) => {
    const { error } = await supabase
      .from("data_transactions")
      .update({ status: "rejected" })
      .eq("id", transaction.id);

    if (error) {
      console.error("Error rejecting transaction:", error);
      toast.error("Failed to reject transaction");
    } else {
      toast.success("Transaction rejected");
      fetchTransactions();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      initiated: { variant: "secondary", icon: Clock, label: "Initiated" },
      pending_subject: { variant: "default", icon: Clock, label: "Pending Subject" },
      pending_holder: { variant: "default", icon: Clock, label: "Pending Holder" },
      approved: { variant: "secondary", icon: CheckCircle2, label: "Approved" },
      completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
    };

    const config = statusConfig[status] || statusConfig.initiated;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canApprove = (transaction: Transaction) => {
    if (!currentOrganization) return false;

    if (
      transaction.status === "pending_subject" &&
      transaction.provider_org_id === currentOrganization.organization_id
    ) {
      return true;
    }

    if (
      transaction.status === "pending_holder" &&
      transaction.holder_org_id === currentOrganization.organization_id
    ) {
      return true;
    }

    return false;
  };

  const filterTransactionsByRole = (role: string) => {
    if (!currentOrganization) return [];

    switch (role) {
      case "requested":
        return transactions.filter(
          (t) => t.consumer_org_id === currentOrganization.organization_id
        );
      case "provider":
        return transactions.filter(
          (t) => t.provider_org_id === currentOrganization.organization_id
        );
      case "holder":
        return transactions.filter(
          (t) => t.holder_org_id === currentOrganization.organization_id
        );
      default:
        return transactions;
    }
  };

  const TransactionCard = ({ transaction }: { transaction: Transaction }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {transaction.asset?.name || "Unknown Asset"}
            </CardTitle>
            <CardDescription className="mt-2">
              {transaction.purpose || "No purpose specified"}
            </CardDescription>
          </div>
          {getStatusBadge(transaction.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Consumer</div>
            <div className="font-medium">{transaction.consumer?.name || "Unknown"}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Provider</div>
            <div className="font-medium">{transaction.provider?.name || "Unknown"}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Holder</div>
            <div className="font-medium">{transaction.holder?.name || "Unknown"}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Created: {new Date(transaction.created_at).toLocaleString()}
        </div>

        {canApprove(transaction) && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleApprove(transaction)}
              className="flex-1"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={() => handleReject(transaction)}
              variant="destructive"
              className="flex-1"
              size="sm"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Transactions</h1>
        <p className="text-muted-foreground">
          Manage and track all data governance transactions
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="requested">My Requests</TabsTrigger>
          <TabsTrigger value="provider">As Provider</TabsTrigger>
          <TabsTrigger value="holder">As Holder</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No transactions found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requested" className="space-y-4 mt-6">
          {filterTransactionsByRole("requested").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filterTransactionsByRole("requested").map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="provider" className="space-y-4 mt-6">
          {filterTransactionsByRole("provider").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No provider transactions found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filterTransactionsByRole("provider").map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="holder" className="space-y-4 mt-6">
          {filterTransactionsByRole("holder").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No holder transactions found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filterTransactionsByRole("holder").map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Transactions;