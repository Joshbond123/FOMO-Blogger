import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  X, 
  Users, 
  ExternalLink,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { BloggerAccount } from "@shared/schema";

interface AccountManagementCardProps {
  accounts: BloggerAccount[];
  onAddAccount: (account: {
    name: string;
    blogId: string;
  }) => void;
  onRemoveAccount: (id: string) => void;
  isLoading?: boolean;
}

export function AccountManagementCard({
  accounts,
  onAddAccount,
  onRemoveAccount,
  isLoading,
}: AccountManagementCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    blogId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.blogId) {
      onAddAccount(formData);
      setFormData({
        name: "",
        blogId: "",
      });
      setIsDialogOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Blogger Accounts</CardTitle>
              <CardDescription>
                Manage multiple Blogger accounts for publishing
              </CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-account">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Blogger Account</DialogTitle>
                  <DialogDescription>
                    Add a new blog using the global OAuth credentials from settings
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      placeholder="My Tech Blog"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="input-account-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blogId">Blog ID</Label>
                    <Input
                      id="blogId"
                      placeholder="1234567890"
                      className="font-mono"
                      value={formData.blogId}
                      onChange={(e) => setFormData({ ...formData, blogId: e.target.value })}
                      data-testid="input-account-blog-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      Uses global OAuth credentials from Admin Settings
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !formData.name || !formData.blogId}
                    data-testid="button-submit-account"
                  >
                    Add Account
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
                data-testid={`account-item-${account.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {account.isConnected ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{account.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        ID: {account.blogId}
                      </span>
                      {account.blogUrl && (
                        <a
                          href={account.blogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={account.isConnected ? "default" : "secondary"}>
                    {account.isConnected ? "Connected" : "Pending"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveAccount(account.id)}
                    data-testid={`button-remove-account-${account.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-muted/30 p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No Blogger accounts configured. Add an account to start publishing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
