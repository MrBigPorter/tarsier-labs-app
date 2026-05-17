# AboutScreen Redesign Plan — Mobile Port from Web

## Current State vs Web State

### Web About Page Sections
1. **Hero** — Heart icon + gradient bg + title + subtitle
2. **Founder Profile** — Avatar with glow, stats row, name, role badge, bio, skill chips, GitHub/Email buttons
3. **Vision + Core Values** — Vision description text + 4 value cards in 2x2 grid
4. **Tech Stack** — 9 categorized groups with icon cards in grid
5. **Footer** — Logo + "Made with love" + Copyright

### Current Mobile AboutScreen
- Plain letter "T" icon + app name + tagline
- Simple link list (Website, Privacy, Terms, Contact)
- Description text box
- Flat tech table (5 items only)
- Copyright text

---

## Redesign Plan

### Section 1: Hero
Replace the letter "T" circle with:
- **App logo** (`require('@assets/logo.png')`) — 80x80, rounded corners
- **Title**: "Tarsier Labs" (bold, large)
- **Subtitle**: "Building the next-generation user experience platform"
- **Background**: subtle gradient or colored surface

### Section 2: Founder Profile
- **Avatar**: Use `AppImage` with `teamMembers[0].avatar` URL
  - 120x120 rounded, with border + shadow
  - Optional: green "online" dot overlay
- **Stats row**: 3 items horizontally
  - "10+" / "Years"
  - "50+" / "Projects"
  - "4" / "Stacks"
- **Name**: "Porter" (large bold)
- **Role badge**: "Full Stack Developer" with icon
- **Bio text**: "Creating elegant solutions for modern web apps"
- **Expertise chips**: Skills as rounded pills
- **Connect buttons**: GitHub + Email as horizontal buttons

### Section 3: Vision + Core Values
- **Vision title** + description text
- **Core Values**: 2x2 grid of cards
  - Innovation / Security / Performance / User Experience
  - Each with icon + title + description
  - Icons mapped: `heart`=Innovation, `shield`... wait, we don't have `rocket`, `shield`, `zap`, `sparkles` in SvgIcon.
  - Use available icons: `settings`=Innovation, `check`=Security, `clock`=Performance, `heart`=UX
  - Or use emoji: 🚀 🛡️ ⚡ ✨

### Section 4: Tech Stack
- 9 categories in `techStackGroups`
- Each category: title + description + items in 2-column grid
- Each item: emoji icon + name + description
- Categories: Frontend, Mobile, Backend, AI, DevOps, Monitoring, Communication, Design, i18n

### Section 5: Footer
- Logo + "Made with ❤️ in the Philippines"
- Copyright text

---

## Implementation Details

### New Dependencies Needed
- None — all UI built from existing components (`AppImage`, `SvgIcon`, etc.)

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/screens/AboutScreen.tsx` | **Rewrite** | Complete redesign with all sections |
| `plans/about-screen-redesign-plan.md` | Create | This plan file |

### Component Structure (in AboutScreen.tsx)

```
ScrollView
├── HeroSection
│   ├── Image (logo.png)
│   ├── Text "Tarsier Labs"
│   └── Text subtitle
│
├── FounderProfile
│   ├── AppImage (avatar URL)
│   ├── StatsRow (3 items)
│   ├── Text "Porter"
│   ├── RoleBadge (icon + "Full Stack Developer")
│   ├── Text bio
│   ├── SkillsRow (chips)
│   └── ContactRow (GitHub + Email buttons)
│
├── VisionSection
│   ├── Text vision title
│   ├── Text vision description
│   └── CoreValuesGrid (2x2)
│       ├── Value cards with icon + title + desc
│       └── ...
│
├── TechStackSection
│   ├── Text title
│   ├── Text description
│   └── For each category:
│       ├── Category title
│       ├── Category description
│       └── TechGrid (2 columns)
│           └── Tech cards with emoji + name + desc
│
└── FooterSection
    ├── Image (logo.png, small)
    ├── Text "Made with ❤️"
    └── Text copyright
```

### Data Structures (inline, no API)

```typescript
const teamMembers = [
  {
    name: 'Porter',
    roleKey: 'Full Stack Developer',
    avatar: 'https://img.joyminis.com/Gemini_Generated_Image_l8u1b7l8u1b7l8u1.png',
    github: 'https://github.com/MrBigPorter',
    skills: ['TypeScript', 'React', 'Node.js', 'Flutter', 'DevOps'],
  },
];

const techStackGroups = [...]; // Same data as Web version

const coreValues = [
  { icon: '🚀', key: 'Innovation', title: 'Innovation Driven', desc: 'Explore new tech for better UX' },
  { icon: '🛡️', key: 'Security', title: 'Safe and Reliable', desc: 'Data security and system stability' },
  { icon: '⚡', key: 'Performance', title: 'High Performance', desc: 'Optimized code for fast response' },
  { icon: '✨', key: 'UserExperience', title: 'User Experience', desc: 'Simple and elegant interfaces' },
];
```

### Icons Mapping (Web → Mobile)

| Web (lucide-react) | Mobile (emoji) | Use |
|--------------------|----------------|-----|
| `Heart` | ❤️ | Hero section icon |
| `Rocket` | 🚀 | Innovation value / role badge |
| `Shield` | 🛡️ | Security value |
| `Zap` | ⚡ | Performance value |
| `Sparkles` | ✨ | UX value / founder section icon |
| `Code2` | 💻 | Tech stack section icon |
| `Github` | GitHub button | Contact |
| `Mail` | Email button | Contact |

### Styling Notes

- Use `colors.surface` for card backgrounds
- Use `colors.primary` with opacity (e.g., `+ '20'`) for subtle backgrounds
- Use `colors.border` for card borders
- Border radius: 12-16px for cards, rounded-full for pills
- Shadow/elevation for depth
- Use `StyleSheet.hairlineWidth` for thin borders

---

## Execution Order

1. Rewrite `src/screens/AboutScreen.tsx` with complete new design
2. Verify TypeScript compilation
3. Run app and verify UI

---

## Visual Comparison

| Web | Mobile (Current) | Mobile (Planned) |
|-----|-----------------|------------------|
| Hero with Heart icon + gradient | Letter "T" in circle + plain text | Logo + bold text + colored bg |
| Founder avatar with glow | — | Rounded avatar + shadow + online dot |
| Stats row (3 columns) | — | Horizontal stat cards |
| Role badge with icon | — | Badge with 🚀 icon |
| Skills as gradient pills | — | Rounded chips |
| Contact buttons with gradient | Plain link rows | Gradient buttons |
| Vision + 4 value cards | Simple description box | Vision text + 2x2 value cards |
| Tech stack categorized grid | Flat 5-item table | 9 categorized groups, 2-col grid |
| Footer with logo + made with love | Simple copyright | Logo + "Made with ❤️" + copyright |
