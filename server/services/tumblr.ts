import crypto from "crypto";
import { storage } from "../storage";
import type { TumblrCredentials, Post } from "@shared/schema";

interface TumblrBlogInfo {
  name: string;
  url: string;
  title: string;
  description: string;
  uuid: string;
}

interface TumblrUserInfo {
  blogs: TumblrBlogInfo[];
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmac = crypto.createHmac("sha1", signingKey);
  hmac.update(signatureBaseString);
  return hmac.digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  credentials: TumblrCredentials,
  additionalParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumer_key,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.token,
    oauth_version: "1.0",
  };

  // Merge ALL parameters for signature calculation (oauth + body params)
  const allParams = { ...oauthParams, ...additionalParams };
  
  console.log("[Tumblr OAuth] All params for signature (keys):", Object.keys(allParams).sort());

  const signature = generateOAuthSignature(
    method,
    url,
    allParams,
    credentials.consumer_secret,
    credentials.token_secret
  );

  oauthParams.oauth_signature = signature;

  // Only oauth_* params go in the Authorization header
  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}

export async function testTumblrConnection(): Promise<{ success: boolean; message: string }> {
  const credentials = await storage.getTumblrCredentials();

  if (!credentials.consumer_key || !credentials.consumer_secret || !credentials.token || !credentials.token_secret) {
    return { success: false, message: "Tumblr credentials not configured" };
  }

  try {
    const url = "https://api.tumblr.com/v2/user/info";
    const authHeader = generateOAuthHeader("GET", url, credentials);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.meta?.msg || `Connection failed: HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const blogCount = data.response?.user?.blogs?.length || 0;

    return {
      success: true,
      message: `Connected! Found ${blogCount} blog${blogCount !== 1 ? "s" : ""} associated with your account.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function getTumblrBlogs(): Promise<{
  success: boolean;
  blogs?: TumblrBlogInfo[];
  message: string;
}> {
  const credentials = await storage.getTumblrCredentials();

  if (!credentials.consumer_key || !credentials.consumer_secret || !credentials.token || !credentials.token_secret) {
    return { success: false, message: "Tumblr credentials not configured" };
  }

  try {
    const url = "https://api.tumblr.com/v2/user/info";
    const authHeader = generateOAuthHeader("GET", url, credentials);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.meta?.msg || `Failed to fetch blogs: HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const blogs: TumblrBlogInfo[] = (data.response?.user?.blogs || []).map((blog: any) => ({
      name: blog.name,
      url: blog.url,
      title: blog.title,
      description: blog.description || "",
      uuid: blog.uuid,
    }));

    return {
      success: true,
      blogs,
      message: `Found ${blogs.length} blog${blogs.length !== 1 ? "s" : ""}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to fetch blogs: ${message}` };
  }
}

export async function publishToTumblr(
  tumblrBlogName: string,
  post: Post,
  bloggerPostUrl: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; message: string }> {
  const credentials = await storage.getTumblrCredentials();

  if (!credentials.consumer_key || !credentials.consumer_secret || !credentials.token || !credentials.token_secret) {
    return { success: false, message: "Tumblr credentials not configured" };
  }

  try {
    // Use NPF (Neue Post Format) endpoint - uses JSON and simpler OAuth
    const url = `https://api.tumblr.com/v2/blog/${tumblrBlogName}/posts`;
    
    // Create a preview excerpt (first 200 characters of plain text content)
    const excerpt = post.excerpt || post.content.substring(0, 200).replace(/<[^>]*>/g, "") + "...";
    
    // Build NPF content blocks
    const contentBlocks: any[] = [];
    
    // Add image block if available
    if (post.imageUrl) {
      contentBlocks.push({
        type: "image",
        media: [{
          url: post.imageUrl,
        }],
      });
    }
    
    // Add title as heading
    contentBlocks.push({
      type: "text",
      text: post.title,
      subtype: "heading1",
    });
    
    // Add excerpt
    contentBlocks.push({
      type: "text",
      text: excerpt,
    });
    
    // Add link to full article
    contentBlocks.push({
      type: "text",
      text: "Read the full article here",
      formatting: [{
        type: "link",
        start: 0,
        end: 26,
        url: bloggerPostUrl,
      }],
    });

    // Build NPF request body
    const requestBody = {
      content: contentBlocks,
      state: "published",
      tags: post.labels?.join(",") || "",
    };

    // For NPF with JSON, DON'T include body in OAuth signature
    const authHeader = generateOAuthHeader("POST", url, credentials);

    console.log("[Tumblr NPF] Publishing to:", url);
    console.log("[Tumblr NPF] Content blocks:", contentBlocks.length);
    console.log("[Tumblr NPF] Auth header (first 100 chars):", authHeader.substring(0, 100));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[Tumblr NPF] Response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("[Tumblr NPF] Error response:", JSON.stringify(errorData));
      return {
        success: false,
        message: errorData.meta?.msg || `Failed to publish: HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const postId = data.response?.id?.toString();

    return {
      success: true,
      postId,
      postUrl: `https://${tumblrBlogName}.tumblr.com/post/${postId}`,
      message: `Published preview to Tumblr: ${tumblrBlogName}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to publish to Tumblr: ${message}` };
  }
}
