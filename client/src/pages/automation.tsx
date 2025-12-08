import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Clock, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Globe,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Pencil
} from "lucide-react";
import { NICHES, type AppSettings, type Schedule, type BloggerAccount } from "@shared/schema";

export default function Automation() {
  const { toast } = useToast();
  const [newTime, setNewTime] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountBlogId, setAccountBlogId] = useState("");
  const [selectedAccountNiche, setSelectedAccountNiche] = useState("");
  
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editAccountId, setEditAccountId] = useState<string>("");
  
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const addSchedule = useMutation({
    mutationFn: async ({ time, timezone, accountId }: { 
      time: string; 
      timezone?: string; 
      accountId?: string 
    }) => {
      return apiRequest("POST", "/api/settings/schedules", { time, timezone, accountId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Schedule added successfully" });
      setNewTime("");
      setSelectedAccountId("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add schedule", description: error.message, variant: "destructive" });
    },
  });

  const removeSchedule = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/settings/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Schedule removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove schedule", description: error.message, variant: "destructive" });
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/settings/schedules/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, time, timezone, accountId }: { id: string; time: string; timezone: string; accountId?: string }) => {
      return apiRequest("PATCH", `/api/settings/schedules/${id}`, { time, timezone, accountId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Schedule updated successfully" });
      setIsEditScheduleOpen(false);
      setEditingSchedule(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update schedule", description: error.message, variant: "destructive" });
    },
  });

  const addAccount = useMutation({
    mutationFn: async (account: {
      name: string;
      blogId: string;
      nicheId?: string;
    }) => {
      return apiRequest("POST", "/api/accounts", account);
    },
    onSuccess: (data: { message?: string; warning?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      if (data.warning) {
        toast({ 
          title: "Account added with warning", 
          description: data.warning,
          variant: "destructive",
        });
      } else {
        toast({ title: "Blogger account connected!", description: data.message });
      }
      setIsAddAccountOpen(false);
      resetAccountForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add account", description: error.message, variant: "destructive" });
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Account removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove account", description: error.message, variant: "destructive" });
    },
  });

  const connectAccount = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/accounts/${id}/connect`);
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Account connected!", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const resetAccountForm = () => {
    setAccountName("");
    setAccountBlogId("");
    setSelectedAccountNiche("");
  };

  const openEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setEditTime(schedule.time);
    setEditAccountId(schedule.accountId || "");
    setIsEditScheduleOpen(true);
  };

  const handleUpdateSchedule = () => {
    if (!editingSchedule || !editTime) {
      toast({ title: "Please select a time", variant: "destructive" });
      return;
    }
    updateSchedule.mutate({
      id: editingSchedule.id,
      time: editTime,
      timezone: editingSchedule.timezone || timezone,
      accountId: editAccountId || undefined,
    });
  };

  const handleAddSchedule = () => {
    if (!newTime) {
      toast({ title: "Please select a time", variant: "destructive" });
      return;
    }
    addSchedule.mutate({
      time: newTime,
      timezone,
      accountId: selectedAccountId || undefined,
    });
  };

  const handleAddAccount = () => {
    if (!accountName || !accountBlogId) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    addAccount.mutate({
      name: accountName,
      blogId: accountBlogId,
      nicheId: selectedAccountNiche || undefined,
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getNicheName = (nicheId?: string) => {
    if (!nicheId) return "Random";
    const niche = NICHES.find(n => n.id === nicheId);
    return niche?.name || nicheId;
  };

  const getAccountName = (accountId?: string) => {
    if (!accountId) return "Default";
    const account = settings?.bloggerAccounts?.find(a => a.id === accountId);
    return account?.name || accountId;
  };

  const getAccountNicheName = (accountId?: string) => {
    if (!accountId) return "Random";
    const account = settings?.bloggerAccounts?.find(a => a.id === accountId);
    if (!account?.nicheId) return "Random";
    const niche = NICHES.find(n => n.id === account.nicheId);
    return niche?.name || "Random";
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const accounts = settings?.bloggerAccounts || [];
  const schedules = settings?.schedules || [];
  const sortedSchedules = [...schedules].sort((a, b) => a.time.localeCompare(b.time));
  const activeSchedules = schedules.filter(s => s.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-automation-title">Automation</h1>
        <p className="text-muted-foreground">
          Manage your Blogger accounts and automated posting schedules
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Status</CardTitle>
                <CardDescription>System overview</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Accounts</span>
              </div>
              <Badge variant="secondary">{accounts.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Active Schedules</span>
              </div>
              <Badge variant="secondary">{activeSchedules.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Timezone</span>
              </div>
              <span className="text-sm text-muted-foreground">{timezone}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              {activeSchedules.length > 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Automation Active</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">No Active Schedules</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Blogger Accounts</CardTitle>
                  <CardDescription>Connected blogs for publishing</CardDescription>
                </div>
              </div>
              <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-account">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Blogger Account</DialogTitle>
                    <DialogDescription>
                      Connect a new Blogger blog for automated posting
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="account-name">Account Name *</Label>
                      <Input
                        id="account-name"
                        placeholder="e.g., Tech Blog"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        data-testid="input-account-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-niche">Primary Niche</Label>
                      <Select value={selectedAccountNiche} onValueChange={setSelectedAccountNiche}>
                        <SelectTrigger data-testid="select-account-niche">
                          <SelectValue placeholder="Select a niche" />
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
                    <div className="space-y-2">
                      <Label htmlFor="account-blog-id">Blog ID *</Label>
                      <Input
                        id="account-blog-id"
                        placeholder="Enter Blogger Blog ID"
                        value={accountBlogId}
                        onChange={(e) => setAccountBlogId(e.target.value)}
                        data-testid="input-account-blog-id"
                      />
                      <p className="text-xs text-muted-foreground">
                        Find this in your Blogger dashboard URL. Uses global OAuth credentials from Settings.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddAccount}
                      disabled={addAccount.isPending}
                      data-testid="button-confirm-add-account"
                    >
                      {addAccount.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                      Add Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No Blogger accounts connected</p>
                <p className="text-sm">Add an account to start publishing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account, index) => (
                  <div 
                    key={account.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50"
                    data-testid={`account-${index}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{account.name}</span>
                        {account.isConnected ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        Blog ID: {account.blogId}
                        {account.nicheId && (
                          <span className="ml-2">| Niche: {getNicheName(account.nicheId)}</span>
                        )}
                      </p>
                      {account.blogName && (
                        <p className="text-sm text-muted-foreground">{account.blogName}</p>
                      )}
                      {account.blogUrl && (
                        <a 
                          href={account.blogUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {account.blogUrl}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.isConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectAccount.mutate(account.id)}
                          disabled={connectAccount.isPending}
                          data-testid={`button-connect-account-${index}`}
                        >
                          {connectAccount.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Connect
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAccount.mutate(account.id)}
                        data-testid={`button-remove-account-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Publishing Schedule</CardTitle>
              <CardDescription>
                Configure automated posting times (runs 24/7)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                data-testid="input-schedule-time"
              />
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={selectedAccountId || "__default__"} onValueChange={(val) => setSelectedAccountId(val === "__default__" ? "" : val)}>
                <SelectTrigger data-testid="select-schedule-account">
                  <SelectValue placeholder="Default account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} {account.nicheId ? `(${getNicheName(account.nicheId)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Niche is determined by the account settings
              </p>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleAddSchedule}
                disabled={addSchedule.isPending || !newTime}
                className="w-full"
                data-testid="button-add-schedule"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>
          </div>

          <Separator />

          {sortedSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No schedules configured</p>
              <p className="text-sm">Add a schedule to start automated posting</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="space-y-3">
                {sortedSchedules.map((schedule, index) => (
                  <div 
                    key={schedule.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50"
                    data-testid={`schedule-${index}`}
                  >
                    <div className="flex items-center gap-4 flex-wrap flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-medium">{formatTime(schedule.time)}</span>
                      </div>
                      <Badge variant="secondary">
                        {getAccountName(schedule.accountId)}
                      </Badge>
                      <Badge variant="outline">
                        {getAccountNicheName(schedule.accountId)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.isActive}
                        onCheckedChange={() => toggleSchedule.mutate(schedule.id)}
                        data-testid={`switch-schedule-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditSchedule(schedule)}
                        data-testid={`button-edit-schedule-${index}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSchedule.mutate(schedule.id)}
                        data-testid={`button-remove-schedule-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditScheduleOpen} onOpenChange={setIsEditScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the posting time or account for this schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-schedule-time">Time</Label>
              <Input
                id="edit-schedule-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                data-testid="input-edit-schedule-time"
              />
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select 
                value={editAccountId || "__default__"} 
                onValueChange={(val) => setEditAccountId(val === "__default__" ? "" : val)}
              >
                <SelectTrigger data-testid="select-edit-schedule-account">
                  <SelectValue placeholder="Default account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} {account.nicheId ? `(${getNicheName(account.nicheId)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditScheduleOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSchedule}
              disabled={updateSchedule.isPending || !editTime}
              data-testid="button-confirm-edit-schedule"
            >
              {updateSchedule.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
