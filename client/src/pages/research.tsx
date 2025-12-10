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
  Globe
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NICHES, type Post } from "@shared/schema";

export default function ResearchTransparency() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const publishedPosts = posts
    .filter(p => p.status === "published")
    .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
    .slice(0, 10);

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

  const openDetails = (post: Post) => {
    setSelectedPost(post);
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
            Showing the {publishedPosts.length} most recent AI-generated and published posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : publishedPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p data-testid="text-empty-state">No published posts yet</p>
              <p className="text-sm">Posts will appear here after the AI publishes them at scheduled times</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publishedPosts.map((post, index) => (
                <div 
                  key={post.id}
                  className="p-4 border rounded-md hover-elevate cursor-pointer"
                  onClick={() => openDetails(post)}
                  data-testid={`post-item-${post.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Published
                        </Badge>
                        {post.nicheId && (
                          <Badge variant="outline" className="text-xs">
                            {getNicheBadge(post.nicheId)}
                          </Badge>
                        )}
                        {post.accountName && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {post.accountName}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(post.publishedAt || post.createdAt).relative}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1 line-clamp-1" data-testid={`text-post-title-${post.id}`}>
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.excerpt || post.topic}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Research Topic: {post.topic}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.bloggerPostUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-external-${post.id}`}
                        >
                          <a 
                            href={post.bloggerPostUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(post);
                        }}
                        data-testid={`button-view-${post.id}`}
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
            <DialogTitle className="pr-8">{selectedPost?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedPost?.nicheId && (
                <Badge variant="secondary">{getNicheBadge(selectedPost.nicheId)}</Badge>
              )}
              {selectedPost?.accountName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {selectedPost.accountName}
                </Badge>
              )}
              {selectedPost?.publishedAt && (
                <span className="text-xs">
                  Published {formatDate(selectedPost.publishedAt).relative}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Research Topic
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedPost?.topic}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Summary
                </h4>
                <p className="text-sm">
                  {selectedPost?.excerpt}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Posting Details
                </h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{selectedPost?.createdAt && formatDate(selectedPost.createdAt).display} at {selectedPost?.createdAt && formatDate(selectedPost.createdAt).time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Published:</span>
                    <span>{selectedPost?.publishedAt && formatDate(selectedPost.publishedAt).display} at {selectedPost?.publishedAt && formatDate(selectedPost.publishedAt).time}</span>
                  </div>
                  {selectedPost?.bloggerPostUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Blog URL:</span>
                      <a 
                        href={selectedPost.bloggerPostUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        View on Blogger
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {selectedPost?.labels && selectedPost.labels.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Labels</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPost.labels.map((label, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2">Full Content</h4>
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedPost?.content || "" }}
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
