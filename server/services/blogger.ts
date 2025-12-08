import { storage } from "../storage";
import type { Post, BloggerAccount } from "@shared/schema";

const BLOGGER_API_BASE = "https://www.googleapis.com/blogger/v3";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

function injectAds(content: string, account: BloggerAccount): string {
  const bannerAdsCode = account.bannerAdsCode?.trim();
  const popunderAdsCode = account.popunderAdsCode?.trim();

  if (!bannerAdsCode && !popunderAdsCode) {
    return content;
  }

  const adStartBanner = bannerAdsCode ? `<div class="ad-placement ad-start" style="margin: 20px 0; text-align: center;">${bannerAdsCode}</div>` : '';
  const adAfterP2Banner = bannerAdsCode ? `<div class="ad-placement ad-after-p2" style="margin: 20px 0; text-align: center;">${bannerAdsCode}</div>` : '';
  const adMiddleBanner = bannerAdsCode ? `<div class="ad-placement ad-middle" style="margin: 20px 0; text-align: center;">${bannerAdsCode}</div>` : '';
  const adEndPopunder = popunderAdsCode ? `\n${popunderAdsCode}` : '';

  const paragraphRegex = /<p[^>]*>[\s\S]*?<\/p>/gi;
  const paragraphs = content.match(paragraphRegex) || [];
  
  if (paragraphs.length === 0) {
    let result = content;
    if (bannerAdsCode) {
      result = adStartBanner + '\n' + result;
    }
    if (popunderAdsCode) {
      result = result + '\n' + adEndPopunder;
    }
    return result;
  }

  let result = content;

  if (bannerAdsCode) {
    const firstParagraphIndex = result.indexOf(paragraphs[0]);
    if (firstParagraphIndex !== -1) {
      result = result.slice(0, firstParagraphIndex) + adStartBanner + '\n' + result.slice(firstParagraphIndex);
    }
  }

  if (bannerAdsCode && paragraphs.length >= 3) {
    const p2End = result.indexOf(paragraphs[1]) + paragraphs[1].length;
    if (p2End > 0) {
      result = result.slice(0, p2End) + '\n' + adAfterP2Banner + result.slice(p2End);
    }
  }

  if (bannerAdsCode && paragraphs.length >= 6) {
    const middleIndex = Math.floor(paragraphs.length / 2);
    const middleParagraph = paragraphs[middleIndex];
    const middlePEnd = result.lastIndexOf(middleParagraph) + middleParagraph.length;
    if (middlePEnd > 0) {
      result = result.slice(0, middlePEnd) + '\n' + adMiddleBanner + result.slice(middlePEnd);
    }
  }

  if (popunderAdsCode) {
    result = result + '\n' + adEndPopunder;
  }

  return result;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function refreshAccessToken(): Promise<{ success: boolean; accessToken?: string; message: string }> {
  try {
    const credentials = await storage.getBloggerCredentials();
    
    if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
      return { 
        success: false, 
        message: "Missing OAuth credentials. Please configure them in Admin Settings." 
      };
    }

    const params = new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.error_description || `Token refresh failed: HTTP ${response.status}`,
      };
    }

    const data: TokenResponse = await response.json();
    
    const settings = await storage.getSettings();
    await storage.setBloggerSettings({
      ...settings.blogger,
      accessToken: data.access_token,
      tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      isConnected: true,
    });

    return {
      success: true,
      accessToken: data.access_token,
      message: "Access token refreshed successfully",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Token refresh failed: ${message}` };
  }
}

async function getValidAccessToken(): Promise<{ success: boolean; accessToken?: string; blogId?: string; message: string }> {
  const settings = await storage.getSettings();
  const { blogger } = settings;
  const credentials = await storage.getBloggerCredentials();

  const blogId = blogger.blogId || credentials.blog_id;
  
  if (!blogId) {
    return { success: false, message: "Blog ID not configured. Please set it in Admin Settings." };
  }

  if (blogger.accessToken && blogger.tokenExpiry) {
    const expiryDate = new Date(blogger.tokenExpiry);
    const now = new Date();
    const bufferMinutes = 5;
    
    if (now.getTime() < expiryDate.getTime() - bufferMinutes * 60 * 1000) {
      return { success: true, accessToken: blogger.accessToken, blogId, message: "Token valid" };
    }
  }

  if (credentials.client_id && credentials.client_secret && credentials.refresh_token) {
    console.log("[Blogger] Access token expired or missing, attempting refresh...");
    const refreshResult = await refreshAccessToken();
    
    if (refreshResult.success && refreshResult.accessToken) {
      return { success: true, accessToken: refreshResult.accessToken, blogId, message: "Token refreshed" };
    }
    
    return { success: false, message: refreshResult.message };
  }

  if (!blogger.accessToken) {
    return { success: false, message: "No access token available. Please connect your Blogger account or configure Admin Settings." };
  }

  return { success: true, accessToken: blogger.accessToken, blogId, message: "Using existing token" };
}

interface BloggerPost {
  kind: string;
  id: string;
  blog: { id: string };
  url: string;
  selfLink: string;
  title: string;
  content: string;
  published: string;
  updated: string;
  labels?: string[];
}

interface BloggerBlog {
  kind: string;
  id: string;
  name: string;
  description: string;
  url: string;
}

export async function validateBloggerConnection(
  blogId: string,
  accessToken: string
): Promise<{ success: boolean; blogName?: string; blogUrl?: string; message: string }> {
  try {
    const response = await fetch(`${BLOGGER_API_BASE}/blogs/${blogId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const blog: BloggerBlog = await response.json();
    return {
      success: true,
      blogName: blog.name,
      blogUrl: blog.url,
      message: `Connected to "${blog.name}"`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function publishToBlogger(post: Post): Promise<{
  success: boolean;
  postId?: string;
  postUrl?: string;
  message: string;
}> {
  const tokenResult = await getValidAccessToken();
  
  if (!tokenResult.success || !tokenResult.accessToken || !tokenResult.blogId) {
    return { success: false, message: tokenResult.message };
  }

  const { accessToken, blogId } = tokenResult;

  try {
    let content = post.content;
    
    if (post.imageUrl) {
      content = `<div style="text-align: center; margin-bottom: 24px;">
        <img src="${post.imageUrl}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px;" />
      </div>\n${content}`;
    }

    const postBody = {
      kind: "blogger#post",
      blog: { id: blogId },
      title: post.title,
      content: content,
      labels: post.labels || [],
    };

    const response = await fetch(`${BLOGGER_API_BASE}/blogs/${blogId}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        return {
          success: false,
          message: "Access token expired and refresh failed. Please check your Admin Settings credentials.",
        };
      }
      
      return {
        success: false,
        message: error.error?.message || `Failed to publish: HTTP ${response.status}`,
      };
    }

    const publishedPost: BloggerPost = await response.json();
    
    return {
      success: true,
      postId: publishedPost.id,
      postUrl: publishedPost.url,
      message: "Post published successfully!",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Publishing failed: ${message}` };
  }
}

export async function publishToBloggerWithAccount(
  post: Post,
  account: BloggerAccount
): Promise<{
  success: boolean;
  postId?: string;
  postUrl?: string;
  message: string;
}> {
  try {
    let accessToken = account.accessToken;
    
    if (!accessToken || (account.tokenExpiry && new Date(account.tokenExpiry) < new Date())) {
      const refreshResult = await refreshAccountToken(account);
      if (!refreshResult.success || !refreshResult.accessToken) {
        return { success: false, message: refreshResult.message };
      }
      accessToken = refreshResult.accessToken;
    }

    let content = post.content;
    
    if (post.imageUrl) {
      content = `<div style="text-align: center; margin-bottom: 24px;">
        <img src="${post.imageUrl}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px;" />
      </div>\n${content}`;
    }

    content = injectAds(content, account);

    const postBody = {
      kind: "blogger#post",
      blog: { id: account.blogId },
      title: post.title,
      content: content,
      labels: post.labels || [],
    };

    const response = await fetch(`${BLOGGER_API_BASE}/blogs/${account.blogId}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.error?.message || `Failed to publish: HTTP ${response.status}`,
      };
    }

    const publishedPost: BloggerPost = await response.json();
    
    return {
      success: true,
      postId: publishedPost.id,
      postUrl: publishedPost.url,
      message: `Post published to ${account.name}!`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Publishing failed: ${message}` };
  }
}

async function refreshAccountToken(account: BloggerAccount): Promise<{ success: boolean; accessToken?: string; message: string }> {
  try {
    const params = new URLSearchParams({
      client_id: account.clientId,
      client_secret: account.clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.error_description || `Token refresh failed: HTTP ${response.status}`,
      };
    }

    const data: TokenResponse = await response.json();
    
    await storage.updateBloggerAccount(account.id, {
      accessToken: data.access_token,
      tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      isConnected: true,
    });

    return {
      success: true,
      accessToken: data.access_token,
      message: "Token refreshed",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Token refresh failed: ${message}` };
  }
}

export async function validateAndConnectAccount(
  account: BloggerAccount
): Promise<{ success: boolean; blogName?: string; blogUrl?: string; message: string }> {
  try {
    const params = new URLSearchParams({
      client_id: account.clientId,
      client_secret: account.clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    });

    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({}));
      await storage.updateBloggerAccount(account.id, { isConnected: false });
      return {
        success: false,
        message: error.error_description || `Token refresh failed: HTTP ${tokenResponse.status}. Please check your client_id, client_secret, and refresh_token.`,
      };
    }

    const tokenData: TokenResponse = await tokenResponse.json();
    
    const validation = await validateBloggerConnection(account.blogId, tokenData.access_token);
    
    if (!validation.success) {
      await storage.updateBloggerAccount(account.id, { isConnected: false });
      return {
        success: false,
        message: validation.message,
      };
    }

    await storage.updateBloggerAccount(account.id, {
      accessToken: tokenData.access_token,
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      isConnected: true,
      blogName: validation.blogName,
      blogUrl: validation.blogUrl,
    });

    return {
      success: true,
      blogName: validation.blogName,
      blogUrl: validation.blogUrl,
      message: `Successfully connected to "${validation.blogName}"`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await storage.updateBloggerAccount(account.id, { isConnected: false });
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function validateAccountCredentials(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  blogId: string
): Promise<{ success: boolean; accessToken?: string; blogName?: string; blogUrl?: string; tokenExpiry?: string; message: string }> {
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({}));
      return {
        success: false,
        message: error.error_description || `Token refresh failed: HTTP ${tokenResponse.status}. Please check your client_id, client_secret, and refresh_token.`,
      };
    }

    const tokenData: TokenResponse = await tokenResponse.json();
    
    const validation = await validateBloggerConnection(blogId, tokenData.access_token);
    
    if (!validation.success) {
      return {
        success: false,
        message: validation.message,
      };
    }

    return {
      success: true,
      accessToken: tokenData.access_token,
      blogName: validation.blogName,
      blogUrl: validation.blogUrl,
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      message: `Successfully connected to "${validation.blogName}"`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function getBloggerPosts(
  maxResults = 10
): Promise<{ success: boolean; posts?: any[]; message: string }> {
  const settings = await storage.getSettings();
  const { blogger } = settings;

  if (!blogger.isConnected || !blogger.blogId || !blogger.accessToken) {
    return { success: false, message: "Blogger is not connected", posts: [] };
  }

  try {
    const response = await fetch(
      `${BLOGGER_API_BASE}/blogs/${blogger.blogId}/posts?maxResults=${maxResults}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${blogger.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return { success: false, message: "Failed to fetch posts", posts: [] };
    }

    const data = await response.json();
    return { success: true, posts: data.items || [], message: "Posts fetched" };
  } catch (error) {
    return { success: false, message: "Error fetching posts", posts: [] };
  }
}
