import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Calendar, Tag } from "lucide-react";
import type { Post } from "@shared/schema";
import { format } from "date-fns";

interface PostPreviewDialogProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostPreviewDialog({
  post,
  open,
  onOpenChange,
}: PostPreviewDialogProps) {
  if (!post) return null;

  const getStatusColor = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "scheduled":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl leading-tight">{post.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(post.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <Badge variant="outline" className={getStatusColor(post.status)}>
                  {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {post.imageUrl && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {post.excerpt && (
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm italic text-muted-foreground">{post.excerpt}</p>
              </div>
            )}

            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {post.labels && post.labels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-4 border-t">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {post.labels.map((label, index) => (
                  <Badge key={index} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {post.errorMessage && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {post.errorMessage}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {post.bloggerPostUrl && (
          <div className="flex justify-end pt-4 border-t">
            <Button asChild>
              <a
                href={post.bloggerPostUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Blogger
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
