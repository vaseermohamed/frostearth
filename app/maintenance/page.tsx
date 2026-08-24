/**
 * Where MAINTENANCE_MODE redirects the entire public site (see
 * middleware.ts). Deliberately static — no nav, no cart, no database
 * query — this has to render even if the thing making the site need
 * maintenance is the database itself.
 */
export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="font-display font-black text-2xl text-ink mb-3">We&apos;re making some updates</h1>
        <p className="text-slate text-sm">Back shortly — thanks for your patience.</p>
      </div>
    </div>
  );
}
