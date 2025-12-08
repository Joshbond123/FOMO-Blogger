import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Zap, 
  FileText, 
  Clock, 
  CheckCircle2,
  XCircle,
  TrendingUp,
  Sparkles,
  Send,
  RefreshCw,
  Users,
  Image as ImageIcon
} from "lucide-react";
import { NICHES, type AppSettings, type Post, type DashboardStats, type ApiResponse } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [selectedNicheId, setSelectedNicheId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [currentTopic, setCurrentTopic] = useState<{ topic: string; fomoHook: string } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ step: string; percent: number } | null>(null);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
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

  const handleFullGeneration = async () => {
    try {
      const nicheId = selectedNicheId || undefined;
      const accountId = selectedAccountId || undefined;

      const topicResult = await generateTopic.mutateAsync(nicheId);
      if (!topicResult.data) return;

      await generatePost.mutateAsync({ 
        topic: topicResult.data.topic, 
        nicheId, 
        accountId 
      });

      await publishPost.mutateAsync();
    } catch (error) {
      console.error("Generation failed:", error);
    }
  };

  const accounts = settings?.bloggerAccounts || [];
  const hasGeminiKeys = (settings?.geminiApiKeys?.length || 0) > 0;
  const hasBloggerConnection = settings?.blogger?.isConnected || accounts.length > 0;
  const isGenerating = generateTopic.isPending || generatePost.isPending || publishPost.isPending;
  
  const recentPosts = posts.slice(0, 5);
  const publishedCount = stats?.publishedToday || 0;
  const activeSchedules = settings?.schedules?.filter(s => s.isActive).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">
          Generate and publish AI-powered blog content automatically
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Posts</p>
                <p className="text-2xl font-bold">{stats?.totalPosts || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Published Today</p>
                <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
                <p className="text-2xl font-bold text-blue-600">{activeSchedules}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold text-purple-600">{accounts.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Quick Generate & Publish</CardTitle>
                <CardDescription>Create and publish a new post instantly</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Niche</label>
                <Select value={selectedNicheId || "__random__"} onValueChange={(val) => setSelectedNicheId(val === "__random__" ? "" : val)}>
                  <SelectTrigger data-testid="select-niche">
                    <SelectValue placeholder="Random niche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__random__">Random niche</SelectItem>
                    {NICHES.map((niche) => (
                      <SelectItem key={niche.id} value={niche.id}>
                        {niche.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Account</label>
                <Select value={selectedAccountId || "__default__"} onValueChange={(val) => setSelectedAccountId(val === "__default__" ? "" : val)}>
                  <SelectTrigger data-testid="select-account">
                    <SelectValue placeholder="Default account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default account</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {generationProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{generationProgress.step}</span>
                  <span>{generationProgress.percent}%</span>
                </div>
                <Progress value={generationProgress.percent} />
              </div>
            )}

            {currentTopic && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Topic Found</span>
                </div>
                <p className="text-sm">{currentTopic.topic}</p>
                <p className="text-xs text-muted-foreground">{currentTopic.fomoHook}</p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button
                size="lg"
                onClick={handleFullGeneration}
                disabled={isGenerating || !hasGeminiKeys || !hasBloggerConnection}
                className="flex-1"
                data-testid="button-generate-publish"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Generate & Publish
              </Button>
            </div>

            {(!hasGeminiKeys || !hasBloggerConnection) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  {!hasGeminiKeys && <p>Add Gemini API keys in Settings to generate content.</p>}
                  {!hasBloggerConnection && <p>Connect a Blogger account in Automation to publish.</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
            <CardDescription>API connections and services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Gemini AI</span>
              </div>
              <Badge variant={hasGeminiKeys ? "secondary" : "outline"}>
                {hasGeminiKeys ? `${settings?.geminiApiKeys?.length} keys` : "Not configured"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Image Generation</span>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                Free
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Blogger Accounts</span>
              </div>
              <Badge variant={accounts.length > 0 ? "secondary" : "outline"}>
                {accounts.length > 0 ? `${accounts.length} connected` : "None"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Automation</span>
              </div>
              <Badge variant={activeSchedules > 0 ? "default" : "outline"}>
                {activeSchedules > 0 ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Recent Posts</CardTitle>
                <CardDescription>Latest generated content</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No posts yet</p>
              <p className="text-sm">Generate your first post above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post, index) => (
                <div 
                  key={post.id}
                  className="flex items-start gap-4 p-3 rounded-lg bg-muted/50"
                  data-testid={`recent-post-${index}`}
                >
                  {post.imageUrl && (
                    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{post.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {post.nicheId && (
                        <span>{NICHES.find(n => n.id === post.nicheId)?.name}</span>
                      )}
                      {post.accountName && <span>• {post.accountName}</span>}
                    </div>
                  </div>
                  <Badge 
                    variant={post.status === "published" ? "secondary" : "outline"}
                    className={post.status === "published" ? "bg-green-500/10 text-green-600" : ""}
                  >
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
