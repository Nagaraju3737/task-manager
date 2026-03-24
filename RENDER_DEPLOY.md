## Render + MongoDB Atlas Setup

### 1) Get MongoDB Atlas connection string
1. Open Atlas and select your cluster.
2. Click **Connect** -> **Drivers**.
3. Choose **Node.js** and copy the connection string.
4. Replace `<username>`, `<password>`, and database name (example: `covey-matrix`).

Example format:

`mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/covey-matrix?retryWrites=true&w=majority&appName=<AppName>`

### 2) Atlas network access
- In Atlas, go to **Network Access** and allow Render IPs. For easiest setup, you can temporarily allow `0.0.0.0/0`.

### 3) Backend service on Render
1. Create a **Web Service** from this repo.
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `npm start`
4. Add environment variables:
   - `MONGODB_URI` = your Atlas URI
   - `PORT` = `10000` (optional, Render sets this automatically)
   - `FRONTEND_URL` = your frontend URL (after frontend is deployed)

### 4) Frontend service on Render
1. Create a **Static Site** from this same repo.
2. Set **Build Command**: `npm run build`
3. Set **Publish Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL` = your backend URL (example: `https://covey-api.onrender.com`)

### 5) Verify
- Backend health: `<backend-url>/api/health`
- App data API: `<backend-url>/api/state`
