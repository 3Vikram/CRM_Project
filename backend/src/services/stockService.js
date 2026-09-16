import { Asset } from '../models/Asset.js'
import { Product } from '../models/Product.js'

export const getStockSummary = async () => {
  try {
    const assets = await Asset.find({}).select('productName productModel quantity availableQuantity status price vendorName')

    // Group by product name and status
    const stockByProduct = {}

    for (const asset of assets) {
      const productName = asset.productName || 'Unknown Product'

      if (!stockByProduct[productName]) {
        stockByProduct[productName] = {
          productName,
          productModel: asset.productModel || '',
          vendor: asset.vendorName || '',
          unitPrice: asset.price || 0,
          inStock: 0,
          rented: 0,
          sold: 0,
          returned: 0,
          damaged: 0,
          lost: 0,
          total: 0,
        }
      }

      const status = String(asset.status || '').toLowerCase()
      const quantity = asset.quantity || 0

      if (status === 'available' || status === 'in_stock') {
        stockByProduct[productName].inStock += quantity
      } else if (status === 'rented' || status === 'rent_out') {
        stockByProduct[productName].rented += quantity
      } else if (status === 'sold') {
        stockByProduct[productName].sold += quantity
      } else if (status === 'returned') {
        stockByProduct[productName].returned += quantity
      } else if (status === 'damaged') {
        stockByProduct[productName].damaged += quantity
      } else if (status === 'lost') {
        stockByProduct[productName].lost += quantity
      }

      stockByProduct[productName].total += quantity
    }

    // Convert to array and sort
    const stockData = Object.values(stockByProduct).sort((a, b) => a.productName.localeCompare(b.productName))

    // Calculate totals
    const summary = {
      totalProducts: stockData.length,
      totalQuantity: stockData.reduce((sum, item) => sum + item.total, 0),
      inStock: stockData.reduce((sum, item) => sum + item.inStock, 0),
      rented: stockData.reduce((sum, item) => sum + item.rented, 0),
      sold: stockData.reduce((sum, item) => sum + item.sold, 0),
      returned: stockData.reduce((sum, item) => sum + item.returned, 0),
      damaged: stockData.reduce((sum, item) => sum + item.damaged, 0),
      lost: stockData.reduce((sum, item) => sum + item.lost, 0),
    }

    return { summary, stockData }
  } catch (error) {
    console.error('✗ Error fetching stock summary:', error.message)
    throw error
  }
}

export const getDetailedStockReport = async () => {
  try {
    const { summary, stockData } = await getStockSummary()

    return {
      generatedAt: new Date().toISOString(),
      summary,
      details: stockData,
    }
  } catch (error) {
    console.error('✗ Error generating stock report:', error.message)
    throw error
  }
}
