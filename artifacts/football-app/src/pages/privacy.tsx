export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-foreground">
      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: August 14, 2026</p>

      <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        Livematchmv ("we," "our," or "us") is based in the Maldives and provides live football
        match scores, stats, and related content through our app and website. This Privacy
        Policy explains what information we collect, how we use it, and your rights regarding
        that information. By using Livematchmv, you agree to the practices described in this
        policy.
      </p>

      <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>
      <p className="mb-4 text-muted-foreground leading-relaxed">
        We do not require you to create an account to use Livematchmv. We collect only the
        following limited information:
      </p>
      <p className="mb-2 text-foreground font-semibold">Push Notification Tokens</p>
      <p className="mb-4 text-muted-foreground leading-relaxed">
        If you enable push notifications, we collect a device-specific token that allows us to
        send you match updates, scores, and other alerts. This token does not identify you
        personally and is used solely for delivering notifications.
      </p>
      <p className="mb-2 text-foreground font-semibold">Analytics and Usage Data</p>
      <p className="mb-4 text-muted-foreground leading-relaxed">
        We collect anonymous usage data such as pages visited, features used, and general app
        performance metrics. This helps us understand how the app is used and improve it over
        time. This data is not linked to any personal identity.
      </p>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        We do not collect names, email addresses, passwords, payment information, or any other
        personally identifiable information, since the app does not use user accounts.
      </p>

      <h2 className="text-xl font-bold mb-3">3. How We Use Information</h2>
      <p className="mb-3 text-muted-foreground leading-relaxed">We use the information described above to:</p>
      <ul className="list-disc list-inside mb-8 text-muted-foreground leading-relaxed space-y-1">
        <li>Send push notifications for live scores, match updates, and news</li>
        <li>Understand app usage patterns and improve performance and features</li>
        <li>Diagnose technical issues</li>
      </ul>

      <h2 className="text-xl font-bold mb-3">4. Data Sharing</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        We do not sell your data. We may share limited technical data (such as push tokens or
        anonymous analytics) with service providers who help us operate the app (for example,
        push notification or analytics infrastructure providers), solely for the purposes
        described above.
      </p>

      <h2 className="text-xl font-bold mb-3">5. Data Retention</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        Push notification tokens are retained for as long as you have notifications enabled and
        are deleted when you disable them or uninstall the app. Analytics data is retained in
        aggregated, anonymous form.
      </p>

      <h2 className="text-xl font-bold mb-3">6. Your Choices</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        You can disable push notifications at any time through your device settings or within
        the app. Since we do not maintain user accounts, there is no personal account data to
        request or delete.
      </p>

      <h2 className="text-xl font-bold mb-3">7. Children's Privacy</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        Livematchmv is not directed at children under 13, and we do not knowingly collect
        personal information from children.
      </p>

      <h2 className="text-xl font-bold mb-3">8. Changes to This Policy</h2>
      <p className="mb-8 text-muted-foreground leading-relaxed">
        We may update this Privacy Policy from time to time. Changes will be posted on this page
        with an updated "Last updated" date.
      </p>

      <h2 className="text-xl font-bold mb-3">9. Contact Us</h2>
      <p className="mb-2 text-muted-foreground leading-relaxed">
        If you have questions about this Privacy Policy, contact us:
      </p>
      <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1">
        <li>Email: info@livematchmv.online</li>
        <li>Website: https://livematchmv.online</li>
      </ul>
    </div>
  );
}
