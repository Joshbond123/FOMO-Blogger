import { storage } from "../storage";
import type { GeneratedContent, NicheId, ApiKey, InsertTrendingResearch } from "@shared/schema";
import { NICHES } from "@shared/schema";

// WebSearchResult type for compatibility (no longer importing from Gemini-based webSearch)
export interface WebSearchResult {
  topic: string;
  summary: string;
  sources: {
    title: string;
    url: string;
    snippet: string;
  }[];
  searchQueries: string[];
  facts: string[];
  whyTrending: string;
  keywords: string[];
}

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
  
  console.log("[Cerebras] Generating trending topic using Cerebras AI...");
  
  // Using Cerebras for topic generation (no Gemini dependency)
  const settings = await storage.getSettings();
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
    
  const usedTopicsContext = usedTopicsForNiche.length > 0 
    ? `\n\nCRITICAL - DO NOT REPEAT OR USE SIMILAR TOPICS. These have already been covered:\n${usedTopicsForNiche.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nYour topic MUST be completely different from ALL of the above. Do not use synonyms or variations of these topics. Find a FRESH, UNIQUE angle that hasn't been covered.`
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

// Cerebras-based topic research (replaces Gemini-based webSearch)
async function researchTopicWithCerebras(topic: string, nicheId?: NicheId): Promise<{
  researchSummary: string;
  facts: string[];
  sources: { title: string; url: string; snippet: string }[];
}> {
  const niche = getNicheById(nicheId);
  
  const today = new Date().toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });

  const prompt = `Today is ${today}. You are a research analyst. Research this topic thoroughly: "${topic}"
${niche ? `Context: This is for a ${niche.name} blog focused on ${niche.promptContext}.` : ""}

Based on your knowledge, provide comprehensive research including:
1. A detailed summary of what's happening with this topic (3-4 paragraphs)
2. Key facts, numbers, and important points
3. Relevant context and background information

Respond with ONLY valid JSON:
{
  "researchSummary": "Detailed 3-4 paragraph summary about this topic with specific information",
  "facts": ["Specific fact 1", "Specific fact 2", "Specific fact 3", "Specific fact 4", "Specific fact 5"],
  "sources": [
    {"title": "Source title 1", "url": "https://example.com/article1", "snippet": "Key information from source"},
    {"title": "Source title 2", "url": "https://example.com/article2", "snippet": "Key information from source"}
  ]
}`;

  try {
    const response = await callCerebrasWithRotation(
      [{ role: "user", content: prompt }],
      true
    );

    const text = extractContent(response);
    const parsed = JSON.parse(text);
    
    return {
      researchSummary: parsed.researchSummary || "Research summary not available.",
      facts: parsed.facts || [],
      sources: parsed.sources || [],
    };
  } catch (error) {
    console.error("[Cerebras] Research failed:", error);
    return {
      researchSummary: `Information about ${topic}.`,
      facts: [],
      sources: [],
    };
  }
}

export async function generateBlogPost(topic: string, fomoHook?: string, nicheId?: NicheId, existingResearch?: WebSearchResult): Promise<GeneratedContent> {
  const niche = getNicheById(nicheId);

  console.log("[Cerebras] Researching topic using Cerebras AI...");
  
  let research = existingResearch;
  if (!research) {
    try {
      const topicResearch = await researchTopicWithCerebras(topic, nicheId);
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
IMPORTANT - USE THIS RESEARCH DATA TO SUPPORT YOUR ARTICLE:
This is real information from web research about the SINGLE topic above. Use these facts to enrich your article:

Topic Summary: ${research.summary}

Supporting Facts (use these to support your main topic):
${research.facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Reference Sources:
${research.sources.slice(0, 5).map(s => `- ${s.title}: ${s.snippet}`).join("\n")}

IMPORTANT: Use ONLY facts that directly relate to "${topic}". Do not make up statistics or claims. 
Do NOT include any facts about other topics, creatures, events, or subjects - ONLY "${topic}".
If the research mentions other topics, IGNORE THEM. Stay 100% focused on "${topic}"
` : "";

  const prompt = `You are a top-tier professional writer creating expert-level content. Your writing sounds like it comes from someone who truly knows the subject - authoritative yet accessible.

Write a complete blog post about THIS SINGLE TOPIC ONLY: "${topic}"
${fomoHook ? `\nHook to inspire your intro: "${fomoHook}"` : ""}
${researchContext}

${nicheWritingStyle}

ABSOLUTE RULE - SINGLE TOPIC ONLY (MANDATORY):
The blog MUST be 100% focused on ONLY this ONE topic: "${topic}"

YOU MUST:
- Write the ENTIRE article about "${topic}" and NOTHING else
- Every paragraph, every section, every fact must directly relate to "${topic}"
- Explore different angles, aspects, and depths of this ONE single topic
- Stay completely focused from the first word to the last word

YOU MUST NEVER:
- Include ANY other topic, subject, or theme besides "${topic}"
- Mix multiple topics together in the same article
- Add "related" or "similar" topics - NO EXCEPTIONS
- Switch between different subjects halfway through
- Create round-ups, listicles, or compilations of multiple topics
- Mention unrelated discoveries, facts, or stories even if they seem connected

EXAMPLES OF WHAT IS FORBIDDEN:
- If the topic is "Immortal Jellyfish" - do NOT also write about axolotls, starfish, or other creatures
- If the topic is "Mary Celeste Mystery" - do NOT also write about other ship mysteries or other historical events
- If the topic is "Axolotl Regeneration" - do NOT also write about other animals, immortality research, or health applications
- NEVER combine science + history + motivation + health into one article - pick ONE

CORRECT APPROACH:
- If the topic is "Immortal Jellyfish" - write ONLY about the immortal jellyfish (its biology, discovery, research, habitat, etc.)
- If the topic is "Mary Celeste Mystery" - write ONLY about the Mary Celeste (the ship, the crew, the theories, the investigation, etc.)
- Deep dive into ONE topic with multiple angles - NOT surface coverage of multiple topics

YOUR WRITING MUST:
- Sound like a respected expert wrote it - confident, knowledgeable, trustworthy
- Be written in simple, clear English that anyone can understand
- Hook readers from the first sentence and keep them engaged until the end
- Flow naturally with smooth transitions between sections
- Deliver REAL value - insights, facts, and information readers can actually use
- Feel like premium content, not generic filler

YOUR WRITING MUST NEVER:
- Sound promotional, salesy, or like an advertisement
- Look like AI-generated content (avoid robotic patterns)
- Be boring, generic, or superficial
- Repeat the same points in different words
- Include fluff or filler content

WRITING STYLE:
1. Write with authority but stay approachable - expert friend, not lecturer
2. Use simple, everyday words - explain complex things simply
3. Keep sentences clear and readable - no run-on sentences
4. Vary sentence length to create natural rhythm
5. Use contractions naturally (don't, won't, can't, it's)
6. Ask questions to engage readers
7. Include specific facts and details from the research
8. Make every paragraph count - no filler content

BANNED AI WORDS AND PHRASES - NEVER USE:
- "delve", "landscape", "leverage", "utilize", "plethora", "myriad", "realm", "tapestry"
- "game-changing", "revolutionary", "cutting-edge", "groundbreaking", "unprecedented"
- "In today's fast-paced world", "In this digital age", "In the ever-evolving"
- "Furthermore", "Moreover", "Additionally", "Consequently", "Subsequently"
- "It's worth noting", "It's important to note", "Interestingly"
- "robust", "seamless", "comprehensive", "holistic", "synergy", "paradigm"
- "at the end of the day", "when all is said and done", "needless to say"
- "unlock", "harness", "empower", "elevate"

USE NATURAL LANGUAGE INSTEAD:
- "look into" instead of "delve"
- "use" instead of "utilize/leverage"
- "area" or "field" instead of "landscape/realm"
- "Also," "Plus," "And here's the thing," instead of "Furthermore/Moreover"
- "Here's what's interesting," "Look," "The key point is" for transitions

STRUCTURE:
1. TITLE: Compelling but honest - makes people want to read, not clickbait. Must be about "${topic}" ONLY.
2. INTRO: Hook immediately with something surprising about "${topic}". Set up THIS specific topic clearly.
3. BODY: 6-8 sections with clear H2 headings - ALL sections MUST be about "${topic}"
   - Each section explores a DIFFERENT ANGLE of the SAME topic "${topic}"
   - Example angles: history, science, discovery, impact, future, controversy, details, timeline
   - NEVER add sections about other topics, animals, events, or subjects
   - Include the REAL facts and statistics from research about "${topic}"
   - Mix paragraphs with bullet points and numbered lists for easy reading
   - Every section dives deeper into "${topic}" - no topic switching allowed
4. CONCLUSION: Strong finish about "${topic}" only - summarize key points, leave readers thinking
   - End with a FRIENDLY CALL-TO-ACTION that invites readers to share their thoughts, experiences, or opinions in the comments
   - Make readers feel valued and welcomed to join the conversation (e.g., "What's your experience with...?", "I'd love to hear your thoughts...", "Have you ever...? Share your story below!")
   - Keep the CTA warm, genuine, and conversational - not pushy or generic
5. FORMAT: HTML tags (<h2>, <p>, <ul>, <li>, <ol>, <strong>, <em>)

LENGTH: 1,200-1,800 words of high-quality, valuable content.

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
      status: "generated" as const,
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
      status: "generated" as const,
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
