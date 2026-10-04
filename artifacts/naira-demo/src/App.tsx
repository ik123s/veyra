import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { ui } from '@clerk/ui';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  Dashboard, Landing, NotificationsPage, Onboarding, PrivacyPage, ProfilePage, ReceivePage,
  SecurityPage, ServicePage, SettingsPage, TransactionDetailPage, TransactionsPage,
  TransferPage, WalletPage
} from '@/pages/app-pages';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#174c40',
    colorForeground: '#203a34',
    colorMutedForeground: '#61736e',
    colorDanger: '#b5453f',
    colorBackground: '#fbf8f1',
    colorInput: '#fffdf8',
    colorInputForeground: '#203a34',
    colorNeutral: '#d9d1c3',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'cl-cardBox rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#203a34] font-bold',
    headerSubtitle: 'text-[#61736e]',
    socialButtonsBlockButtonText: 'text-[#203a34] font-semibold',
    formFieldLabel: 'text-[#203a34] font-semibold',
    footerActionLink: 'text-[#174c40] font-semibold',
    footerActionText: 'text-[#61736e]',
    dividerText: 'text-[#61736e]',
    identityPreviewEditButton: 'text-[#174c40]',
    formFieldSuccessText: 'text-[#267158]',
    alertText: 'text-[#8f332e]',
    logoBox: 'mb-2',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'rounded-xl border-[#d9d1c3] bg-[#fffdf8]',
    formButtonPrimary: 'rounded-xl bg-[#174c40] text-[#fbf8f1] shadow-none',
    formFieldInput: 'rounded-xl border-[#d9d1c3] bg-[#fffdf8] text-[#203a34]',
    footerAction: 'mt-5',
    dividerLine: 'bg-[#e7e0d5]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#d9d1c3] bg-[#fffdf8] text-[#203a34]',
    formFieldRow: 'mb-4',
    main: 'gap-4',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) client.clear();
    previousUserId.current = userId;
  }), [addListener, client]);
  return null;
}

function HomeRedirect() {
  return <>
    <Show when="signed-in"><Redirect to="/dashboard" /></Show>
    <Show when="signed-out"><Landing /></Show>
  </>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="auth-loading"><span /><span /><span /></div>;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function SignInPage() {
  return <div className="clerk-page"><div className="clerk-page-art"><div className="clerk-art-mark">₦</div><span className="eyebrow">A SAFE SPACE TO PRACTISE</span><h1>Your next step,<br /><em>without the risk.</em></h1><p>Sign in to return to your Naira Demo account and pick up where you left off.</p></div><div className="clerk-widget-wrap"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/dashboard`} /></div></div>;
}
function SignUpPage() {
  return <div className="clerk-page"><div className="clerk-page-art"><div className="clerk-art-mark">₦</div><span className="eyebrow">START WITH A VIRTUAL BALANCE</span><h1>Build confidence,<br /><em>one safe step.</em></h1><p>Your account starts with ₦500,000,000 Virtual Balance / Demo Money. No real money is ever involved.</p></div><div className="clerk-widget-wrap"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/onboarding`} /></div></div>;
}

function RouteSwitch() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding"><Protected><Onboarding /></Protected></Route>
      <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
      <Route path="/wallet"><Protected><WalletPage /></Protected></Route>
      <Route path="/transfer"><Protected><TransferPage /></Protected></Route>
      <Route path="/receive"><Protected><ReceivePage /></Protected></Route>
      <Route path="/transactions"><Protected><TransactionsPage /></Protected></Route>
      <Route path="/transactions/:transactionId"><Protected><TransactionDetailPage /></Protected></Route>
      <Route path="/notifications"><Protected><NotificationsPage /></Protected></Route>
      <Route path="/profile"><Protected><ProfilePage /></Protected></Route>
      <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
      <Route path="/privacy"><Protected><PrivacyPage /></Protected></Route>
      <Route path="/security"><Protected><SecurityPage /></Protected></Route>
      <Route path="/services/airtime"><Protected><ServicePage kind="airtime" /></Protected></Route>
      <Route path="/services/bills"><Protected><ServicePage kind="bills" /></Protected></Route>
      <Route path="/services/betting"><Protected><ServicePage kind="betting" /></Protected></Route>
      <Route path="/services/other"><Protected><ServicePage kind="other" /></Protected></Route>
      <Route><div className="not-found"><span className="eyebrow">404 · LOST YOUR WAY?</span><h1>This page isn’t in the demo.</h1><p>The route may have moved, or it may never have existed.</p><Link href="/" className="button button-primary">Return home</Link></div></Route>
    </Switch>
  </ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    ui={ui}
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your private demo account' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Start practising with a virtual wallet' } },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider><RouteSwitch /></TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;