# Design Guidelines: AI Blogging Automation Platform

## Design Approach

**System:** Linear-inspired minimal productivity interface with Material Design components for form elements
**Rationale:** This is a utility-focused dashboard tool requiring clarity, efficiency, and distraction-free workflows. Linear's clean aesthetic paired with Material's robust form patterns provides the perfect balance.

**Design Principles:**
1. Ruthless clarity - every element serves a functional purpose
2. Workflow efficiency - minimize clicks to core actions
3. Status transparency - always show system state (connected APIs, scheduled posts, etc.)

---

## Layout System

**Container Strategy:**
- Main dashboard: max-w-7xl centered with px-6 py-8
- Spacing primitives: Use Tailwind units of **2, 4, 6, 8, 16** (e.g., p-4, gap-6, mb-8)
- Card/panel spacing: p-6 for content areas, p-4 for compact sections
- Section gaps: space-y-8 for major sections, space-y-4 within sections

**Grid Structure:**
- Desktop: 2-column layout for API management sections (left: Gemini/HuggingFace, right: Blogger OAuth)
- Single column for scheduling interface and post history
- Responsive: stack to single column on mobile (< md breakpoint)

---

## Typography Hierarchy

**Fonts:**
- Primary: Inter or DM Sans (clean, modern sans-serif)
- Monospace: JetBrains Mono for API keys and technical data

**Scale:**
- Page title: text-3xl font-semibold
- Section headers: text-xl font-semibold
- Card titles: text-lg font-medium
- Body text: text-base
- Labels: text-sm font-medium
- Helper text: text-sm
- API keys/technical: text-sm font-mono

---

## Component Library

### Navigation
**Top Bar:**
- Fixed width container with logo/title on left
- Right side: connection status indicators (Gemini connected ✓, HuggingFace: 3 keys, Blogger: Connected)
- Height: h-16 with border-b

### Dashboard Cards
**API Management Cards:**
- Bordered panels with rounded-lg corners
- Header: icon + title + status badge
- Body: form inputs with labels above, helper text below
- Footer: action buttons (Save, Test Connection)
- Visual hierarchy: use border-l-4 accent on connected services

**API Key Input Pattern:**
- Label with character count if applicable
- Input field with font-mono for keys
- "Add Another Key" button for HuggingFace (inline, subtle)
- Remove icon (×) for each key in rotation list

### Scheduling Interface
**Time Picker Section:**
- Heading: "Publishing Schedule"
- Grid display of scheduled times (flex-wrap with gap-3)
- Each time: pill-shaped badge with time + remove icon
- "Add Time" button with time input (HH:MM format)
- Display timezone below schedule list

### Post History
**Table/List View:**
- Columns: Date/Time | Title | Status | Actions
- Alternating row backgrounds for readability
- Status badges: Published (success), Scheduled (info), Failed (error)
- Compact padding: py-3 px-4 per row
- Show 10 most recent, "Load More" at bottom

### Buttons
**Primary CTA (Test Post):**
- Large, prominent button: h-12 px-8 text-base font-semibold
- Positioned prominently after API setup sections
- Include icon (paper airplane or similar)

**Secondary Actions:**
- Standard height: h-10 px-4 text-sm
- Icon + text for actions (Save, Connect, Add, Remove)

**Destructive:**
- Used for Remove/Delete actions
- Outlined style with subtle treatment

### Form Inputs
**Text Fields:**
- Height: h-11
- Padding: px-4
- Border: 1px with rounded-md
- Focus states: ring treatment (ring-2 ring-offset-2)
- Error states: error border + error message text-sm below

**OAuth Connection:**
- Button: "Connect to Blogger" with Google icon
- Once connected: show connected blog name + "Disconnect" option
- Display blog ID in smaller, monospace font

### Status Indicators
**Connection Status:**
- Inline badges: rounded-full px-3 py-1 text-xs font-medium
- Icons: use checkmark for connected, × for disconnected, clock for pending

**Notifications/Alerts:**
- Toast-style for success/error messages (top-right positioning)
- Persistent alert boxes for important warnings (e.g., "No API keys configured")

---

## Page Sections (Top to Bottom)

1. **Header Bar** - Logo, title, status indicators
2. **Hero Section** - Brief tagline: "Automated AI Blogging for Blogger.com" with minimal description
3. **API Configuration** (2-column grid)
   - Google Gemini AI card
   - HuggingFace API card (with key rotation list)
   - Blogger OAuth card
4. **Test Post Section** - Large CTA button centered with description
5. **Scheduling Interface** - Time management with current schedule display
6. **Post History** - Table of recent/upcoming posts
7. **Footer** - Minimal: just database status ("Local storage: /database")

---

## Images

**No hero image required** - this is a functional dashboard, not a marketing page.

**Icon usage:**
- Use Heroicons throughout (solid for primary actions, outline for secondary)
- API provider logos: small icons next to Gemini, HuggingFace, Blogger headings (20×20px)

---

## Interaction Patterns

**Form Submission:**
- Inline validation on blur
- Success confirmation via toast notification
- Loading states: disable button + spinner

**API Key Rotation Display:**
- List each HuggingFace key with index number (#1, #2, #3...)
- "Currently using: Key #2" indicator during rotation
- Drag to reorder optional enhancement

**Scheduling:**
- Click "Add Time" opens inline time picker
- Times display in chronological order
- Today's completed posts shown in history with "Published" status

---

## Accessibility

- Consistent focus indicators across all interactive elements
- Label all form inputs (no placeholder-only inputs)
- ARIA labels for icon-only buttons
- Error messages programmatically linked to inputs
- Keyboard navigation for all workflows