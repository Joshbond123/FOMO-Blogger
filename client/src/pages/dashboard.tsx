import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiKeyCard } from "@/components/api-key-card";
import { BloggerCard } from "@/components/blogger-card";
import { AdminSettingsCard } from "@/components/admin-settings-card";
import { ScheduleCard } from "@/components/schedule-card";
import { PostHistory } from "@/components/post-history";
import { TestPostSection } from "@/components/test-post-section";
import { PostPreviewDialog } from "@/components/post-preview-dialog";
import { StatsCards } from "@/components/stats-cards";
import { StatusBadge } from "@/components/status-badge";
import { NicheSelectionCard } from "@/components/niche-selection-card";
import { AccountManagementCard } from "@/components/account-management-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Database, ImageIcon } from "lucide-react";
import { SiGooglegemini } from "react-icons/si";
import type {
  AppSettings,
  Post,
  DashboardStats,
  ApiResponse,
  ConnectionStatus,
  NicheId,
  BloggerAccount,
} from "@shared/schema";

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

interface CredentialsPayload {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  blog_id: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<{ topic: string; fomoHook: string } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ step: string; percent: number } | null>(null);
  const [selectedNicheId, setSelectedNicheId] = useState<string>("");
  const [testResults, setTestResults] = useState<{
    gemini?: { success: boolean; message: string } | null;
  }>({});

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: credentials, isLoading: credentialsLoading } = useQuery<CredentialsResponse>({
    queryKey: ["/api/admin/credentials"],
  });

  const saveCredentials = useMutation({
    mutationFn: async (creds: CredentialsPayload) => {
      return apiRequest("POST", "/api/admin/credentials", creds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credentials"] });
      toast({ title: "Credentials saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save credentials", description: error.message, variant: "destructive" });
    },
  });

  const addGeminiKey = useMutation({
    mutationFn: async ({ key, name }: { key: string; name?: string }) => {
      return apiRequest("POST", "/api/settings/gemini-keys", { key, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Gemini API key added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add key", description: error.message, variant: "destructive" });
    },
  });

  const removeGeminiKey = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/settings/gemini-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "API key removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove key", description: error.message, variant: "destructive" });
    },
  });

  const connectBlogger = useMutation({
    mutationFn: async (data: { blogId: string; accessToken: string; refreshToken?: string }) => {
      return apiRequest("POST", "/api/settings/blogger", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Connected to Blogger successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to connect", description: error.message, variant: "destructive" });
    },
  });

  const disconnectBlogger = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/settings/blogger");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Disconnected from Blogger" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to disconnect", description: error.message, variant: "destructive" });
    },
  });

  const addBloggerAccount = useMutation({
    mutationFn: async (account: {
      name: string;
      blogId: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }) => {
      return apiRequest("POST", "/api/accounts", account);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Blogger account added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add account", description: error.message, variant: "destructive" });
    },
  });

  const removeBloggerAccount = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Account removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove account", description: error.message, variant: "destructive" });
    },
  });

  const addSchedule = useMutation({
    mutationFn: async ({ time, timezone, nicheId, accountId }: { 
      time: string; 
      timezone?: string; 
      nicheId?: string; 
      accountId?: string 
    }) => {
      return apiRequest("POST", "/api/settings/schedules", { time, timezone, nicheId, accountId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Schedule added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add schedule", description: error.message, variant: "destructive" });
    },
  });

  const removeSchedule = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/settings/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Schedule removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove schedule", description: error.message, variant: "destructive" });
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/settings/schedules/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Post deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    },
  });

  const testGemini = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/test/gemini");
      return response as ApiResponse;
    },
    onSuccess: (data) => {
      setTestResults((prev) => ({
        ...prev,
        gemini: { success: data.success, message: data.message || "Connection successful" },
      }));
    },
    onError: (error: Error) => {
      setTestResults((prev) => ({
        ...prev,
        gemini: { success: false, message: error.message },
      }));
    },
  });

  const generateTopic = useMutation({
    mutationFn: async (nicheId?: string) => {
      setGenerationProgress({ step: "Finding trending topic...", percent: 10 });
      const response = await apiRequest("POST", "/api/generate/topic", { nicheId });
      return response as ApiResponse<{ topic: string; fomoHook: string }>;
    },
    onSuccess: (data) => {
      if (data.data) {
        setCurrentTopic(data.data);
        setGenerationProgress({ step: "Topic found!", percent: 25 });
      }
    },
    onError: (error: Error) => {
      setGenerationProgress(null);
      toast({ title: "Failed to generate topic", description: error.message, variant: "destructive" });
    },
  });

  const generatePost = useMutation({
    mutationFn: async ({ topic, nicheId, accountId }: { topic?: string; nicheId?: string; accountId?: string }) => {
      setGenerationProgress({ step: "Generating blog content...", percent: 40 });
      const response = await apiRequest("POST", "/api/generate/post", { topic, nicheId, accountId });
      setGenerationProgress({ step: "Content generated!", percent: 70 });
      return response as ApiResponse<Post>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      setGenerationProgress(null);
      toast({ title: "Failed to generate post", description: error.message, variant: "destructive" });
    },
  });

  const publishPost = useMutation({
    mutationFn: async () => {
      setGenerationProgress({ step: "Publishing to Blogger...", percent: 85 });
      const response = await apiRequest("POST", "/api/publish/latest");
      setGenerationProgress({ step: "Published successfully!", percent: 100 });
      return response as ApiResponse<Post>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Post published successfully!" });
      setTimeout(() => {
        setGenerationProgress(null);
        setCurrentTopic(null);
      }, 2000);
    },
    onError: (error: Error) => {
      setGenerationProgress(null);
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    },
  });

  const handleGenerateTopic = async (nicheId?: string) => {
    const result = await generateTopic.mutateAsync(nicheId);
    return result.data || null;
  };

  const handleGeneratePost = async (topic?: string, nicheId?: string, accountId?: string) => {
    try {
      await generatePost.mutateAsync({ topic, nicheId, accountId });
      return true;
    } catch {
      return false;
    }
  };

  const handleTestPost = async () => {
    try {
      await publishPost.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const handleViewPost = (post: Post) => {
    setSelectedPost(post);
    setPreviewOpen(true);
  };

  const handleSelectNiche = (nicheId: NicheId) => {
    setSelectedNicheId(nicheId);
  };

  const getGeminiStatus = (): ConnectionStatus => {
    if (!settings?.geminiApiKeys?.length) return "disconnected";
    return "connected";
  };

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </header>
        <main className="container mx-auto max-w-7xl px-6 py-8 space-y-8">
          <Skeleton className="h-24 w-full" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  const bloggerAccounts = settings?.bloggerAccounts || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Blog Automator</h1>
                <p className="text-xs text-muted-foreground">Multi-Niche Content Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge
                status={getGeminiStatus()}
                label={`Gemini: ${settings?.geminiApiKeys?.length || 0}`}
              />
              <StatusBadge
                status="connected"
                label="Images: Free"
              />
              <StatusBadge
                status={settings?.blogger?.isConnected || bloggerAccounts.length > 0 ? "connected" : "disconnected"}
                label={`Accounts: ${bloggerAccounts.length || (settings?.blogger?.isConnected ? 1 : 0)}`}
              />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-8 space-y-8">
        <section className="text-center space-y-2">
          <h2 className="text-3xl font-semibold">Multi-Niche AI Blogging Platform</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Generate trending, FOMO-driven content across 6 viral niches
            and publish automatically to multiple Blogger accounts.
          </p>
        </section>

        {stats && <StatsCards stats={stats} />}

        <NicheSelectionCard
          selectedNicheId={selectedNicheId}
          onSelectNiche={handleSelectNiche}
          postsByNiche={stats?.postsByNiche}
        />

        <TestPostSection
          onGenerateTopic={handleGenerateTopic}
          onGeneratePost={handleGeneratePost}
          onTestPost={handleTestPost}
          isGeneratingTopic={generateTopic.isPending}
          isGeneratingPost={generatePost.isPending}
          isPosting={publishPost.isPending}
          hasGeminiKeys={(settings?.geminiApiKeys?.length || 0) > 0}
          hasBloggerConnection={settings?.blogger?.isConnected || false}
          accounts={bloggerAccounts}
          currentTopic={currentTopic}
          generationProgress={generationProgress || undefined}
          selectedNicheId={selectedNicheId}
          onSelectNiche={setSelectedNicheId}
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <ApiKeyCard
            title="Google Gemini AI"
            description="For content generation and topic research"
            icon={<SiGooglegemini className="h-5 w-5" />}
            keys={settings?.geminiApiKeys || []}
            currentKeyIndex={settings?.currentGeminiKeyIndex || 0}
            onAddKey={(key, name) => addGeminiKey.mutate({ key, name })}
            onRemoveKey={(id) => removeGeminiKey.mutate(id)}
            onTestConnection={() => testGemini.mutate()}
            isLoading={testGemini.isPending}
            testResult={testResults.gemini}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <ImageIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Free Image Generation</CardTitle>
                  <CardDescription>Powered by Pollinations AI</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">Free</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Blog images are generated automatically using Pollinations AI - completely free with no API key required.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Unlimited generations</Badge>
                <Badge variant="outline">No watermarks</Badge>
                <Badge variant="outline">High quality</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <AccountManagementCard
          accounts={bloggerAccounts}
          onAddAccount={(account) => addBloggerAccount.mutate(account)}
          onRemoveAccount={(id) => removeBloggerAccount.mutate(id)}
          isLoading={addBloggerAccount.isPending}
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <BloggerCard
            settings={settings?.blogger || { isConnected: false }}
            onConnect={(blogId, accessToken, refreshToken) =>
              connectBlogger.mutate({ blogId, accessToken, refreshToken })
            }
            onDisconnect={() => disconnectBlogger.mutate()}
            isLoading={connectBlogger.isPending || disconnectBlogger.isPending}
          />

          <AdminSettingsCard
            credentials={credentials || { client_id: "", client_secret: "", refresh_token: "", blog_id: "", has_client_id: false, has_client_secret: false, has_refresh_token: false, has_blog_id: false }}
            onSave={(creds) => saveCredentials.mutate(creds)}
            isLoading={credentialsLoading}
            isSaving={saveCredentials.isPending}
          />
        </div>

        <ScheduleCard
          schedules={settings?.schedules || []}
          accounts={bloggerAccounts}
          onAddSchedule={(time, timezone, nicheId, accountId) => 
            addSchedule.mutate({ time, timezone, nicheId, accountId })
          }
          onRemoveSchedule={(id) => removeSchedule.mutate(id)}
          onToggleSchedule={(id) => toggleSchedule.mutate(id)}
        />

        <PostHistory
          posts={posts}
          isLoading={postsLoading}
          onRefresh={() => refetchPosts()}
          onDeletePost={(id) => deletePost.mutate(id)}
          onViewPost={handleViewPost}
        />

        <footer className="text-center py-4 border-t">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            <span>Local storage: /database</span>
          </div>
        </footer>
      </main>

      <PostPreviewDialog
        post={selectedPost}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
