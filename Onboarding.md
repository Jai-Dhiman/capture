## Setup
### 1. Install Tools
Run these in the Command Line
```bash
# Node.js with version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

nvm install 20 && nvm use 20 && nvm alias default 20

# Git 
xcode-select --install

# Wrangler CLI (Cloudflare Workers)
npm install -g wrangler

# pnpm (package manager)
npm install -g pnpm
```

### 2. Get the Code
```bash
git clone https://github.com/Jai-Dhiman/capture.git
cd capture/apps/server
pnpm install
```

### 3. Create DB
```bash
# Navigate to server 
cd apps/server

# Create the drizzle migration
pnpm db:generate 

# Migrate 
pnpm db:migrate
```

### 4. Check Health
```bash
pnpm run dev

# Open a browser to https://localhost:8787

# It should say "status": "ok"
```

## Backend Info
**capture-api** - A serverless Cloudflare Worker backend that powers Capture:
- **Hono.js** (Node.js framework built for workers)
- **GraphQL + REST** APIs for mobile app and dashboard
- **Cloudflare D1** database (serverless SQLite, used for both app and dashboard)

## Workflow

### Working on Features
```bash
# Create feature branch  
git checkout -b feat/what-you-built

# Code, test, commit
pnpm run dev    # develop
pnpm run test   # test your changes
git add . && git commit -m "feat/what-you-built"

# Push and create Pull Request
git push origin feat/what-you-built
# Then create a Pull Request on GitHub
```

### GitHub Workflow
1. **Issues** - If you find a problem, go to the item on the Capture Dev Project Board, convert into an issue, and add a label (bug, question, help wanted, etc...)
2. **Pull Requests** - All changes go through code review

**Branch naming**: `feat/add-user-auth`, `bugfix/fix-cors-issue`, etc..

## Key Commands
```bash
pnpm run dev      # Start development server
pnpm run test     # Run tests
pnpm run deploy   # Deploy to production
```

## Project Structure
```
apps/server/src/
├── db/         # Database stuff
├── graphql/    # GraphQL schema and resolvers
├── lib/        # Library utils
├── middleware/ # Auth, error, etc.
├── routes/     # API endpoints
├── test/       # Testing Setup (Vitest)
├── types/      # Shared types
└── index.ts    # Main entry point
```

## VS Code Setup
Install these extensions:
- **Biome** (linting/formatting) (Make sure to make biome your default linter and formatter)
- **Postman** (API testing)

## Environment Variables
Ask for the `.dev.vars` file - it has all the API keys and secrets you need.
(Never add or commit these api keys to git)

## Useful Resources
- [Hono.js Docs](https://hono.dev/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## Projects
There are basically 2 projects you can choose from:

Using Typescript and YAML:
-[CI/CD pipelines](CI-CD-Context-Doc.md)

Using Python:
-[UMAP analysis to assign themes to vector clusters](UMAP-Analysis-Doc.md)
