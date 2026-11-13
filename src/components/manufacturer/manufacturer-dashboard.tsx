'use client'

import { useEffect, useState, useRef } from 'react'
import { Building2, Package, Plus, Loader2, CheckCircle2, Upload, Shield, Camera } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VerifiedBadge, UnverifiedBadge } from '@/components/manufacturer/verified-badge'
import { PRODUCT_CATEGORIES } from '@/lib/scan/categories'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import type { Manufacturer, ManufacturerProduct, SecurityFeature, FakeIndicator } from '@/lib/scan/manufacturer-types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type View = 'overview' | 'register' | 'products' | 'add-product'

export function ManufacturerDashboard({ open, onOpenChange }: Props) {
  const { user, configured, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [view, setView] = useState<View>('overview')
  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null)
  const [products, setProducts] = useState<ManufacturerProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !configured || !user) return
    setLoading(true)
    Promise.all([
      fetch('/api/manufacturer/register').then((r) => r.json()),
      fetch('/api/manufacturer/products').then((r) => r.json()),
    ])
      .then(([mfgRes, prodRes]) => {
        setManufacturer(mfgRes.manufacturer ?? null)
        setProducts(prodRes.products ?? [])
        setView(mfgRes.manufacturer ? 'overview' : 'register')
      })
      .catch(() => {
        toast({ title: 'Failed to load manufacturer data', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [open, configured, user, toast])

  const [regForm, setRegForm] = useState({ companyName: '', country: '', contactEmail: '', phone: '', regulatoryLicenseNumber: '', website: '' })
  const [registering, setRegistering] = useState(false)

  const handleRegister = async () => {
    if (!regForm.companyName || !regForm.country || !regForm.contactEmail) {
      toast({ title: 'Company name, country, and email are required', variant: 'destructive' })
      return
    }
    setRegistering(true)
    try {
      const res = await fetch('/api/manufacturer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      toast({ title: 'Manufacturer profile created', description: 'You can now add products.' })
      const mfgRes = await fetch('/api/manufacturer/register').then((r) => r.json())
      setManufacturer(mfgRes.manufacturer ?? null)
      setView('overview')
    } catch (err) {
      toast({ title: 'Registration failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setRegistering(false)
    }
  }

  const [productForm, setProductForm] = useState({ productName: '', brand: '', category: 'medicine_otc', barcode: '', packSize: '', description: '' })
  const [securityFeatures, setSecurityFeatures] = useState<SecurityFeature[]>([{ feature: '', location: '', description: '' }])
  const [fakeIndicators, setFakeIndicators] = useState<FakeIndicator[]>([{ indicator: '', description: '' }])
  const [addingProduct, setAddingProduct] = useState(false)

  // Product image upload state.
  const [uploadingTo, setUploadingTo] = useState<string | null>(null)
  const [uploadAngle, setUploadAngle] = useState('front')
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (productId: string) => {
    if (!uploadPreview) return
    setUploading(true)
    try {
      const res = await fetch(`/api/manufacturer/product/${productId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: uploadPreview, angle: uploadAngle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      toast({ title: 'Reference image uploaded', description: 'This image will be used as ground truth for verification.' })
      setUploadPreview(null)
      setUploadingTo(null)
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const readFileAsDataUrl = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setUploadPreview(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleAddProduct = async () => {
    if (!productForm.productName || !productForm.brand) {
      toast({ title: 'Product name and brand are required', variant: 'destructive' })
      return
    }
    setAddingProduct(true)
    try {
      const cleanSecurity = securityFeatures.filter((f) => f.feature.trim())
      const cleanFake = fakeIndicators.filter((f) => f.indicator.trim())
      const res = await fetch('/api/manufacturer/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productForm, securityFeatures: cleanSecurity, knownFakeIndicators: cleanFake }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add product')
      toast({ title: 'Product added', description: 'Your product is now in the registry.' })
      setProductForm({ productName: '', brand: '', category: 'medicine_otc', barcode: '', packSize: '', description: '' })
      setSecurityFeatures([{ feature: '', location: '', description: '' }])
      setFakeIndicators([{ indicator: '', description: '' }])
      const prodRes = await fetch('/api/manufacturer/products').then((r) => r.json())
      setProducts(prodRes.products ?? [])
      setView('products')
    } catch (err) {
      toast({ title: 'Failed to add product', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setAddingProduct(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-zinc-950 border-zinc-800 p-0">
        <SheetHeader className="px-4 py-3 border-b border-zinc-800">
          <SheetTitle className="flex items-center gap-2 text-zinc-100">
            <Building2 className="h-5 w-5 text-amber-400" />
            Manufacturer Portal
          </SheetTitle>
        </SheetHeader>

        {!configured && (
          <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <Building2 className="h-10 w-10 text-zinc-700" />
            <h3 className="text-base font-semibold text-zinc-300">Supabase not connected</h3>
            <p className="max-w-xs text-sm text-zinc-500">
              Add Supabase credentials to .env to enable manufacturer registration. Manufacturers register their company, upload official reference images, and specify security features — their data becomes the ground truth for product verification.
            </p>
          </div>
        )}

        {configured && !authLoading && !user && (
          <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <Shield className="h-10 w-10 text-zinc-700" />
            <h3 className="text-base font-semibold text-zinc-300">Sign in required</h3>
            <p className="max-w-xs text-sm text-zinc-500">
              Tap the sign-in icon in the header (top-right) to create a magic-link account, then open this portal again to register your manufacturer profile.
            </p>
          </div>
        )}

        {configured && user && loading && (
          <div className="flex h-[70vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        )}

        {configured && user && !loading && (
          <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex gap-1 border-b border-zinc-900 px-3 py-2">
              <NavButton active={view === 'overview'} onClick={() => setView('overview')} icon={Building2}>Overview</NavButton>
              <NavButton active={view === 'products'} onClick={() => setView('products')} icon={Package}>Products ({products.length})</NavButton>
              {manufacturer && (
                <NavButton active={view === 'add-product'} onClick={() => setView('add-product')} icon={Plus}>Add Product</NavButton>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {view === 'overview' && (
                  <div className="space-y-4">
                    {manufacturer ? (
                      <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-zinc-100">{manufacturer.companyName}</h3>
                            <p className="text-xs text-zinc-400">{manufacturer.country}</p>
                          </div>
                          {manufacturer.verified ? (
                            <VerifiedBadge />
                          ) : (
                            <UnverifiedBadge />
                          )}
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div><dt className="text-zinc-500">Email</dt><dd className="text-zinc-300">{manufacturer.contactEmail}</dd></div>
                          {manufacturer.phone && <div><dt className="text-zinc-500">Phone</dt><dd className="text-zinc-300">{manufacturer.phone}</dd></div>}
                          {manufacturer.regulatoryLicenseNumber && <div><dt className="text-zinc-500">License</dt><dd className="text-zinc-300">{manufacturer.regulatoryLicenseNumber}</dd></div>}
                          {manufacturer.website && <div><dt className="text-zinc-500">Website</dt><dd className="text-zinc-300 truncate">{manufacturer.website}</dd></div>}
                        </dl>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-zinc-900 p-4 text-center ring-1 ring-inset ring-zinc-800">
                        <p className="text-sm text-zinc-400">You don't have a manufacturer profile yet.</p>
                        <Button onClick={() => setView('register')} className="mt-3 bg-amber-500 text-zinc-950 hover:bg-amber-400">
                          Register your company
                        </Button>
                      </div>
                    )}
                    <div className="rounded-lg bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
                      <h4 className="text-sm font-medium text-zinc-200">How it works</h4>
                      <ol className="mt-2 space-y-2 text-xs text-zinc-400">
                        <li>1. Register your company (above)</li>
                        <li>2. Add each product with official reference photos and security features</li>
                        <li>3. When a consumer scans your product, the app uses YOUR reference images (ground truth) — not web-scraped guesses</li>
                        <li>4. Your security feature checklist is sent to the AI for explicit verification on every scan</li>
                      </ol>
                    </div>
                  </div>
                )}

                {view === 'register' && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-zinc-100">Register your company</h3>
                    <Field label="Company name *"><Input value={regForm.companyName} onChange={(e) => setRegForm({ ...regForm, companyName: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="e.g. GSK Nigeria" /></Field>
                    <Field label="Country *"><Input value={regForm.country} onChange={(e) => setRegForm({ ...regForm, country: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="e.g. Nigeria" /></Field>
                    <Field label="Contact email *"><Input type="email" value={regForm.contactEmail} onChange={(e) => setRegForm({ ...regForm, contactEmail: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="legal@company.com" /></Field>
                    <Field label="Phone"><Input value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="+234..." /></Field>
                    <Field label="Regulatory license number"><Input value={regForm.regulatoryLicenseNumber} onChange={(e) => setRegForm({ ...regForm, regulatoryLicenseNumber: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="e.g. NAFDAC/XYZ-123" /></Field>
                    <Field label="Website"><Input value={regForm.website} onChange={(e) => setRegForm({ ...regForm, website: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="https://..." /></Field>
                    <Button onClick={handleRegister} disabled={registering} className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
                      {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {registering ? 'Registering...' : 'Register company'}
                    </Button>
                  </div>
                )}

                {view === 'products' && (
                  <div className="space-y-2">
                    {products.length === 0 ? (
                      <div className="rounded-lg bg-zinc-900 p-6 text-center ring-1 ring-inset ring-zinc-800">
                        <Package className="mx-auto h-8 w-8 text-zinc-700" />
                        <p className="mt-2 text-sm text-zinc-400">No products yet. Add your first product.</p>
                        <Button onClick={() => setView('add-product')} className="mt-3 bg-amber-500 text-zinc-950 hover:bg-amber-400">
                          <Plus className="mr-2 h-4 w-4" /> Add product
                        </Button>
                      </div>
                    ) : (
                      products.map((p) => (
                        <div key={p.id} className="rounded-lg bg-zinc-900 p-3 ring-1 ring-inset ring-zinc-800">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-100">{p.productName}</p>
                              <p className="truncate text-xs text-zinc-400">{p.brand} - {p.packSize || 'no size'}</p>
                              {p.barcode && <p className="font-mono text-xs text-zinc-600">{p.barcode}</p>}
                            </div>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-500">{p.category}</Badge>
                          </div>
                          {(p.securityFeatures.length > 0 || p.knownFakeIndicators.length > 0) && (
                            <div className="mt-2 flex gap-3 text-[11px] text-zinc-600">
                              {p.securityFeatures.length > 0 && <span>{p.securityFeatures.length} security features</span>}
                              {p.knownFakeIndicators.length > 0 && <span>{p.knownFakeIndicators.length} fake indicators</span>}
                            </div>
                          )}
                          <div className="mt-2 border-t border-zinc-800 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setUploadingTo(p.id); setUploadPreview(null) }}
                              className="text-xs text-amber-400 hover:bg-amber-500/10"
                            >
                              <Upload className="mr-1 h-3 w-3" /> Upload reference images
                            </Button>
                            {uploadingTo === p.id && (
                              <div className="mt-2 space-y-2 rounded-md bg-zinc-950/50 p-2">
                                <p className="text-[11px] text-zinc-500">Upload official product photos — these become the ground truth for Deep Compare verification.</p>
                                <div className="flex gap-2">
                                  <select
                                    value={uploadAngle}
                                    onChange={(e) => setUploadAngle(e.target.value)}
                                    className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                                  >
                                    <option value="front">Front</option>
                                    <option value="back">Back</option>
                                    <option value="side">Side</option>
                                    <option value="top">Top</option>
                                    <option value="detail">Detail</option>
                                    <option value="other">Other</option>
                                  </select>
                                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="border-zinc-700 bg-zinc-900 text-zinc-100">
                                    <Camera className="mr-1 h-3 w-3" /> Choose photo
                                  </Button>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsDataUrl(f); e.target.value = '' }}
                                  />
                                </div>
                                {uploadPreview && (
                                  <div className="space-y-2">
                                    <img src={uploadPreview} alt="Preview" className="max-h-32 rounded-md object-cover" />
                                    <Button size="sm" onClick={() => handleImageUpload(p.id)} disabled={uploading} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
                                      {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                                      {uploading ? 'Uploading...' : 'Upload'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {view === 'add-product' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-zinc-100">Add a product</h3>
                    <Field label="Product name *"><Input value={productForm.productName} onChange={(e) => setProductForm({ ...productForm, productName: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="e.g. Panadol Extra" /></Field>
                    <Field label="Brand *"><Input value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="e.g. GSK" /></Field>
                    <Field label="Category">
                      <Select value={productForm.category} onValueChange={(v) => setProductForm({ ...productForm, category: v })}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {PRODUCT_CATEGORIES.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-zinc-100 focus:bg-zinc-800">{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Barcode (EAN/UPC)"><Input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="5449000000996" /></Field>
                      <Field label="Pack size"><Input value={productForm.packSize} onChange={(e) => setProductForm({ ...productForm, packSize: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100" placeholder="60 tablets" /></Field>
                    </div>
                    <Field label="Description"><Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="bg-zinc-900 border-zinc-800 text-zinc-100 resize-none" rows={2} placeholder="Official product description..." /></Field>

                    <div>
                      <Label className="text-zinc-300">Security features to verify</Label>
                      <p className="mb-2 text-xs text-zinc-500">The AI checks each of these explicitly on every scan of your product.</p>
                      <div className="space-y-2">
                        {securityFeatures.map((sf, i) => (
                          <div key={i} className="grid grid-cols-3 gap-1">
                            <Input placeholder="Feature (e.g. Hologram)" value={sf.feature} onChange={(e) => { const n = [...securityFeatures]; n[i] = { ...sf, feature: e.target.value }; setSecurityFeatures(n) }} className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs" />
                            <Input placeholder="Location (e.g. top right)" value={sf.location} onChange={(e) => { const n = [...securityFeatures]; n[i] = { ...sf, location: e.target.value }; setSecurityFeatures(n) }} className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs" />
                            <Input placeholder="Description" value={sf.description} onChange={(e) => { const n = [...securityFeatures]; n[i] = { ...sf, description: e.target.value }; setSecurityFeatures(n) }} className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs" />
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSecurityFeatures([...securityFeatures, { feature: '', location: '', description: '' }])} className="mt-1 text-zinc-400">
                        <Plus className="mr-1 h-3 w-3" /> Add feature
                      </Button>
                    </div>

                    <div>
                      <Label className="text-zinc-300">Known counterfeit indicators</Label>
                      <p className="mb-2 text-xs text-zinc-500">Common signs that distinguish known counterfeits of your product.</p>
                      <div className="space-y-2">
                        {fakeIndicators.map((fi, i) => (
                          <div key={i} className="grid grid-cols-2 gap-1">
                            <Input placeholder="Indicator (e.g. Misspelling)" value={fi.indicator} onChange={(e) => { const n = [...fakeIndicators]; n[i] = { ...fi, indicator: e.target.value }; setFakeIndicators(n) }} className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs" />
                            <Input placeholder="Description" value={fi.description} onChange={(e) => { const n = [...fakeIndicators]; n[i] = { ...fi, description: e.target.value }; setFakeIndicators(n) }} className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs" />
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setFakeIndicators([...fakeIndicators, { indicator: '', description: '' }])} className="mt-1 text-zinc-400">
                        <Plus className="mr-1 h-3 w-3" /> Add indicator
                      </Button>
                    </div>

                    <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-500">
                      <Upload className="mr-1 inline h-3 w-3" />
                      Reference image upload is available after product creation — add the product first, then upload official photos from the product detail view.
                    </div>

                    <Button onClick={handleAddProduct} disabled={addingProduct} className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
                      {addingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      {addingProduct ? 'Adding...' : 'Add product to registry'}
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function NavButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-zinc-300 text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
