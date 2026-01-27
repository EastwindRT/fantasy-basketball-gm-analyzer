# Fantasy Basketball GM Analyzer

A comprehensive web application for analyzing and comparing General Manager (GM) performances in Yahoo Fantasy Basketball leagues across multiple seasons.

## Features

- **Multi-Season Analysis**: Analyze GM performance across multiple seasons
- **Comprehensive Statistics**:
  - Overall rankings and win-loss records
  - Player interactions (drafted, added, dropped, traded)
  - Category dominance analysis
  - Head-to-head records between GMs
  - Roster churn and activity metrics
  - Consistency scoring
  - Best/worst decision tracking
- **Interactive Visualizations**:
  - Ranking trends over seasons
  - Category dominance bar charts
  - Head-to-head heatmaps
- **Data Export**: Export analytics as CSV or PDF
- **OAuth 2.0 Authentication**: Secure integration with Yahoo Fantasy Sports API
- **Data Caching**: Efficient caching using IndexedDB to minimize API calls

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: Zustand
- **API Client**: Axios
- **Yahoo API Wrapper**: yahoo-fantasy (v4+) - Handles OAuth better and simplifies API interactions
- **PDF Export**: jsPDF with autoTable plugin

## Prerequisites

- Node.js 18+ and npm
- Yahoo Developer Account with Fantasy Sports API access

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd fantasy-basketball-gm-analyzer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Yahoo API Credentials

**Important**: There are TWO types of credentials:

1. **Developer Credentials (App-Level)** - These identify YOUR APPLICATION:
   - Go to [Yahoo Developer Network](https://developer.yahoo.com/fantasysports/guide/)
   - Create a new application to get your:
     - **Client ID** (Consumer Key)
     - **Client Secret** (Consumer Secret)
   - Set the redirect URI to: `https://localhost:3001/api/auth/callback` (for HTTPS local development)
   - Add these to `.env.local`:
     ```
     NEXT_PUBLIC_YAHOO_CLIENT_ID=your_client_id_here
     NEXT_PUBLIC_YAHOO_CLIENT_SECRET=your_client_secret_here
     ```
   - These credentials identify your app to Yahoo (like a license plate)

2. **User Credentials (User-Level)** - Each user logs in with their own Yahoo account:
   - When users click "Authenticate with Yahoo", they log in with THEIR OWN Yahoo account
   - This is separate from the developer credentials
   - Each user can access leagues that THEIR account has access to
   - For private leagues, users must log in with an account that is a member of that league

**⚠️ Security Note**: The current implementation uses `NEXT_PUBLIC_` prefix for demo purposes, which exposes the client secret in the browser. For production, you should:
- Remove `NEXT_PUBLIC_` prefix
- Use server-side API routes (see `app/api/auth/token/route.ts`)
- Store credentials securely on the backend

**💡 Using yahoo-fantasy Package**: This app includes the `yahoo-fantasy` npm package (v4+) which provides better OAuth handling and simplifies API interactions. If your Yahoo app is stuck in review, this package often works better than direct API calls. The package is used in server-side API routes (`app/api/yahoo/*`) to keep credentials secure.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Usage

1. **Authenticate**: Click "Authenticate with Yahoo" to authorize the application
2. **Enter League ID**: 
   - Format: `sport.l.league_number` (e.g., `nba.l.12345`)
   - You can find your league ID in the Yahoo Fantasy URL
3. **Specify Seasons** (Optional):
   - Enter comma-separated years (e.g., `2023,2024,2025`)
   - If blank, defaults to last 5 seasons
4. **Optional GM Filter**: Enter a specific GM username to focus on
5. **Analyze**: Click "Analyze League" to fetch and process data
6. **Explore**: 
   - View the dashboard with all GMs ranked
   - Click on any GM card to see detailed statistics
   - Use export buttons to download data as CSV or PDF

## Project Structure

```
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── callback/route.ts    # OAuth callback handler
│   │       └── token/route.ts       # Server-side token exchange
│   ├── globals.css                  # Global styles
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main page component
├── components/
│   ├── charts/
│   │   ├── CategoryDominanceChart.tsx
│   │   ├── HeadToHeadHeatmap.tsx
│   │   └── RankingTrendChart.tsx
│   ├── Dashboard.tsx                # Main dashboard view
│   ├── ErrorDisplay.tsx             # Error message component
│   ├── ExportButton.tsx             # Export functionality
│   ├── GMDetailView.tsx             # GM-specific detailed view
│   ├── InputForm.tsx                # League input form
│   └── LoadingSpinner.tsx           # Loading indicator
├── lib/
│   ├── data-cache.ts                # IndexedDB caching utilities
│   ├── data-processor.ts            # Data processing and analytics
│   ├── export-utils.ts              # CSV/PDF export functions
│   ├── store.ts                     # Zustand state management
│   └── yahoo-api.ts                 # Yahoo API integration
├── .env.local.example               # Environment variables template
├── next.config.js                   # Next.js configuration
├── package.json                     # Dependencies
├── tailwind.config.ts               # Tailwind configuration
└── tsconfig.json                    # TypeScript configuration
```

## API Endpoints Used

The application uses the following Yahoo Fantasy Sports API endpoints:

- `/leagues;league_keys={league_key}` - Get league information
- `/leagues;league_keys={league_key}/standings` - Get standings
- `/leagues;league_keys={league_key}/teams` - Get teams/GMs
- `/leagues;league_keys={league_key}/transactions` - Get transactions (drafts, trades, adds, drops)
- `/leagues;league_keys={league_key}/scoreboard` - Get matchups/scores
- `/leagues;league_keys={league_key}/settings` - Get league settings

## Data Caching

The application uses IndexedDB (with localStorage fallback) to cache API responses:
- **Regular data**: 1 hour cache duration
- **Historical data**: 24 hour cache duration

This reduces API calls and improves performance when re-analyzing the same leagues.

## Limitations & Known Issues

1. **Private Leagues**: Requires user authentication to access private leagues
2. **Rate Limiting**: Yahoo API has rate limits; the app includes basic error handling
3. **Incomplete Data**: Some historical data may be incomplete or unavailable
4. **Category Analysis**: Category dominance requires matchup data which may not be available for all league types
5. **Client Secret Exposure**: Current implementation exposes client secret in browser (see Security Note above)

## Production Deployment

For production deployment:

1. **Use Server-Side Token Exchange**: 
   - Remove `NEXT_PUBLIC_` prefix from environment variables
   - Use the server-side API route (`app/api/auth/token/route.ts`)
   - Update client code to call the API route instead of direct token exchange

2. **Secure Storage**: 
   - Use secure, httpOnly cookies for storing tokens
   - Never expose client secrets in client-side code

3. **Environment Variables**: 
   - Set environment variables in your hosting platform (Vercel, Netlify, etc.)
   - Never commit `.env.local` to version control

4. **Update Redirect URI**: 
   - Update OAuth redirect URI in Yahoo Developer Console to match your production domain

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Check the [Yahoo Fantasy Sports API Documentation](https://developer.yahoo.com/fantasysports/guide/)
- Review error messages in the browser console
- Ensure your API credentials are correctly configured

## Acknowledgments

- Yahoo Fantasy Sports API
- Next.js team
- Recharts for charting capabilities



