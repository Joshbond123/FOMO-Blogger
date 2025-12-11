import { z } from "zod";

// Niche definitions - 6 viral niches
export const NICHES = [
  {
    id: "scary-mysterious",
    name: "Scary / Mysterious / True Crime",
    description: "Unsolved mysteries, creepy stories, shocking real events",
    icon: "skull",
    color: "red",
    promptContext: "horror, mystery, true crime, unsolved cases, paranormal, creepy stories",
    keywords: ["mystery", "true crime", "creepy", "unsolved", "paranormal", "scary stories"],
  },
  {
    id: "ai-tools",
    name: "AI Tools & Technology",
    description: "Latest AI tools, automation, productivity tech",
    icon: "cpu",
    color: "blue",
    promptContext: "artificial intelligence, AI tools, automation, machine learning, productivity software",
    keywords: ["AI", "automation", "productivity", "technology", "machine learning", "tools"],
  },
  {
    id: "life-hacks",
    name: "Life Hacks & Tips",
    description: "Genius life hacks, money-saving tips, productivity tricks",
    icon: "lightbulb",
    color: "yellow",
    promptContext: "life hacks, productivity tips, money saving, clever solutions, everyday tricks",
    keywords: ["life hacks", "tips", "tricks", "productivity", "money saving", "clever"],
  },
  {
    id: "weird-facts",
    name: "Weird Facts & Discoveries",
    description: "Mind-blowing facts, strange discoveries, unusual knowledge",
    icon: "brain",
    color: "purple",
    promptContext: "weird facts, strange discoveries, unusual knowledge, mind-blowing information, curiosities",
    keywords: ["facts", "weird", "discoveries", "knowledge", "mind-blowing", "curiosities"],
  },
  {
    id: "viral-entertainment",
    name: "Viral Entertainment",
    description: "Trending stories, viral content, entertainment news",
    icon: "flame",
    color: "orange",
    promptContext: "viral content, trending stories, entertainment, pop culture, social media trends",
    keywords: ["viral", "trending", "entertainment", "pop culture", "social media", "news"],
  },
  {
    id: "health-hacks",
    name: "Health & Wellness Hacks",
    description: "Health tips, wellness hacks, fitness secrets",
    icon: "heart-pulse",
    color: "green",
    promptContext: "health tips, wellness, fitness, nutrition, mental health, self-care",
    keywords: ["health", "wellness", "fitness", "nutrition", "mental health", "self-care"],
  },
] as const;

export type NicheId = typeof NICHES[number]["id"];

export const nicheSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.string(),
  promptContext: z.string(),
  keywords: z.array(z.string()),
});

export type Niche = z.infer<typeof nicheSchema>;

// API Key schemas
export const apiKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string().optional(),
  createdAt: z.string(),
  lastUsed: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

export const insertApiKeySchema = apiKeySchema.omit({ id: true, createdAt: true, lastUsed: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Blogger Account schema - supports multiple accounts
export const bloggerAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  blogId: z.string(),
  nicheId: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string(),
  refreshToken: z.string(),
  accessToken: z.string().optional(),
  tokenExpiry: z.string().optional(),
  blogName: z.string().optional(),
  blogUrl: z.string().optional(),
  isConnected: z.boolean().default(false),
  createdAt: z.string(),
  // Adsterra ad settings
  bannerAdsCode: z.string().optional(),
  popunderAdsCode: z.string().optional(),
});

export type BloggerAccount = z.infer<typeof bloggerAccountSchema>;

export const insertBloggerAccountSchema = bloggerAccountSchema.omit({ 
  id: true, 
  createdAt: true,
  accessToken: true,
  tokenExpiry: true,
  blogName: true,
  blogUrl: true,
  isConnected: true,
});
export type InsertBloggerAccount = z.infer<typeof insertBloggerAccountSchema>;

// Blogger OAuth settings (legacy - for backward compatibility)
export const bloggerSettingsSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  blogId: z.string().optional(),
  blogName: z.string().optional(),
  blogUrl: z.string().optional(),
  isConnected: z.boolean().default(false),
  tokenExpiry: z.string().optional(),
});

export type BloggerSettings = z.infer<typeof bloggerSettingsSchema>;

// Blogger credentials config schema (for /storage/config.json)
export const bloggerCredentialsSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  refresh_token: z.string(),
  blog_id: z.string(),
});

export type BloggerCredentials = z.infer<typeof bloggerCredentialsSchema>;

export const insertBloggerCredentialsSchema = bloggerCredentialsSchema;
export type InsertBloggerCredentials = z.infer<typeof insertBloggerCredentialsSchema>;

// Schedule schema - enhanced with niche and account assignment
export const scheduleSchema = z.object({
  id: z.string(),
  time: z.string(),
  isActive: z.boolean().default(true),
  timezone: z.string().default("UTC"),
  nicheId: z.string().optional(),
  accountId: z.string().optional(),
});

export type Schedule = z.infer<typeof scheduleSchema>;

export const insertScheduleSchema = scheduleSchema.omit({ id: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

// Post schema - enhanced with account and niche tracking
export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  topic: z.string(),
  nicheId: z.string().optional(),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  imageUrl: z.string().optional(),
  bloggerPostId: z.string().optional(),
  bloggerPostUrl: z.string().optional(),
  status: z.enum(["draft", "scheduled", "published", "failed"]),
  scheduledFor: z.string().optional(),
  publishedAt: z.string().optional(),
  createdAt: z.string(),
  errorMessage: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export type Post = z.infer<typeof postSchema>;

export const insertPostSchema = postSchema.omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;

// App settings - enhanced with accounts
export const appSettingsSchema = z.object({
  geminiApiKeys: z.array(apiKeySchema).default([]), // Legacy - kept for backward compatibility
  cerebrasApiKeys: z.array(apiKeySchema).default([]), // New Cerebras keys
  huggingfaceApiKeys: z.array(apiKeySchema).default([]),
  imgbbApiKeys: z.array(apiKeySchema).default([]),
  serperApiKeys: z.array(apiKeySchema).default([]), // Serper.dev API keys for web search
  blogger: bloggerSettingsSchema.default({}),
  bloggerAccounts: z.array(bloggerAccountSchema).default([]),
  schedules: z.array(scheduleSchema).default([]),
  currentGeminiKeyIndex: z.number().default(0), // Legacy
  currentCerebrasKeyIndex: z.number().default(0), // New Cerebras key rotation index
  currentHuggingfaceKeyIndex: z.number().default(0),
  currentImgbbKeyIndex: z.number().default(0),
  currentSerperKeyIndex: z.number().default(0), // Serper key rotation index
  usedTopics: z.array(z.string()).default([]),
  usedTopicsByNiche: z.record(z.string(), z.array(z.string())).default({}),
  lastTopicRefresh: z.string().optional(),
  selectedNicheId: z.string().optional(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

// Generated topic schema
export const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  fomoHook: z.string(),
  createdAt: z.string(),
});

export type Topic = z.infer<typeof topicSchema>;

// Content generation request
export const generateContentRequestSchema = z.object({
  topic: z.string().optional(),
  customPrompt: z.string().optional(),
  nicheId: z.string().optional(),
  accountId: z.string().optional(),
});

export type GenerateContentRequest = z.infer<typeof generateContentRequestSchema>;

// Generated blog post content
export const generatedContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  excerpt: z.string(),
  labels: z.array(z.string()),
  imagePrompt: z.string(),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

// API Response types
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

// Status types for dashboard
export type ConnectionStatus = "connected" | "disconnected" | "pending" | "error";

export interface DashboardStats {
  totalPosts: number;
  publishedToday: number;
  scheduledPosts: number;
  failedPosts: number;
  postsByNiche: Record<string, number>;
  accountsCount: number;
  lastUploadedAt?: string;
}

// User credentials schema for authentication
export const userCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type UserCredentials = z.infer<typeof userCredentialsSchema>;

// Trending Research schema - stores AI research on trending topics with Serper.dev integration
export const trendingResearchSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  fullSummary: z.string(),
  aiAnalysis: z.string(),
  whyTrending: z.string(),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    publishDate: z.string().optional(),
  })),
  nicheId: z.string(),
  nicheName: z.string(),
  searchQueries: z.array(z.string()),
  postId: z.string().optional(),
  postTitle: z.string().optional(),
  bloggerAccountId: z.string().optional(),
  bloggerAccountName: z.string().optional(),
  serperKeyUsed: z.string().optional(), // Masked key identifier for transparency
  status: z.enum(["researching", "generated", "published", "failed"]).default("researching"),
  createdAt: z.string(),
  researchedAt: z.string().optional(),
});

export type TrendingResearch = z.infer<typeof trendingResearchSchema>;

export const insertTrendingResearchSchema = trendingResearchSchema.omit({ id: true, createdAt: true });
export type InsertTrendingResearch = z.infer<typeof insertTrendingResearchSchema>;

// Tumblr credentials schema
export const tumblrCredentialsSchema = z.object({
  consumer_key: z.string(),
  consumer_secret: z.string(),
  token: z.string(),
  token_secret: z.string(),
});

export type TumblrCredentials = z.infer<typeof tumblrCredentialsSchema>;

// Tumblr blog schema
export const tumblrBlogSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  uuid: z.string(),
  isConnected: z.boolean().default(false),
  connectedBloggerAccountId: z.string().optional(),
  connectedBloggerAccountName: z.string().optional(),
  createdAt: z.string(),
});

export type TumblrBlog = z.infer<typeof tumblrBlogSchema>;

// Tumblr-Blogger connection schema
export const tumblrBloggerConnectionSchema = z.object({
  id: z.string(),
  tumblrBlogId: z.string(),
  tumblrBlogName: z.string(),
  bloggerAccountId: z.string(),
  bloggerAccountName: z.string(),
  createdAt: z.string(),
});

export type TumblrBloggerConnection = z.infer<typeof tumblrBloggerConnectionSchema>;
