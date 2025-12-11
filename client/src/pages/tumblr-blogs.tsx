import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  Link as LinkIcon, 
  Unlink, 
  ExternalLink,
  AlertCircle,
  Check,
  Globe
} from "lucide-react";
import { SiTumblr, SiBlogger } from "react-icons/si";
import { Link } from "wouter";
import type { BloggerAccount, TumblrBloggerConnection } from "@shared/schema";

interface TumblrBlog {
  name: string;
  url: string;
  title: string;
  description: string;
  uuid: string;
}

interface TumblrBlogsResponse {
  success: boolean;
  blogs?: TumblrBlog[];
  error?: string;
}

interface TumblrCredentialsStatus {
  has_consumer_key: boolean;
  has_consumer_secret: boolean;
  has_token: boolean;
  has_token_secret: boolean;
}

export default function TumblrBlogs() {
  const { toast } = useToast();
  const [selectedTumblrBlog, setSelectedTumblrBlog] = useState<TumblrBlog | null>(null);
  const [selectedBloggerAccountId, setSelectedBloggerAccountId] = useState<string>("");

  const { data: tumblrCredentials, isLoading: credentialsLoading } = useQuery<TumblrCredentialsStatus>({
    queryKey: ["/api/tumblr/credentials"],
  });

  const { data: tumblrBlogsData, isLoading: blogsLoading, refetch: refetchBlogs } = useQuery<TumblrBlogsResponse>({
    queryKey: ["/api/tumblr/blogs"],
    enabled: !!tumblrCredentials?.has_consumer_key,
  });

  const { data: bloggerAccounts, isLoading: accountsLoading } = useQuery<BloggerAccount[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: connections, isLoading: connectionsLoading } = useQuery<TumblrBloggerConnection[]>({
    queryKey: ["/api/tumblr/connections"],
  });

  const createConnection = useMutation({
    mutationFn: async (data: { tumblrBlogId: string; tumblrBlogName: string; bloggerAccountId: string; bloggerAccountName: string }) => {
      return apiRequest("POST", "/api/tumblr/connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tumblr/connections"] });
      toast({ title: "Connection created successfully" });
      setSelectedTumblrBlog(null);
      setSelectedBloggerAccountId("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create connection", description: error.message, variant: "destructive" });
    },
  });

  const removeConnection = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tumblr/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tumblr/connections"] });
      toast({ title: "Connection removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove connection", description: error.message, variant: "destructive" });
    },
  });

  const handleConnect = () => {
    if (!selectedTumblrBlog || !selectedBloggerAccountId) {
      toast({ title: "Please select both a Tumblr blog and a Blogger account", variant: "destructive" });
      return;
    }

    const bloggerAccount = bloggerAccounts?.find(acc => acc.id === selectedBloggerAccountId);
    if (!bloggerAccount) {
      toast({ title: "Selected Blogger account not found", variant: "destructive" });
      return;
    }

    createConnection.mutate({
      tumblrBlogId: selectedTumblrBlog.uuid,
      tumblrBlogName: selectedTumblrBlog.name,
      bloggerAccountId: selectedBloggerAccountId,
      bloggerAccountName: bloggerAccount.name,
    });
  };

  const getConnectionForTumblrBlog = (uuid: string) => {
    return connections?.find(c => c.tumblrBlogId === uuid);
  };

  const connectedBloggerAccounts = bloggerAccounts?.filter(acc => acc.isConnected) || [];
  const tumblrBlogs = tumblrBlogsData?.blogs || [];
  const hasCredentials = tumblrCredentials?.has_consumer_key && tumblrCredentials?.has_consumer_secret && tumblrCredentials?.has_token && tumblrCredentials?.has_token_secret;

  const isLoading = credentialsLoading || blogsLoading || accountsLoading || connectionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasCredentials) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-tumblr-blogs-title">Tumblr Blog Accounts</h1>
          <p className="text-muted-foreground">
            Connect your Tumblr blogs to Blogger accounts for automatic cross-posting
          </p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="text-lg font-medium">Tumblr Not Configured</h3>
                <p className="text-muted-foreground">
                  Please configure your Tumblr API credentials in Settings first.
                </p>
              </div>
              <Link href="/settings">
                <Button data-testid="button-go-to-settings">
                  Go to Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-tumblr-blogs-title">Tumblr Blog Accounts</h1>
          <p className="text-muted-foreground">
            Connect your Tumblr blogs to Blogger accounts for automatic cross-posting
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetchBlogs()}
          disabled={blogsLoading}
          data-testid="button-refresh-blogs"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${blogsLoading ? "animate-spin" : ""}`} />
          Refresh Blogs
        </Button>
      </div>

      {tumblrBlogs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <SiTumblr className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="text-lg font-medium">No Tumblr Blogs Found</h3>
                <p className="text-muted-foreground">
                  No blogs are associated with your Tumblr account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Your Tumblr Blogs</h3>
            <div className="space-y-3">
              {tumblrBlogs.map((blog) => {
                const connection = getConnectionForTumblrBlog(blog.uuid);
                const isSelected = selectedTumblrBlog?.uuid === blog.uuid;
                
                return (
                  <Card 
                    key={blog.uuid}
                    className={`cursor-pointer transition-colors ${isSelected ? "border-primary" : ""}`}
                    onClick={() => setSelectedTumblrBlog(blog)}
                    data-testid={`tumblr-blog-${blog.name}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                            <SiTumblr className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">{blog.title || blog.name}</h4>
                            <p className="text-sm text-muted-foreground truncate">{blog.name}.tumblr.com</p>
                            {blog.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{blog.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {connection ? (
                            <Badge variant="secondary" className="whitespace-nowrap">
                              <LinkIcon className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="whitespace-nowrap">
                              Not Connected
                            </Badge>
                          )}
                          <a 
                            href={blog.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      
                      {connection && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-sm">
                              <SiBlogger className="h-4 w-4 text-orange-500" />
                              <span className="text-muted-foreground">Linked to:</span>
                              <span className="font-medium">{connection.bloggerAccountName}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeConnection.mutate(connection.id);
                              }}
                              disabled={removeConnection.isPending}
                              data-testid={`button-disconnect-${blog.name}`}
                            >
                              <Unlink className="h-4 w-4 mr-1" />
                              Disconnect
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Connect to Blogger</h3>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Connection</CardTitle>
                <CardDescription>
                  Link a Tumblr blog to a Blogger account. When posts are published to the Blogger blog, 
                  a preview will automatically be posted to the connected Tumblr blog.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTumblrBlog ? (
                  <>
                    <div className="p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <SiTumblr className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">{selectedTumblrBlog.title || selectedTumblrBlog.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedTumblrBlog.name}.tumblr.com</p>
                        </div>
                      </div>
                    </div>

                    {connectedBloggerAccounts.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No connected Blogger accounts found.</p>
                        <p className="text-xs">Add a Blogger account in the Automation page first.</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Select Blogger Account</label>
                          <Select 
                            value={selectedBloggerAccountId} 
                            onValueChange={setSelectedBloggerAccountId}
                          >
                            <SelectTrigger data-testid="select-blogger-account">
                              <SelectValue placeholder="Choose a Blogger account" />
                            </SelectTrigger>
                            <SelectContent>
                              {connectedBloggerAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  <div className="flex items-center gap-2">
                                    <SiBlogger className="h-4 w-4 text-orange-500" />
                                    <span>{account.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          className="w-full" 
                          onClick={handleConnect}
                          disabled={!selectedBloggerAccountId || createConnection.isPending}
                          data-testid="button-create-connection"
                        >
                          {createConnection.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <LinkIcon className="h-4 w-4 mr-2" />
                          )}
                          Connect Blogs
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <SiTumblr className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a Tumblr blog from the list to connect it.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">How it works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs shrink-0">1</div>
                    <p>Connect a Tumblr blog to a Blogger account</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs shrink-0">2</div>
                    <p>When AI publishes a post to Blogger, the system automatically creates a Tumblr preview</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs shrink-0">3</div>
                    <p>The Tumblr post contains the title, a snippet, and a link to the full article on Blogger</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <p>This drives traffic from Tumblr to your main Blogger blog!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
