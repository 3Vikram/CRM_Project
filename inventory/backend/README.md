# 3Vikram Inventory Backend

Simple Express.js + MongoDB backend for the Inventory Management module.

## Setup

### Prerequisites
- Node.js v16+
- MongoDB (local or Atlas)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your MongoDB connection string:
```
MONGO_URI=mongodb://localhost:27017/3vikram-crm
PORT=5000
```

### Running

Development mode (with hot reload):
```bash
pnpm dev
```

Production mode:
```bash
pnpm start
```

## API Routes

### `/api/inventory/stats` (GET)
Returns inventory statistics:
- `allAssets` - Total quantity of all assets
- `inStock` - Assets available in stock
- `outwarding` - Assets being sent out
- `rentOut` - Assets currently rented
- `soldOut` - Assets that have been sold
- `returned` - Count of returned assets (last 30 days)
- `damagedLost` - Assets damaged or lost
- `totalAssetValue` - Total value of inventory

### `/api/inventory/movements` (GET)
Returns recent asset movements (default: last 5)

Query params:
- `limit` - Number of movements to return

### `/api/inventory/low-stock` (GET)
Returns assets below minimum stock level

### `/api/inventory/quick-summary` (GET)
Returns today's activity summary:
- `todayInward` - Assets received today
- `todayOutward` - Assets sent out today
- `dueReturns` - Outstanding returns
- `overdueRentals` - Overdue rental returns

## MongoDB Collections

### `assets`
```javascript
{
  name: String,
  description: String,
  category: String,
  sku: String,
  serialNumber: String,
  quantity: Number,
  status: ['available', 'outwarding', 'rented', 'sold', 'damaged', 'lost'],
  price: Number,
  minStockLevel: Number,
  location: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `assetmovements`
```javascript
{
  assetId: ObjectId,
  assetName: String,
  type: ['INWARD', 'OUTWARD', 'RENT_OUT', 'RETURNED', 'SOLD', 'DAMAGED', 'LOST', 'TRANSFER'],
  quantity: Number,
  description: String,
  performedBy: String,
  reference: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Integration

The frontend connects to this backend via `VITE_API_URL` environment variable (default: http://localhost:5000).

See the frontend `.env` file to configure the API endpoint.
