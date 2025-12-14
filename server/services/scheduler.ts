import cron, { ScheduledTask } from "node-cron";
import { storage } from "../storage";
import { generateBlogPost } from "./cerebras";
import { generateBlogImage } from "./imageGenerator";
import { publishToBlogger, publishToBloggerWithAccount } from "./blogger";
import { publishToTumblr } from "./tumblr";
import { postBlogToX } from "./twitter";
import { searchTrendingTopicsSerper, researchTopicWithSerper } from "./serper";
import type { Schedule, BloggerAccount, NicheId, Post, InsertTrendingResearch } from "@shared/schema";
import { NICHES } from "@shared/schema";

const scheduledJobs: Map<string, ScheduledTask> = new Map();
const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function timeToCron(time: string): string {
  const [hours, minutes] = time.split(":");
  return `${minutes} ${hours} * * *`;
}

function getRandomNiche(): string {
  const index = Math.floor(Math.random() * NICHES.length);
  return NICHES[index].id;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishWithRetry(
  post: Post,
  account?: BloggerAccount,
  maxRetries = MAX_PUBLISH_RETRIES
): Promise<{ success: boolean; postId?: string; postUrl?: string; message: string }> {
  let lastError = "Unknown error";
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Scheduler] Publishing attempt ${attempt}/${maxRetries}...`);
    
    try {
      let result;
      if (account) {
        result = await publishToBloggerWithAccount(post, account);
      } else {
        result = await publishToBlogger(post);
      }
      
      if (result.success) {
        console.log(`[Scheduler] Publish succeeded on attempt ${attempt}`);
        return result;
      }
      
      lastError = result.message;
      console.error(`[Scheduler] Attempt ${attempt} failed: ${result.message}`);
      
      if (result.message.includes("401") || result.message.includes("token expired")) {
        console.log("[Scheduler] Token issue detected, retrying after refresh...");
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Scheduler] Attempt ${attempt} threw error:`, error);
    }
    
    if (attempt < maxRetries) {
      const waitTime = RETRY_DELAY_MS * attempt;
      console.log(`[Scheduler] Waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
    }
  }
  
  return { success: false, message: `Failed after ${maxRetries} attempts. Last error: ${lastError}` };
}

async function executeScheduledPost(schedule?: Schedule): Promise<void> {
  const accountId = schedule?.accountId;
  const scheduleTime = schedule?.time || "manual";
  
  let account: BloggerAccount | undefined;
  if (accountId) {
    account = await storage.getBloggerAccount(accountId);
  }
  
  // Use account's niche only - no fallback to random
  const nicheId = account?.nicheId;
  
  if (!nicheId) {
    console.error(`[Scheduler] ERROR: Account ${account?.name || accountId} has no niche configured, skipping`);
    return;
  }
  
  console.log(`[Scheduler] ========================================`);
  console.log(`[Scheduler] Starting scheduled post at ${new Date().toISOString()}`);
  console.log(`[Scheduler] Schedule time: ${scheduleTime}`);
  console.log(`[Scheduler] Niche: ${nicheId}, Account: ${accountId || "default"}`);
  console.log(`[Scheduler] ========================================`);
  
  try {
    const settings = await storage.getSettings();
    
    if (settings.cerebrasApiKeys.length === 0) {
      console.error("[Scheduler] ERROR: No Cerebras API keys available, skipping scheduled post");
      return;
    }

    if (accountId) {
      if (!account) {
        console.error(`[Scheduler] ERROR: Account ${accountId} not found, skipping`);
        return;
      }
      if (!account.isConnected) {
        console.error(`[Scheduler] ERROR: Account ${account.name} not connected, skipping`);
        return;
      }
      console.log(`[Scheduler] Using account: ${account.name}`);
    } else if (!settings.blogger.isConnected) {
      console.error("[Scheduler] ERROR: Blogger not connected, skipping scheduled post");
      return;
    }

    const niche = NICHES.find(n => n.id === nicheId);
    console.log(`[Scheduler] Step 1: Researching trending topics via Serper.dev for ${niche?.name || nicheId}...`);
    
    let serperResearch;
    try {
      const serperKeys = settings.serperApiKeys || [];
      if (serperKeys.length === 0) {
        console.error("[Scheduler] ERROR: No Serper API keys available, skipping scheduled post");
        return;
      }
      
      serperResearch = await searchTrendingTopicsSerper(nicheId as NicheId, accountId);
      console.log(`[Scheduler] Topic researched via Serper: ${serperResearch.topic}`);
      console.log(`[Scheduler] Found ${serperResearch.totalSourcesFound} sources, ${serperResearch.topicCandidatesGenerated} candidates generated`);
      console.log(`[Scheduler] Niche confirmed: ${serperResearch.nicheConfirmed ? "Yes" : "No"}, Key: ${serperResearch.serperKeyUsed}`);
      
      const researchLog: InsertTrendingResearch = {
        title: serperResearch.topic,
        shortDescription: serperResearch.summary.slice(0, 200),
        fullSummary: serperResearch.summary,
        aiAnalysis: `Topic selected from ${serperResearch.topicCandidatesGenerated} candidates based on ${serperResearch.totalSourcesFound} sources found via Serper.dev search. Niche confirmed: ${serperResearch.nicheConfirmed}. Keywords: ${serperResearch.keywords.join(", ")}`,
        nicheId: nicheId,
        nicheName: niche?.name || nicheId,
        bloggerAccountId: accountId,
        bloggerAccountName: account?.name,
        sources: serperResearch.sources,
        searchQueries: serperResearch.searchQueries,
        whyTrending: serperResearch.whyTrending,
        serperKeyUsed: serperResearch.serperKeyUsed,
        status: "generated",
        researchedAt: new Date().toISOString(),
      };
      
      const savedResearch = await storage.createTrendingResearch(researchLog);
      console.log("[Scheduler] Research log saved for transparency with ID:", savedResearch.id);
      
      await storage.addUsedTopic(serperResearch.topic, nicheId);
      console.log("[Scheduler] Topic added to used topics for duplicate prevention");
      
      (serperResearch as any).researchId = savedResearch.id;
      
    } catch (error) {
      console.error("[Scheduler] ERROR: Failed to research topics via Serper:", error);
      throw new Error(`Serper research failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    console.log("[Scheduler] Step 2: Generating blog post content with AI...");
    let content;
    try {
      const fomoHook = `Discover what's happening now with ${serperResearch.topic}`;
      content = await generateBlogPost(serperResearch.topic, fomoHook, nicheId as NicheId);
      console.log(`[Scheduler] Post title: ${content.title}`);
    } catch (error) {
      console.error("[Scheduler] ERROR: Failed to generate blog post:", error);
      throw new Error(`Blog post generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    let imageUrl: string | undefined;
    console.log("[Scheduler] Step 3: Generating featured image (FREE - Pollinations AI)...");
    try {
      const image = await generateBlogImage(content.imagePrompt);
      if (image) {
        imageUrl = image;
        console.log("[Scheduler] Image generated successfully");
      } else {
        console.error("[Scheduler] ERROR: Image generation returned null - image is required for posting");
        throw new Error("Image generation failed - image is mandatory for blog posts");
      }
    } catch (error) {
      console.error("[Scheduler] ERROR: Image generation failed - image is required for posting:", error);
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    console.log("[Scheduler] Step 4: Saving post as draft...");
    const post = await storage.createPost({
      title: content.title,
      content: content.content,
      excerpt: content.excerpt,
      topic: serperResearch.topic,
      nicheId,
      accountId,
      accountName: account?.name,
      imageUrl,
      status: "draft",
      labels: content.labels,
    });
    console.log(`[Scheduler] Draft saved with ID: ${post.id}`);

    console.log("[Scheduler] Step 5: Publishing to Blogger with retries...");
    const result = await publishWithRetry(post, account);

    if (result.success) {
      await storage.updatePost(post.id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        bloggerPostId: result.postId,
        bloggerPostUrl: result.postUrl,
      });
      console.log(`[Scheduler] SUCCESS: Post published at ${result.postUrl}`);
      
      if ((serperResearch as any).researchId) {
        await storage.updateTrendingResearch((serperResearch as any).researchId, {
          status: "published",
          postId: post.id,
          postTitle: post.title,
        });
        console.log("[Scheduler] Research log status updated to published");
      }
      
      // Step 6: Cross-post to Tumblr if there's a connection for this account
      if (accountId && result.postUrl) {
        try {
          const connections = await storage.getTumblrConnections();
          const connection = connections.find(c => c.bloggerAccountId === accountId);
          
          if (connection) {
            console.log(`[Scheduler] Step 6: Cross-posting to Tumblr (${connection.tumblrBlogName})...`);
            const tumblrResult = await publishToTumblr(
              connection.tumblrBlogName,
              post,
              result.postUrl
            );
            
            if (tumblrResult.success) {
              console.log(`[Scheduler] SUCCESS: Also posted to Tumblr at ${tumblrResult.postUrl}`);
            } else {
              console.log(`[Scheduler] Tumblr cross-post failed: ${tumblrResult.message}`);
            }
          } else {
            console.log(`[Scheduler] No Tumblr connection found for account ${accountId}, skipping cross-post`);
          }
        } catch (tumblrError) {
          console.error("[Scheduler] Tumblr cross-post error:", tumblrError);
        }
        
        // Step 7: Cross-post to X (Twitter) if there's a connection for this account
        try {
          const updatedPost = await storage.getPost(post.id);
          if (updatedPost) {
            console.log(`[Scheduler] Step 7: Cross-posting to X (Twitter)...`);
            const xResult = await postBlogToX(accountId, updatedPost);
            
            if (xResult.success) {
              console.log(`[Scheduler] SUCCESS: Also posted to X at ${xResult.tweetUrl}`);
            } else {
              console.log(`[Scheduler] X cross-post skipped/failed: ${xResult.message}`);
            }
          }
        } catch (xError) {
          console.error("[Scheduler] X cross-post error:", xError);
        }
      }
      
      console.log(`[Scheduler] ========================================`);
    } else {
      await storage.updatePost(post.id, {
        status: "failed",
        errorMessage: result.message,
      });
      console.error(`[Scheduler] FAILED: ${result.message}`);
      console.log(`[Scheduler] ========================================`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Scheduler] CRITICAL ERROR during scheduled post: ${errorMessage}`);
    console.error("[Scheduler] Full error:", error);
    console.log(`[Scheduler] ========================================`);
  }
}

export async function startScheduler(): Promise<void> {
  console.log("[Scheduler] ========================================");
  console.log("[Scheduler] Initializing scheduler...");
  console.log(`[Scheduler] Current server time: ${new Date().toISOString()}`);
  console.log("[Scheduler] ========================================");
  await refreshSchedules();
}

export async function refreshSchedules(): Promise<void> {
  console.log("[Scheduler] Refreshing scheduled jobs...");
  
  scheduledJobs.forEach((job, id) => {
    console.log(`[Scheduler] Stopping existing job: ${id}`);
    job.stop();
  });
  scheduledJobs.clear();

  const settings = await storage.getSettings();
  const activeSchedules = settings.schedules.filter((s) => s.isActive);

  console.log(`[Scheduler] Found ${activeSchedules.length} active schedules`);

  if (activeSchedules.length === 0) {
    console.log("[Scheduler] No active schedules configured");
    return;
  }

  for (const schedule of activeSchedules) {
    const cronExpression = timeToCron(schedule.time);
    
    if (cron.validate(cronExpression)) {
      const job = cron.schedule(cronExpression, async () => {
        const triggerTime = new Date().toISOString();
        console.log(`[Scheduler] *** CRON TRIGGERED at ${triggerTime} for schedule ${schedule.time} ***`);
        try {
          await executeScheduledPost(schedule);
        } catch (error) {
          console.error(`[Scheduler] Unhandled error in cron job for ${schedule.time}:`, error);
        }
      }, {
        timezone: schedule.timezone || "UTC"
      });
      
      job.start();
      scheduledJobs.set(schedule.id, job);
      
      let niche = "Random";
      if (schedule.nicheId) {
        niche = NICHES.find(n => n.id === schedule.nicheId)?.name || schedule.nicheId;
      } else if (schedule.accountId) {
        const acc = await storage.getBloggerAccount(schedule.accountId);
        if (acc?.nicheId) {
          niche = NICHES.find(n => n.id === acc.nicheId)?.name || acc.nicheId;
        }
      }
      const account = schedule.accountId || "default";
      console.log(`[Scheduler] Scheduled: ${schedule.time} (${cronExpression}) | Timezone: ${schedule.timezone || "UTC"} | Niche: ${niche} | Account: ${account}`);
    } else {
      console.error(`[Scheduler] ERROR: Invalid cron expression: ${cronExpression} for time ${schedule.time}`);
    }
  }
  
  console.log(`[Scheduler] Total active jobs: ${scheduledJobs.size}`);
}

export function stopScheduler(): void {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs.clear();
  console.log("[Scheduler] All scheduled jobs stopped");
}

export function getActiveScheduleCount(): number {
  return scheduledJobs.size;
}

export async function executeManualPost(nicheId?: string, accountId?: string): Promise<void> {
  await executeScheduledPost({ 
    id: "manual", 
    time: "00:00", 
    isActive: true, 
    timezone: "UTC",
    nicheId,
    accountId,
  });
}
