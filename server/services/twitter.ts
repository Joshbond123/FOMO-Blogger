import crypto from "crypto";
import { storage } from "../storage";
import type { XAccount, Post } from "@shared/schema";

interface TwitterApiResponse {
  data?: {
    id: string;
    text: string;
  };
  errors?: Array<{ message: string; code?: number }>;
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_token: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_signature?: string;
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  return signature;
}

function generateAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string,
  additionalParams: Record<string, string> = {}
): string {
  const oauthParams: OAuthParams = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...additionalParams };
  const signature = generateSignature(
    method,
    url,
    allParams,
    apiSecret,
    accessTokenSecret
  );
  oauthParams.oauth_signature = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key as keyof OAuthParams] as string)}"`)
    .join(", ");

  return `OAuth ${authHeader}`;
}

export async function testXConnection(
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ success: boolean; message: string; username?: string }> {
  try {
    const url = "https://api.twitter.com/2/users/me";
    const authHeader = generateAuthHeader(
      "GET",
      url,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("X API Error:", errorText);
      return {
        success: false,
        message: `Authentication failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json() as { data?: { username: string; name: string } };
    
    if (data.data?.username) {
      return {
        success: true,
        message: `Successfully connected to @${data.data.username}`,
        username: data.data.username,
      };
    }

    return {
      success: false,
      message: "Could not verify account credentials",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Connection failed: ${message}`,
    };
  }
}

export async function postToX(
  xAccount: XAccount,
  text: string,
  mediaUrl?: string
): Promise<{ success: boolean; message: string; tweetId?: string; tweetUrl?: string }> {
  try {
    const url = "https://api.twitter.com/2/tweets";
    
    const tweetBody: { text: string } = { text };

    const authHeader = generateAuthHeader(
      "POST",
      url,
      xAccount.apiKey,
      xAccount.apiSecret,
      xAccount.accessToken,
      xAccount.accessTokenSecret
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("X API Error:", errorText);
      
      // Provide helpful error messages for common issues
      if (response.status === 403) {
        const errorLower = errorText.toLowerCase();
        if (errorLower.includes("not permitted") || errorLower.includes("forbidden")) {
          return {
            success: false,
            message: `X API permission error: Your X Developer App likely doesn't have "Read and Write" permissions. Go to developer.x.com -> Your App -> Settings -> User authentication settings -> Set permissions to "Read and Write", then REGENERATE your Access Token and Access Token Secret (old tokens won't work after permission changes).`,
          };
        }
      }
      
      if (response.status === 401) {
        return {
          success: false,
          message: `X API authentication error: Your API credentials may be invalid or expired. Please verify your API Key, API Secret, Access Token, and Access Token Secret in the X Developer Portal.`,
        };
      }
      
      return {
        success: false,
        message: `Failed to post: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json() as TwitterApiResponse;
    
    if (data.data?.id) {
      const tweetUrl = xAccount.username 
        ? `https://x.com/${xAccount.username}/status/${data.data.id}`
        : `https://x.com/i/status/${data.data.id}`;
      
      return {
        success: true,
        message: "Successfully posted to X",
        tweetId: data.data.id,
        tweetUrl,
      };
    }

    if (data.errors && data.errors.length > 0) {
      return {
        success: false,
        message: `X API Error: ${data.errors[0].message}`,
      };
    }

    return {
      success: false,
      message: "Unknown error occurred while posting",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to post: ${message}`,
    };
  }
}

export function formatBlogPostForX(
  post: Post,
  blogUrl: string,
  maxLength: number = 1000
): string {
  let excerpt = post.excerpt || post.content;
  
  excerpt = excerpt
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  const linkText = `\n\nRead more: ${blogUrl}`;
  const availableLength = maxLength - linkText.length;
  
  if (excerpt.length > availableLength) {
    excerpt = excerpt.substring(0, availableLength - 3).trim() + "...";
  }
  
  return excerpt + linkText;
}

export async function postBlogToX(
  bloggerAccountId: string,
  post: Post
): Promise<{ success: boolean; message: string; tweetUrl?: string }> {
  try {
    const connection = await storage.getXConnectionByBloggerAccountId(bloggerAccountId);
    
    if (!connection || !connection.isActive) {
      return {
        success: false,
        message: "No active X account linked to this blog",
      };
    }
    
    const xAccount = await storage.getXAccount(connection.xAccountId);
    
    if (!xAccount || !xAccount.isConnected) {
      return {
        success: false,
        message: "X account not found or not connected",
      };
    }
    
    const blogUrl = post.bloggerPostUrl || "";
    
    if (!blogUrl) {
      return {
        success: false,
        message: "Blog post URL not available",
      };
    }
    
    const tweetText = formatBlogPostForX(post, blogUrl);
    
    const result = await postToX(xAccount, tweetText, post.imageUrl);
    
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to post to X: ${message}`,
    };
  }
}
