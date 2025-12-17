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
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  MessageCircle, 
  Send, 
  Check, 
  X, 
  RefreshCw,
  Bell,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  Phone,
  Key,
  AlertTriangle
} from "lucide-react";

interface WhatsAppSettings {
  phoneNumber?: string;
  apiKey?: string;
  isEnabled: boolean;
  notifyOnFailure: boolean;
  sendDailyReport: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
}

interface WhatsAppStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
}

export default function WhatsApp() {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<WhatsAppSettings>({
    queryKey: ["/api/whatsapp/settings"],
  });

  const { data: status, isLoading: statusLoading } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp/status"],
  });

  const saveSettings = useMutation({
    mutationFn: async (data: Partial<WhatsAppSettings>) => {
      return apiRequest("POST", "/api/whatsapp/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save settings", description: error.message, variant: "destructive" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp/test");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({ title: "Test message sent!", description: "Check your WhatsApp for the test message." });
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const sendDailyReportNow = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp/send-daily-report");
    },
    onSuccess: () => {
      toast({ title: "Daily report sent!", description: "Check your WhatsApp for the report." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send report", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveCredentials = () => {
    if (!phoneNumber.trim() && !apiKey.trim()) {
      toast({ title: "Please enter phone number and API key", variant: "destructive" });
      return;
    }
    
    const updates: Partial<WhatsAppSettings> = {};
    if (phoneNumber.trim()) updates.phoneNumber = phoneNumber.trim();
    if (apiKey.trim()) updates.apiKey = apiKey.trim();
    
    saveSettings.mutate(updates);
    setPhoneNumber("");
    setApiKey("");
  };

  const handleToggleEnabled = (enabled: boolean) => {
    saveSettings.mutate({ isEnabled: enabled });
  };

  const handleToggleNotifyOnFailure = (enabled: boolean) => {
    saveSettings.mutate({ notifyOnFailure: enabled });
  };

  const handleToggleDailyReport = (enabled: boolean) => {
    saveSettings.mutate({ sendDailyReport: enabled });
  };

  if (settingsLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 text-white">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">WhatsApp Notifications</h1>
          <p className="text-muted-foreground">Get instant alerts via CallMeBot</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Connection Status
                  </CardTitle>
                  <CardDescription>Your WhatsApp notification status</CardDescription>
                </div>
                {status?.isConfigured ? (
                  status?.isEnabled ? (
                    <Badge variant="default" className="bg-green-500">
                      <Check className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <X className="mr-1 h-3 w-3" />
                      Disabled
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Not Configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-xs text-muted-foreground">Turn WhatsApp notifications on/off</p>
                </div>
                <Switch
                  checked={settings?.isEnabled || false}
                  onCheckedChange={handleToggleEnabled}
                  disabled={!status?.isConfigured}
                  data-testid="switch-enable-notifications"
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Publish Failure Alerts
                  </Label>
                  <p className="text-xs text-muted-foreground">Get notified when a post fails</p>
                </div>
                <Switch
                  checked={settings?.notifyOnFailure || false}
                  onCheckedChange={handleToggleNotifyOnFailure}
                  disabled={!status?.isConfigured || !settings?.isEnabled}
                  data-testid="switch-failure-alerts"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Daily Reports (11:59 PM)
                  </Label>
                  <p className="text-xs text-muted-foreground">Receive daily activity summary</p>
                </div>
                <Switch
                  checked={settings?.sendDailyReport || false}
                  onCheckedChange={handleToggleDailyReport}
                  disabled={!status?.isConfigured || !settings?.isEnabled}
                  data-testid="switch-daily-reports"
                />
              </div>
              
              {status?.lastTestAt && (
                <>
                  <Separator />
                  <div className="text-xs text-muted-foreground">
                    Last test: {new Date(status.lastTestAt).toLocaleString()}
                    {status.lastTestSuccess ? (
                      <Badge variant="outline" className="ml-2 text-green-600">Success</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 text-red-600">Failed</Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                CallMeBot Credentials
              </CardTitle>
              <CardDescription>Enter your WhatsApp number and API key</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number (with country code)
                </Label>
                <Input
                  id="phoneNumber"
                  placeholder="e.g., 12025551234 (no + or spaces)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  data-testid="input-phone-number"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {settings?.phoneNumber || "Not set"}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  CallMeBot API Key
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Your CallMeBot API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-api-key"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                    data-testid="button-toggle-api-key"
                  >
                    {showApiKey ? <X className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: {settings?.apiKey ? "***configured***" : "Not set"}
                </p>
              </div>
              
              <Button 
                onClick={handleSaveCredentials}
                disabled={saveSettings.isPending || (!phoneNumber.trim() && !apiKey.trim())}
                className="w-full"
                data-testid="button-save-credentials"
              >
                {saveSettings.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save Credentials
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test & Actions
              </CardTitle>
              <CardDescription>Test your connection and send reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending || !status?.isConfigured}
                variant="outline"
                className="w-full"
                data-testid="button-test-connection"
              >
                {testConnection.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Test Message
              </Button>
              
              <Button 
                onClick={() => sendDailyReportNow.mutate()}
                disabled={sendDailyReportNow.isPending || !status?.isConfigured || !settings?.isEnabled}
                variant="outline"
                className="w-full"
                data-testid="button-send-report"
              >
                {sendDailyReportNow.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Send Daily Report Now
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      How to Use CallMeBot
                    </CardTitle>
                    {isGuideOpen ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-4 space-y-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">What is CallMeBot?</h3>
                      <p className="text-sm text-muted-foreground">
                        CallMeBot is a free service that allows you to receive WhatsApp messages from your applications. 
                        It's perfect for receiving instant notifications about your blog posts!
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Why Do You Need It?</h3>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        <li>Get instant alerts when a blog post fails to publish</li>
                        <li>Receive daily summaries of your blog activity</li>
                        <li>Stay informed without checking the dashboard constantly</li>
                        <li>Never miss important issues with your automation</li>
                      </ul>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Setup Instructions</h3>
                      
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                          <div>
                            <p className="font-medium">Open WhatsApp on your phone</p>
                            <p className="text-sm text-muted-foreground">Make sure you have the latest version installed.</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                          <div>
                            <p className="font-medium">Add CallMeBot to your contacts</p>
                            <p className="text-sm text-muted-foreground">
                              Save this number: <strong>+34 644 71 69 51</strong>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                          <div>
                            <p className="font-medium">Send the activation message</p>
                            <p className="text-sm text-muted-foreground">
                              Send this exact message to CallMeBot:
                            </p>
                            <code className="block mt-1 p-2 bg-muted rounded text-sm">
                              I allow callmebot to send me messages
                            </code>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</div>
                          <div>
                            <p className="font-medium">Get your API Key</p>
                            <p className="text-sm text-muted-foreground">
                              CallMeBot will reply with your unique API key. Copy this key!
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">5</div>
                          <div>
                            <p className="font-medium">Enter your credentials here</p>
                            <p className="text-sm text-muted-foreground">
                              Enter your phone number (with country code, no + or spaces) and the API key you received.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">6</div>
                          <div>
                            <p className="font-medium">Test the connection</p>
                            <p className="text-sm text-muted-foreground">
                              Click "Send Test Message" to verify everything works!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Phone Number Format</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your phone number with country code, without the + sign or spaces:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>USA: 12025551234 (1 is the country code)</li>
                        <li>UK: 447911123456 (44 is the country code)</li>
                        <li>Nigeria: 2348012345678 (234 is the country code)</li>
                        <li>India: 919876543210 (91 is the country code)</li>
                      </ul>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Troubleshooting</h3>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        <li>Make sure you sent the activation message correctly</li>
                        <li>Check that your phone number format is correct</li>
                        <li>Ensure you copied the API key exactly as received</li>
                        <li>Wait a few seconds after saving before testing</li>
                        <li>If issues persist, try reactivating with CallMeBot</li>
                      </ul>
                    </div>
                    
                    <div className="pt-2">
                      <Button variant="outline" className="w-full" asChild>
                        <a 
                          href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Visit CallMeBot Website
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>
            {!isGuideOpen && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click above to expand the setup guide and learn how to configure CallMeBot for WhatsApp notifications.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                What You'll Receive
              </CardTitle>
              <CardDescription>Example notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium text-red-600 mb-1">Publish Failure Alert:</p>
                <p className="text-sm">
                  PUBLISH FAILED!<br />
                  Post: "10 Amazing AI Tools You Need"<br />
                  Error: Token expired<br />
                  Time: Dec 17, 2025, 3:45 PM
                </p>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium text-green-600 mb-1">Daily Report (11:59 PM):</p>
                <p className="text-sm">
                  DAILY REPORT<br />
                  Today's Activity:<br />
                  - Published: 5 posts<br />
                  - Failed: 0 posts<br />
                  - Scheduled: 3 posts<br />
                  All systems running smoothly!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
