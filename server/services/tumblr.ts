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
    ...additionalParams,
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    credentials.consumer_secret,
    credentials.token_secret
  );

  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .filter((key) => key.startsWith("oauth_"))
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
    const url = `https://api.tumblr.com/v2/blog/${tumblrBlogName}/post`;
    
    // Create a preview excerpt (first 200 characters of plain text content)
    const excerpt = post.excerpt || post.content.substring(0, 200).replace(/<[^>]*>/g, "") + "...";
    
    // Build the post body with optional image, preview text, and link to full article
    let postBody = "";
    
    // Add the image if available
    if (post.imageUrl) {
      postBody += `<div style="text-align: center; margin-bottom: 16px;">
  <img src="${post.imageUrl}" alt="${post.title}" style="max-width: 100%; height: auto; border-radius: 8px;" />
</div>\n`;
    }
    
    // Add the preview text and link
    postBody += `<h2>${post.title}</h2>
<p>${excerpt}</p>
<p><strong><a href="${bloggerPostUrl}" target="_blank">Read the full article here</a></strong></p>`;

    const formData = new URLSearchParams();
    formData.append("type", "text");
    formData.append("title", post.title);
    formData.append("body", postBody);
    if (post.labels && post.labels.length > 0) {
      formData.append("tags", post.labels.join(","));
    }

    const authHeader = generateOAuthHeader("POST", url, credentials);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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
