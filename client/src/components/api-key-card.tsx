import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { Plus, X, RotateCcw } from "lucide-react";
import type { ApiKey, ConnectionStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  keys: ApiKey[];
  currentKeyIndex: number;
  onAddKey: (key: string, name?: string) => void;
  onRemoveKey: (id: string) => void;
  onTestConnection: () => void;
  isLoading?: boolean;
  testResult?: { success: boolean; message: string } | null;
}

export function ApiKeyCard({
  title,
  description,
  icon,
  keys,
  currentKeyIndex,
  onAddKey,
  onRemoveKey,
  onTestConnection,
  isLoading,
  testResult,
}: ApiKeyCardProps) {
  const [newKey, setNewKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const { toast } = useToast();

  const handleAddKey = () => {
    if (!newKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }
    onAddKey(newKey.trim(), keyName.trim() || undefined);
    setNewKey("");
    setKeyName("");
  };

  const status: ConnectionStatus = keys.length > 0 ? "connected" : "disconnected";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <StatusBadge
            status={status}
            label={keys.length > 0 ? `${keys.length} key${keys.length > 1 ? "s" : ""}` : "No keys"}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {keys.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Keys</Label>
            <div className="space-y-2">
              {keys.map((apiKey, index) => (
                <div
                  key={apiKey.id}
                  className="flex items-center gap-2 rounded-md bg-muted/50 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      {apiKey.name && (
                        <span className="text-sm font-medium truncate">{apiKey.name}</span>
                      )}
                      {index === currentKeyIndex && (
                        <Badge variant="secondary" className="text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      {apiKey.key}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveKey(apiKey.id)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-remove-key-${apiKey.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-medium">Add New Key</Label>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Key name (optional)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              data-testid={`input-key-name-${title.toLowerCase().replace(/\s/g, "-")}`}
            />
            <Input
              type="password"
              placeholder="Enter API key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="font-mono"
              data-testid={`input-api-key-${title.toLowerCase().replace(/\s/g, "-")}`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleAddKey}
              disabled={!newKey.trim()}
              data-testid={`button-add-key-${title.toLowerCase().replace(/\s/g, "-")}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Key
            </Button>
            {keys.length > 0 && (
              <Button
                variant="outline"
                onClick={onTestConnection}
                disabled={isLoading}
                data-testid={`button-test-${title.toLowerCase().replace(/\s/g, "-")}`}
              >
                {isLoading ? "Testing..." : "Test Connection"}
              </Button>
            )}
          </div>
        </div>

        {testResult && (
          <div
            className={`rounded-md p-3 text-sm ${
              testResult.success
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {testResult.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
