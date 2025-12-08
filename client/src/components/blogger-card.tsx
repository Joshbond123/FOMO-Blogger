import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./status-badge";
import { ExternalLink, Unplug } from "lucide-react";
import { SiBlogger } from "react-icons/si";
import type { BloggerSettings } from "@shared/schema";
import { useState } from "react";

interface BloggerCardProps {
  settings: BloggerSettings;
  onConnect: (blogId: string, accessToken: string, refreshToken?: string) => void;
  onDisconnect: () => void;
  isLoading?: boolean;
}

export function BloggerCard({
  settings,
  onConnect,
  onDisconnect,
  isLoading,
}: BloggerCardProps) {
  const [blogId, setBlogId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const handleConnect = () => {
    if (blogId.trim() && accessToken.trim()) {
      onConnect(blogId.trim(), accessToken.trim(), refreshToken.trim() || undefined);
      setBlogId("");
      setAccessToken("");
      setRefreshToken("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <SiBlogger className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Blogger Connection</CardTitle>
              <CardDescription className="text-sm">
                Connect your Blogger account to publish posts
              </CardDescription>
            </div>
          </div>
          <StatusBadge
            status={settings.isConnected ? "connected" : "disconnected"}
            label={settings.isConnected ? "Connected" : "Not Connected"}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.isConnected ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">{settings.blogName || "Your Blog"}</span>
                {settings.blogUrl && (
                  <a
                    href={settings.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Visit Blog
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                Blog ID: {settings.blogId}
              </p>
            </div>
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
              Access tokens expire after 1 hour. If publishing fails, disconnect and reconnect with a fresh token from OAuth Playground.
            </div>
            <Button
              variant="outline"
              onClick={onDisconnect}
              className="text-destructive hover:text-destructive"
              disabled={isLoading}
              data-testid="button-disconnect-blogger"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">How to get your credentials:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Go to Google OAuth Playground: <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OAuth Playground</a></li>
                <li>Select "Blogger API v3" scope</li>
                <li>Authorize and get your access token</li>
                <li>Find your Blog ID in Blogger dashboard URL</li>
              </ol>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="blogId" className="text-sm">Blog ID</Label>
                <Input
                  id="blogId"
                  type="text"
                  placeholder="Enter your Blogger blog ID"
                  value={blogId}
                  onChange={(e) => setBlogId(e.target.value)}
                  className="font-mono"
                  data-testid="input-blog-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken" className="text-sm">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Enter OAuth access token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="font-mono"
                  data-testid="input-access-token"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refreshToken" className="text-sm">Refresh Token (Optional)</Label>
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="Enter refresh token for auto-renewal"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="font-mono"
                  data-testid="input-refresh-token"
                />
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={!blogId.trim() || !accessToken.trim() || isLoading}
              data-testid="button-connect-blogger"
            >
              <SiBlogger className="h-4 w-4 mr-2" />
              Connect to Blogger
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
