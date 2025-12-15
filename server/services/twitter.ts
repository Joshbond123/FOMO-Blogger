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

async function uploadMediaToX(
  xAccount: XAccount,
  imageUrl: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    console.log("[X Media] Downloading image from:", imageUrl);
    
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { success: false, error: `Failed to download image: ${imageResponse.status}` };
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    
    // Determine media type from URL or content-type
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mediaType = contentType.includes("png") ? "image/png" : 
                      contentType.includes("gif") ? "image/gif" : "image/jpeg";
    
    console.log("[X Media] Image size:", imageBuffer.byteLength, "bytes, type:", mediaType);
    
    // Upload to X media endpoint (v1.1 API)
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    
    // Create form data for media upload
    const formData = new URLSearchParams();
    formData.append("media_data", base64Image);
    
    const authHeader = generateAuthHeader(
      "POST",
      uploadUrl,
      xAccount.apiKey,
      xAccount.apiSecret,
      xAccount.accessToken,
      xAccount.accessTokenSecret,
      { media_data: base64Image }
    );
    
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[X Media] Upload failed:", errorText);
      return { success: false, error: `Media upload failed: ${uploadResponse.status} - ${errorText}` };
    }
    
    const uploadData = await uploadResponse.json() as { media_id_string?: string };
    
    if (uploadData.media_id_string) {
      console.log("[X Media] Upload successful, media_id:", uploadData.media_id_string);
      return { success: true, mediaId: uploadData.media_id_string };
    }
    
    return { success: false, error: "No media_id returned from upload" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[X Media] Upload error:", message);
    return { success: false, error: message };
  }
}

export async function postToX(
  xAccount: XAccount,
  text: string,
  mediaUrl?: string
): Promise<{ success: boolean; message: string; tweetId?: string; tweetUrl?: string }> {
  try {
    const url = "https://api.twitter.com/2/tweets";
    
    // Build tweet body with optional media
    const tweetBody: { text: string; media?: { media_ids: string[] } } = { text };
    
    // Upload media if provided
    if (mediaUrl) {
      console.log("[X Post] Uploading media:", mediaUrl);
      const mediaResult = await uploadMediaToX(xAccount, mediaUrl);
      
      if (mediaResult.success && mediaResult.mediaId) {
        tweetBody.media = { media_ids: [mediaResult.mediaId] };
        console.log("[X Post] Media attached to tweet");
      } else {
        console.warn("[X Post] Media upload failed, posting without image:", mediaResult.error);
      }
    }
    
    // Debug logging
    console.log("[X Post] Tweet text:", {
      textLength: text?.length,
      textPreview: text?.slice(0, 200),
      hasMedia: !!tweetBody.media
    });
    console.log("[X Post] Using credentials:", {
      apiKey: xAccount.apiKey?.slice(0, 8) + "...",
      apiSecretLength: xAccount.apiSecret?.length,
      accessToken: xAccount.accessToken?.slice(0, 15) + "...",
      accessTokenSecretLength: xAccount.accessTokenSecret?.length
    });

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
          // Check if this might be a content length issue (tweets over 280 chars get 403)
          if (text.length > 280) {
            return {
              success: false,
              message: `X API error: Tweet is ${text.length} characters but X only allows 280 characters. The tweet was automatically truncated but may have exceeded the limit.`,
            };
          }
          return {
            success: false,
            message: `X API permission error: Your X Developer App may not have "Read and Write" permissions. Go to developer.x.com -> Your App -> Settings -> User authentication settings -> Set permissions to "Read and Write", then REGENERATE your Access Token and Access Token Secret (old tokens won't work after permission changes).`,
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
  maxLength: number = 280
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
    console.log("[postBlogToX] Starting for bloggerAccountId:", bloggerAccountId);
    
    const connection = await storage.getXConnectionByBloggerAccountId(bloggerAccountId);
    console.log("[postBlogToX] Connection found:", JSON.stringify(connection, null, 2));
    
    if (!connection || !connection.isActive) {
      return {
        success: false,
        message: "No active X account linked to this blog",
      };
    }
    
    const xAccount = await storage.getXAccount(connection.xAccountId);
    console.log("[postBlogToX] xAccount retrieved:", JSON.stringify({
      id: xAccount?.id,
      name: xAccount?.name,
      apiKey: xAccount?.apiKey,
      apiKeyLength: xAccount?.apiKey?.length,
      apiSecret: xAccount?.apiSecret,
      apiSecretLength: xAccount?.apiSecret?.length,
      accessToken: xAccount?.accessToken,
      accessTokenLength: xAccount?.accessToken?.length,
      accessTokenSecret: xAccount?.accessTokenSecret,
      accessTokenSecretLength: xAccount?.accessTokenSecret?.length,
      isConnected: xAccount?.isConnected,
    }, null, 2));
    
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
    console.log("[postBlogToX] Calling postToX with tweetText length:", tweetText.length);
    
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
