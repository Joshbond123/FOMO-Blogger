import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Link2, Unlink, RefreshCw } from "lucide-react";
import { SiX } from "react-icons/si";
import type { XAccount, XBloggerConnection, BloggerAccount } from "@shared/schema";

interface SafeXAccount extends Omit<XAccount, "apiKey" | "apiSecret" | "accessToken" | "accessTokenSecret"> {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export default function XIntegration() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  });
  const [selectedXAccountId, setSelectedXAccountId] = useState<string>("");
  const [selectedBloggerAccountId, setSelectedBloggerAccountId] = useState<string>("");

  const { data: xAccounts = [], isLoading: loadingAccounts } = useQuery<SafeXAccount[]>({
    queryKey: ["/api/x/accounts"],
  });

  const { data: bloggerAccounts = [] } = useQuery<BloggerAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: connections = [] } = useQuery<XBloggerConnection[]>({
    queryKey: ["/api/x/connections"],
  });

  const addAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/x/accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/accounts"] });
      setFormData({ name: "", apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" });
      setShowAddForm(false);
      toast({ title: "X account added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add X account", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/x/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/x/connections"] });
      toast({ title: "X account removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove X account", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/x/accounts/${id}/test`);
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/accounts"] });
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const addConnectionMutation = useMutation({
    mutationFn: async ({ xAccountId, bloggerAccountId }: { xAccountId: string; bloggerAccountId: string }) => {
      const xAccount = xAccounts.find(a => a.id === xAccountId);
      const bloggerAccount = bloggerAccounts.find(a => a.id === bloggerAccountId);
      
      if (!xAccount || !bloggerAccount) {
        throw new Error("Invalid account selection");
      }
      
      return apiRequest("POST", "/api/x/connections", {
        xAccountId,
        xAccountName: xAccount.name,
        bloggerAccountId,
        bloggerAccountName: bloggerAccount.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/connections"] });
      setSelectedXAccountId("");
      setSelectedBloggerAccountId("");
      toast({ title: "Blog linked to X account" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to link accounts", description: error.message, variant: "destructive" });
    },
  });

  const removeConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/x/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/connections"] });
      toast({ title: "Connection removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove connection", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.apiKey || !formData.apiSecret || !formData.accessToken || !formData.accessTokenSecret) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    addAccountMutation.mutate(formData);
  };

  const handleLinkAccounts = () => {
    if (!selectedXAccountId || !selectedBloggerAccountId) {
      toast({ title: "Please select both accounts", variant: "destructive" });
      return;
    }
    addConnectionMutation.mutate({ xAccountId: selectedXAccountId, bloggerAccountId: selectedBloggerAccountId });
  };

  const connectedXAccounts = xAccounts.filter(a => a.isConnected);
  const unlinkedBloggerAccounts = bloggerAccounts.filter(
    b => !connections.some(c => c.bloggerAccountId === b.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SiX className="w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">X Account Integration</h1>
          <p className="text-muted-foreground">Connect your X (Twitter) account for automatic blog posting</p>
        </div>
      </div>

      {/* Part 1: X API Connection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>X API Credentials</CardTitle>
            <CardDescription>Add your X Developer API credentials to connect your account</CardDescription>
          </div>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} data-testid="button-add-account">
              <Plus className="w-4 h-4 mr-2" />
              Add X Account
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="My X Account"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-account-name"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key (Consumer Key)</Label>
                  <Input
                    id="apiKey"
                    placeholder="Enter API Key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    data-testid="input-api-key"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret (Consumer Secret)</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="Enter API Secret"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    data-testid="input-api-secret"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token</Label>
                  <Input
                    id="accessToken"
                    placeholder="Enter Access Token"
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    data-testid="input-access-token"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accessTokenSecret">Access Token Secret</Label>
                  <Input
                    id="accessTokenSecret"
                    type="password"
                    placeholder="Enter Access Token Secret"
                    value={formData.accessTokenSecret}
                    onChange={(e) => setFormData({ ...formData, accessTokenSecret: e.target.value })}
                    data-testid="input-access-token-secret"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="submit" disabled={addAccountMutation.isPending} data-testid="button-save-connect">
                  {addAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save & Connect
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} data-testid="button-cancel">
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loadingAccounts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : xAccounts.length === 0 && !showAddForm ? (
            <p className="text-muted-foreground text-center py-8">
              No X accounts connected. Click "Add X Account" to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {xAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-4 p-4 border rounded-md" data-testid={`card-x-account-${account.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <SiX className="w-5 h-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{account.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.username ? `@${account.username}` : "Not verified"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        API Key: {account.apiKey} | Access Token: {account.accessToken}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {account.isConnected ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Connected
                      </Badge>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnectionMutation.mutate(account.id)}
                      disabled={testConnectionMutation.isPending}
                      data-testid={`button-test-${account.id}`}
                    >
                      {testConnectionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteAccountMutation.mutate(account.id)}
                      disabled={deleteAccountMutation.isPending}
                      data-testid={`button-delete-${account.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Part 2: Link X Account to Blog */}
      <Card>
        <CardHeader>
          <CardTitle>Link X Account to Blog</CardTitle>
          <CardDescription>Connect your X account to a Blogger.com blog for automatic posting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {connectedXAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Connect and verify an X account above first to link it to your blogs.
            </p>
          ) : unlinkedBloggerAccounts.length === 0 && bloggerAccounts.length > 0 ? (
            <p className="text-muted-foreground text-center py-4">
              All your Blogger accounts are already linked to X accounts.
            </p>
          ) : bloggerAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No Blogger accounts found. Add a Blogger account in Settings first.
            </p>
          ) : (
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2 min-w-[200px]">
                <Label>X Account</Label>
                <Select value={selectedXAccountId} onValueChange={setSelectedXAccountId}>
                  <SelectTrigger data-testid="select-x-account">
                    <SelectValue placeholder="Select X Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedXAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.username ? `(@${account.username})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 min-w-[200px]">
                <Label>Blogger Account</Label>
                <Select value={selectedBloggerAccountId} onValueChange={setSelectedBloggerAccountId}>
                  <SelectTrigger data-testid="select-blogger-account">
                    <SelectValue placeholder="Select Blog" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedBloggerAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.blogName ? `(${account.blogName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleLinkAccounts} 
                disabled={addConnectionMutation.isPending || !selectedXAccountId || !selectedBloggerAccountId}
                data-testid="button-link-accounts"
              >
                {addConnectionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Link Accounts
              </Button>
            </div>
          )}

          <Separator />

          <div>
            <h3 className="font-medium mb-3">Active Connections</h3>
            {connections.length === 0 ? (
              <p className="text-muted-foreground text-sm">No connections yet.</p>
            ) : (
              <div className="space-y-2">
                {connections.map((connection) => (
                  <div 
                    key={connection.id} 
                    className="flex items-center justify-between gap-4 p-3 border rounded-md"
                    data-testid={`card-connection-${connection.id}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline">{connection.bloggerAccountName}</Badge>
                      <span className="text-muted-foreground">linked to</span>
                      <Badge variant="secondary">
                        <SiX className="w-3 h-3 mr-1" />
                        {connection.xAccountName}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeConnectionMutation.mutate(connection.id)}
                      disabled={removeConnectionMutation.isPending}
                      data-testid={`button-unlink-${connection.id}`}
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Part 3: Automatic Posting Info */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Posting</CardTitle>
          <CardDescription>How blog posts are shared to X</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>When a blog post is published to a linked Blogger account:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The post excerpt (up to 1000 characters) will be posted to X</li>
              <li>A clickable link to the full blog post will be included</li>
              <li>Posts are automatically formatted to comply with X character limits</li>
            </ul>
            <p className="mt-4 text-xs">
              Note: Make sure your X Developer App has Read and Write permissions enabled in the Twitter Developer Portal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
