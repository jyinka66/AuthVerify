'use client'

import { useState } from 'react'
import { FileText, Shield, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LegalDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState('disclaimer')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            Legal & Privacy
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
            <TabsTrigger value="disclaimer" className="data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Disclaimer
            </TabsTrigger>
            <TabsTrigger value="privacy" className="data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950">
              <Shield className="mr-1 h-3.5 w-3.5" /> Privacy
            </TabsTrigger>
            <TabsTrigger value="terms" className="data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950">
              <FileText className="mr-1 h-3.5 w-3.5" /> Terms
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] pr-3">
            <TabsContent value="disclaimer" className="mt-4 space-y-3 text-sm text-zinc-300">
              <h3 className="text-base font-semibold text-amber-300">Important — Read Before Use</h3>
              <p><strong className="text-zinc-100">AuthVerify provides AI-generated preliminary assessments, not legally binding authenticity certifications.</strong></p>
              <p>The verdicts produced by this app ("Likely Authentic", "High Risk — Likely Counterfeit", "Inconclusive") are based on visual analysis by an AI vision model and, in Deep Compare mode, comparison against reference images sourced from the public web. These verdicts are advisory only and may be wrong.</p>
              <p><strong className="text-zinc-100">The app cannot detect all counterfeits.</strong> Some counterfeit products are visually indistinguishable from genuine ones, even to expert human inspectors. A "Likely Authentic" verdict does not guarantee the product is genuine. A "High Risk" verdict does not prove the product is counterfeit.</p>
              <p><strong className="text-zinc-100">For authoritative verification, contact:</strong></p>
              <ul className="list-disc space-y-1 pl-5">
                <li>The product manufacturer directly</li>
                <li>Your national drug regulator (NAFDAC in Nigeria, FDA Ghana, PPB Kenya, etc.)</li>
                <li>An authorized retailer or distributor</li>
              </ul>
              <p><strong className="text-zinc-100">Do not make health, safety, or financial decisions solely based on this app's verdict.</strong> If you suspect a medicine is counterfeit, do not consume it. Return it to the pharmacy or report it to your regulator.</p>
              <p className="text-xs text-zinc-500">Reference images used in Deep Compare are sourced from the public web and may themselves be inaccurate. The credibility of each reference source is shown in the comparison card.</p>
            </TabsContent>

            <TabsContent value="privacy" className="mt-4 space-y-3 text-sm text-zinc-300">
              <h3 className="text-base font-semibold text-amber-300">Privacy Policy</h3>
              <p><strong className="text-zinc-100">What we collect:</strong></p>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Product images</strong> you capture or upload for scanning. These are processed by our AI to produce a verdict and may be stored for up to 30 days to improve detection, then automatically deleted.</li>
                <li><strong>Anonymous device fingerprint</strong> — a random ID stored in your browser, used to group your scan history. No personally identifying information.</li>
                <li><strong>Approximate region</strong> (derived from your browser timezone) — used to route community counterfeit alerts to nearby users.</li>
                <li><strong>Community reports</strong> you submit (brand, product name, details you type) — shared with other users to warn them. Anonymous.</li>
              </ul>
              <p><strong className="text-zinc-100">What we do NOT collect:</strong></p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Your name, email, or phone number (unless you sign in with magic link — then only your email)</li>
                <li>GPS coordinates (we strip EXIF metadata from all images before processing)</li>
                <li>Browsing history outside this app</li>
              </ul>
              <p><strong className="text-zinc-100">Image processing:</strong> All images are processed through AI vision models hosted by our service provider. Images are stripped of EXIF metadata (including GPS, camera serial numbers) before processing.</p>
              <p><strong className="text-zinc-100">Data retention:</strong> Scan images are retained for 30 days, then automatically deleted. Scan metadata (verdict, flags, timestamp) is retained for community learning. Community reports are retained indefinitely (anonymized).</p>
              <p><strong className="text-zinc-100">Your rights:</strong> You can delete your scan history at any time from the History panel. If you sign in, you can request full data export or deletion by contacting us.</p>
              <p className="text-xs text-zinc-500">This app complies with the Nigeria Data Protection Regulation (NDPR) and GDPR. For data requests, contact privacy@authverify.app.</p>
            </TabsContent>

            <TabsContent value="terms" className="mt-4 space-y-3 text-sm text-zinc-300">
              <h3 className="text-base font-semibold text-amber-300">Terms of Service</h3>
              <p><strong className="text-zinc-100">1. Acceptance.</strong> By using AuthVerify, you accept these terms. If you do not accept them, do not use the app.</p>
              <p><strong className="text-zinc-100">2. Service description.</strong> AuthVerify is a free tool that provides AI-generated preliminary assessments of product authenticity based on photos you submit. It is not a certification service.</p>
              <p><strong className="text-zinc-100">3. No warranty.</strong> The service is provided "as is" without warranties of any kind. We do not guarantee that verdicts are accurate, complete, or reliable. <strong className="text-zinc-100">You use the app at your own risk.</strong></p>
              <p><strong className="text-zinc-100">4. Limitation of liability.</strong> To the maximum extent permitted by law, AuthVerify and its operators are not liable for any damages arising from the use of or reliance on the app's verdicts, including but not limited to: consuming a product based on a verdict, financial losses, health consequences, or damage to reputation.</p>
              <p><strong className="text-zinc-100">5. Acceptable use.</strong> You agree not to: (a) submit images that are not product photos, (b) attempt to overwhelm or hack the service, (c) submit false community reports, (d) use the app to harass or defame any brand or business.</p>
              <p><strong className="text-zinc-100">6. Community reports.</strong> Reports you submit are anonymous and become part of the community alert feed. You are responsible for the accuracy of the information you submit. Knowingly submitting false reports may result in access being revoked.</p>
              <p><strong className="text-zinc-100">7. Brand disputes.</strong> If you represent a brand and believe a verdict or community report is incorrect, contact brands@authverify.app with evidence and we will review and remove it if warranted.</p>
              <p><strong className="text-zinc-100">8. Changes.</strong> We may update these terms and the service at any time. Continued use after changes constitutes acceptance.</p>
              <p className="text-xs text-zinc-500">These terms are governed by the laws of Nigeria. For disputes, the courts of Lagos State have jurisdiction.</p>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
        >
          I understand
        </Button>
      </DialogContent>
    </Dialog>
  )
}
