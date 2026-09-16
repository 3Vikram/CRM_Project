# Quick Start - Backend Setup

## 5-Minute Setup

### 1. Install Backend Dependencies
```bash
cd backend
pnpm install
```

### 2. Create `.env` File
```bash
cd backend
```

Create file named `.env`:
```
MONGO_URI=mongodb://localhost:27017/3vikram-crm
PORT=5000
```

### 3. Start Backend
```bash
pnpm dev
```

You should see:
```
✓ Connected to MongoDB
✓ Server running on http://localhost:5000
```

### 4. Frontend Should Still Be Running
```bash
cd forntend
pnpm dev
```

### 5. Test It
1. Open http://localhost:3001/inventory/dashboard
2. You should see all metrics showing **0**
3. Empty states for movements and low stock

### 6. Try Sample Data (Optional)
```bash
cd backend
pnpm seed
```

Refresh the page to see sample data!

## Troubleshooting

**"Cannot connect to MongoDB"**
- Make sure MongoDB is running: `mongod` (local) or check Atlas credentials
- Verify MONGO_URI in `.env`

**"Cannot fetch data" in browser**
- Make sure backend is running on port 5000
- Check `http://localhost:5000/api/health` - should return `{"status":"ok"}`

**Still showing zeros after seeding**
- Clear browser cache: Ctrl+Shift+Delete
- Refresh page

---

See `INVENTORY_SETUP_GUIDE.md` for complete documentation.
