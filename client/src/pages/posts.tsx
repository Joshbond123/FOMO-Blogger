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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NICHES, type Post } from "@shared/schema";

export default function Posts() {
  const { toast } = useToast();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: posts = [], isLoading, refetch } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
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

  const publishPost = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/publish/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Post published successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Published
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            <FileText className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNicheName = (nicheId?: string) => {
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

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === "published").length,
    drafts: posts.filter(p => p.status === "draft").length,
    failed: posts.filter(p => p.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-posts-title">Posts</h1>
          <p className="text-muted-foreground">
            View and manage your generated blog posts
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-refresh-posts"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total Posts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.published}</div>
              <p className="text-sm text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-muted-foreground">{stats.drafts}</div>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">{stats.failed}</div>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Post History</CardTitle>
              <CardDescription>All generated and published posts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No posts yet</p>
              <p className="text-sm">Generated posts will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Niche</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPosts.map((post, index) => {
                    const date = formatDate(post.createdAt);
                    return (
                      <TableRow key={post.id} data-testid={`post-row-${index}`}>
                        <TableCell className="max-w-xs">
                          <div className="truncate font-medium">{post.title}</div>
                          {post.accountName && (
                            <div className="text-xs text-muted-foreground">{post.accountName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {post.nicheId && (
                            <Badge variant="outline" size="sm">
                              {getNicheName(post.nicheId)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(post.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">{date.display}</div>
                          <div className="text-xs text-muted-foreground">{date.relative}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPost(post);
                                setPreviewOpen(true);
                              }}
                              data-testid={`button-view-post-${index}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {post.bloggerPostUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(post.bloggerPostUrl, "_blank")}
                                data-testid={`button-open-post-${index}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {post.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => publishPost.mutate(post.id)}
                                disabled={publishPost.isPending}
                                data-testid={`button-publish-post-${index}`}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePost.mutate(post.id)}
                              data-testid={`button-delete-post-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedPost?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {selectedPost && getStatusBadge(selectedPost.status)}
              {selectedPost?.nicheId && (
                <Badge variant="outline" size="sm">
                  {getNicheName(selectedPost.nicheId)}
                </Badge>
              )}
              {selectedPost?.createdAt && (
                <span className="text-sm">
                  Created {formatDate(selectedPost.createdAt).relative}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedPost?.imageUrl && (
              <div className="mb-4">
                <img 
                  src={selectedPost.imageUrl} 
                  alt={selectedPost.title}
                  className="w-full max-h-64 object-cover rounded-lg"
                />
              </div>
            )}
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedPost?.content || "" }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
