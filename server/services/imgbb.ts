import { storage } from "../storage";

const IMGBB_API_URL = "https://api.imgbb.com/1/upload";

interface ImgbbResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: number;
    expiration: number;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium?: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

async function getImgbbApiKey(): Promise<string | null> {
  const key = await storage.getNextImgbbKey();
  if (!key) {
    return null;
  }
  return key.key;
}

export async function uploadImageToImgbb(base64Image: string): Promise<string | null> {
  try {
    const apiKey = await getImgbbApiKey();
    
    if (!apiKey) {
      console.log("[ImgBB] No API key available, returning base64 data URL");
      return null;
    }

    let imageData = base64Image;
    if (base64Image.startsWith("data:")) {
      imageData = base64Image.split(",")[1];
    }

    console.log("[ImgBB] Uploading image to ImgBB...");
    
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", imageData);

    const response = await fetch(IMGBB_API_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ImgBB] Upload failed:", response.status, errorText);
      return null;
    }

    const result: ImgbbResponse = await response.json();
    
    if (!result.success) {
      console.error("[ImgBB] Upload unsuccessful:", result);
      return null;
    }

    console.log("[ImgBB] Image uploaded successfully:", result.data.display_url);
    return result.data.display_url;
  } catch (error) {
    console.error("[ImgBB] Error uploading image:", error);
    return null;
  }
}

export async function testImgbbConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const apiKey = await getImgbbApiKey();
    
    if (!apiKey) {
      return { success: false, message: "No ImgBB API key configured" };
    }

    const testImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", testImage);

    const response = await fetch(IMGBB_API_URL, {
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
      return { success: true, message: "ImgBB connection verified successfully" };
    }

    return { success: false, message: `Connection test failed: HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}
