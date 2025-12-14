import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  RefreshCw,
  Eye,
  Brain,
  FileText,
  Clock,
  CheckCircle2,
  Globe,
  Search,
  Key,
  Calendar,
  Link2,
  Database,
  ListChecks,
  CheckCheck
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NICHES, type TrendingResearch } from "@shared/schema";

export default function ResearchTransparency() {
  const [selectedResearch, setSelectedResearch] = useState<TrendingResearch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: researchLogs = [], isLoading } = useQuery<TrendingResearch[]>({
    queryKey: ["/api/research"],
  });

  const recentLogs = researchLogs.slice(0, 10);

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
      full: format(date, "EEEE, MMMM d, yyyy 'at' h:mm:ss a"),
    };
  };

  // Parse aiAnalysis to extract source count, candidates, and niche confirmation
  const parseAiAnalysis = (aiAnalysis?: string) => {
    if (!aiAnalysis) return { totalSources: 0, candidates: 0, nicheConfirmed: false };
    
    const sourcesMatch = aiAnalysis.match(/(\d+)\s*sources?\s*found/i);
    const candidatesMatch = aiAnalysis.match(/(\d+)\s*candidates?/i);
    const nicheConfirmedMatch = aiAnalysis.match(/niche confirmed:\s*(yes|true)/i);
    
    return {
      totalSources: sourcesMatch ? parseInt(sourcesMatch[1], 10) : 0,
      candidates: candidatesMatch ? parseInt(candidatesMatch[1], 10) : 0,
      nicheConfirmed: !!nicheConfirmedMatch,
    };
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "published":
        return <Badge variant="secondary" className="text-xs flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Published
        </Badge>;
      case "generated":
        return <Badge variant="outline" className="text-xs flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Generated
        </Badge>;
      case "researching":
        return <Badge variant="outline" className="text-xs flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Researching
        </Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-xs">
          Failed
        </Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">
          Generated
        </Badge>;
    }
  };

  const openDetails = (research: TrendingResearch) => {
    setSelectedResearch(research);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Research Transparency
          </CardTitle>
          <CardDescription>
            Showing the {recentLogs.length} most recent research logs. All research is conducted using Serper.dev for real-time web data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p data-testid="text-empty-state">No research logs yet</p>
              <p className="text-sm">Research logs will appear here when the AI researches topics using Serper.dev</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((research) => (
                <div 
                  key={research.id}
                  className="p-4 border rounded-md hover-elevate cursor-pointer"
                  onClick={() => openDetails(research)}
                  data-testid={`research-item-${research.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {getStatusBadge(research.status)}
                        {research.nicheId && (
                          <Badge variant="outline" className="text-xs">
                            {getNicheBadge(research.nicheId)}
                          </Badge>
                        )}
                        {research.bloggerAccountName && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {research.bloggerAccountName}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(research.createdAt).relative}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1 line-clamp-1" data-testid={`text-research-title-${research.id}`}>
                        {research.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {research.shortDescription}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                        {(() => {
                          const metrics = parseAiAnalysis(research.aiAnalysis);
                          return (
                            <>
                              <span className="flex items-center gap-1" data-testid={`text-sources-${research.id}`}>
                                <Database className="h-3 w-3" />
                                {metrics.totalSources > 0 ? metrics.totalSources : (research.sources?.length || 0)} sources found
                              </span>
                              {metrics.candidates > 0 && (
                                <span className="flex items-center gap-1" data-testid={`text-candidates-${research.id}`}>
                                  <ListChecks className="h-3 w-3" />
                                  {metrics.candidates} candidates
                                </span>
                              )}
                              {metrics.nicheConfirmed && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid={`badge-niche-confirmed-${research.id}`}>
                                  <CheckCheck className="h-3 w-3" />
                                  Niche Verified
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                        {research.serperKeyUsed && (
                          <span className="flex items-center gap-1">
                            <Key className="h-3 w-3" />
                            {research.serperKeyUsed}
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
                          openDetails(research);
                        }}
                        data-testid={`button-view-${research.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedResearch?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedResearch && getStatusBadge(selectedResearch.status)}
              {selectedResearch?.nicheId && (
                <Badge variant="secondary">{getNicheBadge(selectedResearch.nicheId)}</Badge>
              )}
              {selectedResearch?.bloggerAccountName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {selectedResearch.bloggerAccountName}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timestamp
                </h4>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    {selectedResearch?.createdAt && formatDate(selectedResearch.createdAt).full}
                  </p>
                  {selectedResearch?.researchedAt && (
                    <p className="text-xs text-muted-foreground">
                      Researched: {formatDate(selectedResearch.researchedAt).full}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Short Summary
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedResearch?.shortDescription}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Full Research Summary
                </h4>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedResearch?.fullSummary}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Why This Topic Was Chosen
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedResearch?.whyTrending}
                </p>
              </div>

              {selectedResearch?.aiAnalysis && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Research Metrics
                    </h4>
                    {(() => {
                      const metrics = parseAiAnalysis(selectedResearch.aiAnalysis);
                      return (
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2 p-2 border rounded-md">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium" data-testid="text-detail-sources">{metrics.totalSources}</p>
                              <p className="text-xs text-muted-foreground">Total Sources</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded-md">
                            <ListChecks className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium" data-testid="text-detail-candidates">{metrics.candidates}</p>
                              <p className="text-xs text-muted-foreground">Topic Candidates</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 border rounded-md">
                            <CheckCheck className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium" data-testid="text-detail-niche">{metrics.nicheConfirmed ? "Yes" : "No"}</p>
                              <p className="text-xs text-muted-foreground">Niche Verified</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {selectedResearch?.sources && selectedResearch.sources.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Source Links ({selectedResearch.sources.length})
                    </h4>
                    <div className="space-y-3">
                      {selectedResearch.sources.map((source, index) => (
                        <div key={index} className="p-3 border rounded-md">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-sm text-foreground hover:underline line-clamp-1"
                              >
                                {source.title}
                              </a>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {source.snippet}
                              </p>
                              {source.publishDate && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {source.publishDate}
                                </p>
                              )}
                            </div>
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="shrink-0"
                            >
                              <Button variant="ghost" size="icon">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedResearch?.searchQueries && selectedResearch.searchQueries.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Search Queries Used</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedResearch.searchQueries.map((query, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {query}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedResearch?.serperKeyUsed && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Serper Key Used
                    </h4>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedResearch.serperKeyUsed}
                    </Badge>
                  </div>
                </>
              )}

              {selectedResearch?.postTitle && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Generated Blog Post</h4>
                    <p className="text-sm">{selectedResearch.postTitle}</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
