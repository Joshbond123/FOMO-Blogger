import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, AlertCircle } from "lucide-react";
import type { ConnectionStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: ConnectionStatus;
  label?: string;
  count?: number;
}

export function StatusBadge({ status, label, count }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Check,
          text: label || "Connected",
          className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
        };
      case "disconnected":
        return {
          icon: X,
          text: label || "Disconnected",
          className: "bg-muted text-muted-foreground border-muted",
        };
      case "pending":
        return {
          icon: Clock,
          text: label || "Pending",
          className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
        };
      case "error":
        return {
          icon: AlertCircle,
          text: label || "Error",
          className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        };
      default:
        return {
          icon: X,
          text: label || "Unknown",
          className: "bg-muted text-muted-foreground border-muted",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} gap-1.5 font-medium`}
    >
      <Icon className="h-3 w-3" />
      {count !== undefined ? `${count} ${config.text}` : config.text}
    </Badge>
  );
}
