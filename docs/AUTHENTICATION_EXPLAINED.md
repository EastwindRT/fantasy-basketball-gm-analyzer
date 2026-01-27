# Authentication Explained

## Two Types of Credentials

### 1. Developer Credentials (App-Level)
- **What**: Client ID and Client Secret from Yahoo Developer Console
- **Where**: Stored in `.env.local` file
- **Purpose**: Identifies YOUR APPLICATION to Yahoo
- **Who uses it**: The application itself (server-side)
- **Example**: Like a license plate for your car - it identifies the vehicle, not the driver

### 2. User Credentials (User-Level)
- **What**: The Yahoo account username/password of the person using the app
- **Where**: User enters this during OAuth flow
- **Purpose**: Identifies which USER is accessing their fantasy leagues
- **Who uses it**: The end user (the person analyzing their league)
- **Example**: Like the driver's license - it identifies who is driving

## How They Work Together

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: App Setup (One Time)                          │
│  ────────────────────────────────────────────────────  │
│  Developer gets Client ID/Secret from Yahoo             │
│  Stores them in .env.local                              │
│  These NEVER change for your app                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: User Authentication (Each User)               │
│  ────────────────────────────────────────────────────  │
│  1. User clicks "Authenticate with Yahoo"              │
│  2. App redirects to Yahoo login (using Client ID)      │
│  3. USER enters THEIR OWN Yahoo username/password       │
│  4. Yahoo verifies the user's credentials              │
│  5. Yahoo gives app an access token for THAT USER      │
│  6. App can now access that user's leagues              │
└─────────────────────────────────────────────────────────┘
```

## Important Points

✅ **Developer credentials** (Client ID/Secret) are for YOUR app only
✅ **User credentials** are entered by EACH USER during OAuth
✅ **Different users** can use the same app with their own Yahoo accounts
✅ **Private leagues** are accessible only to users who are members

## Common Confusion

❌ **WRONG**: "I need to use the developer's Yahoo account"
✅ **CORRECT**: "Each user logs in with their own Yahoo account"

The developer credentials are just to identify your app to Yahoo. They don't give you access to any user's data. Each user must authenticate with their own Yahoo account to access their leagues.

## For Private Leagues

If you want to analyze a private league:
1. The app uses YOUR developer credentials (already set up)
2. YOU (the user) log in with YOUR Yahoo account that has access to that league
3. The app gets an access token for YOUR account
4. The app can now fetch data from leagues YOUR account can see

## Switching Accounts

If you need to analyze a league from a different Yahoo account:
1. Click "Switch Account"
2. Log in with the DIFFERENT Yahoo account
3. The app will now use that account's access token
4. You can access leagues that account can see


