# PixelMatch: AI-Powered Design Comparison Tool

PixelMatch helps design teams ensure pixel-perfect implementation by comparing design mockups with website screenshots using advanced AI vision analysis.

## Features

- **Advanced AI Analysis**: Automatically detect visual discrepancies between design mockups and website implementations
- **Multi-Provider Support**: Uses both OpenAI and Anthropic for visual comparison
- **Detailed Reports**: Generate professional reports with highlighted discrepancies
- **Project Management**: Organize comparisons by project with team collaboration
- **Authentication**: Secure login with email/password or GitHub OAuth
- **Responsive Interface**: Beautiful UI built with React, Tailwind CSS, and shadcn/ui

## AI-Powered Analysis

PixelMatch leverages two powerful AI providers for visual comparison:

### OpenAI Integration

The application uses OpenAI's GPT-4o model with vision capabilities to:
- Analyze and detect visual differences between design mockups and website screenshots
- Classify discrepancies by type (color, size, typography, position, layout, other)
- Prioritize issues based on impact (high, medium, low)
- Generate comprehensive summaries of detected issues

### Anthropic Integration

As an alternative, PixelMatch can use Anthropic's Claude 3.7 Sonnet model to:
- Perform similar visual comparison and discrepancy detection
- Provide an alternative analysis perspective
- Serve as a fallback if one provider is unavailable

### Configuring AI Providers

You can select which AI provider to use by setting the `AI_PROVIDER` environment variable:
- `AI_PROVIDER=openai` - Use OpenAI (default)
- `AI_PROVIDER=anthropic` - Use Anthropic

Both providers require API keys to be set as environment variables:
- `OPENAI_API_KEY` - Your OpenAI API key
- `ANTHROPIC_API_KEY` - Your Anthropic API key

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `OPENAI_API_KEY` - OpenAI API key
   - `ANTHROPIC_API_KEY` - Anthropic API key (optional)
   - `AI_PROVIDER` - "openai" or "anthropic" (defaults to "openai")
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - For GitHub OAuth
4. Start the development server: `npm run dev`

## Authentication Options

- **Email/Password**: Standard registration and login
- **GitHub OAuth**: Single-click sign-in with GitHub account

## Project Structure

- `server/` - Express.js backend
  - `services/` - Core functionality including AI services
  - `routes.ts` - API endpoints
  - `storage.ts` - Data access layer
- `client/src/` - React frontend
  - `components/` - Reusable UI components
  - `pages/` - Main application pages
  - `hooks/` - Custom React hooks

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, React Query
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o, Anthropic Claude 3.7
- **Authentication**: Passport.js with GitHub OAuth

## License

MIT