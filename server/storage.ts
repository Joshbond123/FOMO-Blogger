import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type {
  AppSettings,
  Post,
  ApiKey,
  Schedule,
  BloggerSettings,
  DashboardStats,
  BloggerCredentials,
  BloggerAccount,
  InsertBloggerAccount,
  UserCredentials,
  TrendingResearch,
  InsertTrendingResearch,
  TumblrCredentials,
  TumblrBloggerConnection,
  XAccount,
  InsertXAccount,
  XBloggerConnection,
} from "@shared/schema";

const DATABASE_DIR = path.join(process.cwd(), "database");
const SETTINGS_FILE = path.join(DATABASE_DIR, "settings.json");
const POSTS_FILE = path.join(DATABASE_DIR, "posts.json");
const ACCOUNTS_FILE = path.join(DATABASE_DIR, "accounts.json");
const USER_FILE = path.join(DATABASE_DIR, "user.json");
const RESEARCH_FILE = path.join(DATABASE_DIR, "research.json");

const STORAGE_DIR = path.join(process.cwd(), "storage");
const CONFIG_FILE = path.join(STORAGE_DIR, "config.json");
const TUMBLR_CONFIG_FILE = path.join(STORAGE_DIR, "tumblr_config.json");
const TUMBLR_CONNECTIONS_FILE = path.join(DATABASE_DIR, "tumblr_connections.json");
const X_CONFIG_FILE = path.join(STORAGE_DIR, "x_accounts.json");
const X_CONNECTIONS_FILE = path.join(DATABASE_DIR, "x_connections.json");
const IMAGES_DIR = path.join(STORAGE_DIR, "images");

const defaultUserCredentials: UserCredentials = {
  email: "Adeniranj787@gmail.com",
  password: "1adeniran",
};

const defaultBloggerCredentials: BloggerCredentials = {
  client_id: "",
  client_secret: "",
  refresh_token: "",
  blog_id: "",
};

const defaultTumblrCredentials: TumblrCredentials = {
  consumer_key: "",
  consumer_secret: "",
  token: "",
  token_secret: "",
};

function ensureStorageDirectoryExists() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function ensureImagesDirectoryExists() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

export function saveImage(imageBuffer: Buffer, extension = "png"): string {
  ensureImagesDirectoryExists();
  const filename = `${randomUUID()}.${extension}`;
  const filepath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filepath, imageBuffer);
  return filename;
}

export function getImagePath(filename: string): string | null {
  const filepath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(filepath)) {
    return filepath;
  }
  return null;
}

export function deleteImage(filename: string): boolean {
  const filepath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

function ensureDirectoryExists() {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDirectoryExists();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDirectoryExists();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    throw new Error(`Failed to write to ${filePath}`);
  }
}

const defaultSettings: AppSettings = {
  geminiApiKeys: [],
  cerebrasApiKeys: [],
  huggingfaceApiKeys: [],
  imgbbApiKeys: [],
  serperApiKeys: [],
  blogger: { isConnected: false },
  bloggerAccounts: [],
  schedules: [],
  currentGeminiKeyIndex: 0,
  currentCerebrasKeyIndex: 0,
  currentHuggingfaceKeyIndex: 0,
  currentImgbbKeyIndex: 0,
  currentSerperKeyIndex: 0,
  usedTopics: [],
  usedTopicsByNiche: {},
  lastTopicRefresh: undefined,
  selectedNicheId: undefined,
};

export interface IStorage {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  
  addGeminiKey(key: string, name?: string): Promise<ApiKey>;
  removeGeminiKey(id: string): Promise<void>;
  getNextGeminiKey(): Promise<ApiKey | null>;
  
  addCerebrasKey(key: string, name?: string): Promise<ApiKey>;
  removeCerebrasKey(id: string): Promise<void>;
  getNextCerebrasKey(): Promise<ApiKey | null>;
  updateCerebrasKeyUsage(id: string): Promise<void>;
  rotateCerebrasKeyIndex(): Promise<void>;
  
  addHuggingfaceKey(key: string, name?: string): Promise<ApiKey>;
  removeHuggingfaceKey(id: string): Promise<void>;
  getNextHuggingfaceKey(): Promise<ApiKey | null>;
  
  addImgbbKey(key: string, name?: string): Promise<ApiKey>;
  removeImgbbKey(id: string): Promise<void>;
  getNextImgbbKey(): Promise<ApiKey | null>;
  
  addSerperKey(key: string, name?: string): Promise<ApiKey>;
  removeSerperKey(id: string): Promise<void>;
  getNextSerperKey(): Promise<ApiKey | null>;
  rotateSerperKeyIndex(): Promise<void>;
  
  setBloggerSettings(settings: BloggerSettings): Promise<void>;
  clearBloggerSettings(): Promise<void>;
  
  // Multi-account management
  addBloggerAccount(account: InsertBloggerAccount): Promise<BloggerAccount>;
  updateBloggerAccount(id: string, updates: Partial<BloggerAccount>): Promise<BloggerAccount>;
  removeBloggerAccount(id: string): Promise<void>;
  getBloggerAccount(id: string): Promise<BloggerAccount | undefined>;
  getBloggerAccounts(): Promise<BloggerAccount[]>;
  
  addSchedule(time: string, timezone?: string, accountId?: string): Promise<Schedule>;
  updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule>;
  removeSchedule(id: string): Promise<void>;
  toggleSchedule(id: string): Promise<void>;
  
  getPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: Omit<Post, "id" | "createdAt">): Promise<Post>;
  updatePost(id: string, updates: Partial<Post>): Promise<Post>;
  deletePost(id: string): Promise<void>;
  
  addUsedTopic(topic: string, nicheId?: string): Promise<void>;
  isTopicUsed(topic: string, nicheId?: string): Promise<boolean>;
  
  getStats(): Promise<DashboardStats>;
  
  getBloggerCredentials(): Promise<BloggerCredentials>;
  saveBloggerCredentials(credentials: BloggerCredentials): Promise<void>;
  
  setSelectedNiche(nicheId: string): Promise<void>;
  
  // User authentication
  getUserCredentials(): Promise<UserCredentials>;
  saveUserCredentials(credentials: UserCredentials): Promise<void>;
  validateUser(email: string, password: string): Promise<boolean>;
  
  // Trending Research
  getTrendingResearch(): Promise<TrendingResearch[]>;
  getTrendingResearchById(id: string): Promise<TrendingResearch | undefined>;
  createTrendingResearch(research: InsertTrendingResearch): Promise<TrendingResearch>;
  updateTrendingResearch(id: string, updates: Partial<TrendingResearch>): Promise<TrendingResearch | undefined>;
  deleteTrendingResearch(id: string): Promise<void>;
  
  // Tumblr integration
  getTumblrCredentials(): Promise<TumblrCredentials>;
  saveTumblrCredentials(credentials: TumblrCredentials): Promise<void>;
  getTumblrConnections(): Promise<TumblrBloggerConnection[]>;
  addTumblrConnection(connection: Omit<TumblrBloggerConnection, "id" | "createdAt">): Promise<TumblrBloggerConnection>;
  removeTumblrConnection(id: string): Promise<void>;
  getTumblrConnectionByBloggerAccountId(bloggerAccountId: string): Promise<TumblrBloggerConnection | undefined>;
  getTumblrConnectionByTumblrBlogId(tumblrBlogId: string): Promise<TumblrBloggerConnection | undefined>;
  
  // X (Twitter) integration
  getXAccounts(): Promise<XAccount[]>;
  getXAccount(id: string): Promise<XAccount | undefined>;
  addXAccount(account: InsertXAccount): Promise<XAccount>;
  updateXAccount(id: string, updates: Partial<XAccount>): Promise<XAccount>;
  removeXAccount(id: string): Promise<void>;
  getXConnections(): Promise<XBloggerConnection[]>;
  addXConnection(connection: Omit<XBloggerConnection, "id" | "createdAt">): Promise<XBloggerConnection>;
  removeXConnection(id: string): Promise<void>;
  getXConnectionByBloggerAccountId(bloggerAccountId: string): Promise<XBloggerConnection | undefined>;
  getXConnectionsByXAccountId(xAccountId: string): Promise<XBloggerConnection[]>;
}

export class FileStorage implements IStorage {
  async getSettings(): Promise<AppSettings> {
    const settings = readJsonFile<AppSettings>(SETTINGS_FILE, defaultSettings);
    return {
      ...defaultSettings,
      ...settings,
      usedTopicsByNiche: settings.usedTopicsByNiche || {},
      bloggerAccounts: settings.bloggerAccounts || [],
      cerebrasApiKeys: settings.cerebrasApiKeys || [],
      currentCerebrasKeyIndex: settings.currentCerebrasKeyIndex || 0,
      imgbbApiKeys: settings.imgbbApiKeys || [],
      currentImgbbKeyIndex: settings.currentImgbbKeyIndex || 0,
      serperApiKeys: settings.serperApiKeys || [],
      currentSerperKeyIndex: settings.currentSerperKeyIndex || 0,
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    writeJsonFile(SETTINGS_FILE, settings);
  }

  async addGeminiKey(key: string, name?: string): Promise<ApiKey> {
    const settings = await this.getSettings();
    const newKey: ApiKey = {
      id: randomUUID(),
      key,
      name,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    settings.geminiApiKeys.push(newKey);
    await this.saveSettings(settings);
    return newKey;
  }

  async removeGeminiKey(id: string): Promise<void> {
    const settings = await this.getSettings();
    settings.geminiApiKeys = settings.geminiApiKeys.filter((k) => k.id !== id);
    if (settings.currentGeminiKeyIndex >= settings.geminiApiKeys.length) {
      settings.currentGeminiKeyIndex = 0;
    }
    await this.saveSettings(settings);
  }

  async getNextGeminiKey(): Promise<ApiKey | null> {
    const settings = await this.getSettings();
    const activeKeys = settings.geminiApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;

    const currentIndex = settings.currentGeminiKeyIndex % activeKeys.length;
    const key = activeKeys[currentIndex];

    const keyIndex = settings.geminiApiKeys.findIndex((k) => k.id === key.id);
    if (keyIndex !== -1) {
      settings.geminiApiKeys[keyIndex].lastUsed = new Date().toISOString();
    }

    settings.currentGeminiKeyIndex = (currentIndex + 1) % activeKeys.length;
    await this.saveSettings(settings);

    return key;
  }

  async addCerebrasKey(key: string, name?: string): Promise<ApiKey> {
    const settings = await this.getSettings();
    const newKey: ApiKey = {
      id: randomUUID(),
      key,
      name,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    if (!settings.cerebrasApiKeys) {
      settings.cerebrasApiKeys = [];
    }
    settings.cerebrasApiKeys.push(newKey);
    await this.saveSettings(settings);
    return newKey;
  }

  async removeCerebrasKey(id: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.cerebrasApiKeys) {
      settings.cerebrasApiKeys = [];
    }
    settings.cerebrasApiKeys = settings.cerebrasApiKeys.filter((k) => k.id !== id);
    if ((settings.currentCerebrasKeyIndex || 0) >= settings.cerebrasApiKeys.length) {
      settings.currentCerebrasKeyIndex = 0;
    }
    await this.saveSettings(settings);
  }

  async getNextCerebrasKey(): Promise<ApiKey | null> {
    const settings = await this.getSettings();
    if (!settings.cerebrasApiKeys) {
      settings.cerebrasApiKeys = [];
    }
    const activeKeys = settings.cerebrasApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;

    const currentIndex = (settings.currentCerebrasKeyIndex || 0) % activeKeys.length;
    const key = activeKeys[currentIndex];
    return key;
  }

  async updateCerebrasKeyUsage(id: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.cerebrasApiKeys) return;
    
    const keyIndex = settings.cerebrasApiKeys.findIndex((k) => k.id === id);
    if (keyIndex !== -1) {
      settings.cerebrasApiKeys[keyIndex].lastUsed = new Date().toISOString();
      await this.saveSettings(settings);
    }
  }

  async rotateCerebrasKeyIndex(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.cerebrasApiKeys) {
      settings.cerebrasApiKeys = [];
    }
    const activeKeys = settings.cerebrasApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return;
    
    settings.currentCerebrasKeyIndex = ((settings.currentCerebrasKeyIndex || 0) + 1) % activeKeys.length;
    await this.saveSettings(settings);
  }

  async addHuggingfaceKey(key: string, name?: string): Promise<ApiKey> {
    const settings = await this.getSettings();
    const newKey: ApiKey = {
      id: randomUUID(),
      key,
      name,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    settings.huggingfaceApiKeys.push(newKey);
    await this.saveSettings(settings);
    return newKey;
  }

  async removeHuggingfaceKey(id: string): Promise<void> {
    const settings = await this.getSettings();
    settings.huggingfaceApiKeys = settings.huggingfaceApiKeys.filter((k) => k.id !== id);
    if (settings.currentHuggingfaceKeyIndex >= settings.huggingfaceApiKeys.length) {
      settings.currentHuggingfaceKeyIndex = 0;
    }
    await this.saveSettings(settings);
  }

  async getNextHuggingfaceKey(): Promise<ApiKey | null> {
    const settings = await this.getSettings();
    const activeKeys = settings.huggingfaceApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;

    const currentIndex = settings.currentHuggingfaceKeyIndex % activeKeys.length;
    const key = activeKeys[currentIndex];

    const keyIndex = settings.huggingfaceApiKeys.findIndex((k) => k.id === key.id);
    if (keyIndex !== -1) {
      settings.huggingfaceApiKeys[keyIndex].lastUsed = new Date().toISOString();
    }

    settings.currentHuggingfaceKeyIndex = (currentIndex + 1) % activeKeys.length;
    await this.saveSettings(settings);

    return key;
  }

  async addImgbbKey(key: string, name?: string): Promise<ApiKey> {
    const settings = await this.getSettings();
    const newKey: ApiKey = {
      id: randomUUID(),
      key,
      name,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    if (!settings.imgbbApiKeys) {
      settings.imgbbApiKeys = [];
    }
    settings.imgbbApiKeys.push(newKey);
    await this.saveSettings(settings);
    return newKey;
  }

  async removeImgbbKey(id: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.imgbbApiKeys) {
      settings.imgbbApiKeys = [];
    }
    settings.imgbbApiKeys = settings.imgbbApiKeys.filter((k) => k.id !== id);
    if ((settings.currentImgbbKeyIndex || 0) >= settings.imgbbApiKeys.length) {
      settings.currentImgbbKeyIndex = 0;
    }
    await this.saveSettings(settings);
  }

  async getNextImgbbKey(): Promise<ApiKey | null> {
    const settings = await this.getSettings();
    if (!settings.imgbbApiKeys) {
      settings.imgbbApiKeys = [];
    }
    const activeKeys = settings.imgbbApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;

    const currentIndex = (settings.currentImgbbKeyIndex || 0) % activeKeys.length;
    const key = activeKeys[currentIndex];

    const keyIndex = settings.imgbbApiKeys.findIndex((k) => k.id === key.id);
    if (keyIndex !== -1) {
      settings.imgbbApiKeys[keyIndex].lastUsed = new Date().toISOString();
    }

    settings.currentImgbbKeyIndex = (currentIndex + 1) % activeKeys.length;
    await this.saveSettings(settings);

    return key;
  }

  async addSerperKey(key: string, name?: string): Promise<ApiKey> {
    const settings = await this.getSettings();
    const newKey: ApiKey = {
      id: randomUUID(),
      key,
      name,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    if (!settings.serperApiKeys) {
      settings.serperApiKeys = [];
    }
    settings.serperApiKeys.push(newKey);
    await this.saveSettings(settings);
    return newKey;
  }

  async removeSerperKey(id: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.serperApiKeys) {
      settings.serperApiKeys = [];
    }
    settings.serperApiKeys = settings.serperApiKeys.filter((k) => k.id !== id);
    if ((settings.currentSerperKeyIndex || 0) >= settings.serperApiKeys.length) {
      settings.currentSerperKeyIndex = 0;
    }
    await this.saveSettings(settings);
  }

  async getNextSerperKey(): Promise<ApiKey | null> {
    const settings = await this.getSettings();
    if (!settings.serperApiKeys) {
      settings.serperApiKeys = [];
    }
    const activeKeys = settings.serperApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return null;

    const currentIndex = (settings.currentSerperKeyIndex || 0) % activeKeys.length;
    const key = activeKeys[currentIndex];
    return key;
  }

  async rotateSerperKeyIndex(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.serperApiKeys) {
      settings.serperApiKeys = [];
    }
    const activeKeys = settings.serperApiKeys.filter((k) => k.isActive);
    if (activeKeys.length === 0) return;
    
    settings.currentSerperKeyIndex = ((settings.currentSerperKeyIndex || 0) + 1) % activeKeys.length;
    await this.saveSettings(settings);
  }

  async setBloggerSettings(bloggerSettings: BloggerSettings): Promise<void> {
    const settings = await this.getSettings();
    settings.blogger = { ...bloggerSettings, isConnected: true };
    await this.saveSettings(settings);
  }

  async clearBloggerSettings(): Promise<void> {
    const settings = await this.getSettings();
    settings.blogger = { isConnected: false };
    await this.saveSettings(settings);
  }

  // Multi-account management
  async addBloggerAccount(accountData: InsertBloggerAccount): Promise<BloggerAccount> {
    const settings = await this.getSettings();
    const account: BloggerAccount = {
      ...accountData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      isConnected: false,
    };
    settings.bloggerAccounts.push(account);
    await this.saveSettings(settings);
    return account;
  }

  async updateBloggerAccount(id: string, updates: Partial<BloggerAccount>): Promise<BloggerAccount> {
    const settings = await this.getSettings();
    const index = settings.bloggerAccounts.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error("Account not found");
    }
    settings.bloggerAccounts[index] = { ...settings.bloggerAccounts[index], ...updates };
    await this.saveSettings(settings);
    return settings.bloggerAccounts[index];
  }

  async removeBloggerAccount(id: string): Promise<void> {
    const settings = await this.getSettings();
    settings.bloggerAccounts = settings.bloggerAccounts.filter((a) => a.id !== id);
    // Remove schedules associated with this account
    settings.schedules = settings.schedules.filter((s) => s.accountId !== id);
    await this.saveSettings(settings);
  }

  async getBloggerAccount(id: string): Promise<BloggerAccount | undefined> {
    const settings = await this.getSettings();
    return settings.bloggerAccounts.find((a) => a.id === id);
  }

  async getBloggerAccounts(): Promise<BloggerAccount[]> {
    const settings = await this.getSettings();
    return settings.bloggerAccounts;
  }

  async addSchedule(time: string, timezone?: string, accountId?: string): Promise<Schedule> {
    const settings = await this.getSettings();
    const schedule: Schedule = {
      id: randomUUID(),
      time,
      timezone: timezone || "UTC",
      isActive: true,
      accountId,
    };
    settings.schedules.push(schedule);
    await this.saveSettings(settings);
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const settings = await this.getSettings();
    const index = settings.schedules.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error("Schedule not found");
    }
    settings.schedules[index] = { ...settings.schedules[index], ...updates };
    await this.saveSettings(settings);
    return settings.schedules[index];
  }

  async removeSchedule(id: string): Promise<void> {
    const settings = await this.getSettings();
    settings.schedules = settings.schedules.filter((s) => s.id !== id);
    await this.saveSettings(settings);
  }

  async toggleSchedule(id: string): Promise<void> {
    const settings = await this.getSettings();
    const schedule = settings.schedules.find((s) => s.id === id);
    if (schedule) {
      schedule.isActive = !schedule.isActive;
      await this.saveSettings(settings);
    }
  }

  async getPosts(): Promise<Post[]> {
    const posts = readJsonFile<Post[]>(POSTS_FILE, []);
    
    const sortedPosts = [...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    if (sortedPosts.length > 8) {
      const postsToKeep = sortedPosts.slice(0, 8);
      writeJsonFile(POSTS_FILE, postsToKeep);
      return postsToKeep;
    }
    
    return sortedPosts;
  }

  async getPost(id: string): Promise<Post | undefined> {
    const posts = await this.getPosts();
    return posts.find((p) => p.id === id);
  }

  async createPost(postData: Omit<Post, "id" | "createdAt">): Promise<Post> {
    const posts = await this.getPosts();
    const post: Post = {
      ...postData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    posts.push(post);
    writeJsonFile(POSTS_FILE, posts);
    return post;
  }

  async updatePost(id: string, updates: Partial<Post>): Promise<Post> {
    const posts = await this.getPosts();
    const index = posts.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error("Post not found");
    }
    posts[index] = { ...posts[index], ...updates };
    writeJsonFile(POSTS_FILE, posts);
    return posts[index];
  }

  async deletePost(id: string): Promise<void> {
    const posts = await this.getPosts();
    const filtered = posts.filter((p) => p.id !== id);
    writeJsonFile(POSTS_FILE, filtered);
  }

  async addUsedTopic(topic: string, nicheId?: string): Promise<void> {
    const settings = await this.getSettings();
    const normalizedTopic = topic.toLowerCase().trim();
    
    // Add to global list
    if (!settings.usedTopics.includes(normalizedTopic)) {
      settings.usedTopics.push(normalizedTopic);
    }
    
    // Add to niche-specific list
    if (nicheId) {
      if (!settings.usedTopicsByNiche[nicheId]) {
        settings.usedTopicsByNiche[nicheId] = [];
      }
      if (!settings.usedTopicsByNiche[nicheId].includes(normalizedTopic)) {
        settings.usedTopicsByNiche[nicheId].push(normalizedTopic);
      }
    }
    
    await this.saveSettings(settings);
  }

  async isTopicUsed(topic: string, nicheId?: string): Promise<boolean> {
    const settings = await this.getSettings();
    const normalizedTopic = topic.toLowerCase().trim();
    
    // Check niche-specific list first if nicheId provided
    if (nicheId && settings.usedTopicsByNiche[nicheId]) {
      const nicheTopics = settings.usedTopicsByNiche[nicheId];
      if (nicheTopics.some((t) => t.includes(normalizedTopic) || normalizedTopic.includes(t))) {
        return true;
      }
    }
    
    // Fall back to global list
    return settings.usedTopics.some(
      (t) => t.includes(normalizedTopic) || normalizedTopic.includes(t)
    );
  }

  async getStats(): Promise<DashboardStats> {
    const posts = await this.getPosts();
    const settings = await this.getSettings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const publishedToday = posts.filter((p) => {
      if (p.status !== "published" || !p.publishedAt) return false;
      const publishDate = new Date(p.publishedAt);
      publishDate.setHours(0, 0, 0, 0);
      return publishDate.getTime() === today.getTime();
    }).length;

    // Count posts by niche
    const postsByNiche: Record<string, number> = {};
    posts.forEach((p) => {
      const niche = p.nicheId || "unknown";
      postsByNiche[niche] = (postsByNiche[niche] || 0) + 1;
    });

    // Find the most recently published post
    const publishedPosts = posts
      .filter((p) => p.status === "published" && p.publishedAt)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
    const lastUploadedAt = publishedPosts.length > 0 ? publishedPosts[0].publishedAt : undefined;

    return {
      totalPosts: posts.length,
      publishedToday,
      scheduledPosts: posts.filter((p) => p.status === "scheduled").length,
      failedPosts: posts.filter((p) => p.status === "failed").length,
      postsByNiche,
      accountsCount: settings.bloggerAccounts.length,
      lastUploadedAt,
    };
  }

  async getBloggerCredentials(): Promise<BloggerCredentials> {
    ensureStorageDirectoryExists();
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, "utf-8");
        return JSON.parse(data) as BloggerCredentials;
      }
    } catch (error) {
      console.error(`Error reading ${CONFIG_FILE}:`, error);
    }
    return defaultBloggerCredentials;
  }

  async saveBloggerCredentials(credentials: BloggerCredentials): Promise<void> {
    ensureStorageDirectoryExists();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(credentials, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error writing ${CONFIG_FILE}:`, error);
      throw new Error(`Failed to write to ${CONFIG_FILE}`);
    }
  }

  async setSelectedNiche(nicheId: string): Promise<void> {
    const settings = await this.getSettings();
    settings.selectedNicheId = nicheId;
    await this.saveSettings(settings);
  }

  async getUserCredentials(): Promise<UserCredentials> {
    ensureDirectoryExists();
    try {
      if (fs.existsSync(USER_FILE)) {
        const data = fs.readFileSync(USER_FILE, "utf-8");
        return JSON.parse(data) as UserCredentials;
      }
    } catch (error) {
      console.error(`Error reading ${USER_FILE}:`, error);
    }
    // Initialize with default credentials if file doesn't exist
    await this.saveUserCredentials(defaultUserCredentials);
    return defaultUserCredentials;
  }

  async saveUserCredentials(credentials: UserCredentials): Promise<void> {
    ensureDirectoryExists();
    try {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(credentials.password, 10);
      const secureCredentials = {
        email: credentials.email,
        password: hashedPassword,
      };
      fs.writeFileSync(USER_FILE, JSON.stringify(secureCredentials, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error writing ${USER_FILE}:`, error);
      throw new Error(`Failed to write to ${USER_FILE}`);
    }
  }

  async validateUser(email: string, password: string): Promise<boolean> {
    const credentials = await this.getUserCredentials();
    if (credentials.email.toLowerCase() !== email.toLowerCase()) {
      return false;
    }
    // Check if password is hashed (bcrypt hashes start with $2)
    if (credentials.password.startsWith("$2")) {
      return bcrypt.compare(password, credentials.password);
    }
    // For legacy unhashed passwords, compare directly and hash on next save
    return credentials.password === password;
  }

  async getTrendingResearch(): Promise<TrendingResearch[]> {
    const research = readJsonFile<TrendingResearch[]>(RESEARCH_FILE, []);
    // Sort by createdAt descending and limit to 10 most recent
    return research
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  async getTrendingResearchById(id: string): Promise<TrendingResearch | undefined> {
    const research = await this.getTrendingResearch();
    return research.find((r) => r.id === id);
  }

  async createTrendingResearch(researchData: InsertTrendingResearch): Promise<TrendingResearch> {
    const allResearch = readJsonFile<TrendingResearch[]>(RESEARCH_FILE, []);
    const research: TrendingResearch = {
      ...researchData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    allResearch.push(research);
    // Keep only the 10 most recent
    const sortedResearch = allResearch
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    writeJsonFile(RESEARCH_FILE, sortedResearch);
    return research;
  }

  async updateTrendingResearch(id: string, updates: Partial<TrendingResearch>): Promise<TrendingResearch | undefined> {
    // Read full dataset directly (not via getTrendingResearch which truncates to 10)
    const fullResearch = readJsonFile<TrendingResearch[]>(RESEARCH_FILE, []);
    const index = fullResearch.findIndex((r) => r.id === id);
    if (index === -1) return undefined;
    
    fullResearch[index] = { ...fullResearch[index], ...updates };
    // Write full array back to preserve all historical entries
    writeJsonFile(RESEARCH_FILE, fullResearch);
    return fullResearch[index];
  }

  async deleteTrendingResearch(id: string): Promise<void> {
    const research = readJsonFile<TrendingResearch[]>(RESEARCH_FILE, []);
    const filtered = research.filter((r) => r.id !== id);
    writeJsonFile(RESEARCH_FILE, filtered);
  }

  // Tumblr integration methods
  async getTumblrCredentials(): Promise<TumblrCredentials> {
    ensureStorageDirectoryExists();
    try {
      if (fs.existsSync(TUMBLR_CONFIG_FILE)) {
        const data = fs.readFileSync(TUMBLR_CONFIG_FILE, "utf-8");
        return JSON.parse(data) as TumblrCredentials;
      }
    } catch (error) {
      console.error(`Error reading ${TUMBLR_CONFIG_FILE}:`, error);
    }
    return defaultTumblrCredentials;
  }

  async saveTumblrCredentials(credentials: TumblrCredentials): Promise<void> {
    ensureStorageDirectoryExists();
    try {
      fs.writeFileSync(TUMBLR_CONFIG_FILE, JSON.stringify(credentials, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error writing ${TUMBLR_CONFIG_FILE}:`, error);
      throw new Error(`Failed to write to ${TUMBLR_CONFIG_FILE}`);
    }
  }

  async getTumblrConnections(): Promise<TumblrBloggerConnection[]> {
    return readJsonFile<TumblrBloggerConnection[]>(TUMBLR_CONNECTIONS_FILE, []);
  }

  async addTumblrConnection(connection: Omit<TumblrBloggerConnection, "id" | "createdAt">): Promise<TumblrBloggerConnection> {
    const connections = await this.getTumblrConnections();
    
    // Check if connection already exists for this tumblr blog
    const existingIndex = connections.findIndex(c => c.tumblrBlogId === connection.tumblrBlogId);
    if (existingIndex !== -1) {
      // Update existing connection
      connections[existingIndex] = {
        ...connections[existingIndex],
        ...connection,
      };
      writeJsonFile(TUMBLR_CONNECTIONS_FILE, connections);
      return connections[existingIndex];
    }
    
    const newConnection: TumblrBloggerConnection = {
      ...connection,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    connections.push(newConnection);
    writeJsonFile(TUMBLR_CONNECTIONS_FILE, connections);
    return newConnection;
  }

  async removeTumblrConnection(id: string): Promise<void> {
    const connections = await this.getTumblrConnections();
    const filtered = connections.filter((c) => c.id !== id);
    writeJsonFile(TUMBLR_CONNECTIONS_FILE, filtered);
  }

  async getTumblrConnectionByBloggerAccountId(bloggerAccountId: string): Promise<TumblrBloggerConnection | undefined> {
    const connections = await this.getTumblrConnections();
    return connections.find((c) => c.bloggerAccountId === bloggerAccountId);
  }

  async getTumblrConnectionByTumblrBlogId(tumblrBlogId: string): Promise<TumblrBloggerConnection | undefined> {
    const connections = await this.getTumblrConnections();
    return connections.find((c) => c.tumblrBlogId === tumblrBlogId);
  }

  // X (Twitter) integration methods
  async getXAccounts(): Promise<XAccount[]> {
    ensureStorageDirectoryExists();
    try {
      if (fs.existsSync(X_CONFIG_FILE)) {
        const data = fs.readFileSync(X_CONFIG_FILE, "utf-8");
        return JSON.parse(data) as XAccount[];
      }
    } catch (error) {
      console.error(`Error reading ${X_CONFIG_FILE}:`, error);
    }
    return [];
  }

  async getXAccount(id: string): Promise<XAccount | undefined> {
    const accounts = await this.getXAccounts();
    return accounts.find((a) => a.id === id);
  }

  async addXAccount(accountData: InsertXAccount): Promise<XAccount> {
    const accounts = await this.getXAccounts();
    const account: XAccount = {
      ...accountData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      isConnected: false,
    };
    accounts.push(account);
    ensureStorageDirectoryExists();
    fs.writeFileSync(X_CONFIG_FILE, JSON.stringify(accounts, null, 2), "utf-8");
    return account;
  }

  async updateXAccount(id: string, updates: Partial<XAccount>): Promise<XAccount> {
    const accounts = await this.getXAccounts();
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error("X account not found");
    }
    accounts[index] = { ...accounts[index], ...updates };
    ensureStorageDirectoryExists();
    fs.writeFileSync(X_CONFIG_FILE, JSON.stringify(accounts, null, 2), "utf-8");
    return accounts[index];
  }

  async removeXAccount(id: string): Promise<void> {
    const accounts = await this.getXAccounts();
    const filtered = accounts.filter((a) => a.id !== id);
    ensureStorageDirectoryExists();
    fs.writeFileSync(X_CONFIG_FILE, JSON.stringify(filtered, null, 2), "utf-8");
    
    // Also remove any connections for this X account
    const connections = await this.getXConnections();
    const filteredConnections = connections.filter((c) => c.xAccountId !== id);
    fs.writeFileSync(X_CONNECTIONS_FILE, JSON.stringify(filteredConnections, null, 2), "utf-8");
  }

  async getXConnections(): Promise<XBloggerConnection[]> {
    return readJsonFile<XBloggerConnection[]>(X_CONNECTIONS_FILE, []);
  }

  async addXConnection(connection: Omit<XBloggerConnection, "id" | "createdAt">): Promise<XBloggerConnection> {
    const connections = await this.getXConnections();
    
    // Check if connection already exists for this blogger account
    const existingIndex = connections.findIndex(c => c.bloggerAccountId === connection.bloggerAccountId);
    if (existingIndex !== -1) {
      // Update existing connection
      connections[existingIndex] = {
        ...connections[existingIndex],
        ...connection,
      };
      writeJsonFile(X_CONNECTIONS_FILE, connections);
      return connections[existingIndex];
    }
    
    const newConnection: XBloggerConnection = {
      ...connection,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    connections.push(newConnection);
    writeJsonFile(X_CONNECTIONS_FILE, connections);
    return newConnection;
  }

  async removeXConnection(id: string): Promise<void> {
    const connections = await this.getXConnections();
    const filtered = connections.filter((c) => c.id !== id);
    writeJsonFile(X_CONNECTIONS_FILE, filtered);
  }

  async getXConnectionByBloggerAccountId(bloggerAccountId: string): Promise<XBloggerConnection | undefined> {
    const connections = await this.getXConnections();
    return connections.find((c) => c.bloggerAccountId === bloggerAccountId);
  }

  async getXConnectionsByXAccountId(xAccountId: string): Promise<XBloggerConnection[]> {
    const connections = await this.getXConnections();
    return connections.filter((c) => c.xAccountId === xAccountId);
  }
}

export const storage = new FileStorage();
