import { storage } from "../storage";
import type { NicheId, ApiKey, InsertTrendingResearch } from "@shared/schema";
import { NICHES } from "@shared/schema";

const SERPER_API_URL = "https://google.serper.dev/search";

export interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  position?: number;
}

export interface SerperResponse {
  organic: SerperSearchResult[];
  searchParameters?: {
    q: string;
    type?: string;
    tbs?: string;
  };
}

export interface SerperResearchResult {
  topic: string;
  summary: string;
  sources: {
    title: string;
    url: string;
    snippet: string;
    publishDate?: string;
  }[];
  searchQueries: string[];
  whyTrending: string;
  keywords: string[];
  serperKeyUsed: string;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***" + key.slice(-4);
  return key.slice(0, 4) + "***" + key.slice(-4);
}

function getNicheById(nicheId?: string) {
  if (!nicheId) return null;
  return NICHES.find((n) => n.id === nicheId) || null;
}

function getTimeRangeParam(range: "today" | "24h" | "week" | "month" = "week"): string {
  switch (range) {
    case "today":
      return "qdr:d";
    case "24h":
      return "qdr:d";
    case "week":
      return "qdr:w";
    case "month":
      return "qdr:m";
    default:
      return "qdr:w";
  }
}

async function callSerperWithRotation(
  query: string,
  options: { timeRange?: "today" | "24h" | "week" | "month"; num?: number } = {}
): Promise<{ results: SerperResponse; keyUsed: string }> {
  const settings = await storage.getSettings();
  const allKeys = (settings.serperApiKeys || []).filter((k) => k.isActive);
  
  if (allKeys.length === 0) {
    throw new Error("No Serper API keys available. Please add a key in settings.");
  }
  
  let startIndex = (settings.currentSerperKeyIndex || 0) % allKeys.length;
  let attemptedKeys = 0;
  
  while (attemptedKeys < allKeys.length) {
    const currentIndex = (startIndex + attemptedKeys) % allKeys.length;
    const key = allKeys[currentIndex];
    
    try {
      console.log(`[Serper] Trying key ${key.name || maskKey(key.key)}... (${attemptedKeys + 1}/${allKeys.length})`);
      
      const response = await fetch(SERPER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": key.key,
        },
        body: JSON.stringify({
          q: query,
          tbs: getTimeRangeParam(options.timeRange || "week"),
          num: options.num || 10,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Serper] Key ${key.name || maskKey(key.key)} failed: ${response.status} - ${errorText}`);
        
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          attemptedKeys++;
          continue;
        }
        
        throw new Error(`Serper API error: ${response.status}`);
      }
      
      const data = await response.json() as SerperResponse;
      
      await storage.rotateSerperKeyIndex();
      
      return { results: data, keyUsed: maskKey(key.key) };
      
    } catch (error) {
      console.error(`[Serper] Key ${key.name || maskKey(key.key)} error:`, error);
      attemptedKeys++;
      
      if (attemptedKeys >= allKeys.length) {
        throw new Error(`All Serper API keys failed. Last error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }
  
  throw new Error("All Serper API keys exhausted");
}

export async function testSerperConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { results, keyUsed } = await callSerperWithRotation("test query", { num: 1 });
    
    if (results.organic && results.organic.length >= 0) {
      return { success: true, message: `Serper API connection verified successfully (Key: ${keyUsed})` };
    }
    
    return { success: false, message: "Unexpected response format" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Connection failed: ${message}` };
  }
}

export async function searchTrendingTopicsSerper(nicheId?: NicheId): Promise<SerperResearchResult> {
  const niche = getNicheById(nicheId);
  const settings = await storage.getSettings();
  
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
  
  const now = new Date();
  const today = now.toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
  
  const searchQueries: string[] = [];
  const allResults: SerperSearchResult[] = [];
  let keyUsed = "";
  
  const baseQuery = niche 
    ? `${niche.name} trending news ${today}`
    : `trending technology news ${today}`;
  
  const queries = niche 
    ? [
        `${niche.name} breaking news today`,
        `${niche.keywords[0]} latest trends 2024`,
        `${niche.keywords[1] || niche.keywords[0]} viral news`,
      ]
    : [
        "trending tech news today",
        "AI technology latest developments",
        "viral technology stories",
      ];
  
  for (const query of queries) {
    try {
      const { results, keyUsed: usedKey } = await callSerperWithRotation(query, { 
        timeRange: "week",
        num: 10 
      });
      
      keyUsed = usedKey;
      searchQueries.push(query);
      
      if (results.organic) {
        allResults.push(...results.organic);
      }
    } catch (error) {
      console.error(`[Serper] Query "${query}" failed:`, error);
    }
  }
  
  if (allResults.length === 0) {
    throw new Error("No search results found from Serper");
  }
  
  const uniqueResults = allResults.reduce((acc, result) => {
    if (!acc.find(r => r.link === result.link)) {
      acc.push(result);
    }
    return acc;
  }, [] as SerperSearchResult[]);
  
  let selectedResult = uniqueResults[0];
  for (const result of uniqueResults) {
    const isUsed = usedTopicsForNiche.some(
      used => result.title.toLowerCase().includes(used) || 
              used.includes(result.title.toLowerCase().slice(0, 30))
    );
    if (!isUsed) {
      selectedResult = result;
      break;
    }
  }
  
  const sources = uniqueResults.slice(0, 5).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    publishDate: r.date || today,
  }));
  
  const topic = selectedResult.title;
  const summary = `Based on current research from ${sources.length} sources (as of ${today} at ${timeString}), this topic is generating significant attention.

${selectedResult.snippet}

Additional context from related sources:
${sources.slice(1, 4).map(s => `- ${s.snippet}`).join("\n")}

This research was conducted using Serper.dev to ensure up-to-date, real-world data.`;
  
  const whyTrending = `This topic was found trending on ${today} based on searches for ${niche?.name || "technology"} news. The search returned ${uniqueResults.length} unique results with this topic appearing prominently.`;
  
  const keywords = niche 
    ? [...niche.keywords, "trending", "news", "viral"]
    : ["technology", "trending", "news", "AI", "viral"];
  
  return {
    topic,
    summary,
    sources,
    searchQueries,
    whyTrending,
    keywords,
    serperKeyUsed: keyUsed,
  };
}

export async function researchTopicWithSerper(
  topic: string, 
  nicheId?: NicheId
): Promise<{
  researchSummary: string;
  sources: { title: string; url: string; snippet: string; publishDate?: string }[];
  serperKeyUsed: string;
}> {
  const niche = getNicheById(nicheId);
  
  const now = new Date();
  const today = now.toLocaleDateString("en-US", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  
  const queries = [
    topic,
    `${topic} latest news`,
    `${topic} ${niche?.name || ""} analysis`,
  ].filter(Boolean);
  
  const allResults: SerperSearchResult[] = [];
  let keyUsed = "";
  
  for (const query of queries) {
    try {
      const { results, keyUsed: usedKey } = await callSerperWithRotation(query, {
        timeRange: "week",
        num: 8
      });
      
      keyUsed = usedKey;
      
      if (results.organic) {
        allResults.push(...results.organic);
      }
    } catch (error) {
      console.error(`[Serper] Research query "${query}" failed:`, error);
    }
  }
  
  const uniqueResults = allResults.reduce((acc, result) => {
    if (!acc.find(r => r.link === result.link)) {
      acc.push(result);
    }
    return acc;
  }, [] as SerperSearchResult[]);
  
  const sources = uniqueResults.slice(0, 6).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    publishDate: r.date || today,
  }));
  
  const researchSummary = `Research conducted on ${today} about "${topic}":

${sources.map((s, i) => `Source ${i + 1}: ${s.title}
${s.snippet}
`).join("\n")}

This comprehensive research was gathered from ${sources.length} verified sources using Serper.dev for real-time web search capabilities.`;

  return {
    researchSummary,
    sources,
    serperKeyUsed: keyUsed,
  };
}
