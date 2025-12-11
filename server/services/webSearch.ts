import { GoogleGenAI, Type } from "@google/genai";
import { storage } from "../storage";
import type { NicheId } from "@shared/schema";
import { NICHES } from "@shared/schema";

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

export async function searchTrendingTopics(nicheId?: NicheId): Promise<WebSearchResult> {
  const ai = await getGeminiClient();
  const niche = getNicheById(nicheId);
  
  const settings = await storage.getSettings();
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
  
  const usedTopicsContext = usedTopicsForNiche.length > 0 
    ? `\n\nCRITICAL - AVOID these already covered topics:\n${usedTopicsForNiche.slice(-30).map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";
  
  const nicheContext = niche 
    ? `Find the MOST INTERESTING, HIGH-ATTENTION trending topic in the "${niche.name}" niche. Focus on: ${niche.promptContext}. Keywords: ${niche.keywords.join(", ")}`
    : `Find the MOST INTERESTING, HIGH-ATTENTION trending topic in AI, technology, or productivity.`;

  const today = new Date().toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });

  const prompt = `Today is ${today}. You are an expert content strategist finding topics that INSTANTLY grab attention. ${nicheContext}

Search the internet for trending stories. Your goal is to find ONE topic that:
- Makes readers say "I NEED to read this!"
- Has a high curiosity or shock factor
- Is genuinely interesting, NOT boring or generic
- Feels current and urgent
- Will generate engagement (comments, shares)
${usedTopicsContext}

REJECT these types of topics:
- Boring industry updates
- Generic announcements
- Topics that sound promotional or like ads
- Vague trends with no specific story

PREFER these types of topics:
- Surprising discoveries or revelations
- Controversial stories with strong opinions
- Mysterious or unexplained events
- Human interest stories with emotional impact
- Specific events with clear details

Based on your web search, provide:
1. ONE specific, attention-grabbing topic (not generic, must instantly hook readers)
2. A detailed summary of what's happening (based on actual news/sources)
3. The sources you found (with real URLs and snippets)
4. Why this topic will grab attention
5. Key facts and statistics from your research
6. Relevant keywords

Respond in JSON format:
{
  "topic": "Specific, attention-grabbing topic title that makes people want to click",
  "summary": "Detailed 3-4 paragraph summary based on real sources you found",
  "sources": [{"title": "Article title", "url": "https://...", "snippet": "Key excerpt"}],
  "whyTrending": "What makes this topic so interesting - be specific about why it grabs attention",
  "facts": ["Fact 1 from research", "Fact 2 from research", "Fact 3 from research"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "searchQueries": ["search query used 1", "search query used 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    console.log("[WebSearch] Gemini response received, parsing...");
    
    try {
      const parsed = JSON.parse(text);
      return {
        topic: parsed.topic || `Trending in ${niche?.name || "Tech"}`,
        summary: parsed.summary || "Summary not available.",
        sources: parsed.sources || [],
        searchQueries: parsed.searchQueries || [],
        facts: parsed.facts || [],
        whyTrending: parsed.whyTrending || "This topic is generating significant interest.",
        keywords: parsed.keywords || (niche ? [...niche.keywords] : ["trending", "viral"]),
      };
    } catch (parseError) {
      console.error("[WebSearch] JSON parse failed, extracting data...");
      return {
        topic: `Trending Topic in ${niche?.name || "Technology"}`,
        summary: text.substring(0, 500),
        sources: [],
        searchQueries: [],
        facts: [],
        whyTrending: "Current trend based on web research.",
        keywords: niche ? [...niche.keywords] : ["trending"],
      };
    }
  } catch (error) {
    console.error("[WebSearch] Search failed:", error);
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function researchTopicForContent(topic: string, nicheId?: NicheId): Promise<{
  researchSummary: string;
  facts: string[];
  sources: { title: string; url: string; snippet: string }[];
  relatedTopics: string[];
  statistics: string[];
}> {
  const ai = await getGeminiClient();
  const niche = getNicheById(nicheId);
  
  const today = new Date().toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });

  const prompt = `Today is ${today}. Research this topic thoroughly: "${topic}"
${niche ? `Context: This is for a ${niche.name} blog.` : ""}

Search the web and gather:
1. Recent news and developments about this topic
2. Important facts, numbers, and statistics
3. Expert opinions or quotes
4. Related stories and context
5. What people are saying about this

Provide comprehensive research in JSON format:
{
  "researchSummary": "Detailed 4-5 paragraph summary of everything you found about this topic, including specific dates, names, and events",
  "facts": ["Specific fact 1 with numbers/dates", "Specific fact 2", "Specific fact 3", "Specific fact 4", "Specific fact 5"],
  "sources": [{"title": "Source title", "url": "https://...", "snippet": "Key quote or excerpt"}],
  "relatedTopics": ["Related topic 1", "Related topic 2", "Related topic 3"],
  "statistics": ["Statistic 1 with numbers", "Statistic 2 with numbers"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    
    try {
      const parsed = JSON.parse(text);
      return {
        researchSummary: parsed.researchSummary || "Research in progress.",
        facts: parsed.facts || [],
        sources: parsed.sources || [],
        relatedTopics: parsed.relatedTopics || [],
        statistics: parsed.statistics || [],
      };
    } catch {
      return {
        researchSummary: text.substring(0, 1000),
        facts: [],
        sources: [],
        relatedTopics: [],
        statistics: [],
      };
    }
  } catch (error) {
    console.error("[WebSearch] Research failed:", error);
    throw new Error(`Topic research failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
