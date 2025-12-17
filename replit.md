# AI Blog Automator

An automated AI blogging platform that generates FOMO-driven content using Cerebras AI and Serper.dev for research, creates featured images with Pollinations AI, and auto-publishes to Blogger.com with X (Twitter) cross-posting.

## Overview

This platform is designed for multiple niches, automatically generating:
- Trending topic research via Serper.dev + Cerebras AI
- SEO-optimized blog posts with FOMO hooks
- Featured images using Pollinations AI (free)
- Automated publishing to Blogger.com
- Automatic cross-posting to X (Twitter) for connected accounts

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with Shadcn UI components
- **State Management**: TanStack Query for server state
- **Routing**: Wouter

### Backend (Express + Node.js)
- **API**: Express.js REST API
- **Storage**: File-based JSON storage in `/database` folder
- **Scheduling**: node-cron for automated posting
- **AI Services**: Cerebras AI (primary), Serper.dev (web research), Pollinations AI (images)

## Key Features

1. **Unlimited API Key Management**
   - Add multiple Gemini API keys with automatic rotation
   - Add multiple HuggingFace API keys with automatic rotation
   - Keys are stored locally in file-based storage

2. **Blogger Integration**
   - OAuth 2.0 connection using access tokens
   - Direct publishing via Blogger API v3
   - Supports blog ID and access token authentication

3. **Content Generation**
   - AI-powered trending topic research
   - FOMO-driven blog post generation
   - SEO-optimized titles and content
   - Automatic featured image generation

4. **Scheduling System**
   - Set unlimited daily posting times
   - Automatic execution at scheduled times
   - Timezone-aware scheduling

5. **Duplicate Prevention**
   - Tracks previously used topics
   - Ensures unique content generation

## File Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and providers
│   │   └── hooks/          # Custom hooks
├── server/                 # Backend Express application
│   ├── services/           # Business logic services
│   │   ├── gemini.ts       # Gemini AI integration
│   │   ├── huggingface.ts  # HuggingFace image generation
│   │   ├── blogger.ts      # Blogger API integration
│   │   └── scheduler.ts    # Cron-based scheduling
│   ├── routes.ts           # API route definitions
│   └── storage.ts          # File-based storage implementation
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Zod schemas and TypeScript types
├── database/               # Local file-based storage
│   ├── settings.json       # App settings and API keys
│   └── posts.json          # Post history
└── design_guidelines.md    # Frontend design specifications
```

## API Endpoints

### Settings
- `GET /api/settings` - Get app settings (keys are masked)
- `POST /api/settings/gemini-keys` - Add Gemini API key
- `DELETE /api/settings/gemini-keys/:id` - Remove Gemini API key
- `POST /api/settings/huggingface-keys` - Add HuggingFace API key
- `DELETE /api/settings/huggingface-keys/:id` - Remove HuggingFace API key
- `POST /api/settings/blogger` - Connect Blogger account
- `DELETE /api/settings/blogger` - Disconnect Blogger account
- `POST /api/settings/schedules` - Add schedule time
- `DELETE /api/settings/schedules/:id` - Remove schedule
- `PATCH /api/settings/schedules/:id/toggle` - Toggle schedule active state

### Posts
- `GET /api/posts` - Get all posts
- `GET /api/posts/:id` - Get single post
- `DELETE /api/posts/:id` - Delete post

### Generation & Publishing
- `POST /api/generate/topic` - Generate trending topic
- `POST /api/generate/post` - Generate blog post content
- `POST /api/publish/latest` - Publish latest draft post
- `POST /api/publish/:id` - Publish specific post

### Testing
- `POST /api/test/gemini` - Test Gemini API connection
- `POST /api/test/huggingface` - Test HuggingFace API connection

### Stats
- `GET /api/stats` - Get dashboard statistics

## How to Use

1. **Add API Keys**
   - Add your Gemini API key(s) from Google AI Studio
   - Optionally add HuggingFace API key(s) for image generation

2. **Connect Blogger**
   - Get your Blog ID from Blogger dashboard URL
   - Get OAuth access token from Google OAuth Playground
   - Connect using Blog ID and access token

3. **Generate & Publish**
   - Use "Generate & Publish Post" to create and post content
   - Choose automatic trending topic or enter custom topic

4. **Set Up Scheduling**
   - Add posting times for automatic daily publishing
   - Scheduler runs at specified times in your timezone

## Development

```bash
npm run dev     # Start development server
npm run build   # Build for production
```

## Technical Notes

- All data is stored locally in the `/database` folder
- No external database required
- API keys are rotated automatically per request
- Scheduler persists across server restarts
- Posts are tracked to prevent duplicate topics

## Known Limitations

### Blogger Token Expiry
- OAuth access tokens from Google OAuth Playground expire after 1 hour
- For long-term automated publishing, you'll need to refresh tokens periodically
- The app will notify you when tokens expire - simply disconnect and reconnect with a fresh token

### Image Generation
- HuggingFace free tier has rate limits
- If image generation fails, posts will be created without featured images
- Consider adding multiple HuggingFace API keys for higher throughput

## Pages

### Research Transparency Page
- Shows only the 10 most recent AI-generated and published posts
- Read-only view focused on transparency of what the AI has published
- Each entry shows: research topic, summary, niche, account name, publishing details
- Click on any post to view full details including content and blog URL
- No manual controls - posts only appear after the AI publishes them at scheduled times

## Recent Updates

### December 17, 2025 - WhatsApp Notifications via CallMeBot
- **CallMeBot Integration**: Added WhatsApp notifications using the free CallMeBot API
- **Instant Failure Alerts**: Get notified immediately when a scheduled blog post fails to publish
- **Daily Reports at 11:59 PM**: Receive automated daily activity summaries via WhatsApp
- **User-Friendly Setup Guide**: Comprehensive step-by-step instructions for CallMeBot activation
- **New WhatsApp Page**: Dedicated settings page with connection status, credentials management, and test functions
- **API Endpoints**: GET/POST `/api/whatsapp/settings`, POST `/api/whatsapp/test`, POST `/api/whatsapp/send-daily-report`
- **Storage**: WhatsApp settings stored in database/settings.json following existing pattern

### December 11, 2025 - Serper.dev Integration (Primary Research Tool)
- **Serper.dev API Integration**: All web research now uses Serper.dev exclusively instead of Gemini web search
- **Unlimited Serper API Keys**: Add multiple rotating Serper API keys with automatic rotation and failure handling
- **Time-Aware Searching**: Research queries include date context (today, 24h, week, month) for accurate trending topics
- **Enhanced Duplicate Prevention**: Topics are persisted immediately after research to prevent duplicates across all niches
- **Research Status Tracking**: Research logs now update from "generated" to "published" when posts are successfully published
- **Research Transparency Page**: Shows 10 most recent research logs with full details, sources, timestamps, and masked API keys
- **New Server Service**: Created server/services/serper.ts for centralized Serper.dev web search functionality

### December 11, 2025 - Tumblr OAuth Fix
- **Fixed Tumblr Cross-Posting**: Resolved OAuth 1.0 signature verification failures that caused 401 Unauthorized errors
- **Switched to NPF Format**: Changed from legacy `/post` endpoint to NPF (Neue Post Format) `/posts` endpoint
- **JSON-Based Requests**: NPF uses JSON Content-Type which doesn't require body params in OAuth signature calculation
- **Cross-Posting Now Working**: Both manual and scheduled publishing successfully cross-post to connected Tumblr blogs

### December 2024 - Web Search & Research Enhancement (Deprecated - Now using Serper.dev)
- **Real Web Search Before Publishing**: AI now browses the internet using Serper.dev for research before generating any blog posts
- **Research-Based Content**: Blog posts are now written using actual facts, statistics, and sources found from web research - not generic AI knowledge
- **Stronger No-Text Image Prompts**: Enhanced image generation prompts to completely eliminate text, words, letters, and typography from generated images
- **Improved Topic Uniqueness**: Added similarity scoring to prevent topics that are too similar to previously used topics (not just exact matches)
- **Banned AI Words**: Extensive list of AI-sounding words and phrases that are never used (delve, leverage, landscape, game-changing, etc.)
- **Natural Writing Style**: Specific guidelines for more natural, human-like writing with casual transitions and conversational tone
- **New WebSearch Service**: Created server/services/webSearch.ts for centralized web research functionality

### Previous Updates
- Simplified Research Transparency page to show only published posts (removed niche selection, research buttons, topic lists)
- Fixed scheduler to properly await async operations
- Added Switch toggle for schedule active/inactive state
- Added token expiry checking for Blogger publishing
- Improved error messages for failed operations
