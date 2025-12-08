import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Send, 
  Sparkles, 
  Wand2, 
  TrendingUp,
  Loader2,
  AlertCircle,
  Image as ImageIcon
} from "lucide-react";
import { NICHES, type BloggerAccount, type NicheId } from "@shared/schema";

interface TestPostSectionProps {
  onGenerateTopic: (nicheId?: string) => Promise<{ topic: string; fomoHook: string } | null>;
  onGeneratePost: (topic?: string, nicheId?: string, accountId?: string) => Promise<boolean>;
  onTestPost: () => Promise<boolean>;
  isGeneratingTopic: boolean;
  isGeneratingPost: boolean;
  isPosting: boolean;
  hasGeminiKeys: boolean;
  hasBloggerConnection: boolean;
  accounts?: BloggerAccount[];
  currentTopic?: { topic: string; fomoHook: string } | null;
  generationProgress?: { step: string; percent: number };
  selectedNicheId?: string;
  onSelectNiche?: (nicheId: string) => void;
}

export function TestPostSection({
  onGenerateTopic,
  onGeneratePost,
  onTestPost,
  isGeneratingTopic,
  isGeneratingPost,
  isPosting,
  hasGeminiKeys,
  hasBloggerConnection,
  accounts = [],
  currentTopic,
  generationProgress,
  selectedNicheId,
  onSelectNiche,
}: TestPostSectionProps) {
  const [customTopic, setCustomTopic] = useState("");
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [localNicheId, setLocalNicheId] = useState<string>(selectedNicheId || "");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const isLoading = isGeneratingTopic || isGeneratingPost || isPosting;
  const canGenerate = hasGeminiKeys;
  const canPost = (hasBloggerConnection || accounts.length > 0) && hasGeminiKeys;

  const currentNicheId = selectedNicheId || localNicheId;

  const handleNicheChange = (value: string) => {
    setLocalNicheId(value);
    if (onSelectNiche) {
      onSelectNiche(value);
    }
  };

  const handleGenerateAndPost = async () => {
    const nicheId = currentNicheId || undefined;
    const accountId = selectedAccountId || undefined;
    
    if (mode === "auto") {
      const topic = await onGenerateTopic(nicheId);
      if (topic) {
        const success = await onGeneratePost(topic.topic, nicheId, accountId);
        if (success) {
          await onTestPost();
        }
      }
    } else {
      const success = await onGeneratePost(customTopic || undefined, nicheId, accountId);
      if (success) {
        await onTestPost();
      }
    }
  };

  const selectedNiche = NICHES.find(n => n.id === currentNicheId);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl">Generate & Post Content</CardTitle>
            <CardDescription>
              Create AI-powered blog content with FOMO hooks and publish instantly
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Content Niche</Label>
            <Select value={currentNicheId} onValueChange={handleNicheChange}>
              <SelectTrigger data-testid="select-post-niche">
                <SelectValue placeholder="Select a niche..." />
              </SelectTrigger>
              <SelectContent>
                {NICHES.map((niche) => (
                  <SelectItem key={niche.id} value={niche.id}>
                    {niche.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Publish to Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger data-testid="select-post-account">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {selectedNiche && (
          <div className="rounded-md bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{selectedNiche.name}:</span>{" "}
              {selectedNiche.description}
            </p>
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as "auto" | "custom")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto" data-testid="tab-auto-topic">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trending Topic
            </TabsTrigger>
            <TabsTrigger value="custom" data-testid="tab-custom-topic">
              <Wand2 className="h-4 w-4 mr-2" />
              Custom Topic
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4 mt-4">
            <div className="rounded-md bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                AI will research and find the latest trending topic in{" "}
                <span className="font-medium text-foreground">
                  {selectedNiche?.name || "your selected niche"}
                </span>
                , then generate an engaging article with FOMO hooks to maximize reader engagement.
              </p>
            </div>
            
            {currentTopic && (
              <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-2">
                <p className="text-sm font-medium">Current Topic:</p>
                <p className="text-foreground">{currentTopic.topic}</p>
                <p className="text-sm text-muted-foreground italic">"{currentTopic.fomoHook}"</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="customTopic">Your Topic</Label>
              <Textarea
                id="customTopic"
                placeholder={`Enter a specific ${selectedNiche?.name || ""} topic you want to write about...`}
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-custom-topic"
              />
            </div>
          </TabsContent>
        </Tabs>

        {isLoading && generationProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{generationProgress.step}</span>
              <span className="font-mono">{generationProgress.percent}%</span>
            </div>
            <Progress value={generationProgress.percent} className="h-2" />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleGenerateAndPost}
            disabled={isLoading || !canPost || !currentNicheId}
            className="h-12 text-base"
            data-testid="button-generate-and-post"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {isGeneratingTopic && "Finding Trending Topic..."}
                {isGeneratingPost && "Generating Content..."}
                {isPosting && "Publishing to Blogger..."}
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Generate & Publish Post
              </>
            )}
          </Button>

          {!currentNicheId && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Select a niche to generate content
            </div>
          )}

          {!canGenerate && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Add Gemini API key to enable content generation
            </div>
          )}

          {canGenerate && !hasBloggerConnection && accounts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Connect Blogger or add an account to publish posts
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Trending Research</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wand2 className="h-4 w-4" />
            <span>SEO Optimized</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            <span>Auto Images</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
