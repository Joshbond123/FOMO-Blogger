import { storage } from "../storage";
import type { NicheId, ApiKey, InsertTrendingResearch } from "@shared/schema";
import { NICHES } from "@shared/schema";

const SERPER_API_URL = "https://google.serper.dev/search";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "llama-3.3-70b";

// Global topic lock to prevent duplicate topics across domains
// Stores both original source title and URL for accurate comparison
const topicLock = new Map<string, { timestamp: number; accountId: string; originalTitle: string; sourceUrl?: string }>();
const LOCK_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

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
  totalSourcesFound: number;
  topicCandidatesGenerated: number;
  nicheConfirmed: boolean;
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

// Clean up expired topic locks
function cleanupExpiredLocks(): void {
  const now = Date.now();
  const entries = Array.from(topicLock.entries());
  for (const [topic, lock] of entries) {
    if (now - lock.timestamp > LOCK_EXPIRY_MS) {
      topicLock.delete(topic);
    }
  }
}

// Check if a topic is locked by another domain - compares against original source title
function isTopicLocked(topic: string, currentAccountId?: string, sourceUrl?: string): boolean {
  cleanupExpiredLocks();
  const normalizedTopic = topic.toLowerCase().trim();
  
  const entries = Array.from(topicLock.entries());
  for (const [_, lock] of entries) {
    if (lock.accountId !== currentAccountId) {
      // Check URL match first (most accurate)
      if (sourceUrl && lock.sourceUrl && sourceUrl === lock.sourceUrl) {
        return true;
      }
      // Then check original title similarity
      const similarity = calculateTopicSimilarity(normalizedTopic, lock.originalTitle.toLowerCase());
      if (similarity > 0.5) {
        return true;
      }
    }
  }
  return false;
}

// Lock a topic for a specific account - returns false if already locked by another account
// Now stores original source title and URL for accurate comparison
function lockTopic(originalTitle: string, accountId: string, sourceUrl?: string): boolean {
  cleanupExpiredLocks();
  const normalizedOriginal = originalTitle.toLowerCase().trim();
  
  // Check if topic is already locked by another account (atomic check-and-set)
  const entries = Array.from(topicLock.entries());
  for (const [_, lock] of entries) {
    if (lock.accountId !== accountId) {
      // Check URL match first (most accurate)
      if (sourceUrl && lock.sourceUrl && sourceUrl === lock.sourceUrl) {
        console.log(`[Serper] Topic with URL "${sourceUrl}" already locked by account ${lock.accountId}, cannot lock for ${accountId}`);
        return false;
      }
      // Then check original title similarity
      const similarity = calculateTopicSimilarity(normalizedOriginal, lock.originalTitle.toLowerCase());
      if (similarity > 0.5) {
        console.log(`[Serper] Topic "${originalTitle}" already locked by account ${lock.accountId}, cannot lock for ${accountId}`);
        return false;
      }
    }
  }
  
  const lockKey = sourceUrl || normalizedOriginal;
  topicLock.set(lockKey, { 
    timestamp: Date.now(), 
    accountId, 
    originalTitle: normalizedOriginal,
    sourceUrl 
  });
  console.log(`[Serper] Topic locked for account ${accountId}: "${originalTitle}"`);
  return true;
}

// Calculate similarity between two topic strings
function calculateTopicSimilarity(str1: string, str2: string): number {
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

export async function searchTrendingTopicsSerper(nicheId?: NicheId, accountId?: string): Promise<SerperResearchResult> {
  const niche = getNicheById(nicheId);
  const settings = await storage.getSettings();
  
  const usedTopicsForNiche = nicheId && settings.usedTopicsByNiche[nicheId] 
    ? settings.usedTopicsByNiche[nicheId].slice(-100)
    : settings.usedTopics.slice(-100);
  
  // Also get globally used topics across all niches for cross-domain uniqueness
  const allUsedTopics = settings.usedTopics.slice(-200);
  
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
  
  // Enhanced niche-specific queries to fetch from up to 100 different sources
  // Using more varied and specific queries to get diverse results
  const queries = niche 
    ? [
        `${niche.name} viral story today ${now.getFullYear()}`,
        `${niche.name} shocking news this week`,
        `${niche.keywords[0]} breaking story today`,
        `${niche.keywords[1] || niche.keywords[0]} trending viral`,
        `most talked about ${niche.name} story`,
        `${niche.name} trending topic December 2024`,
        `${niche.keywords[2] || niche.keywords[0]} latest news`,
        `${niche.name} what everyone is talking about`,
        `${niche.keywords[0]} must read story`,
        `${niche.name} incredible discovery`,
        `${niche.keywords[3] || niche.keywords[0]} update news`,
        `${niche.name} amazing story this week`,
        `${niche.keywords[0]} you wont believe`,
        `${niche.name} experts surprised`,
        `${niche.keywords[1] || niche.keywords[0]} reveal shocking`,
      ]
    : [
        "viral tech story today",
        "shocking AI news this week",
        "most talked about technology story",
        "trending technology breakthrough",
        "incredible discovery technology",
        "AI tools everyone talking about",
        "tech news must read today",
        "technology update shocking",
      ];
  
  console.log(`[Serper] Starting enhanced search for ${niche?.name || "general"} niche with ${queries.length} queries...`);
  
  for (const query of queries) {
    try {
      const { results, keyUsed: usedKey } = await callSerperWithRotation(query, { 
        timeRange: "week",
        num: 10 // 10 results per query * 15 queries = up to 150 potential sources
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
  
  // Remove duplicates and keep up to 100 unique sources
  const uniqueResults = allResults.reduce((acc, result) => {
    if (!acc.find(r => r.link === result.link)) {
      acc.push(result);
    }
    return acc;
  }, [] as SerperSearchResult[]);
  
  const totalSourcesFound = uniqueResults.length;
  console.log(`[Serper] Found ${totalSourcesFound} unique sources from ${searchQueries.length} queries`);
  
  // Filter out already used topics and locked topics
  const unusedResults = uniqueResults.filter(result => {
    const titleLower = result.title.toLowerCase();
    
    // Check against used topics
    const isUsed = allUsedTopics.some(used => {
      const usedLower = used.toLowerCase();
      return titleLower.includes(usedLower) || 
             usedLower.includes(titleLower.slice(0, 30)) ||
             calculateTopicSimilarity(titleLower, usedLower) > 0.5;
    });
    
    // Check against locked topics (pass URL for accurate matching)
    const isLocked = isTopicLocked(result.title, accountId, result.link);
    
    return !isUsed && !isLocked;
  });
  
  console.log(`[Serper] ${unusedResults.length} topics available after filtering used/locked topics`);
  
  const candidateResults = unusedResults.length > 0 ? unusedResults : uniqueResults.slice(0, 50);
  
  // Take up to 100 candidates for AI selection
  const topCandidates = candidateResults.slice(0, 100);
  const topicCandidatesGenerated = topCandidates.length;
  
  console.log(`[Serper] Generated ${topicCandidatesGenerated} topic candidates for AI selection`);
  
  // Use Cerebras AI to select the MOST interesting, high-attention topic with random element
  // With retry logic to handle topic lock failures (race condition prevention)
  let selectedResult: { topic: string; snippet: string; whyInteresting: string; originalTitle: string; sourceUrl: string } | null = null;
  let attempts = 0;
  const maxAttempts = 5;
  let remainingCandidates = [...topCandidates];
  
  while (!selectedResult && attempts < maxAttempts && remainingCandidates.length > 0) {
    attempts++;
    const result = await selectBestTopicWithCerebras(
      remainingCandidates, 
      niche, 
      today, 
      allUsedTopics,
      accountId
    );
    
    // Try to lock the selected topic for this account using original title and URL
    if (accountId && result.originalTitle) {
      const lockAcquired = lockTopic(result.originalTitle, accountId, result.sourceUrl);
      if (lockAcquired) {
        selectedResult = result;
        console.log(`[Serper] Successfully locked topic on attempt ${attempts}: "${result.originalTitle}"`);
      } else {
        // Remove the exact URL and similar topics from candidates and try again
        console.log(`[Serper] Lock failed on attempt ${attempts}, trying different topic...`);
        remainingCandidates = remainingCandidates.filter(c => 
          c.link !== result.sourceUrl && 
          calculateTopicSimilarity(c.title.toLowerCase(), result.originalTitle.toLowerCase()) < 0.5
        );
      }
    } else {
      // No accountId means no locking needed
      selectedResult = result;
    }
  }
  
  // Fallback if all attempts fail - pick from remaining unlocked candidates
  if (!selectedResult) {
    console.log(`[Serper] All lock attempts failed after ${attempts} attempts`);
    
    // Find first unlocked candidate
    for (const candidate of remainingCandidates) {
      if (accountId) {
        const lockAcquired = lockTopic(candidate.title, accountId, candidate.link);
        if (lockAcquired) {
          selectedResult = {
            topic: createFOMOTitle(candidate.title, niche),
            snippet: candidate.snippet,
            whyInteresting: "Selected as fallback after lock conflicts.",
            originalTitle: candidate.title,
            sourceUrl: candidate.link
          };
          break;
        }
      }
    }
    
    // Last resort - try ALL original candidates to find one that can be locked
    if (!selectedResult) {
      console.log(`[Serper] Trying all ${topCandidates.length} original candidates for lock...`);
      for (const candidate of topCandidates) {
        if (accountId) {
          const lockAcquired = lockTopic(candidate.title, accountId, candidate.link);
          if (lockAcquired) {
            selectedResult = {
              topic: createFOMOTitle(candidate.title, niche),
              snippet: candidate.snippet,
              whyInteresting: "Selected from exhaustive search after lock conflicts.",
              originalTitle: candidate.title,
              sourceUrl: candidate.link
            };
            console.log(`[Serper] Found unlocked topic in exhaustive search: "${candidate.title}"`);
            break;
          }
        }
      }
    }
    
    // If still no result, throw error - cannot publish duplicate
    if (!selectedResult) {
      throw new Error(`All ${topCandidates.length} topic candidates are already locked by other domains. Cannot proceed without risking duplicate content.`);
    }
  }
  
  const sources = uniqueResults.slice(0, 10).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    publishDate: r.date || today,
  }));
  
  const topic = selectedResult.topic;
  const summary = `Based on current research from ${totalSourcesFound} sources (as of ${today} at ${timeString}), this topic is generating significant attention.

${selectedResult.snippet}

Additional context from related sources:
${sources.slice(1, 4).map(s => `- ${s.snippet}`).join("\n")}

This research was conducted using Serper.dev to ensure up-to-date, real-world data. All ${topicCandidatesGenerated} topic candidates were verified to match the ${niche?.name || "selected"} niche only.`;
  
  const whyTrending = selectedResult.whyInteresting || `This topic was found trending on ${today} based on searches for ${niche?.name || "technology"} news. The search returned ${uniqueResults.length} unique results with this topic appearing prominently.`;
  
  const keywords = niche 
    ? [...niche.keywords, "trending", "news", "viral"]
    : ["technology", "trending", "news", "AI", "viral"];
  
  console.log(`[Serper] Selected high-attention topic: "${topic}"`);
  console.log(`[Serper] Total sources: ${totalSourcesFound}, Candidates: ${topicCandidatesGenerated}, Niche: ${niche?.name || "general"}`);
  
  return {
    topic,
    summary,
    sources,
    searchQueries,
    whyTrending,
    keywords,
    serperKeyUsed: keyUsed,
    totalSourcesFound,
    topicCandidatesGenerated,
    nicheConfirmed: niche !== null,
  };
}

// Cerebras-powered topic selector with randomization for cross-domain uniqueness
async function selectBestTopicWithCerebras(
  candidates: SerperSearchResult[], 
  niche: { name: string; keywords: readonly string[]; promptContext: string } | null,
  today: string,
  usedTopics: string[],
  accountId?: string
): Promise<{ topic: string; snippet: string; whyInteresting: string; originalTitle: string; sourceUrl: string }> {
  
  if (candidates.length === 0) {
    return {
      topic: `Trending in ${niche?.name || "Technology"}`,
      snippet: "No specific trending topic found.",
      whyInteresting: "General interest topic.",
      originalTitle: "Fallback topic",
      sourceUrl: ""
    };
  }
  
  // Add randomization: shuffle candidates and pick from top portion
  const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);
  const randomSubset = shuffledCandidates.slice(0, Math.min(30, shuffledCandidates.length));
  
  if (randomSubset.length === 1) {
    return {
      topic: createFOMOTitle(randomSubset[0].title, niche),
      snippet: randomSubset[0].snippet,
      whyInteresting: "Top trending result.",
      originalTitle: randomSubset[0].title,
      sourceUrl: randomSubset[0].link
    };
  }
  
  // Use Cerebras to evaluate and select the best topic
  try {
    const settings = await storage.getSettings();
    const allKeys = settings.cerebrasApiKeys.filter((k) => k.isActive);
    
    if (allKeys.length === 0) {
      // Fallback to random selection if no Cerebras keys
      const randomIndex = Math.floor(Math.random() * randomSubset.length);
      const selected = randomSubset[randomIndex];
      return {
        topic: createFOMOTitle(selected.title, niche),
        snippet: selected.snippet,
        whyInteresting: "Randomly selected trending topic.",
        originalTitle: selected.title,
        sourceUrl: selected.link
      };
    }
    
    const key = allKeys[settings.currentCerebrasKeyIndex % allKeys.length];
    
    const candidateList = randomSubset.map((c, i) => 
      `${i + 1}. "${c.title}" - ${c.snippet}`
    ).join("\n");
    
    const usedTopicsContext = usedTopics.length > 0
      ? `\n\nAVOID THESE USED TOPICS (select something DIFFERENT):\n${usedTopics.slice(-20).map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";
    
    const prompt = `You are an expert content strategist. Today is ${today}.

NICHE: ${niche?.name || "General Technology"}
${niche ? `FOCUS AREAS: ${niche.promptContext}` : ""}

Below are ${randomSubset.length} potential trending topics found via web search. Your job is to:
1. Select ONE topic that will INSTANTLY grab readers' attention
2. Rewrite the title in SIMPLE, everyday English that anyone can understand
3. Make the title create FOMO (Fear of Missing Out) - readers should feel they'll miss something important if they don't read

CANDIDATES:
${candidateList}
${usedTopicsContext}

RULES FOR TITLE:
- Use SIMPLE words that a 12-year-old can understand
- Make readers feel "If I don't read this, I'll miss out!"
- Keep it under 15 words
- Be specific but accessible
- NO jargon, technical terms, or fancy words
- Examples of good FOMO titles:
  * "This Simple Trick Is Changing How People Save Money"
  * "Scientists Just Found Something Scary in the Ocean"
  * "Why Everyone Is Talking About This New AI Tool"
  * "The Truth About [Topic] That No One Tells You"

RULES FOR SELECTION:
- MUST match the ${niche?.name || "selected"} niche ONLY
- REJECT boring, generic, or weak topics
- REJECT topics that don't match the niche
- PREFER topics with: surprising facts, controversy, mystery, human interest, urgency
- PREFER specific stories over vague trends

Select ONE topic and respond in JSON:
{
  "selectedIndex": 1,
  "topic": "Your rewritten FOMO title in simple English",
  "whyInteresting": "1-2 sentences explaining why readers will feel they can't miss this"
}`;

    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key.key}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.8, // Higher temperature for more variety
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text);
    
    // Rotate Cerebras key
    await storage.rotateCerebrasKeyIndex();
    
    const selectedIndex = Math.max(0, Math.min((parsed.selectedIndex || 1) - 1, randomSubset.length - 1));
    const selectedCandidate = randomSubset[selectedIndex];
    
    return {
      topic: parsed.topic || createFOMOTitle(selectedCandidate.title, niche),
      snippet: selectedCandidate.snippet,
      whyInteresting: parsed.whyInteresting || "High-attention trending topic.",
      originalTitle: selectedCandidate.title,
      sourceUrl: selectedCandidate.link
    };
    
  } catch (error) {
    console.error("[Serper] Cerebras topic selection failed, using random selection:", error);
    // Fallback to random selection
    const randomIndex = Math.floor(Math.random() * randomSubset.length);
    const selected = randomSubset[randomIndex];
    return {
      topic: createFOMOTitle(selected.title, niche),
      snippet: selected.snippet,
      whyInteresting: "Trending topic selected randomly.",
      originalTitle: selected.title,
      sourceUrl: selected.link
    };
  }
}

// Create a FOMO-style title in simple English
function createFOMOTitle(originalTitle: string, niche: { name: string } | null): string {
  // Clean up the title
  let title = originalTitle
    .replace(/\s*[-|]\s*.*$/, "") // Remove site names after dash or pipe
    .replace(/^\d+\.\s*/, "") // Remove numbered prefixes
    .trim();
  
  // If title is too long, truncate it
  if (title.length > 80) {
    title = title.substring(0, 77) + "...";
  }
  
  return title;
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

// Export function to get topic lock status (for debugging/monitoring)
export function getTopicLockStatus(): Map<string, { timestamp: number; accountId: string }> {
  cleanupExpiredLocks();
  return new Map(topicLock);
}

// Export function to clear all locks (for testing)
export function clearAllTopicLocks(): void {
  topicLock.clear();
  console.log("[Serper] All topic locks cleared");
}
