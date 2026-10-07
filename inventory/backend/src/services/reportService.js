import ExcelJS from 'exceljs'
import { Asset } from '../models/Asset.js'

const safeString = (value) => {
  if (value === undefined || value === null) return ''
  return String(value)
}

const formatDmy = (value) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${String(date.getDate()).padStart(2, '0')}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}-${date.getFullYear()}`
}

/**
 * ONLY these statuses are In Stock.
 *
 * available
 * AVAILABLE
 * in_stock
 * IN_STOCK
 * IN STOCK
 * outwarding
 * OUTWARDING
 * In Stock
 */
const isAvailableAsset = (asset = {}) => {
  const status = safeString(asset.status)
    .trim()
    .toLowerCase()

  return (
    status === 'available' ||
    status === 'in_stock' ||
    status === 'in stock' ||
    status === 'outwarding'
  )
}

/**
 * Convert MongoDB asset directly into Excel row.
 */
const toReportRow = (asset, index) => {
  const make = safeString(
    asset.manufacturer ||
      asset.make ||
      asset.productName ||
      asset.name ||
      ''
  ).trim()

  const model = safeString(
    asset.productModel ||
      asset.model ||
      ''
  ).trim()

  const serialNumber = safeString(
    asset.productSerialNumber ||
      asset.serialNumber ||
      ''
  ).trim()

  const configuration = safeString(
    asset.productDescription ||
      asset.description ||
      ''
  ).trim()

  return {
    slNo: index + 1,
    make,
    model,
    sn: serialNumber,
    configuration,
    status: 'IN STOCK',
  }
}

/**
 * Get ONLY current In Stock assets.
 */
const getCurrentInStockAssets = async () => {
  console.log('')
  console.log('==============================================')
  console.log('DAILY IN STOCK REPORT')
  console.log('==============================================')

  const allAssets = await Asset.find({})
    .sort({ createdAt: -1 })
    .lean()

  console.log(
    'Total Asset documents:',
    allAssets.length
  )

  console.log(
    'All statuses:',
    allAssets.map((asset) => asset.status)
  )

  const inStockAssets = allAssets.filter(
    (asset) => isAvailableAsset(asset)
  )

  console.log(
    'In Stock assets:',
    inStockAssets.length
  )

  console.log(
    'In Stock statuses:',
    inStockAssets.map((asset) => asset.status)
  )

  console.log(
    'In Stock serial numbers:',
    inStockAssets.map(
      (asset) =>
        asset.productSerialNumber ||
        asset.serialNumber ||
        ''
    )
  )

  if (inStockAssets.length === 0) {
    throw new Error(
      'No In Stock assets found.'
    )
  }

  const reportRows = inStockAssets.map(
    (asset, index) =>
      toReportRow(asset, index)
  )

  console.log(
    'Excel rows:',
    reportRows.length
  )

  console.log(
    'First Excel row:',
    reportRows[0]
  )

  console.log(
    '=============================================='
  )

  return reportRows
}

/**
 * Daily report heading.
 */
const formatDailyHeading = (
  value = new Date()
) => {
  const date = new Date(value)

  const day = String(
    date.getDate()
  ).padStart(2, '0')

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')

  const year = String(
    date.getFullYear()
  ).slice(-2)

  return `${day}/${month}/${year} - IN STOCK REPORT`
}

/**
 * Build Excel workbook.
 */
const buildDailyInStockWorkbook = async (
  reportDate,
  rows
) => {
  const workbook = new ExcelJS.Workbook()

  workbook.creator =
    '3 Vikram Technologies CRM'

  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet =
    workbook.addWorksheet(
      'Daily In Stock Report'
    )

  const modelCounts = {}

  rows.forEach((row) => {
    const model =
      String(row.model || '').trim() || 'Unknown'

    modelCounts[model] =
      (modelCounts[model] || 0) + 1
  })

  const summaryRows = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const columns = [
    {
      header: 'SL. NO.',
      key: 'slNo',
      width: 12,
    },
    {
      header: 'PRODUCT NAME',
      key: 'make',
      width: 25,
    },
    {
      header: 'PRODUCT MODEL',
      key: 'model',
      width: 22,
    },
    {
      header: 'SN',
      key: 'sn',
      width: 25,
    },
    {
      header: 'CONFIGURATION',
      key: 'configuration',
      width: 40,
    },
    {
      header: 'STATUS',
      key: 'status',
      width: 18,
    },
  ]

  worksheet.columns = columns

  worksheet.spliceRows(1, 1)

  worksheet.getCell('A1').value =
    formatDailyHeading(reportDate)

  worksheet.getCell('A1').font = {
    bold: true,
    size: 12,
  }

  worksheet.getCell('A1').alignment = {
    horizontal: 'left',
    vertical: 'middle',
  }

  worksheet.getRow(1).height = 22
  worksheet.getRow(2).values = []

  const headers = [
    'SL. NO.',
    'PRODUCT NAME',
    'PRODUCT MODEL',
    'SN',
    'CONFIGURATION',
    'STATUS',
  ]

  const headerRow =
    worksheet.getRow(3)

  headerRow.values = headers
  headerRow.height = 24

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF',
      },
    }

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF06283D',
      },
    }

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    }

    cell.border = {
      top: {
        style: 'thin',
        color: {
          argb: 'FFBFBFBF',
        },
      },
      left: {
        style: 'thin',
        color: {
          argb: 'FFBFBFBF',
        },
      },
      bottom: {
        style: 'thin',
        color: {
          argb: 'FFBFBFBF',
        },
      },
      right: {
        style: 'thin',
        color: {
          argb: 'FFBFBFBF',
        },
      },
    }
  })

  rows.forEach((row, index) => {
    const excelRow =
      worksheet.getRow(index + 4)

    excelRow.values = [
      row.slNo ?? index + 1,
      row.make || '',
      row.model || '',
      row.sn || '',
      row.configuration || '',
      'IN STOCK',
    ]

    excelRow.eachCell((cell) => {
      cell.alignment = {
        vertical: 'top',
      }

      cell.border = {
        top: {
          style: 'thin',
          color: {
            argb: 'FFD9D9D9',
          },
        },
        left: {
          style: 'thin',
          color: {
            argb: 'FFD9D9D9',
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: 'FFD9D9D9',
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: 'FFD9D9D9',
          },
        },
      }
    })
  })

  const blankSummaryRow = worksheet.getRow(rows.length + 4)
  blankSummaryRow.values = []

  const summaryTitleRow = worksheet.getRow(rows.length + 5)
  summaryTitleRow.getCell('A').value = 'TOTAL SUMMARY'
  summaryTitleRow.getCell('A').font = {
    bold: true,
    size: 12,
    color: {
      argb: 'FF06283D',
    },
  }
  summaryTitleRow.getCell('A').alignment = {
    horizontal: 'left',
    vertical: 'middle',
  }

  const totalRow = worksheet.getRow(rows.length + 6)
  totalRow.getCell('A').value = `Total Assets in Stock: ${rows.length}`
  totalRow.getCell('A').font = {
    bold: true,
    color: {
      argb: 'FF06283D',
    },
  }
  totalRow.getCell('A').alignment = {
    horizontal: 'left',
    vertical: 'middle',
  }

  const summaryHeaderRow = worksheet.getRow(rows.length + 8)
  summaryHeaderRow.getCell('A').value = 'PRODUCT MODEL'
  summaryHeaderRow.getCell('B').value = 'QUANTITY'

  summaryHeaderRow.getCell('A').font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  }
  summaryHeaderRow.getCell('B').font = {
    bold: true,
    color: {
      argb: 'FFFFFFFF',
    },
  }

  summaryHeaderRow.getCell('A').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF06283D' },
  }
  summaryHeaderRow.getCell('B').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF06283D' },
  }

  summaryHeaderRow.getCell('A').alignment = {
    horizontal: 'center',
    vertical: 'middle',
  }
  summaryHeaderRow.getCell('B').alignment = {
    horizontal: 'center',
    vertical: 'middle',
  }

  ;['A', 'B'].forEach((cellRef) => {
    const cell = summaryHeaderRow.getCell(cellRef)
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    }
  })

  summaryRows.forEach(([model, quantity], index) => {
    const summaryDataRow = worksheet.getRow(rows.length + 9 + index)
    summaryDataRow.getCell('A').value = model
    summaryDataRow.getCell('B').value = quantity

    ;['A', 'B'].forEach((cellRef) => {
      const cell = summaryDataRow.getCell(cellRef)
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
    })
  })

  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 3,
    },
  ]

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }

  worksheet.pageSetup.margins = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  }

  worksheet.autoFilter = {
    from: 'A3',
    to: 'F3',
  }

  return workbook
}

/**
 * Generate Daily In Stock Excel.
 */
export const generateDailyInStockReportWorkbook =
  async (
    reportDate = new Date()
  ) => {
    console.log(
      '[Daily Email] Generating Daily In Stock Excel...'
    )

    const rows =
      await getCurrentInStockAssets()

    console.log(
      '[Daily Email] Rows going into Excel:',
      rows.length
    )

    const workbook =
      await buildDailyInStockWorkbook(
        reportDate,
        rows
      )

    /*
     * Final safety check.
     */
    const worksheet =
      workbook.getWorksheet(
        'Daily In Stock Report'
      )

    console.log(
      '[Daily Email] Worksheet row count:',
      worksheet.rowCount
    )

    console.log(
      '[Daily Email] Worksheet rows 4+:',
      worksheet
        .getRows(
          4,
          worksheet.rowCount - 3
        )
        ?.map((row) => row.values)
    )

    const buffer =
      await workbook.xlsx.writeBuffer()

    const filename =
      `Daily_In_Stock_Report_${formatDmy(
        reportDate
      ).replace(/-/g, '')}.xlsx`

    console.log(
      '[Daily Email] Excel generated:',
      filename
    )

    return {
      buffer,
      filename,
      rows,
    }
  }

/**
 * Morning report.
 */
export const generateMorningStockReportWorkbook =
  async (
    reportDate = new Date()
  ) =>
    generateDailyInStockReportWorkbook(
      reportDate
    )

/**
 * Evening report.
 */
export const generateEveningStockReportWorkbook =
  async (
    reportDate = new Date()
  ) =>
    generateDailyInStockReportWorkbook(
      reportDate
    )

/**
 * Generate attachment buffer.
 */
export const generateWorkbookBuffer =
  async (
    reportType = 'daily',
    reportDate = new Date()
  ) => {
    try {
      const result =
        await generateDailyInStockReportWorkbook(
          reportDate
        )

      return {
        buffer: result.buffer,
        filename: result.filename,
      }
    } catch (error) {
      console.error(
        'Error generating daily in-stock workbook buffer:',
        error?.message || error
      )

      throw error
    }
  }

/**
 * Generic stock report.
 */
export const generateStockReport =
  async (
    reportType = 'daily',
    reportDate = new Date()
  ) =>
    generateDailyInStockReportWorkbook(
      reportDate
    )