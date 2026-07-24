# 🏪 Ehsas Store — Inventory Manager

A playful, pink-powered inventory management app for **Ehsas Store** built with vanilla JavaScript and GitHub as the data backend.

## ✨ Features

- **📊 Dashboard** — Overview of total products, revenue, stock levels, and low-stock alerts
- **📦 Product Management** — Full CRUD with name, price, category, stock, images, tags, and notes
- **🏷️ Categories** — Organize products with custom color-coded categories
- **💰 Sales Tracking** — Log sales, track revenue, monthly stats
- **🔍 Search & Filter** — Find products instantly by name, category, or status
- **📤 Export** — Download inventory as CSV for spreadsheets
- **🔐 PIN Protection** — Simple password protection with changeable PIN
- **📱 Responsive** — Works beautifully on both mobile and desktop
- **💾 GitHub Sync** — All data stored in a JSON file in your GitHub repo

## 🚀 Setup Guide

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Create a **private** repository (e.g., `ehsas-store-inventory`)
3. Note your **username** and **repo name**

### Step 2: Get a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name like "ehsas-store-inventory"
4. Select scope: **`repo`** (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token now** — it starts with `ghp_...`

### Step 3: Configure the App

Open **`js/config.js`** and update these values:

```js
const CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',    // ← Your GitHub username
  repo: 'YOUR_REPO_NAME',           // ← Your repo name (e.g., "ehsas-store-inventory")
  token: 'ghp_xxxxxxxxxxxxxxxx',    // ← Your GitHub token from Step 2
  defaultPin: '1234',               // ← Change this after first login!
};
```

### Step 4: Push to GitHub

```bash
# Initialize git repo
git init
git add .
git commit -m "Initial commit — Ehsas Store inventory manager"

# Add your remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 5: Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under "Branch", select **`main`** and root `/`
3. Click **Save**
4. Wait a minute — your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### Step 6: Login!

1. Open the GitHub Pages URL
2. Enter the default PIN: **`1234`**
3. **Change your PIN** in Settings immediately!

## 📱 Usage Tips

- **Add products** via the Products view → "Add Product" button
- **Log sales** via the Sales view → "Log Sale" button
- **Data auto-syncs** to GitHub — every change saves automatically after 3 seconds
- **Use the "Sync Now" button** in Settings for an immediate save
- **Images**: Paste any public image URL (or leave blank for no image)
- **Tags**: Comma-separated, e.g., `summer, new, trending`

## 🔒 Security Notes

- The GitHub token is visible in the frontend code — this is by design for a personal single-user app
- Use a **private repo** and a **token with minimal scope**
- The PIN adds a layer of access control on top
- Change the default PIN immediately after first login

## 🛠️ Tech Stack

- Vanilla HTML/CSS/JS (no frameworks)
- GitHub REST API (Contents API)
- Web Crypto API (SHA-256 PIN hashing)
- Google Fonts (Poppins, Playfair Display, Dancing Script)
- GitHub Pages (hosting)
