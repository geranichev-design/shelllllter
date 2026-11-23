// A cloned frontend must work even if Figma chooses its own launch command.
// Real API access is an explicit opt-in, never an automatic fallback from demo.
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const DEMO_DATA_KEY = 'shelter-demo-data-v1';
export const DEMO_AUTH_KEY = 'shelter-demo-auth-v1';

export const demoAccounts = [
  { id: 'demo-user-9', email: 'dsns@example.com', role: 'DSNS', orgId: 'demo-organization-1', label: 'ДСНС' },
  { id: 'demo-user-6', email: 'regional@example.com', role: 'REGIONAL', orgId: 'demo-organization-2', label: 'Регіональний орган' },
  { id: 'demo-user-1', email: 'balance-holder@example.com', role: 'BALANCE_HOLDER', orgId: 'demo-organization-5', label: 'Балансоутримувач' },
  { id: 'demo-user-4', email: 'gov-org@example.com', role: 'GOV_ORG', orgId: 'demo-organization-5', label: 'Орган влади' },
];

export function createDemoAuth(role = 'DSNS') {
  const { label: _label, ...user } = demoAccounts.find(account => account.role === role) ?? demoAccounts[0];
  // A preview marker, never a credential accepted by the real backend.
  return { accessToken: 'demo-preview-only', user };
}
