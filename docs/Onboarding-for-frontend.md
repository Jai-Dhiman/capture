## Setup
### 1. Install Tools
Run these in the Command Line
```bash
# Node.js with version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

nvm install 20 && nvm use 20 && nvm alias default 20

# Git 
xcode-select --install

# pnpm (package manager)
npm install -g pnpm

# Expo CLI (React Native development)
npm install -g @expo/cli

# EAS CLI (Expo Application Services)
npm install -g eas-cli
```

### 2. Get the Code
```bash
git clone https://github.com/Jai-Dhiman/capture.git
cd capture
pnpm install
```

### 3. Setup Environment Variables
The app uses these environment variables:

In the frontend .env file:
```bash
API_URL="http://localhost:8787"
SHARE_URL="https://www.captureapp.org"
```

### 4. Start Development
```bash
# Start the Expo development server
pnpm run dev

# For specific platforms:
pnpm run ios     # iOS Simulator
pnpm run android # Android Emulator
pnpm run web     # Web browser
```

## Frontend Info
**Capture Mobile** - A React Native mobile app built with Expo:
- **React Native 0.76** with **Expo SDK 52**
- **TypeScript** for type safety
- **NativeWind** (Tailwind CSS for React Native) for styling
- **Apollo Client** + **GraphQL** for API communication
- **Zustand** + **Jotai** for state management
- **React Navigation** for navigation
- **Tanstack Query** for data fetching and caching

## Workflow

### Working on Features
```bash
# Create feature branch  
git checkout -b feat/what-you-built

# Code, test, commit
pnpm run dev    # develop with live reload
git add . && git commit -m "feat/what-you-built"

# Push and create Pull Request
git push origin feat/what-you-built
# Then create a Pull Request on GitHub
```

### GitHub Workflow
1. **Issues** - If you find a problem, go to the item on the Capture Dev Project Board, convert into an issue, and add a label (bug, question, help wanted, etc...)
2. **Pull Requests** - All changes go through code review

**Branch naming**: `feat/add-user-profile`, `bugfix/fix-navigation-bug`, etc..

## Key Commands
```bash
pnpm run dev      # Start Expo development server
pnpm run ios      # Run on iOS simulator
pnpm run android  # Run on Android emulator
pnpm run web      # Run in web browser
pnpm run web:dev  # Run web with HTTPS for development
```

## Project Structure
```
apps/mobile/src/
├── features/     # Feature-based modules (auth, feed, profile, etc.)
├── shared/       # Shared components, hooks, utils
├── navigation/   # Navigation configuration
├── App.tsx       # Main app component
├── index.ts      # Entry point
└── env.d.ts      # Environment variable types
```

## Development Setup

### iOS Development
```bash
# Install Xcode from Mac App Store
# Install iOS Simulator

# For physical device testing:
npx expo install --fix  # Fix any dependency issues
```

### Android Development
```bash
# Install Android Studio
# Setup Android SDK and emulator

# For physical device testing:
# Enable Developer Options and USB Debugging on your Android device
```

### Web Development
```bash
# Works out of the box with Metro bundler
pnpm run web
```

## VS Code Setup
Install these extensions:
- **Biome** (linting/formatting) - Make sure to set as default formatter
- **React Native Tools** (Microsoft)
- **Expo Tools** (Expo)
- **Tailwind CSS IntelliSense**
- **Pretty TypeScript Errors** - For better error messages

## Key Technologies

### Styling
- **NativeWind** - Tailwind CSS for React Native
- **Tailwind Config** in `tailwind.config.js`
- Global styles in `global.css`

### State Management
- **Zustand** - State management for complex state
- **Jotai** - Additional atomic state management mostly for ui
- **Apollo Client** - GraphQL state management

### Navigation
- **React Navigation v7** - Native stack navigation
- Deep linking configured in `app.json`
- Type-safe navigation with TypeScript

### Data Fetching
- **Tanstack Query** - REST API + GraphQL calls and caching
- **Jotai Tanstack Query** - Integration between Jotai and Tanstack Query

## Database Setup
```bash
# Navigate to server directory
cd apps/server

# Migrate the database
pnpm db:migrate
```

## Seed Local Database
```bash
# First, make sure your backend server is running
cd apps/server
pnpm run dev

# In apps/server, add a .dev.vars file with:
SEED_SECRET="Purple_Elephant"

# Then in a new terminal tab, make a POST request to seed the database
curl -X POST http://localhost:8787/seed \
  -H "x-seed-secret: Purple_Elephant" \
  -H "Content-Type: application/json"

# Alternative: Use a tool like Postman or another API tester
# POST to: http://localhost:8787/seed
# Header: x-seed-secret: Purple_Elephant
```

## Testing on Device

```bash
pnpm run dev
# Easiest is to open on web and then opening Responsive Design Mode from Web Console
# You can also test on ios or android simulators
```


## Useful Resources
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [React Navigation Documentation](https://reactnavigation.org/)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [Tanstack Query Documentation](https://tanstack.com/query/latest/docs/framework/react/overview)

### Dependencies Issues
```bash
# Fix Expo dependencies
npx expo install --fix

# Clean install
rm -rf node_modules && rm -rf pnpm-lock.yaml && pnpm install
```
