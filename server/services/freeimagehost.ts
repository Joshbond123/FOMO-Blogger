import { storage } from "../storage";

const FREEIMAGEHOST_API_URL = "https://freeimage.host/api/1/upload";

interface FreeImageHostResponse {
  status_code: number;
  success: {
    message: string;
    code: number;
  };
  image: {
    name: string;
    extension: string;
    width: number;
    height: number;
    size: number;
    time: string;
    expiration: string;
    likes: string;
    description: string | null;
    original_filename: string;
    is_animated: number;
    nsfw: string;
    id_encoded: string;
    size_formatted: string;
    filename: string;
    url: string;
    url_short: string;
    url_seo: string;
    url_viewer: string;
    url_viewer_preview: string;
    url_viewer_thumb: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
      size: number;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    display_url: string;
  };
  status_txt: string;
}

async function getFreeImageHostApiKey(): Promise<string | null> {
  const key = await storage.getNextFreeImageHostKey();
  if (!key) {
    return null;
  }
  return key.key;
}

export async function uploadImageToFreeImageHost(base64Image: string): Promise<string | null> {
  try {
    const apiKey = await getFreeImageHostApiKey();
    
    if (!apiKey) {
      console.log("[FreeImageHost] No API key available");
      return null;
    }

    let imageData = base64Image;
    if (base64Image.startsWith("data:")) {
      imageData = base64Image.split(",")[1];
    }

    console.log("[FreeImageHost] Uploading image...");
    
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("source", imageData);
    formData.append("format", "json");

    const response = await fetch(FREEIMAGEHOST_API_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FreeImageHost] Upload failed:", response.status, errorText);
      return null;
    }

    const result: FreeImageHostResponse = await response.json();
    
    if (result.status_code !== 200) {
      console.error("[FreeImageHost] Upload unsuccessful:", result);
      return null;
    }

    const imageUrl = result.image?.image?.url || result.image?.display_url || result.image?.url;
    console.log("[FreeImageHost] Image uploaded successfully:", imageUrl);
    return imageUrl;
  } catch (error) {
    console.error("[FreeImageHost] Error uploading image:", error);
    return null;
  }
}

export async function testFreeImageHostConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const apiKey = await getFreeImageHostApiKey();
    
    if (!apiKey) {
      return { success: false, message: "No FreeImage.host API key configured" };
    }

    const testImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("source", testImage);
    formData.append("format", "json");

    const response = await fetch(FREEIMAGEHOST_API_URL, {
      method: "POST",
      body: formData,
    });

    if (response.status === 401 || response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: errorData.error?.message || "Invalid API key" 
      };
    }

    if (response.ok) {
      return { success: true, message: "FreeImage.host connection verified successfully" };
    }

    return { success: false, message: `Connection test failed: HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}
