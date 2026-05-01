// Sample data for Counter POS
const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'apparel', name: 'Apparel' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'food', name: 'Food' },
  { id: 'pantry', name: 'Pantry' },
  { id: 'gifts', name: 'Gifts' },
];

const PRODUCTS = [
  {
    id: 'p1', name: 'Heavyweight Tee', category: 'apparel', price: 32.00,
    stock: 24, sku: 'APP-HWT',
    swatch: ['#2B2B2E', '#E8E4DB'],
    variants: {
      Size: ['S', 'M', 'L', 'XL'],
      Color: ['Ink', 'Bone', 'Moss'],
    },
    priceMap: { 'XL': 34.00 },
  },
  {
    id: 'p2', name: 'Oat Flat White', category: 'drinks', price: 4.80,
    stock: 999, sku: 'DRK-OFW',
    swatch: ['#C9AA85', '#F3E6D3'],
    variants: { Size: ['Small', 'Regular', 'Large'] },
    priceMap: { 'Small': 4.20, 'Regular': 4.80, 'Large': 5.40 },
    modifiers: [
      { name: 'Extra shot', price: 0.80 },
      { name: 'Oat milk', price: 0.50, included: true },
      { name: 'Decaf', price: 0 },
      { name: 'Vanilla syrup', price: 0.60 },
    ],
  },
  {
    id: 'p3', name: 'Sourdough Loaf', category: 'food', price: 8.50,
    stock: 6, sku: 'FOD-SDL',
    swatch: ['#C89B5C', '#EBD4A6'],
  },
  {
    id: 'p4', name: 'Ceramic Mug', category: 'gifts', price: 18.00,
    stock: 3, sku: 'GFT-MUG',
    swatch: ['#E8E4DB', '#B8B2A4'],
    variants: { Color: ['Bone', 'Moss', 'Clay'] },
  },
  {
    id: 'p5', name: 'Cold Brew', category: 'drinks', price: 5.20,
    stock: 42, sku: 'DRK-CBR',
    swatch: ['#3A2A1E', '#6B4B33'],
    variants: { Size: ['12 oz', '16 oz'] },
    priceMap: { '12 oz': 5.20, '16 oz': 6.00 },
  },
  {
    id: 'p6', name: 'House Granola', category: 'pantry', price: 14.00,
    stock: 12, sku: 'PAN-GRA',
    swatch: ['#D4A96A', '#F1DFB8'],
  },
  {
    id: 'p7', name: 'Canvas Tote', category: 'apparel', price: 22.00,
    stock: 0, sku: 'APP-TOT',
    swatch: ['#DDD4C2', '#8B8270'],
    variants: { Color: ['Natural', 'Ink'] },
  },
  {
    id: 'p8', name: 'Almond Croissant', category: 'food', price: 4.50,
    stock: 8, sku: 'FOD-ACR',
    swatch: ['#D5A66B', '#E8C896'],
  },
  {
    id: 'p9', name: 'Matcha Latte', category: 'drinks', price: 5.50,
    stock: 999, sku: 'DRK-MAT',
    swatch: ['#8FA678', '#C5D4B0'],
    variants: { Size: ['Small', 'Regular', 'Large'] },
    priceMap: { 'Small': 4.80, 'Regular': 5.50, 'Large': 6.20 },
  },
  {
    id: 'p10', name: 'Olive Oil 500ml', category: 'pantry', price: 24.00,
    stock: 9, sku: 'PAN-OLV',
    swatch: ['#A3A566', '#D4D18A'],
  },
  {
    id: 'p11', name: 'Linen Apron', category: 'apparel', price: 48.00,
    stock: 5, sku: 'APP-APR',
    swatch: ['#6B5E4B', '#B8A892'],
    variants: { Color: ['Sand', 'Charcoal'] },
  },
  {
    id: 'p12', name: 'Sea Salt Chocolate', category: 'gifts', price: 9.50,
    stock: 18, sku: 'GFT-CHO',
    swatch: ['#3A2A1E', '#8B5A3C'],
  },
];

const CUSTOMERS = [
  { id: 'c1', name: 'Ana Morales', email: 'ana@studio.co', loyalty: 240, visits: 14 },
  { id: 'c2', name: 'Devon Park', email: 'devon.p@mail.io', loyalty: 85, visits: 6 },
  { id: 'c3', name: 'Iris Chen', email: 'iris@workshop.design', loyalty: 512, visits: 31 },
  { id: 'c4', name: 'Marcus Okafor', email: 'marcus@field.studio', loyalty: 40, visits: 3 },
  { id: 'c5', name: 'Sana Rehman', email: 'sana@acme.co', loyalty: 178, visits: 11 },
];

const ORDER_HISTORY = [
  { id: 'CT-2049', time: '2m ago', total: 41.30, items: 3, method: 'Card', status: 'paid', customer: 'Ana Morales' },
  { id: 'CT-2048', time: '14m ago', total: 8.50, items: 1, method: 'Cash', status: 'paid' },
  { id: 'CT-2047', time: '28m ago', total: 96.40, items: 6, method: 'Split', status: 'paid', customer: 'Iris Chen' },
  { id: 'CT-2046', time: '41m ago', total: 12.20, items: 2, method: 'QR', status: 'paid' },
  { id: 'CT-2045', time: '1h ago', total: 34.00, items: 1, method: 'Card', status: 'refunded' },
  { id: 'CT-2044', time: '1h ago', total: 5.50, items: 1, method: 'Cash', status: 'paid' },
  { id: 'CT-2043', time: '2h ago', total: 62.80, items: 4, method: 'Card', status: 'paid', customer: 'Devon Park' },
  { id: 'CT-2042', time: '2h ago', total: 18.00, items: 1, method: 'QR', status: 'paid' },
];

const PARKED_ORDERS = [
  { id: 'T-04', label: 'Table 4', items: 5, total: 38.40, note: 'Waiting on dessert' },
  { id: 'T-11', label: 'Table 11', items: 2, total: 14.00 },
  { id: 'TO-03', label: 'Takeout — Marcus', items: 3, total: 22.50 },
];

Object.assign(window, { CATEGORIES, PRODUCTS, CUSTOMERS, ORDER_HISTORY, PARKED_ORDERS });
