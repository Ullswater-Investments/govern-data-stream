# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/30003625-5c07-4d59-864e-278d2db791dc

## 🚀 Quick Start (Developers)

### Prerequisites
- Docker & Docker Compose
- `jq` installed (`sudo apt install jq` or `brew install jq`)
- Node.js 18+ (for frontend)

### Backend Setup (FIWARE Stack)

1. **Start Docker containers:**
   ```bash
   docker-compose up -d
   ```

2. **Run automated setup script:**
   ```bash
   chmod +x setup_dev_env.sh
   ./setup_dev_env.sh
   ```
   
   This script will:
   - Configure Keyrock (OAuth2 Identity Manager)
   - Create service users and applications
   - Inject test data into Orion-LD Context Broker
   - Generate `.env.dev` with credentials

3. **Configure Supabase Edge Function:**
   - Open the generated `.env.dev` file
   - Copy the values to your Supabase project secrets:
     - `IDM_HOST`, `FIWARE_USER`, `FIWARE_PASS`, `FIWARE_HOST`

4. **(Optional) Expose local Docker to Lovable Cloud:**
   
   If developing with Lovable (cloud) and Docker running locally:
   ```bash
   ngrok http 1027
   ```
   
   Update `FIWARE_HOST` in Supabase with the ngrok URL.

### Frontend Development

```bash
npm install
npm run dev
```

**Important:** The frontend communicates with FIWARE **only** through the `fiware-proxy` Edge Function. Never make direct HTTP requests to FIWARE components.

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for detailed API documentation.

---

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/30003625-5c07-4d59-864e-278d2db791dc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/30003625-5c07-4d59-864e-278d2db791dc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
