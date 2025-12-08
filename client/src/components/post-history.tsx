import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, ExternalLink, RefreshCw, Trash2, Eye } from "lucide-react";
import type { Post } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

interface PostHistoryProps {
  posts: Post[];
  isLoading?: boolean;
  onRefresh: () => void;
  onDeletePost: (id: string) => void;
  onViewPost: (post: Post) => void;
}

export function PostHistory({
  posts,
  isLoading,
  onRefresh,
  onDeletePost,
  onViewPost,
}: PostHistoryProps) {
  const getStatusBadge = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            Published
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            Scheduled
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            Draft
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
    (a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Post History</CardTitle>
              <CardDescription className="text-sm">
                {posts.length} post{posts.length !== 1 ? "s" : ""} in history
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            data-testid="button-refresh-history"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <div className="rounded-md bg-muted/30 p-8 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No posts yet. Generate your first post to get started!
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Title</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPosts.map((post) => {
                  const date = formatDate(post.publishedAt || post.createdAt);
                  return (
                    <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium line-clamp-1">{post.title}</p>
                          {post.topic && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {post.topic}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">{date.display}</p>
                          <p className="text-xs text-muted-foreground">{date.time}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {post.accountName ? (
                          <span className="text-sm text-muted-foreground">{post.accountName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(post.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewPost(post)}
                            data-testid={`button-view-post-${post.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {post.bloggerPostUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a
                                href={post.bloggerPostUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`link-post-${post.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeletePost(post.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-post-${post.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
  );
}
