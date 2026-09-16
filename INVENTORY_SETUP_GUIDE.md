# Inventory Overview - Real Data Implementation Guide

## Overview

The Inventory Overview page has been converted from **fake/demo data** to a **real dynamic dashboard** that fetches data from MongoDB via a REST API.

## Architecture

```
MongoDB Database
        ↓
Backend API (Express.js)
  - /api/inventory/stats
  - /api/inventory/movements
  - /api/inventory/low-stock
  - /api/inventory/quick-summary
        ↓
Frontend (React + TypeScript)
        ↓
Inventory Overview Dashboard
```

## Files Created

### Backend
- `backend/package.json` - Backend dependencies and scripts
- `backend/src/server.js` - Express server setup with MongoDB
- `backend/src/models/Asset.js` - Mongoose schema for inventory assets
- `backend/src/models/AssetMovement.js` - Mongoose schema for asset movements
- `backend/src/routes/inventory.js` - API endpoints for Inventory Overview
- `backend/.env.example` - Environment variables template
- `backend/README.md` - Backend documentation
- `backend/seed.js` - Database seeding script for testing

### Frontend
- `forntend/src/hooks/useInventoryData.ts` - Hook to fetch inventory data from API
- `forntend/src/components/empty-state.tsx` - Reusable empty state component
- `forntend/.env` - Frontend environment variables (API URL)
- `forntend/.env.example` - Template for environment variables

## Files Modified

### Frontend
- `forntend/src/pages/InventoryOverviewPage.tsx` - Now fetches real data, shows zeros initially
- `forntend/src/components/asset-movement-table.tsx` - Added empty state support
- `forntend/src/components/low-stock-alerts.tsx` - Added empty state support

## How It Works

### Initial State (No Data)
When the application first opens and there's no inventory data:

```
All Assets         0
In Stock           0
Outwarding         0
Rent Out           0
Sold Out           0
Returned           0
Damaged / Lost     0
Total Asset Value  £0.00
```

Recent Asset Movement shows:
```
"No asset movement yet"
"Your inward, outward, rental and return activity will appear here."
```

Low Stock Alerts shows:
```
"No low stock alerts"
"You're all caught up. Products below their minimum stock level will appear here."
```

### How Statistics Are Calculated

| Metric | Calculation |
|--------|-------------|
| **All Assets** | SUM(quantity) of all assets where status is active |
| **In Stock** | SUM(quantity) where status = 'available' |
| **Outwarding** | SUM(quantity) where status = 'outwarding' |
| **Rent Out** | SUM(quantity) where status = 'rented' |
| **Sold Out** | SUM(quantity) where status = 'sold' |
| **Returned** | COUNT of movements where type = 'RETURNED' (last 30 days) |
| **Damaged/Lost** | SUM(quantity) where status = 'damaged' OR 'lost' |
| **Total Asset Value** | SUM(price × quantity) of all assets |

### Asset Status Values
- `available` - In stock, ready for use
- `outwarding` - Being sent out
- `rented` - Currently rented to customer
- `sold` - Sold and no longer in inventory
- `damaged` - Damaged and not usable
- `lost` - Lost/missing

### Movement Types
- `INWARD` - Assets received
- `OUTWARD` - Assets sent out
- `RENT_OUT` - Assets rented to customer
- `RETURNED` - Assets returned
- `SOLD` - Assets sold
- `DAMAGED` - Assets marked as damaged
- `LOST` - Assets marked as lost
- `TRANSFER` - Assets transferred between locations

## Setup & Testing

### Step 1: Install Backend Dependencies

```bash
cd backend
pnpm install
```

### Step 2: Configure MongoDB

Create `.env` file in backend folder:

```
MONGO_URI=mongodb://localhost:27017/3vikram-crm
PORT=5000
```

For MongoDB Atlas, use:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/3vikram-crm
```

### Step 3: Start Backend Server

```bash
cd backend
pnpm dev
```

Expected output:
```
✓ Connected to MongoDB
✓ Server running on http://localhost:5000
```

### Step 4: Test Empty State

1. Frontend is still running on http://localhost:3001
2. Navigate to http://localhost:3001/inventory/dashboard
3. See all metrics showing **0** with attractive empty states

### Step 5: Seed Sample Data (Optional)

To test with sample data, run:

```bash
cd backend
pnpm seed
```

This creates:
- **3 assets**: 10 Dell laptops, 3 HP monitors, 2 Cisco switches
- **2 movements**: 1 inward, 1 outward
- **Low stock alerts**: HP monitors (3 available, 5 minimum)

After seeding, refresh http://localhost:3001/inventory/dashboard to see:
- All Assets: 15
- In Stock: 15
- Outwarding: 0
- Rent Out: 0
- Sold Out: 0
- Total Asset Value: £1,337,000.00
- Recent movements appear in table
- HP Monitor appears in Low Stock Alerts

### Step 6: Data Flow Verification

1. **Backend API Test**: http://localhost:5000/api/inventory/stats
2. **Frontend Request**: Browser Developer Tools → Network tab
3. **See the data fetching** when page loads

## Important Notes

### About Zero Values
- **DO NOT** hide zero values
- Show them prominently to indicate empty state
- Empty state messages help users understand what to do next

### About Empty States
- Recent Asset Movement shows a helpful empty message
- Low Stock Alerts shows a positive, encouraging empty message
- Both include relevant action guidance

### Real Data Requirement
- The page ONLY shows data that exists in the database
- No hardcoded numbers or fake values
- If database is empty, all numbers are 0

### API Error Handling
- If backend is not running, page shows zeros
- Network errors gracefully default to empty state
- Check browser console for debugging

## Testing Checklist

- [ ] Backend running on http://localhost:5000
- [ ] Frontend running on http://localhost:3001
- [ ] MongoDB connected and accessible
- [ ] http://localhost:5000/api/health returns `{"status":"ok"}`
- [ ] Inventory Overview page loads without errors
- [ ] All statistics show 0 on initial load
- [ ] Empty states are visible and professional
- [ ] (Optional) Seed data, refresh page, verify numbers update
- [ ] (Optional) Check browser Network tab for API calls

## Debugging

### Backend won't connect to MongoDB
```bash
# Check if MongoDB is running
# Local: mongod --dbpath /path/to/data
# Atlas: Verify connection string in .env
# Check network access in MongoDB Atlas settings
```

### Frontend showing "Failed to fetch data" errors
```bash
# Check VITE_API_URL in forntend/.env
# Verify backend is running
# Check browser console for CORS errors
# Open http://localhost:5000/api/health in browser
```

### Empty state not showing
- Check that movements array is truly empty
- Verify browser console shows no errors
- Clear browser cache and refresh

## What's NOT Changed

✅ **NOT changed:**
- Login/Authentication system
- Sales module
- Accounts module
- Existing CRM functionality
- Visual design/UI layout of Overview

## Next Steps

Once initial data is in the database, you can:
1. Build Inwarding page (to add assets)
2. Build Outwarding page (to send assets)
3. Build All Assets page (to manage inventory)
4. Build other Inventory sub-pages
5. Connect to real MongoDB Atlas

Each page should follow the same pattern:
1. Create API endpoints
2. Create hooks to fetch data
3. Create React components
4. Wire up real data sources
