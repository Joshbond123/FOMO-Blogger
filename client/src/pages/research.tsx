import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  Eye,
  Brain,
  TrendingUp,
  Link2,
  FileText,
  Sparkles,
  Clock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NICHES, type TrendingResearch } from "@shared/schema";

export default function ResearchTransparency() {
  const { toast } = useToast();
  const [selectedResearch, setSelectedResearch] = useState<TrendingResearch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<string>("all");

  const { data: research = [], isLoading, refetch } = useQuery<TrendingResearch[]>({
    queryKey: ["/api/research"],
  });

  const deleteResearch = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/research/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research"] });
      toast({ title: "Research deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete research", description: error.message, variant: "destructive" });
    },
  });

  const generateResearch = useMutation({
    mutationFn: async (nicheId: string) => {
      return apiRequest("POST", "/api/research/generate", { nicheId, createPost: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research"] });
      toast({ title: "New trending research generated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate research", description: error.message, variant: "destructive" });
    },
  });

  const getNicheBadge = (nicheId?: string) => {
    if (!nicheId) return null;
    const niche = NICHES.find(n => n.id === nicheId);
    return niche?.name || nicheId;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      display: format(date, "MMM d, yyyy"),
      time: format(date, "h:mm a"),
      relative: formatDistanceToNow(date, { addSuffix: true }),
    };
  };

  // Filter and limit to 10 most recent
  const filteredResearch = research
    .filter(r => selectedNiche === "all" || r.nicheId === selectedNiche)
    .slice(0, 10);

  const openDetails = (item: TrendingResearch) => {
    setSelectedResearch(item);
    setDetailsOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Research Transparency</h1>
          <p className="text-muted-foreground">
            View the 10 most recent trending topics researched by the AI
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedNiche} onValueChange={setSelectedNiche}>
            <SelectTrigger className="w-[180px]" data-testid="select-niche-filter">
              <SelectValue placeholder="Filter by niche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Niches</SelectItem>
              {NICHES.map(niche => (
                <SelectItem key={niche.id} value={niche.id}>{niche.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Generate Research Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate New Research
          </CardTitle>
          <CardDescription>
            Search for real trending topics in a specific niche
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            {NICHES.slice(0, 3).map(niche => (
              <Button
                key={niche.id}
                variant="outline"
                size="sm"
                onClick={() => generateResearch.mutate(niche.id)}
                disabled={generateResearch.isPending}
                data-testid={`button-generate-${niche.id}`}
              >
                {generateResearch.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {niche.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Research List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Recent Trending Research
          </CardTitle>
          <CardDescription>
            Showing {filteredResearch.length} most recent research entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResearch.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No research data yet</p>
              <p className="text-sm">Generate research for a niche to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredResearch.map((item) => (
                <div 
                  key={item.id}
                  className="p-4 border rounded-md hover-elevate cursor-pointer"
                  onClick={() => openDetails(item)}
                  data-testid={`research-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {getNicheBadge(item.nicheId)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(item.createdAt).relative}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1 line-clamp-1" data-testid={`text-research-title-${item.id}`}>
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.shortDescription}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {item.sources?.length || 0} sources
                        </span>
                        {item.postId && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <FileText className="h-3 w-3" />
                            Post created
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(item);
                        }}
                        data-testid={`button-view-${item.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteResearch.mutate(item.id);
                        }}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedResearch?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedResearch?.nicheName && (
                <Badge variant="secondary">{selectedResearch.nicheName}</Badge>
              )}
              {selectedResearch?.createdAt && (
                <span className="text-xs">
                  Researched {formatDate(selectedResearch.createdAt).relative}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Short Description */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedResearch?.shortDescription}
                </p>
              </div>

              <Separator />

              {/* Why Trending */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Why This is Trending
                </h4>
                <p className="text-sm">
                  {selectedResearch?.whyTrending}
                </p>
              </div>

              <Separator />

              {/* Full Summary */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Full Research Summary
                </h4>
                <div className="text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-md">
                  {selectedResearch?.fullSummary}
                </div>
              </div>

              <Separator />

              {/* AI Analysis */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Analysis
                </h4>
                <div className="text-sm bg-primary/5 p-4 rounded-md border border-primary/10">
                  {selectedResearch?.aiAnalysis}
                </div>
              </div>

              <Separator />

              {/* Sources */}
              {selectedResearch?.sources && selectedResearch.sources.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Sources ({selectedResearch.sources.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedResearch.sources.map((source, index) => (
                      <div key={index} className="p-3 border rounded-md bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-sm line-clamp-1">
                              {source.title}
                            </h5>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {source.snippet}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="shrink-0"
                          >
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Queries */}
              {selectedResearch?.searchQueries && selectedResearch.searchQueries.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Related Search Queries
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedResearch.searchQueries.map((query, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {query}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
