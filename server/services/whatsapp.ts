import { storage } from "../storage";
import type { WhatsAppSettings, DashboardStats } from "@shared/schema";

const CALLMEBOT_API_URL = "https://api.callmebot.com/whatsapp.php";

export async function sendWhatsAppMessage(message: string): Promise<{ success: boolean; message: string }> {
  const settings = await storage.getWhatsAppSettings();
  
  if (!settings.isEnabled) {
    return { success: false, message: "WhatsApp notifications are disabled" };
  }
  
  if (!settings.phoneNumber || !settings.apiKey) {
    return { success: false, message: "WhatsApp phone number or API key not configured" };
  }
  
  try {
    const encodedMessage = encodeURIComponent(message);
    const url = `${CALLMEBOT_API_URL}?phone=${settings.phoneNumber}&text=${encodedMessage}&apikey=${settings.apiKey}`;
    
    const response = await fetch(url, {
      method: "GET",
    });
    
    const responseText = await response.text();
    
    if (response.ok || responseText.includes("Message queued") || responseText.includes("Message Sent")) {
      console.log("[WhatsApp] Message sent successfully");
      return { success: true, message: "Message sent successfully" };
    }
    
    console.error("[WhatsApp] API response:", responseText);
    return { success: false, message: `Failed to send message: ${responseText}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[WhatsApp] Error sending message:", errorMessage);
    return { success: false, message: `Error sending message: ${errorMessage}` };
  }
}

export async function testWhatsAppConnection(): Promise<{ success: boolean; message: string }> {
  const settings = await storage.getWhatsAppSettings();
  
  if (!settings.phoneNumber || !settings.apiKey) {
    return { success: false, message: "Please enter your phone number and API key first" };
  }
  
  const testMessage = `Test message from AI Blog Automation! Your WhatsApp notifications are working correctly. Time: ${new Date().toLocaleString()}`;
  
  const result = await sendWhatsAppMessage(testMessage);
  
  await storage.updateWhatsAppSettings({
    lastTestAt: new Date().toISOString(),
    lastTestSuccess: result.success,
  });
  
  return result;
}

export async function notifyPublishFailure(
  postTitle: string,
  errorMessage: string,
  accountName?: string
): Promise<void> {
  const settings = await storage.getWhatsAppSettings();
  
  if (!settings.isEnabled || !settings.notifyOnFailure) {
    return;
  }
  
  const timestamp = new Date().toLocaleString();
  const accountInfo = accountName ? ` (${accountName})` : "";
  
  const message = `PUBLISH FAILED!

Post: "${postTitle}"${accountInfo}
Error: ${errorMessage}
Time: ${timestamp}

Please check your dashboard for details.`;
  
  try {
    await sendWhatsAppMessage(message);
    console.log("[WhatsApp] Failure notification sent for:", postTitle);
  } catch (error) {
    console.error("[WhatsApp] Failed to send failure notification:", error);
  }
}

export async function sendDailyReport(): Promise<{ success: boolean; message: string }> {
  const settings = await storage.getWhatsAppSettings();
  
  if (!settings.isEnabled || !settings.sendDailyReport) {
    return { success: false, message: "Daily reports are disabled" };
  }
  
  try {
    const stats = await storage.getStats();
    const posts = await storage.getPosts();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysPosts = posts.filter((p) => {
      const postDate = new Date(p.createdAt);
      postDate.setHours(0, 0, 0, 0);
      return postDate.getTime() === today.getTime();
    });
    
    const publishedToday = todaysPosts.filter((p) => p.status === "published").length;
    const failedToday = todaysPosts.filter((p) => p.status === "failed").length;
    const scheduledPosts = posts.filter((p) => p.status === "scheduled").length;
    
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const message = `DAILY REPORT - ${date}

Today's Activity:
- Published: ${publishedToday} posts
- Failed: ${failedToday} posts
- Pending Scheduled: ${scheduledPosts} posts

All-Time Stats:
- Total Posts: ${stats.totalPosts}
- Connected Accounts: ${stats.accountsCount}

${failedToday > 0 ? "ATTENTION: Some posts failed today. Please review your dashboard." : "All systems running smoothly!"}

Have a great day!`;
    
    const result = await sendWhatsAppMessage(message);
    console.log("[WhatsApp] Daily report sent:", result.success);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[WhatsApp] Failed to send daily report:", errorMessage);
    return { success: false, message: errorMessage };
  }
}

export async function getWhatsAppStatus(): Promise<{
  isConfigured: boolean;
  isEnabled: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
}> {
  const settings = await storage.getWhatsAppSettings();
  
  return {
    isConfigured: !!(settings.phoneNumber && settings.apiKey),
    isEnabled: settings.isEnabled,
    lastTestAt: settings.lastTestAt,
    lastTestSuccess: settings.lastTestSuccess,
  };
}
