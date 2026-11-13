import type { ProductCategory } from './types'

export interface CategoryMeta {
  id: ProductCategory
  label: string
  description: string
  icon: string
  verificationHints: string[]
}

export const PRODUCT_CATEGORIES: CategoryMeta[] = [
  {
    id: 'medicine_otc',
    label: 'Medicine — OTC',
    description: 'Pain relievers, cold remedies, antipyretics (paracetamol, ibuprofen)',
    icon: 'Pill',
    verificationHints: ['NAFDAC number', 'batch number', 'expiry print quality', 'foil seal', 'blister pack'],
  },
  {
    id: 'medicine_antimalarial',
    label: 'Medicine — Antimalarial',
    description: 'Artemisinin-based combinations, malaria treatments',
    icon: 'Shield',
    verificationHints: ['WHO prequalification', 'NAFDAC number', 'blister seal', 'tablet color/shape'],
  },
  {
    id: 'medicine_prescription',
    label: 'Medicine — Prescription',
    description: 'Antibiotics, chronic disease medications, prescription drugs',
    icon: 'FileText',
    verificationHints: ['batch number', 'NAFDAC number', 'blister integrity', 'pharmacy label'],
  },
  {
    id: 'medicine_supplement',
    label: 'Vitamins & Supplements',
    description: 'Multivitamins, mineral supplements, herbal capsules',
    icon: 'Leaf',
    verificationHints: ['brand logo', 'batch code', 'seal integrity', 'NAFDAC number'],
  },
  {
    id: 'cosmetic',
    label: 'Cosmetics & Personal Care',
    description: 'Soaps, lotions, creams, perfumes, hair products',
    icon: 'Sparkles',
    verificationHints: ['brand logo', 'batch code', 'packaging print', 'scent seal'],
  },
  {
    id: 'beverage',
    label: 'Beverages',
    description: 'Soft drinks, bottled water, juice, energy drinks',
    icon: 'CupSoda',
    verificationHints: ['bottle shape', 'cap seal', 'label print quality', 'expiry code'],
  },
  {
    id: 'packaged_food',
    label: 'Packaged Food',
    description: 'Branded snacks, cooking oil, canned goods, spices',
    icon: 'Package',
    verificationHints: ['packaging seal', 'brand logo', 'expiry print', 'barcode format'],
  },
  {
    id: 'electronics_accessory',
    label: 'Electronics Accessory',
    description: 'Chargers, cables, earphones, power banks',
    icon: 'Plug',
    verificationHints: ['brand marking', 'connector quality', 'cable print', 'safety marks'],
  },
  {
    id: 'electronics_device',
    label: 'Electronics Device',
    description: 'Phones, headphones, small branded appliances',
    icon: 'Smartphone',
    verificationHints: ['serial number', 'brand logo', 'build quality', 'IMEI'],
  },
  {
    id: 'household_good',
    label: 'Household Good',
    description: 'Cleaning products, batteries, branded home items',
    icon: 'Home',
    verificationHints: ['brand logo', 'batch code', 'packaging seal', 'safety marks'],
  },
  {
    id: 'apparel',
    label: 'Branded Apparel',
    description: 'Sneakers, bags, clothing, footwear',
    icon: 'Shirt',
    verificationHints: ['brand logo embroidery', 'stitching quality', 'tag/label', 'size print'],
  },
  {
    id: 'auto_consumable',
    label: 'Auto Parts & Lubricants',
    description: 'Engine oil, spark plugs, filters, brake pads (branded)',
    icon: 'Car',
    verificationHints: ['brand hologram', 'batch number', 'packaging seal', 'safety marks'],
  },
  {
    id: 'currency',
    label: 'Currency & Documents',
    description: 'Banknotes, IDs, certificates, high-value documents',
    icon: 'Banknote',
    verificationHints: ['security thread', 'watermark', 'color-shifting ink', 'microprint'],
  },
  {
    id: 'other_branded',
    label: 'Other Branded Product',
    description: 'Anything else with a brand to verify',
    icon: 'Tag',
    verificationHints: ['brand logo', 'packaging quality', 'batch/serial number', 'official marks'],
  },
]

export function getCategoryMeta(id: ProductCategory): CategoryMeta | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.id === id)
}
