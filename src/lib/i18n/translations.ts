/**
 * AuthVerify translations.
 *
 * Supports English (en) and French (fr) — the two most critical languages
 * for the Africa-first market. Adding a new language: copy the `en` object,
 * translate the values, add the locale code to `SUPPORTED_LOCALES`.
 *
 * Keys are namespaced by component/feature for organization.
 */

export type Locale = 'en' | 'fr'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr']

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
}

type TranslationDict = Record<string, string>

const en: TranslationDict = {
  // App
  'app.name': 'AuthVerify',
  'app.tagline': 'Counterfeit detection co-pilot',

  // Header
  'header.manufacturerPortal': 'Manufacturer portal',
  'header.regulatorDashboard': 'Regulator dashboard',
  'header.scanBarcode': 'Scan barcode with camera',
  'header.communityAlerts': 'Community alerts',
  'header.scanHistory': 'Scan history',
  'header.legalPrivacy': 'Legal & privacy',
  'header.enableAlerts': 'Enable alerts',
  'header.alertsOn': 'Alerts on',
  'header.signIn': 'Sign in',
  'header.signOut': 'Sign out',
  'header.online': 'Online',
  'header.offline': 'Offline',
  'header.queued': 'queued',
  'header.syncing': 'Syncing',
  'header.local': 'Local',
  'header.scanner': 'Scanner',

  // Mode switcher
  'mode.quickScan': 'Quick Scan',
  'mode.deepCompare': 'Deep Compare',

  // Camera
  'camera.centerProduct': 'Center the product inside the frame',
  'camera.tapToScan': 'Center the product, then tap the amber button below',
  'camera.retryCamera': 'Retry camera',
  'camera.startingCamera': 'Starting camera…',

  // Photo capture
  'photo.title': 'Snap or upload a product photo',
  'photo.description': 'Deep Compare searches the web for genuine reference images and checks your photo against them. Take a clear, well-lit, straight-on shot of the packaging.',
  'photo.takePhoto': 'Take a photo',
  'photo.uploadGallery': 'Upload from gallery',
  'photo.verifyFirst': 'Take or upload a photo first',
  'photo.verifyOriginals': 'Verify against originals',
  'photo.verifying': 'Verifying…',
  'photo.reviewPrompt': 'Review your photo — is the product sharp, well-lit, and filling the frame?',

  // Category picker
  'category.autoDetect': 'Auto-detect',
  'category.autoDetectDesc': 'Let the AI identify the category from the image',

  // Verdict
  'verdict.likelyAuthentic': 'Likely Authentic',
  'verdict.highRisk': 'High Risk — Likely Counterfeit',
  'verdict.inconclusive': 'Inconclusive',
  'verdict.authenticDesc': 'No major red flags detected. Treat as a preliminary check, not a guarantee.',
  'verdict.highRiskDesc': 'Multiple red flags detected. Do not use this product. Report it to protect others.',
  'verdict.inconclusiveDesc': 'Not enough evidence to reach a verdict. Try Deep Compare for a stronger check.',
  'verdict.confidence': 'Confidence',
  'verdict.whyVerdict': 'Why this verdict',
  'verdict.reportFake': 'Report this fake',
  'verdict.scanAnother': 'Scan another',

  // Flags
  'flags.redFlags': 'Red flags',
  'flags.positives': 'Authenticity indicators',

  // Quick scan footer
  'footer.howToScan': 'Center the product, then tap the amber button below',

  // Onboarding
  'onboarding.verifyTitle': 'Verify any product in seconds',
  'onboarding.verifyBody': 'Point your camera at a medicine, cosmetic, beverage, or any branded product. AuthVerify checks for counterfeit red flags using AI vision analysis.',
  'onboarding.twoWaysTitle': 'Two ways to check',
  'onboarding.twoWaysBody': 'Quick Scan analyzes your photo instantly. Deep Compare searches the web for genuine reference images and compares your photo side-by-side with the real thing.',
  'onboarding.communityTitle': 'Protect your community',
  'onboarding.communityBody': 'When you spot a fake, report it. Other users nearby get alerted instantly. Together we can push counterfeits out of the market — every report makes the app smarter for everyone.',
  'onboarding.startScanning': 'Start scanning',
  'onboarding.next': 'Next',
  'onboarding.skip': 'Skip onboarding',

  // Scan history
  'history.title': 'Scan history',
  'history.empty': 'No scans yet. Verify your first product and it will appear here.',

  // Community alerts
  'alerts.title': 'Community alerts',
  'alerts.live': 'Live',
  'alerts.offline': 'Offline',
  'alerts.empty': 'No alerts yet. You will be notified here when other users in your region report a counterfeit.',
  'alerts.connecting': 'Connecting to the community alert network…',
  'alerts.clearAll': 'Clear all',
  'alerts.toastTitle': 'Counterfeit alert nearby',

  // Community report form
  'report.title': 'Report a counterfeit',
  'report.description': 'Your report helps other users in your region avoid this fake. Reports are anonymous — your identity is not shared.',
  'report.brand': 'Brand',
  'report.productName': 'Product name',
  'report.details': 'What made you suspect it?',
  'report.detailsPlaceholder': 'e.g. The hologram was missing and the expiry date was smudged…',
  'report.submit': 'Submit report',
  'report.submitting': 'Submitting…',
  'report.cancel': 'Cancel',

  // Feedback
  'feedback.title': 'Was this verdict correct?',
  'feedback.correct': 'Correct',
  'feedback.partially': 'Partially',
  'feedback.wrong': 'Wrong',
  'feedback.recorded': 'Feedback recorded',
  'feedback.addDetails': 'Add details',
  'feedback.detailsPlaceholder': "What was wrong? (e.g. 'It said authentic but the hologram was clearly missing')",

  // Barcode
  'barcode.scanning': 'Scan barcode',
  'barcode.pointAt': 'Point at the product barcode',
  'barcode.productLookup': 'Product lookup',
  'barcode.verifyVisually': 'Verify visually',
  'barcode.scanAnother': 'Scan another',

  // Legal
  'legal.title': 'Legal & Privacy',
  'legal.disclaimer': 'Disclaimer',
  'legal.privacy': 'Privacy',
  'legal.terms': 'Terms',
  'legal.understand': 'I understand',

  // Offline
  'offline.queued': 'Scan queued',
  'offline.queueDesc': 'You are offline. The scan will process automatically when you reconnect.',
  'offline.queueDeep': 'You are offline. Deep Compare will run automatically when you reconnect.',
  'offline.networkDropped': 'Network dropped — will retry when online.',
  'offline.completed': 'Offline scan completed',
  'offline.completedDesc': 'Your queued scan has been processed.',
}

const fr: TranslationDict = {
  // App
  'app.name': 'AuthVerify',
  'app.tagline': 'Assistant de détection de contrefaçon',

  // Header
  'header.manufacturerPortal': 'Portail fabricant',
  'header.regulatorDashboard': 'Tableau régulateur',
  'header.scanBarcode': 'Scanner le code-barres',
  'header.communityAlerts': 'Alertes communautaires',
  'header.scanHistory': 'Historique des scans',
  'header.legalPrivacy': 'Mentions légales',
  'header.enableAlerts': 'Activer les alertes',
  'header.alertsOn': 'Alertes activées',
  'header.signIn': 'Se connecter',
  'header.signOut': 'Se déconnecter',
  'header.online': 'En ligne',
  'header.offline': 'Hors ligne',
  'header.queued': 'en file',
  'header.syncing': 'Synchronisation',
  'header.local': 'Local',
  'header.scanner': 'Scanner',

  // Mode switcher
  'mode.quickScan': 'Scan rapide',
  'mode.deepCompare': 'Comparaison approfondie',

  // Camera
  'camera.centerProduct': 'Centrez le produit dans le cadre',
  'camera.tapToScan': 'Centrez le produit, puis appuyez sur le bouton ambre ci-dessous',
  'camera.retryCamera': 'Réessayer la caméra',
  'camera.startingCamera': 'Démarrage de la caméra…',

  // Photo capture
  'photo.title': 'Prenez ou téléchargez une photo du produit',
  'photo.description': 'La comparaison approfondie recherche des images de référence authentiques sur le web et compare votre photo avec celles-ci. Prenez une photo claire, bien éclairée et de face de l\'emballage.',
  'photo.takePhoto': 'Prendre une photo',
  'photo.uploadGallery': 'Télécharger depuis la galerie',
  'photo.verifyFirst': 'Prenez ou téléchargez d\'abord une photo',
  'photo.verifyOriginals': 'Vérifier par rapport aux originaux',
  'photo.verifying': 'Vérification…',
  'photo.reviewPrompt': 'Vérifiez votre photo — le produit est-il net, bien éclairé et remplit-il le cadre?',

  // Category picker
  'category.autoDetect': 'Détection auto',
  'category.autoDetectDesc': 'Laisser l\'IA identifier la catégorie depuis l\'image',

  // Verdict
  'verdict.likelyAuthentic': 'Probablement authentique',
  'verdict.highRisk': 'Risque élevé — Probablement contrefait',
  'verdict.inconclusive': 'Non concluant',
  'verdict.authenticDesc': 'Aucun signe d\'alerte majeur détecté. À considérer comme une vérification préliminaire, pas une garantie.',
  'verdict.highRiskDesc': 'Plusieurs signes d\'alerte détectés. N\'utilisez pas ce produit. Signalez-le pour protéger les autres.',
  'verdict.inconclusiveDesc': 'Pas assez de preuves pour un verdict. Essayez la comparaison approfondie pour une vérification plus forte.',
  'verdict.confidence': 'Confiance',
  'verdict.whyVerdict': 'Pourquoi ce verdict',
  'verdict.reportFake': 'Signaler cette contrefaçon',
  'verdict.scanAnother': 'Scanner un autre produit',

  // Flags
  'flags.redFlags': 'Signes d\'alerte',
  'flags.positives': 'Indicateurs d\'authenticité',

  // Quick scan footer
  'footer.howToScan': 'Centrez le produit, puis appuyez sur le bouton ambre ci-dessous',

  // Onboarding
  'onboarding.verifyTitle': 'Vérifiez n\'importe quel produit en quelques secondes',
  'onboarding.verifyBody': 'Pointez votre caméra vers un médicament, cosmétique, boisson ou tout produit de marque. AuthVerify vérifie les signes de contrefaçon avec une analyse visuelle par IA.',
  'onboarding.twoWaysTitle': 'Deux façons de vérifier',
  'onboarding.twoWaysBody': 'Le scan rapide analyse votre photo instantanément. La comparaison approfondie recherche des images de référence authentiques sur le web et compare votre photo côte à côte avec la vraie.',
  'onboarding.communityTitle': 'Protégez votre communauté',
  'onboarding.communityBody': 'Quand vous repérez une contrefaçon, signalez-la. Les autres utilisateurs à proximité sont alertés instantanément. Ensemble, nous pouvons éliminer les contrefaçons du marché — chaque signalement rend l\'application plus intelligente pour tous.',
  'onboarding.startScanning': 'Commencer à scanner',
  'onboarding.next': 'Suivant',
  'onboarding.skip': 'Passer l\'intro',

  // Scan history
  'history.title': 'Historique des scans',
  'history.empty': 'Aucun scan pour l\'instant. Vérifiez votre premier produit et il apparaîtra ici.',

  // Community alerts
  'alerts.title': 'Alertes communautaires',
  'alerts.live': 'En direct',
  'alerts.offline': 'Hors ligne',
  'alerts.empty': 'Aucune alerte pour l\'instant. Vous serez notifié ici lorsque d\'autres utilisateurs de votre région signalent une contrefaçon.',
  'alerts.connecting': 'Connexion au réseau d\'alertes communautaires…',
  'alerts.clearAll': 'Tout effacer',
  'alerts.toastTitle': 'Alerte contrefaçon à proximité',

  // Community report form
  'report.title': 'Signaler une contrefaçon',
  'report.description': 'Votre signalement aide les autres utilisateurs de votre région à éviter cette contrefaçon. Les signalements sont anonymes — votre identité n\'est pas partagée.',
  'report.brand': 'Marque',
  'report.productName': 'Nom du produit',
  'report.details': 'Qu\'est-ce qui vous a fait soupçonner?',
  'report.detailsPlaceholder': 'ex. L\'hologramme manquait et la date d\'expiration était brouillée…',
  'report.submit': 'Envoyer le signalement',
  'report.submitting': 'Envoi…',
  'report.cancel': 'Annuler',

  // Feedback
  'feedback.title': 'Ce verdict était-il correct?',
  'feedback.correct': 'Correct',
  'feedback.partially': 'Partiellement',
  'feedback.wrong': 'Faux',
  'feedback.recorded': 'Commentaire enregistré',
  'feedback.addDetails': 'Ajouter des détails',
  'feedback.detailsPlaceholder': "Qu\'est-ce qui n\'allait pas? (ex. 'Il a dit authentique mais l\'hologramme manquait clairement')",

  // Barcode
  'barcode.scanning': 'Scanner le code-barres',
  'barcode.pointAt': 'Pointez vers le code-barres du produit',
  'barcode.productLookup': 'Recherche produit',
  'barcode.verifyVisually': 'Vérifier visuellement',
  'barcode.scanAnother': 'Scanner un autre',

  // Legal
  'legal.title': 'Mentions légales',
  'legal.disclaimer': 'Avertissement',
  'legal.privacy': 'Confidentialité',
  'legal.terms': 'Conditions',
  'legal.understand': 'J\'ai compris',

  // Offline
  'offline.queued': 'Scan en file',
  'offline.queueDesc': 'Vous êtes hors ligne. Le scan sera traité automatiquement à la reconnexion.',
  'offline.queueDeep': 'Vous êtes hors ligne. La comparaison approfondie s\'exécutera automatiquement à la reconnexion.',
  'offline.networkDropped': 'Connexion perdue — nouvelle tentative à la reconnexion.',
  'offline.completed': 'Scan hors ligne terminé',
  'offline.completedDesc': 'Votre scan en file a été traité.',
}

export const translations: Record<Locale, TranslationDict> = { en, fr }

/** Detect the best locale from the browser's language settings. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language
  if (!lang) return 'en'
  if (lang.toLowerCase().startsWith('fr')) return 'fr'
  return 'en'
}
