import { storage } from "../storage";
import type { GeneratedContent, NicheId, ApiKey, InsertTrendingResearch } from "@shared/schema";
import { NICHES } from "@shared/schema";
import { searchTrendingTopics, researchTopicForContent, type WebSearchResult } from "./webSearch";

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "llama-3.3-70b";

interface CerebrasResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface KeyRotationResult {
  key: ApiKey;
  response: CerebrasResponse;
}

async function callCerebrasWithRotation(
  messages: { role: string; content: string }[],
  jsonMode: boolean = false
): Promise<CerebrasResponse> {
  const settings = await storage.getSettings();
  const allKeys = settings.cerebrasApiKeys.filter((k) => k.isActive);
  
  if (allKeys.length === 0) {
    throw new Error("No Cerebras API keys available. Please add a key in settings.");
  }
  
  let startIndex = settings.currentCerebrasKeyIndex % allKeys.length;
  let attemptedKeys = 0;
  const failedKeyIds: string[] = [];
  
  while (attemptedKeys < allKeys.length) {
    const currentIndex = (startIndex + attemptedKeys) % allKeys.length;
    const key = allKeys[currentIndex];
    
    try {
      console.log(`[Cerebras] Trying key ${key.name || key.id.slice(0, 8)}... (${attemptedKeys + 1}/${allKeys.length})`);
      
      const requestBody: any = {
        model: CEREBRAS_MODEL,
        messages,
        max_tokens: 8192,
        temperature: 0.7,
      };
      
      if (jsonMode) {
        requestBody.response_format = { type: "json_object" };
      }
      
      const response = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key.key}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Cerebras] Key ${key.name || key.id.slice(0, 8)} failed: ${response.status} - ${errorText}`);
        
        if (response.status === 401 || response.status === 403) {
          failedKeyIds.push(key.id);
          attemptedKeys++;
          continue;
        }
        
        if (response.status === 429) {
          console.log(`[Cerebras] Rate limited on key ${key.name || key.id.slice(0, 8)}, trying next...`);
          attemptedKeys++;
          continue;
        }
        
        throw new Error(`Cerebras API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json() as CerebrasResponse;
      
      await storage.updateCerebrasKeyUsage(key.id);
      await storage.rotateCerebrasKeyIndex();
      
      console.log(`[Cerebras] Success with key ${key.name || key.id.slice(0, 8)}`);
      return data;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Cerebras] Error with key ${key.name || key.id.slice(0, 8)}: ${message}`);
      
      if (message.includes("API error")) {
        throw error;
      }
      
      attemptedKeys++;
    }
  }
  
  throw new Error("All Cerebras API keys failed. Please check your keys in settings.");
}

function extractContent(response: CerebrasResponse): string {
  if (response.choices && response.choices.length > 0) {
    return response.choices[0].message.content || "";
  }
  return "";
}

function getNicheById(nicheId?: string) {
  if (!nicheId) return null;
  return NICHES.find((n) => n.id === nicheId) || null;
}

export async function testCerebrasConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await callCerebrasWithRotation([
      {
        role: "user",
        content: "Say 'API connection successful' in exactly those words.",
      },
    ]);
    
    const text = extractContent(response);
    if (text.toLowerCase().includes("successful")) {
      return { success: true, message: "Cerebras API connection verified successfully" };
    }
    return { success: true, message: "Connection established" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function generateTrendingTopic(nicheId?: NicheId): Promise<{ topic: string; fomoHook: string; keywords: string[]; webResearch?: WebSearchResult }> {
  const niche = getNicheById(nicheId);
  
  console.log("[Cerebras] Starting web search for trending topics...");
  
  let webResearch: WebSearchResult | undefined;
  try {
    webResearch = await searchTrendingTopics(nicheId);
    console.log("[Cerebras] Web research completed:", webResearch.topic);
  } catch (error) {
    console.error("[Cerebras] Web search failed, falling back to AI generation:", error);
  }
  
  if (webResearch && webResearch.topic && webResearch.summary) {
    const settings = await storage.getSettings();
    const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
      ? settings.usedTopicsByNiche[nicheId].slice(-100)
      : settings.usedTopics.slice(-100);
    
    const normalizedTopic = webResearch.topic.toLowerCase().trim();
    const isSimilar = usedTopicsForNiche.some(used => {
      const usedNormalized = used.toLowerCase().trim();
      return usedNormalized === normalizedTopic || 
             usedNormalized.includes(normalizedTopic) || 
             normalizedTopic.includes(usedNormalized) ||
             calculateSimilarity(usedNormalized, normalizedTopic) > 0.6;
    });
    
    if (!isSimilar) {
      console.log("[Cerebras] Using web-researched topic:", webResearch.topic);
      return {
        topic: webResearch.topic,
        fomoHook: webResearch.whyTrending || "This is what everyone is talking about right now.",
        keywords: webResearch.keywords || niche?.keywords || ["trending", "viral"],
        webResearch,
      };
    } else {
      console.log("[Cerebras] Web topic too similar to used topics, generating alternative...");
    }
  }
  
  const settings = await storage.getSettings();
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
    
  const usedTopicsContext = usedTopicsForNiche.length > 0 
    ? `\n\nCRITICAL - DO NOT REPEAT OR USE SIMILAR TOPICS. These have already been covered:\n${usedTopicsForNiche.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nYour topic MUST be completely different from ALL of the above. Do not use synonyms or variations of these topics. Find a FRESH, UNIQUE angle that hasn't been covered.`
    : "";

  const webContext = webResearch 
    ? `\n\nBased on recent web research, here are some trending stories you can build upon (but DO NOT copy these exactly - use them for inspiration):\n- ${webResearch.topic}: ${webResearch.summary.substring(0, 300)}...\n- Facts found: ${webResearch.facts.slice(0, 3).join("; ")}`
    : "";

  const nicheContext = niche 
    ? `You are an expert content strategist focused on the "${niche.name}" niche.

Your task: Create a UNIQUE and SPECIFIC trending topic related to ${niche.promptContext} that would make an excellent blog post for today. Focus on:
${niche.keywords.map(k => `- ${k}`).join("\n")}
- Current events and breaking news in this niche
- Topics people are actively searching for
- Fresh angles that haven't been covered`
    : `You are an expert AI content strategist focused on the "AI Tools and Productivity" niche.

Your task: Create a UNIQUE and SPECIFIC trending topic in AI tools that would make an excellent blog post for today. Focus on:
- New AI tools, features, or updates
- Practical AI automation for work/business
- AI productivity hacks and workflows
- Real-world AI use cases`;

  const prompt = `${nicheContext}
${webContext}

The topic MUST:
1. Be COMPLETELY UNIQUE - not similar to any previously used topic
2. Be highly SPECIFIC (not generic like "top 10 tips" - give exact names, dates, events)
3. Be timely and relevant to what's happening NOW
4. Create urgency for readers
5. Use a fresh angle that hasn't been explored
${usedTopicsContext}

Respond with ONLY valid JSON in this exact format:
{
  "topic": "A SPECIFIC topic with real names, dates, or events - not generic",
  "fomoHook": "A compelling 1-2 sentence hook that creates urgency",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

  const response = await callCerebrasWithRotation(
    [{ role: "user", content: prompt }],
    true
  );

  const text = extractContent(response);
  try {
    const parsed = JSON.parse(text);
    return {
      topic: parsed.topic || (niche ? `Trending in ${niche.name}` : "AI Tools for Maximum Productivity"),
      fomoHook: parsed.fomoHook || "Discover what everyone is talking about.",
      keywords: parsed.keywords || (niche ? [...niche.keywords] : ["AI", "productivity", "automation"]),
      webResearch,
    };
  } catch {
    const defaultTopic = niche 
      ? `The Latest Trending Topics in ${niche.name}` 
      : "The Latest AI Tools Transforming Business Productivity";
    const defaultHook = niche
      ? `The ${niche.name.toLowerCase()} world is buzzing with this topic. Don't miss out!`
      : "While you're reading this, thousands of businesses are automating their workflows with AI. Are you keeping up?";
    return {
      topic: defaultTopic,
      fomoHook: defaultHook,
      keywords: niche ? [...niche.keywords] : ["AI tools", "productivity", "business automation", "workflow"],
      webResearch,
    };
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const stopWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "have", "this", "from", "that", "with", "they", "will", "what", "about", "which", "when", "make", "like", "time", "just", "know", "take", "people", "into", "year", "your", "some", "could", "them", "than", "then", "look", "only", "come", "over", "such", "also", "back", "after", "use", "two", "how", "more", "most", "very", "even"]);
  
  const normalize = (str: string) => str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const words1 = normalize(str1);
  const words2 = normalize(str2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  const jaccardSimilarity = commonWords.length / (new Set([...words1, ...words2]).size);
  const overlapScore = commonWords.length / Math.min(words1.length, words2.length);
  
  return Math.max(jaccardSimilarity, overlapScore * 0.8);
}

export async function generateBlogPost(topic: string, fomoHook?: string, nicheId?: NicheId, existingResearch?: WebSearchResult): Promise<GeneratedContent> {
  const niche = getNicheById(nicheId);

  console.log("[Cerebras] Researching topic before writing blog post...");
  
  let research = existingResearch;
  if (!research) {
    try {
      const topicResearch = await researchTopicForContent(topic, nicheId);
      research = {
        topic,
        summary: topicResearch.researchSummary,
        sources: topicResearch.sources,
        searchQueries: [],
        facts: topicResearch.facts,
        whyTrending: "",
        keywords: [],
      };
      console.log("[Cerebras] Topic research completed, found", topicResearch.facts.length, "facts");
    } catch (error) {
      console.error("[Cerebras] Topic research failed, proceeding without research:", error);
    }
  }

  const nicheWritingStyle = niche ? getNicheWritingStyle(niche.id) : getDefaultWritingStyle();

  const researchContext = research ? `
IMPORTANT - USE THIS RESEARCH DATA IN YOUR ARTICLE:
This is real information from web research. Include these facts and details in your article:

Summary: ${research.summary}

Key Facts (USE THESE):
${research.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Sources Referenced:
${research.sources.slice(0, 5).map(s => `- ${s.title}: ${s.snippet}`).join("\n")}

Write about these REAL facts and information. Do not make up statistics or claims. Base your content on this research.
` : "";

  const prompt = `You are a skilled blogger who writes like a real person - not like AI. Your writing should feel authentic, warm, and easy to read.

Write a complete blog post about: "${topic}"
${fomoHook ? `\nHook to inspire your intro: "${fomoHook}"` : ""}
${researchContext}

${nicheWritingStyle}

WRITING RULES (CRITICAL - FOLLOW EXACTLY):
1. Write like you're talking to a friend - casual, warm, and real
2. Keep sentences readable - avoid long run-on sentences
3. Keep paragraphs digestible - don't write walls of text
4. Use simple, everyday words - no fancy vocabulary
5. Vary your sentence length to create natural rhythm
6. Start some sentences with "And", "But", "So" - it's conversational
7. Use contractions (don't, won't, can't, it's)
8. Ask questions to engage readers
9. Use "you" and "your" often to speak directly to readers
10. INCLUDE SPECIFIC FACTS from the research provided above

BANNED AI WORDS AND PHRASES - NEVER USE THESE:
- "delve", "landscape", "leverage", "utilize", "plethora", "myriad", "realm", "tapestry"
- "game-changing", "revolutionary", "cutting-edge", "groundbreaking", "unprecedented"
- "In today's fast-paced world", "In this digital age", "In the ever-evolving"
- "Furthermore", "Moreover", "Additionally", "Consequently", "Subsequently"
- "It's worth noting", "It's important to note", "Interestingly"
- "robust", "seamless", "comprehensive", "holistic", "synergy", "paradigm"
- "at the end of the day", "when all is said and done"
- "needless to say", "goes without saying"

USE THESE NATURAL ALTERNATIVES INSTEAD:
- "look into" instead of "delve"
- "use" instead of "utilize/leverage"
- "area" or "space" instead of "landscape/realm"
- "lots of" or "many" instead of "plethora/myriad"
- "Also," "Plus," "On top of that," instead of "Furthermore/Moreover"
- "Here's the thing," "Look," "The cool part is" for transitions

STRUCTURE:
1. TITLE: Catchy but simple - something you'd actually click on
2. INTRO: Hook the reader right away. Reference the real facts from research.
3. BODY: 6-8 sections with clear H2 headings
   - Include the REAL facts and statistics from the research
   - Mix paragraphs with bullet points and numbered lists
   - Include real examples and practical tips
   - Keep it informative but easy to skim
4. CONCLUSION: Quick summary + encourage comments/shares
5. FORMAT: HTML tags (<h2>, <p>, <ul>, <li>, <ol>, <strong>, <em>)

LENGTH: 1,200-1,800 words. Quality content based on real research.

Respond with ONLY valid JSON:
{
  "title": "Your catchy, simple title",
  "content": "Full HTML-formatted blog content based on research",
  "excerpt": "2-3 sentence preview that makes people want to read more",
  "labels": ["label1", "label2", "label3", "label4", "label5"],
  "imagePrompt": "Visual scene description for featured image - describe a scene, no text"
}`;

  const response = await callCerebrasWithRotation(
    [{ role: "user", content: prompt }],
    true
  );

  const text = extractContent(response);
  try {
    const parsed = JSON.parse(text);
    
    await storage.addUsedTopic(topic, nicheId);
    
    return {
      title: parsed.title || topic,
      content: parsed.content || "<p>Content generation failed. Please try again.</p>",
      excerpt: parsed.excerpt || (niche ? `Discover the latest in ${niche.name.toLowerCase()}.` : "Discover the latest in AI tools and productivity."),
      labels: parsed.labels || (niche ? niche.keywords.slice(0, 5) : ["AI", "Productivity", "Technology"]),
      imagePrompt: parsed.imagePrompt || `Cinematic visual scene representing ${topic}, ${niche ? niche.promptContext : "modern technology"}, dramatic lighting, no text`,
    };
  } catch (error) {
    throw new Error("Failed to parse generated content. Please try again.");
  }
}

function getNicheWritingStyle(nicheId: string): string {
  const styles: Record<string, string> = {
    "scary-mysterious": `NICHE: Scary/Mysterious/True Crime
TONE: Suspenseful but readable. Like telling a spooky story around a campfire.
- Build tension with short, punchy sentences
- End sections with hooks that make readers want more
- Describe creepy details vividly but simply
- Use "What happened next..." or "Then things got weird..."
- Keep it eerie without being over-the-top`,

    "ai-tools": `NICHE: AI Tools & Technology
TONE: Helpful tech friend. You're explaining cool stuff, not giving a lecture.
- Explain tech in simple terms anyone can understand
- Give specific tool names and what they actually do
- Include step-by-step tips people can try right now
- Compare options honestly - pros AND cons
- Focus on "here's how this helps you" not fancy features`,

    "life-hacks": `NICHE: Life Hacks & Tips
TONE: Excited friend sharing discoveries. "OMG you have to try this!"
- Make every tip super easy to do TODAY
- Show the before/after difference
- Be enthusiastic but not fake
- Use "This changed everything for me" type language
- Focus on real time and money savings`,

    "weird-facts": `NICHE: Weird Facts & Discoveries
TONE: Mind-blown friend sharing cool stuff. "Wait till you hear this!"
- Start with the most surprising part
- Use "Did you know..." and "Here's the crazy thing..."
- Compare weird facts to things people understand
- Build up to the big reveal
- Make readers want to share what they learned`,

    "viral-entertainment": `NICHE: Viral Entertainment
TONE: In-the-know friend. Casual, fun, current.
- Reference what's trending right NOW
- Use social media style language (but readable)
- Include quotes and memorable moments
- Hook readers with "Everyone's talking about..."
- Keep it light, fun, and shareable`,

    "health-hacks": `NICHE: Health & Wellness  
TONE: Supportive friend, not a doctor. Encouraging but realistic.
- Give practical tips people can start today
- Mention research in simple terms when helpful
- Be encouraging without being preachy
- Use "Try this..." and "You might notice..."
- Focus on small wins that add up`,
  };

  return styles[nicheId] || getDefaultWritingStyle();
}

function getDefaultWritingStyle(): string {
  return `NICHE: General/Mixed Content
TONE: Friendly and helpful. Like a knowledgeable friend sharing useful info.
- Keep it casual but informative
- Include real examples and practical advice
- Focus on what readers can actually use
- Be engaging without being pushy`;
}

export async function generateTrendingResearch(nicheId: NicheId): Promise<InsertTrendingResearch> {
  const niche = getNicheById(nicheId);
  const nicheName = niche?.name || "General Topics";
  
  const settings = await storage.getSettings();
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-50)
    : [];
  
  const usedTopicsContext = usedTopicsForNiche.length > 0 
    ? `\n\nAVOID THESE ALREADY COVERED TOPICS:\n${usedTopicsForNiche.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  const prompt = `You are a research analyst who identifies REAL trending topics from the internet. Your job is to find what's ACTUALLY trending right now in the "${nicheName}" niche.

IMPORTANT: You must identify a REAL trending topic that people are actually searching for and discussing online. Base your research on:
- Recent news articles and reports
- Social media trends and discussions
- Search trends and popular queries
- Forums and community discussions
- Recent events and announcements

For the "${nicheName}" niche, focus on topics related to: ${niche?.promptContext || "general interest topics"}
Keywords to consider: ${niche?.keywords.join(", ") || "trending, viral, popular"}
${usedTopicsContext}

Generate a detailed research report for ONE trending topic. Include:

1. The trending topic title (specific and current)
2. A short description (2-3 sentences)
3. Full research summary (detailed analysis, 3-4 paragraphs)
4. AI analysis of the topic (insights, predictions, implications)
5. Why this topic is trending (what events or factors made it popular)
6. 3-5 sources with titles, URLs, and snippets (generate realistic news/blog sources)
7. Search queries that would find this topic

Respond with ONLY valid JSON:
{
  "title": "Specific trending topic title",
  "shortDescription": "Brief 2-3 sentence overview",
  "fullSummary": "Detailed research summary with multiple paragraphs. Include facts, statistics, and context.",
  "aiAnalysis": "AI-generated analysis of implications, predictions, and insights about this trend",
  "whyTrending": "Explanation of why this topic is currently trending - what triggered the interest",
  "sources": [
    {
      "title": "Source article title",
      "url": "https://example.com/article",
      "snippet": "Key excerpt from the source"
    }
  ],
  "searchQueries": ["query 1", "query 2", "query 3"]
}`;

  const response = await callCerebrasWithRotation(
    [{ role: "user", content: prompt }],
    true
  );

  const text = extractContent(response);
  try {
    const parsed = JSON.parse(text);
    
    return {
      title: parsed.title || `Trending in ${nicheName}`,
      shortDescription: parsed.shortDescription || `Latest trending topic in the ${nicheName.toLowerCase()} space.`,
      fullSummary: parsed.fullSummary || "Research summary not available.",
      aiAnalysis: parsed.aiAnalysis || "AI analysis not available.",
      whyTrending: parsed.whyTrending || "This topic is currently generating significant online interest.",
      sources: parsed.sources || [],
      nicheId,
      nicheName,
      searchQueries: parsed.searchQueries || [],
    };
  } catch {
    return {
      title: `Trending Topic in ${nicheName}`,
      shortDescription: `A current trending topic in the ${nicheName.toLowerCase()} niche.`,
      fullSummary: "Unable to generate detailed research summary at this time.",
      aiAnalysis: "Analysis unavailable.",
      whyTrending: "This topic is currently popular in online discussions.",
      sources: [],
      nicheId,
      nicheName,
      searchQueries: [],
    };
  }
}
