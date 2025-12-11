import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import type { GeneratedContent, NicheId } from "@shared/schema";
import { NICHES } from "@shared/schema";
import { searchTrendingTopics, researchTopicForContent, type WebSearchResult } from "./webSearch";

async function getGeminiClient(): Promise<GoogleGenAI> {
  const key = await storage.getNextGeminiKey();
  if (!key) {
    throw new Error("No Gemini API keys available. Please add a key in settings.");
  }
  return new GoogleGenAI({ apiKey: key.key });
}

function getNicheById(nicheId?: string) {
  if (!nicheId) return null;
  return NICHES.find((n) => n.id === nicheId) || null;
}

export async function testGeminiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const ai = await getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say 'API connection successful' in exactly those words.",
    });
    const text = response.text || "";
    if (text.toLowerCase().includes("successful")) {
      return { success: true, message: "Gemini API connection verified successfully" };
    }
    return { success: true, message: "Connection established" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function generateTrendingTopic(nicheId?: NicheId): Promise<{ topic: string; fomoHook: string; keywords: string[] }> {
  const ai = await getGeminiClient();
  
  const settings = await storage.getSettings();
  const niche = getNicheById(nicheId);
  
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
    
  const usedTopicsContext = usedTopicsForNiche.length > 0 
    ? `\n\nCRITICAL - DO NOT REPEAT OR USE SIMILAR TOPICS. These have already been covered:\n${usedTopicsForNiche.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nYour topic MUST be completely different from ALL of the above. Do not use synonyms or variations of these topics. Find a FRESH, UNIQUE angle that hasn't been covered.`
    : "";

  const nicheContext = niche 
    ? `You are an expert content strategist focused on the "${niche.name}" niche.

Your task: Research and identify a TRENDING topic related to ${niche.promptContext} that would make an excellent blog post for today. Focus on:
${niche.keywords.map(k => `- ${k}`).join("\n")}
- Trending stories and current events in this niche
- Engaging content that captures reader attention
- Topics that create curiosity and shareability`
    : `You are an expert AI content strategist focused on the "AI Tools and Productivity" niche.

Your task: Research and identify a TRENDING topic in AI tools that would make an excellent blog post for today. Focus on:
- New AI tools, features, or updates
- Practical AI automation for work/business
- AI productivity hacks and workflows
- AI tool comparisons and reviews
- Real-world AI use cases`;

  const prompt = `${nicheContext}

The topic MUST:
1. Be COMPLETELY UNIQUE - not similar to any previously used topic
2. Be highly relevant and timely (trending now)
3. Create FOMO (fear of missing out) for readers
4. Be actionable and engaging
5. Appeal to the target audience of this niche
6. Use a fresh angle that hasn't been explored before
${usedTopicsContext}

Respond with ONLY valid JSON in this exact format:
{
  "topic": "The specific topic title that would make an engaging blog post",
  "fomoHook": "A compelling 1-2 sentence hook that creates urgency and FOMO",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";
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

export async function generateBlogPost(topic: string, fomoHook?: string, nicheId?: NicheId, existingResearch?: WebSearchResult): Promise<GeneratedContent> {
  const ai = await getGeminiClient();
  const niche = getNicheById(nicheId);

  console.log("[Gemini] Researching topic before writing blog post...");
  
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
      console.log("[Gemini] Topic research completed, found", topicResearch.facts.length, "facts");
    } catch (error) {
      console.error("[Gemini] Topic research failed, proceeding without research:", error);
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

USE THESE NATURAL ALTERNATIVES INSTEAD:
- "look into" instead of "delve"
- "use" instead of "utilize/leverage"
- "area" or "space" instead of "landscape/realm"
- "Also," "Plus," "On top of that," instead of "Furthermore/Moreover"

STRUCTURE:
1. TITLE: Catchy but simple - something you'd actually click on
2. INTRO: Hook the reader right away. Reference the real facts from research.
3. BODY: 6-8 sections with clear H2 headings
   - Include the REAL facts and statistics from the research
   - Mix paragraphs with bullet points and numbered lists
   - Include real examples and practical tips
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

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";
  try {
    const parsed = JSON.parse(text);
    
    await storage.addUsedTopic(topic, nicheId);
    
    return {
      title: parsed.title || topic,
      content: parsed.content || "<p>Content generation failed. Please try again.</p>",
      excerpt: parsed.excerpt || (niche ? `Discover the latest in ${niche.name.toLowerCase()}.` : "Discover the latest in AI tools and productivity."),
      labels: parsed.labels || (niche ? [...niche.keywords.slice(0, 5)] : ["AI", "Productivity", "Technology"]),
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
