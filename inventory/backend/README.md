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

3. Update `.env` with your MongoDB connection string and a unique `INVENTORY_AUTH_SECRET` of at least 32 characters. The administrator email and password are stored in SQLite, not `.env`.
```
MONGO_URI=mongodb://localhost:27017/3vikram-crm
PORT=5000
INVENTORY_AUTH_SECRET=<generate-a-random-secret-locally>
```

4. From the project root, install dependencies and initialize the local Inventory database:
```powershell
npm install --prefix inventory\backend
npm --prefix inventory\backend run db:init
```

Initialization creates missing tables without dropping existing Inventory data and creates or updates the bcrypt-hashed demo administrator:

- Email: `admin@synov.in`
- Password: `admin123`

The demo password is for local development only. Use a stronger password before real deployment. The local `database\inventory.db` is ignored by Git; a clone creates its own database by running the initializer.

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
