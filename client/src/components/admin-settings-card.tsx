import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2, Check } from "lucide-react";

interface CredentialsResponse {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  blog_id: string;
  has_client_id?: boolean;
  has_client_secret?: boolean;
  has_refresh_token?: boolean;
  has_blog_id?: boolean;
}

interface AdminSettingsCardProps {
  credentials: CredentialsResponse;
  onSave: (credentials: { client_id: string; client_secret: string; refresh_token: string; blog_id: string }) => void;
  isLoading?: boolean;
  isSaving?: boolean;
}

export function AdminSettingsCard({
  credentials,
  onSave,
  isLoading,
  isSaving,
}: AdminSettingsCardProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [blogId, setBlogId] = useState("");
  
  const [hasExistingClientId, setHasExistingClientId] = useState(false);
  const [hasExistingClientSecret, setHasExistingClientSecret] = useState(false);
  const [hasExistingRefreshToken, setHasExistingRefreshToken] = useState(false);
  const [hasExistingBlogId, setHasExistingBlogId] = useState(false);
  
  const [clientIdModified, setClientIdModified] = useState(false);
  const [clientSecretModified, setClientSecretModified] = useState(false);
  const [refreshTokenModified, setRefreshTokenModified] = useState(false);
  const [blogIdModified, setBlogIdModified] = useState(false);

  useEffect(() => {
    if (credentials) {
      setHasExistingClientId(!!credentials.has_client_id);
      setHasExistingClientSecret(!!credentials.has_client_secret);
      setHasExistingRefreshToken(!!credentials.has_refresh_token);
      setHasExistingBlogId(!!credentials.has_blog_id);
      
      setBlogId(credentials.blog_id && credentials.blog_id !== "***" ? credentials.blog_id : "");
      
      setClientId("");
      setClientSecret("");
      setRefreshToken("");
      
      setClientIdModified(false);
      setClientSecretModified(false);
      setRefreshTokenModified(false);
      setBlogIdModified(false);
    }
  }, [credentials]);

  const handleSave = () => {
    onSave({
      client_id: clientIdModified ? clientId.trim() : "",
      client_secret: clientSecretModified ? clientSecret.trim() : "",
      refresh_token: refreshTokenModified ? refreshToken.trim() : "",
      blog_id: blogIdModified ? blogId.trim() : "",
    });
  };

  const hasChanges = clientIdModified || clientSecretModified || refreshTokenModified || blogIdModified;

  const isComplete =
    (hasExistingClientId || clientId.trim() !== "") &&
    (hasExistingClientSecret || clientSecret.trim() !== "") &&
    (hasExistingRefreshToken || refreshToken.trim() !== "") &&
    (hasExistingBlogId || blogId.trim() !== "");

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Admin Settings</CardTitle>
              <CardDescription className="text-sm">Loading credentials...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Admin Settings</CardTitle>
            <CardDescription className="text-sm">
              Configure Blogger API credentials for automatic token refresh
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">How to get your OAuth credentials:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add authorized redirect URI for OAuth Playground</li>
            <li>Use OAuth Playground to get refresh token with Blogger API scope</li>
            <li>Find your Blog ID in Blogger dashboard URL</li>
          </ol>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-client-id" className="text-sm">Client ID</Label>
              {hasExistingClientId && !clientIdModified && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <Input
              id="admin-client-id"
              type="text"
              placeholder={hasExistingClientId ? "Enter new value to replace existing" : "Enter your OAuth Client ID"}
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setClientIdModified(true);
              }}
              className="font-mono text-sm"
              data-testid="input-admin-client-id"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-client-secret" className="text-sm">Client Secret</Label>
              {hasExistingClientSecret && !clientSecretModified && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <Input
              id="admin-client-secret"
              type="password"
              placeholder={hasExistingClientSecret ? "Enter new value to replace existing" : "Enter your OAuth Client Secret"}
              value={clientSecret}
              onChange={(e) => {
                setClientSecret(e.target.value);
                setClientSecretModified(true);
              }}
              className="font-mono text-sm"
              data-testid="input-admin-client-secret"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-refresh-token" className="text-sm">Refresh Token</Label>
              {hasExistingRefreshToken && !refreshTokenModified && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <Input
              id="admin-refresh-token"
              type="password"
              placeholder={hasExistingRefreshToken ? "Enter new value to replace existing" : "Enter your OAuth Refresh Token"}
              value={refreshToken}
              onChange={(e) => {
                setRefreshToken(e.target.value);
                setRefreshTokenModified(true);
              }}
              className="font-mono text-sm"
              data-testid="input-admin-refresh-token"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="admin-blog-id" className="text-sm">Blog ID</Label>
              {hasExistingBlogId && !blogIdModified && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <Input
              id="admin-blog-id"
              type="text"
              placeholder={hasExistingBlogId ? "Enter new value to replace existing" : "Enter your Blogger Blog ID"}
              value={blogId}
              onChange={(e) => {
                setBlogId(e.target.value);
                setBlogIdModified(true);
              }}
              className="font-mono text-sm"
              data-testid="input-admin-blog-id"
            />
          </div>
        </div>

        {isComplete && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600 dark:text-green-400">
            All credentials are configured. The system will automatically refresh access tokens when publishing.
          </div>
        )}

        {!isComplete && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
            Fill in all fields to enable automatic token refresh when publishing posts.
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          data-testid="button-save-credentials"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Credentials
        </Button>
      </CardContent>
    </Card>
  );
}
