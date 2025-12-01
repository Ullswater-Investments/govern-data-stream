import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Database, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

interface DataAsset {
  id: string;
  name: string;
  description: string | null;
  data_type: string;
  provider_org_id: string;
  holder_org_id: string;
  provider: any;
  holder: any;
}

const Catalog = () => {
  const { user } = useAuth();
  const { currentOrganization } = useOrganizationContext();
  const [assets, setAssets] = useState<DataAsset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<DataAsset | null>(null);
  const [purpose, setPurpose] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_assets")
      .select(`
        *,
        provider:provider_org_id(name),
        holder:holder_org_id(name)
      `);

    if (error) {
      console.error("Error fetching assets:", error);
      toast.error("Failed to load catalog");
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  };

  const handleRequestAccess = async () => {
    if (!selectedAsset || !user || !currentOrganization) return;

    if (!purpose.trim()) {
      toast.error("Please provide a purpose for the request");
      return;
    }

    setRequesting(true);

    const { error } = await supabase.from("data_transactions").insert({
      asset_id: selectedAsset.id,
      consumer_org_id: currentOrganization.organization_id,
      provider_org_id: selectedAsset.provider_org_id,
      holder_org_id: selectedAsset.holder_org_id,
      requested_by: user.id,
      status: "initiated",
      purpose: purpose,
    });

    if (error) {
      console.error("Error creating request:", error);
      toast.error("Failed to submit request");
    } else {
      toast.success("Request submitted successfully!");
      setSelectedAsset(null);
      setPurpose("");
    }

    setRequesting(false);
  };

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDataTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      iot: "bg-blue-500",
      esg: "bg-green-500",
      financial: "bg-purple-500",
      array: "bg-orange-500",
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Data Catalog</h1>
        <p className="text-muted-foreground">
          Browse available data assets and request access
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search data assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading catalog...</div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No data assets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Database className="w-8 h-8 text-primary" />
                  <Badge variant="secondary" className="capitalize">
                    <div className={`w-2 h-2 rounded-full mr-2 ${getDataTypeColor(asset.data_type)}`} />
                    {asset.data_type}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{asset.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {asset.description || "No description available"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">Provider:</span>
                    <span>{asset.provider?.name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">Holder:</span>
                    <span>{asset.holder?.name || "Unknown"}</span>
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      Request Access
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Data Access</DialogTitle>
                      <DialogDescription>
                        Submit a request to access "{asset.name}"
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="purpose">Purpose of Request</Label>
                        <Textarea
                          id="purpose"
                          placeholder="Explain why you need access to this data..."
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="bg-muted p-4 rounded-lg text-sm">
                        <p className="font-medium mb-2">Approval Process:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Provider (Data Subject) approval required</li>
                          <li>Holder (Data Controller) approval required</li>
                          <li>Access granted upon all approvals</li>
                        </ol>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </DialogTrigger>
                      <Button
                        className="flex-1"
                        onClick={handleRequestAccess}
                        disabled={requesting}
                      >
                        {requesting ? "Submitting..." : "Submit Request"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;