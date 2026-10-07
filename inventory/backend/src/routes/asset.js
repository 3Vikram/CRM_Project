import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Asset } from '../models/Asset.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.resolve(__dirname, '../../uploads/documents')

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${timestamp}-${safeName}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'))
    }
    cb(null, true)
  },
})

const toDocumentPayload = (asset) => ({
  id: asset._id.toString(),
  document: {
    fileName: asset.document?.fileName || '',
    fileUrl: asset.document?.fileUrl || '',
    uploadedAt: asset.document?.uploadedAt || null,
  },
})

router.post('/:id/document', upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params
    const asset = await Asset.findById(id)
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' })
    }

    asset.document = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/documents/${req.file.filename}`,
      uploadedAt: new Date(),
    }

    await asset.save()

    res.json(toDocumentPayload(asset))
  } catch (error) {
    console.error('Error uploading asset document:', error)
    res.status(500).json({ error: 'Failed to upload asset document' })
  }
})

router.put('/:id/document', upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params
    const asset = await Asset.findById(id)
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' })
    }

    if (asset.document?.fileUrl) {
      const existingFileName = path.basename(asset.document.fileUrl)
      const existingPath = path.resolve(uploadDir, existingFileName)
      try {
        if (fs.existsSync(existingPath)) {
          fs.unlinkSync(existingPath)
        }
      } catch (err) {
        console.warn('Failed to remove old document file:', err)
      }
    }

    asset.document = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/documents/${req.file.filename}`,
      uploadedAt: new Date(),
    }

    await asset.save()

    res.json(toDocumentPayload(asset))
  } catch (error) {
    console.error('Error replacing asset document:', error)
    res.status(500).json({ error: 'Failed to replace asset document' })
  }
})

router.delete('/:id/document', async (req, res) => {
  try {
    const { id } = req.params
    const asset = await Asset.findById(id)
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    if (asset.document?.fileUrl) {
      const existingFileName = path.basename(asset.document.fileUrl)
      const existingPath = path.resolve(uploadDir, existingFileName)
      try {
        if (fs.existsSync(existingPath)) {
          fs.unlinkSync(existingPath)
        }
      } catch (err) {
        console.warn('Failed to remove document file:', err)
      }
    }

    asset.document = {
      fileName: '',
      fileUrl: '',
      uploadedAt: null,
    }

    await asset.save()

    res.json(toDocumentPayload(asset))
  } catch (error) {
    console.error('Error deleting asset document:', error)
    res.status(500).json({ error: 'Failed to delete asset document' })
  }
})

export default router
