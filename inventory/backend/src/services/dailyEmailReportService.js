import ExcelJS from 'exceljs'
import { Asset } from '../models/Asset.js'
import { AssetMovement } from '../models/AssetMovement.js'
import { DailyEmailSnapshot } from '../models/DailyEmailSnapshot.js'
import { DailyEmailSettings } from '../models/DailyEmailSettings.js'

const IST_TZ = 'Asia/Kolkata'

const fmtDateYMD = (date) => {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

const fmtDateDisplay = (date) => {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

const toMoney = (value) => {
  const num = Number(value) || 0
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const getAssetSnapshotForMorning = async (reportDate = new Date()) => {
  const start = new Date(reportDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(reportDate)
  end.setHours(23, 59, 59, 999)

  const assets = await Asset.find({
    status: { $in: ['available', 'IN_STOCK', 'in_stock', 'outwarding', 'OUTWARDING'] },
    createdAt: { $gte: new Date('1970-01-01'), $lte: end },
  }).lean()

  const rows = assets.map((asset) => ({
    assetId: asset._id,
    productName: asset.productName || asset.name || '',
    productDescription: asset.productDescription || asset.description || '',
    productModel: asset.productModel || '',
    unitPrice: Number(asset.price || 0),
    serialNumber: asset.productSerialNumber || asset.serialNumber || '',
    status: 'In Stock',
  }))

  return rows
}

const getMorningSnapshot = async (reportDate = new Date()) => {
  const dateKey = new Date(reportDate)
  dateKey.setHours(0, 0, 0, 0)

  const snapshot = await DailyEmailSnapshot.findOne({
    reportDate: dateKey,
    reportType: 'morning',
  }).lean()

  if (snapshot && Array.isArray(snapshot.assets)) {
    return snapshot.assets
  }

  const assets = await getAssetSnapshotForMorning(reportDate)
  const saved = await DailyEmailSnapshot.findOneAndUpdate(
    { reportDate: dateKey, reportType: 'morning' },
    {
      reportDate: dateKey,
      reportType: 'morning',
      snapshotTime: '10:00',
      timezone: IST_TZ,
      generatedAt: new Date(),
      assets,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return saved.assets || assets
}

const getMovementForAsset = async (assetSerial, reportDate) => {
  const start = new Date(reportDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(reportDate)
  end.setHours(23, 59, 59, 999)

  const movements = await AssetMovement.find({
    $or: [
      { productSerialNumber: assetSerial },
      { serialNumber: assetSerial },
    ],
    movementDate: { $gte: start, $lte: end },
  }).sort({ movementDate: 1, createdAt: 1 }).lean()

  if (!movements.length) return null

  const lastMovement = movements[movements.length - 1]
  const type = String(lastMovement.type || '').toUpperCase()

  if (type === 'RETURNED') {
    return { movement: 'Returned', movementDate: lastMovement.movementDate || lastMovement.createdAt || null }
  }

  if (type === 'RENT_OUT' || type === 'OUTWARD') {
    const outwardType = String(lastMovement.outwardType || '').toLowerCase()
    return {
      movement: outwardType === 'rent' ? 'Rent Out' : 'Sold Out',
      movementDate: lastMovement.movementDate || lastMovement.createdAt || null,
    }
  }

  if (type === 'SOLD' || type === 'SOLD_OUT') {
    return { movement: 'Sold Out', movementDate: lastMovement.movementDate || lastMovement.createdAt || null }
  }

  return { movement: 'No Change', movementDate: null }
}

export const generateMorningStockReportWorkbook = async (reportDate = new Date()) => {
  const morningAssets = await getMorningSnapshot(reportDate)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '3 Vikram Technologies CRM'
  workbook.created = new Date()
  workbook.modified = new Date()

  const ws = workbook.addWorksheet('Morning Stock Report')

  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `GENERATED DATE: ${fmtDateYMD(reportDate)}`
  ws.getCell('A1').font = { bold: true, size: 12 }

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = 'DAILY STOCK REPORT'
  ws.getCell('A2').font = { bold: true, size: 14 }

  ws.getRow(4)
  ws.columns = [
    { header: 'Product Name', key: 'productName', width: 24 },
    { header: 'Product Description', key: 'productDescription', width: 30 },
    { header: 'Model', key: 'productModel', width: 18 },
    { header: 'Unit Price', key: 'unitPrice', width: 16 },
    { header: 'Serial Number', key: 'serialNumber', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
  ]

  const headerRow = ws.getRow(4)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06283D' } }
    cell.alignment = { horizontal: 'center', vertical: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    }
  })

  morningAssets.forEach((item) => {
    const row = ws.addRow({
      productName: item.productName || '',
      productDescription: item.productDescription || '',
      productModel: item.productModel || '',
      unitPrice: Number(item.unitPrice || 0),
      serialNumber: item.serialNumber || '',
      status: item.status || 'In Stock',
    })

    const cell = row.getCell('D')
    cell.numFmt = '₹#,##0.00'
    row.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 4 }]
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `Stock_Report_Morning_${fmtDateYMD(reportDate).replace(/-/g, '')}.xlsx`

  return { buffer, filename, rows: morningAssets }
}

export const generateEveningStockReportWorkbook = async (reportDate = new Date()) => {
  const morningAssets = await getMorningSnapshot(reportDate)
  const morningMap = new Map((morningAssets || []).map((item) => [String(item.serialNumber || '').trim(), item]))

  const allAssets = await Asset.find({}).lean()
  const currentStatusMap = new Map()
  allAssets.forEach((asset) => {
    const serial = String(asset.productSerialNumber || asset.serialNumber || '').trim()
    if (!serial) return
    currentStatusMap.set(serial, asset)
  })

  const rows = []

  for (const item of morningAssets) {
    const serial = String(item.serialNumber || '').trim()
    const currentAsset = currentStatusMap.get(serial)
    const movementInfo = await getMovementForAsset(serial, reportDate)

    const currentStatus = currentAsset
      ? currentAsset.status === 'rented' || currentAsset.status === 'RENTED'
        ? 'Rent Out'
        : currentAsset.status === 'sold' || currentAsset.status === 'SOLD'
          ? 'Sold Out'
          : currentAsset.status === 'returned' || currentAsset.status === 'RETURNED'
            ? 'Returned'
            : 'In Stock'
      : 'In Stock'

    const movement = movementInfo?.movement || 'No Change'
    const movementDate = movementInfo?.movementDate ? fmtDateDisplay(movementInfo.movementDate) : '—'

    rows.push({
      productName: item.productName || '',
      productDescription: item.productDescription || '',
      productModel: item.productModel || '',
      unitPrice: Number(item.unitPrice || 0),
      serialNumber: serial,
      morningStatus: 'In Stock',
      eveningStatus: currentStatus,
      movement,
      movementDate,
    })
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '3 Vikram Technologies CRM'
  workbook.created = new Date()
  workbook.modified = new Date()

  const ws = workbook.addWorksheet('Evening Stock Report')

  ws.mergeCells('A1:I1')
  ws.getCell('A1').value = `GENERATED DATE: ${fmtDateYMD(reportDate)}`
  ws.getCell('A1').font = { bold: true, size: 12 }

  ws.mergeCells('A2:I2')
  ws.getCell('A2').value = 'DAILY STOCK REPORT'
  ws.getCell('A2').font = { bold: true, size: 14 }

  ws.columns = [
    { header: 'Product Name', key: 'productName', width: 24 },
    { header: 'Product Description', key: 'productDescription', width: 30 },
    { header: 'Model', key: 'productModel', width: 18 },
    { header: 'Unit Price', key: 'unitPrice', width: 16 },
    { header: 'Serial Number', key: 'serialNumber', width: 20 },
    { header: 'Morning Status', key: 'morningStatus', width: 16 },
    { header: 'Evening Status', key: 'eveningStatus', width: 16 },
    { header: 'Movement', key: 'movement', width: 18 },
    { header: 'Movement Date', key: 'movementDate', width: 16 },
  ]

  const headerRow = ws.getRow(4)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06283D' } }
    cell.alignment = { horizontal: 'center', vertical: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    }
  })

  rows.forEach((row) => {
    const r = ws.addRow({
      productName: row.productName,
      productDescription: row.productDescription,
      productModel: row.productModel,
      unitPrice: Number(row.unitPrice || 0),
      serialNumber: row.serialNumber,
      morningStatus: row.morningStatus,
      eveningStatus: row.eveningStatus,
      movement: row.movement,
      movementDate: row.movementDate,
    })

    r.getCell('D').numFmt = '₹#,##0.00'
    r.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 4 }]
  ws.getRow(1).height = 22
  ws.getRow(2).height = 22

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `Stock_Report_Evening_${fmtDateYMD(reportDate).replace(/-/g, '')}.xlsx`

  return { buffer, filename, rows }
}

export const createAndPersistMorningSnapshot = async (reportDate = new Date()) => {
  const assets = await getAssetSnapshotForMorning(reportDate)
  const dateKey = new Date(reportDate)
  dateKey.setHours(0, 0, 0, 0)

  const snapshot = await DailyEmailSnapshot.findOneAndUpdate(
    { reportDate: dateKey, reportType: 'morning' },
    {
      reportDate: dateKey,
      reportType: 'morning',
      snapshotTime: '10:00',
      timezone: IST_TZ,
      generatedAt: new Date(),
      assets,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return snapshot
}

export const getDailyEmailSettings = async () => {
  return DailyEmailSettings.findOne().lean()
}
