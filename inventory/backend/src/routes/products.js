import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product } from '../models/Product.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads/products');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

const normalizeProduct = (product) => ({
  ...product.toObject(),
  id: product._id.toString(),
  documents: product.documents || {
    fileName: '',
    fileUrl: '',
    uploadedAt: null,
  },
});

router.get('/', async (req, res) => {
  try {
    const { search = '', minPrice, maxPrice } = req.query;

    const filters = { isActive: { $ne: false } };
    const text = String(search || '').trim();

    if (text) {
      filters.$or = [
        { productName: { $regex: text, $options: 'i' } },
        { description: { $regex: text, $options: 'i' } },
        { hsnSac: { $regex: text, $options: 'i' } },
      ];
    }

    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = Number(minPrice);
      if (maxPrice) filters.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(filters).sort({ productName: 1, createdAt: -1 });
    res.json(products.map(normalizeProduct));
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { productName, description = '', price, hsnSac = '', gst, productModel = '' } = req.body || {};

    if (!productName || String(productName).trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (price === undefined || price === null || Number(price) <= 0) {
      return res.status(400).json({ error: 'Price is required' });
    }

    if (gst === undefined || gst === null || String(gst).trim() === '') {
      return res.status(400).json({ error: 'GST is required' });
    }

    const product = await Product.create({
      productName: String(productName).trim(),
      description: String(description || '').trim(),
      productModel: String(productModel || '').trim(),
      price: Number(price),
      hsnSac: String(hsnSac || '').trim(),
      gst: String(gst).trim(),
      documents: {
        fileName: '',
        fileUrl: '',
        uploadedAt: null,
      },
    });

    res.status(201).json(normalizeProduct(product));
  } catch (error) {
    console.error('Error creating product:', error.message, error);
    
    // Return specific validation error message if available
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') || 'Validation failed' });
    }
    
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, description, price, hsnSac, gst, productModel } = req.body || {};

    console.log('\n=== PUT Product Request ===');
    console.log('Product ID:', id);
    console.log('Received payload:', { productName, description, price, hsnSac, gst, productModel });

    const product = await Product.findById(id);
    if (!product) {
      console.log('Product not found for ID:', id);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Current product GST:', product.gst, `(type: ${typeof product.gst})`);

    if (productName !== undefined && String(productName).trim() === '') {
      console.log('Validation failed: Product name is required');
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (price !== undefined && (price === null || Number(price) <= 0)) {
      console.log('Validation failed: Price is required');
      return res.status(400).json({ error: 'Price is required' });
    }

    if (gst !== undefined && (gst === null || String(gst).trim() === '')) {
      console.log('Validation failed: GST is required');
      return res.status(400).json({ error: 'GST is required' });
    }

    if (productName !== undefined) product.productName = String(productName).trim();
    if (description !== undefined) product.description = String(description || '').trim();
    if (productModel !== undefined) product.productModel = String(productModel || '').trim();
    if (price !== undefined) product.price = Number(price);
    if (hsnSac !== undefined) product.hsnSac = String(hsnSac || '').trim();
    if (gst !== undefined) {
      console.log('Setting GST from', product.gst, 'to', String(gst).trim());
      product.gst = String(gst).trim();
    }

    console.log('Calling product.save()...');
    await product.save();
    console.log('Save successful! Updated product GST:', product.gst);
    res.json(normalizeProduct(product));
  } catch (error) {
    console.error('Error updating product:');
    console.error('  Message:', error.message);
    console.error('  Name:', error.name);
    console.error('  Stack:', error.stack);
    
    // Return specific validation error message if available
    if (error.name === 'ValidationError') {
      console.error('Mongoose ValidationError details:', error.errors);
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') || 'Validation failed' });
    }
    
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.documents?.fileUrl) {
      const fileName = path.basename(product.documents.fileUrl);
      const filePath = path.resolve(uploadDir, fileName);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.warn('Failed to remove product document file:', unlinkError);
      }
    }

    await product.deleteOne();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

router.post('/:id/document', upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }

    product.documents = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/products/${req.file.filename}`,
      uploadedAt: new Date(),
    };

    await product.save();
    res.json(normalizeProduct(product));
  } catch (error) {
    console.error('Error uploading product document:', error);
    res.status(500).json({ error: 'Failed to upload product document' });
  }
});

router.put('/:id/document', upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }

    if (product.documents?.fileUrl) {
      const existingFileName = path.basename(product.documents.fileUrl);
      const existingPath = path.resolve(uploadDir, existingFileName);
      try {
        if (fs.existsSync(existingPath)) fs.unlinkSync(existingPath);
      } catch (unlinkError) {
        console.warn('Failed to remove old product document file:', unlinkError);
      }
    }

    product.documents = {
      fileName: req.file.originalname,
      fileUrl: `/uploads/products/${req.file.filename}`,
      uploadedAt: new Date(),
    };

    await product.save();
    res.json(normalizeProduct(product));
  } catch (error) {
    console.error('Error replacing product document:', error);
    res.status(500).json({ error: 'Failed to replace product document' });
  }
});

router.delete('/:id/document', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.documents?.fileUrl) {
      const existingFileName = path.basename(product.documents.fileUrl);
      const existingPath = path.resolve(uploadDir, existingFileName);
      try {
        if (fs.existsSync(existingPath)) fs.unlinkSync(existingPath);
      } catch (unlinkError) {
        console.warn('Failed to remove product document file:', unlinkError);
      }
    }

    product.documents = {
      fileName: '',
      fileUrl: '',
      uploadedAt: null,
    };

    await product.save();
    res.json(normalizeProduct(product));
  } catch (error) {
    console.error('Error deleting product document:', error);
    res.status(500).json({ error: 'Failed to delete product document' });
  }
});

export default router;
