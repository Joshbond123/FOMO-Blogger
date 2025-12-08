import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Plus, X, Calendar } from "lucide-react";
import { NICHES, type Schedule, type BloggerAccount } from "@shared/schema";

interface ScheduleCardProps {
  schedules: Schedule[];
  accounts?: BloggerAccount[];
  onAddSchedule: (time: string, timezone?: string, nicheId?: string, accountId?: string) => void;
  onRemoveSchedule: (id: string) => void;
  onToggleSchedule: (id: string) => void;
}

export function ScheduleCard({
  schedules,
  accounts = [],
  onAddSchedule,
  onRemoveSchedule,
  onToggleSchedule,
}: ScheduleCardProps) {
  const [newTime, setNewTime] = useState("");
  const [selectedNicheId, setSelectedNicheId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleAddSchedule = () => {
    if (newTime) {
      onAddSchedule(
        newTime, 
        timezone, 
        selectedNicheId || undefined, 
        selectedAccountId || undefined
      );
      setNewTime("");
      setSelectedNicheId("");
      setSelectedAccountId("");
    }
  };

  const sortedSchedules = [...schedules].sort((a, b) => a.time.localeCompare(b.time));

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getNicheName = (nicheId?: string) => {
    if (!nicheId) return null;
    const niche = NICHES.find(n => n.id === nicheId);
    return niche?.name || nicheId;
  };

  const getAccountName = (accountId?: string) => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account?.name || accountId;
  };

  const getScheduleNiche = (schedule: Schedule) => {
    if (schedule.accountId) {
      const account = accounts.find(a => a.id === schedule.accountId);
      if (account?.nicheId) {
        return getNicheName(account.nicheId);
      }
      return "No niche set";
    }
    return "No account";
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Publishing Schedule</CardTitle>
            <CardDescription className="text-sm">
              Set daily posting times with niche and account assignment
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Scheduled Times ({schedules.length})</Label>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-4">
                {sortedSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                      !schedule.isActive ? "opacity-60" : ""
                    }`}
                    data-testid={`schedule-item-${schedule.id}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-sm">{formatTime(schedule.time)}</span>
                      <Badge variant="outline" className="text-xs">
                        {schedule.timezone || "UTC"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getScheduleNiche(schedule)}
                      </Badge>
                      {schedule.accountId && (
                        <Badge variant="secondary" className="text-xs">
                          {getAccountName(schedule.accountId)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Switch
                        checked={schedule.isActive}
                        onCheckedChange={() => onToggleSchedule(schedule.id)}
                        data-testid={`switch-toggle-schedule-${schedule.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveSchedule(schedule.id)}
                        data-testid={`button-remove-schedule-${schedule.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="space-y-4">
          <Label className="text-sm font-medium">Add New Schedule</Label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="font-mono"
                data-testid="input-schedule-time"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Niche (optional)</Label>
              <Select value={selectedNicheId} onValueChange={setSelectedNicheId}>
                <SelectTrigger data-testid="select-schedule-niche">
                  <SelectValue placeholder="Any niche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any niche</SelectItem>
                  {NICHES.map((niche) => (
                    <SelectItem key={niche.id} value={niche.id}>
                      {niche.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Account (optional)</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger data-testid="select-schedule-account">
                  <SelectValue placeholder="Any account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleAddSchedule}
              disabled={!newTime}
              data-testid="button-add-schedule"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Timezone: {timezone}
          </p>
        </div>

        {schedules.length === 0 && (
          <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground text-center">
            No scheduled times yet. Add posting times to automate your content publishing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
