import { uploadImageToImgbb } from "./imgbb";

const POLLINATIONS_API_URL = "https://image.pollinations.ai/prompt/";

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function createFOMOImagePrompt(basePrompt: string): string {
  return `${basePrompt}, purely visual scene only, ultra-detailed, cinematic lighting, hyper-realistic, 8k resolution, dramatic composition, vibrant colors, professional photography, stunning visual impact, award-winning photography, high contrast, sharp focus, magazine cover quality, breathtaking scene, epic atmosphere, absolutely no text, no words, no letters, no typography, no writing, no captions, no titles, no labels, no watermarks, no logos, no signs, no banners, text-free image`;
}

export async function testImageGeneratorConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const testPrompt = encodeURIComponent("test image generation");
    const testUrl = `${POLLINATIONS_API_URL}${testPrompt}?width=64&height=64&nologo=true`;
    
    const response = await fetchWithTimeout(testUrl, 60000);
    
    if (response.ok) {
      return { success: true, message: "Pollinations AI connection verified successfully (Free, No API Key Required)" };
    }
    
    return { success: false, message: `Connection test failed: HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const enhancedPrompt = createFOMOImagePrompt(prompt);
    console.log("[ImageGenerator] Generating image with prompt:", enhancedPrompt.substring(0, 100) + "...");
    
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const imageUrl = `${POLLINATIONS_API_URL}${encodedPrompt}?width=1024&height=576&seed=${seed}&model=flux&nologo=true&enhance=true`;
    
    console.log("[ImageGenerator] Fetching from Pollinations AI...");
    
    const response = await fetchWithTimeout(imageUrl, 180000);
    
    if (!response.ok) {
      console.error(`[ImageGenerator] Pollinations API returned status ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("image")) {
      const hostedUrl = await saveImageFromResponse(response);
      if (hostedUrl) {
        console.log("[ImageGenerator] Image generated and hosted successfully");
        return hostedUrl;
      }
      
      console.log("[ImageGenerator] ImgBB upload failed, using direct Pollinations URL");
      return imageUrl;
    }
    
    console.error("[ImageGenerator] Response was not an image");
    return null;
  } catch (error) {
    console.error("[ImageGenerator] Error generating image:", error);
    return null;
  }
}

async function saveImageFromResponse(response: Response): Promise<string | null> {
  try {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const contentType = response.headers.get("content-type") || "image/png";
    const mimeType = contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
    
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log("[ImageGenerator] Image converted to base64 (length:", dataUrl.length, ")");
    
    const hostedUrl = await uploadImageToImgbb(dataUrl);
    if (hostedUrl) {
      console.log("[ImageGenerator] Image uploaded to ImgBB:", hostedUrl);
      return hostedUrl;
    }
    
    return null;
  } catch (error) {
    console.error("[ImageGenerator] Error saving image:", error);
    return null;
  }
}

export async function generateBlogImage(prompt: string, maxRetries = 5): Promise<string | null> {
  console.log("[ImageGenerator] ========================================");
  console.log("[ImageGenerator] Starting FREE blog image generation (Pollinations AI)...");
  console.log("[ImageGenerator] No API key required!");
  console.log("[ImageGenerator] Prompt:", prompt.substring(0, 100) + "...");
  
  let retries = 0;
  
  while (retries < maxRetries) {
    console.log(`[ImageGenerator] Attempt ${retries + 1}/${maxRetries}...`);
    try {
      const image = await generateImage(prompt);
      if (image) {
        console.log("[ImageGenerator] Blog image generated successfully!");
        console.log("[ImageGenerator] ========================================");
        return image;
      }
      console.log(`[ImageGenerator] Attempt ${retries + 1} returned null, retrying...`);
    } catch (error) {
      console.error(`[ImageGenerator] Attempt ${retries + 1} failed:`, error);
    }
    retries++;
    if (retries < maxRetries) {
      console.log("[ImageGenerator] Waiting 3 seconds before retry...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  
  console.log("[ImageGenerator] All retries exhausted - Pollinations AI generation failed");
  console.log("[ImageGenerator] ========================================");
  return null;
}
