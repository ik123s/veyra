import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useUser, useClerk } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, ChevronRight, CircleHelp,
  Clipboard, CreditCard, Eye, FileText, Fingerprint, Gauge, Home, LockKeyhole, LogOut,
  Menu, Moon, MoreHorizontal, Send, Settings, ShieldCheck, Smartphone, Sparkles,
  Sun, UserRound, Wallet, X
} from 'lucide-react';
import {
  getGetMyAccountQueryKey, getGetWalletStatsQueryKey, getGetTransactionQueryKey,
  getListNotificationsQueryKey, getListTransactionsQueryKey, getSearchAccountQueryKey,
  useChangePin, useCreateMyAccount, useCreateTransfer, useGetMyAccount, useGetTransaction,
  useGetWalletStats, useListNotifications, useListTransactions, useSearchAccount,
  useSimulateService, useUpdateMyAccount, useUpdateNotification
} from '@workspace/api-client-react';
import type { Notification, Recipient, Transaction, UserProfile, WalletStats } from '@workspace/api-client-react';

const naira = (amount?: number) => `₦${Number(amount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (value?: string) => value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const errorText = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Something did not work. Please try again.';
};
const navGroups = [
  { label: 'YOUR SPACE', items: [
    { href: '/dashboard', label: 'Overview', icon: Home }, { href: '/wallet', label: 'Virtual wallet', icon: Wallet },
    { href: '/transfer', label: 'Send demo money', icon: Send }, { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
    { href: '/transactions', label: 'Transactions', icon: FileText }, { href: '/notifications', label: 'Notifications', icon: Bell },
  ] },
  { label: 'SIMULATIONS', items: [
    { href: '/services/airtime', label: 'Airtime & data', icon: Smartphone }, { href: '/services/bills', label: 'Bills', icon: CreditCard },
    { href: '/services/betting', label: 'Betting', icon: Gauge }, { href: '/services/other', label: 'Other services', icon: MoreHorizontal },
  ] },
  { label: 'ACCOUNT', items: [
    { href: '/profile', label: 'Profile', icon: UserRound }, { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/privacy', label: 'Privacy', icon: ShieldCheck }, { href: '/security', label: 'Security & PIN', icon: LockKeyhole },
  ] },
];

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand">
    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
    <span>Naira<span className="brand-light">Demo</span></span>
  </Link>;
}

function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'line' | 'quiet' | 'danger' }) {
  return <button {...props} className={`button button-${variant} ${props.className ?? ''}`}>{children}</button>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Notice({ children, tone = 'good' }: { children: ReactNode; tone?: 'good' | 'bad' | 'info' }) {
  return <div className={`notice notice-${tone}`} role="status">{children}</div>;
}
function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}
function DemoLabel() { return <span className="demo-label"><span /> SIMULATION ONLY</span>; }
function LoadingBlock({ label = 'Loading your private account…' }: { label?: string }) {
  return <div className="panel loading-panel"><div className="skeleton-line wide" /><div className="skeleton-line" /><span>{label}</span></div>;
}
function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="panel failure"><div className="status-icon"><CircleHelp size={20} /></div><strong>We could not load this just now</strong><p>{errorText(error)}</p>{retry && <Button variant="line" onClick={retry}>Try again</Button>}</div>;
}

export function Landing() {
  return <div className="landing app-grain">
    <header className="landing-nav"><Brand /><nav><a href="#how-it-works">How it works</a><a href="#privacy-note">Your privacy</a></nav><div className="landing-actions"><Link href="/sign-in" className="text-link">Sign in</Link><Link href="/sign-up" className="button button-primary">Create account <ArrowRight size={16} /></Link></div></header>
    <main>
      <section className="hero">
        <div className="hero-copy enter"><div className="hero-kicker"><span className="kicker-mark">₦</span> A little practice goes a long way</div><h1>Money moves.<br /><em>Nothing real</em> leaves.</h1><p>Meet your own Nigerian virtual wallet. Try sending, receiving and everyday services using demo money — safely, simply, and entirely in-app.</p><div className="hero-actions"><Link href="/sign-up" className="button button-primary button-large">Start with ₦500,000,000 <ArrowRight size={17} /></Link><Link href="/sign-in" className="button button-line button-large">I already have an account</Link></div><div className="hero-proof"><ShieldCheck size={17} /><span>No real banking. No payments. Just a safe place to learn.</span></div></div>
        <div className="hero-art" aria-label="Virtual wallet illustration">
          <div className="sun-disc" /><div className="orbit orbit-a" /><div className="orbit orbit-b" />
          <div className="receipt"><span className="receipt-overline">YOUR NAIRA DEMO</span><div className="receipt-naira">₦</div><strong>₦500,000,000</strong><small>Virtual Balance / Demo Money</small><div className="receipt-row"><span>Practice transfer</span><b>Ready when you are</b></div><div className="receipt-bottom"><span className="tiny-dot" /> PRIVATE BY DESIGN <span>·</span> MADE FOR YOU</div></div>
          <div className="hero-stamp">PRACTICE<br />WITH PEACE<br /><b>OF MIND</b></div><span className="art-caption">A wallet for learning, not spending.</span>
        </div>
      </section>
      <section className="trust-strip"><div><span className="strip-icon">01</span><strong>Made for everyday Nigerians</strong><small>Simple language, familiar naira.</small></div><div><span className="strip-icon">02</span><strong>One private in-app profile</strong><small>Your demo account is yours.</small></div><div><span className="strip-icon">03</span><strong>No real money involved</strong><small>Every action stays a simulation.</small></div></section>
      <section id="how-it-works" className="story-section"><div className="story-aside"><span className="eyebrow">A SAFE PLACE TO TRY</span><div className="story-number">01 / 03</div></div><div className="story-main"><h2>Get comfortable<br />before it counts.</h2><p>Start with a ₦500,000,000 demo balance. Explore the familiar rhythms of a wallet, from checking your balance to sending demo money to another Naira Demo account.</p><div className="story-steps"><div><span>01</span><strong>Make it yours</strong><p>Create a private in-app profile and choose your username.</p></div><div><span>02</span><strong>Try the everyday</strong><p>Send, receive and explore clearly labelled simulations.</p></div><div><span>03</span><strong>Learn at your pace</strong><p>Your activity stays inside this demo environment.</p></div></div></div></section>
      <section className="feature-band"><div className="feature-art"><div className="feature-card"><div className="feature-card-top"><span>NAIRA DEMO</span><span>VIRTUAL WALLET</span></div><div className="feature-card-center"><span>Virtual Balance / Demo Money</span><strong>₦500,000,000</strong></div><div className="feature-card-bottom"><span>IN-APP ACCOUNT</span><span>•••• 2048</span></div></div><div className="feature-orb" /></div><div className="feature-copy"><span className="eyebrow">BUILT FOR PRACTICE</span><h2>Real-world flows.<br /><em>Imaginary money.</em></h2><p>Transfers between registered demo accounts let you see how a payment flow works, without touching a bank or payment provider.</p><Link href="/sign-up" className="text-link text-link-arrow">Create your in-app account <ArrowRight size={16} /></Link></div></section>
      <section id="privacy-note" className="privacy-section"><div className="privacy-mark"><ShieldCheck size={26} /></div><div><span className="eyebrow">YOUR DETAILS, YOUR CHOICE</span><h2>Private by default.<br />Clear about what is shared.</h2><p>Your username can help other in-app users find you. Choose whether it is displayed in your own account. Your original registered name remains directly below your username when shown. No activity here reaches a real financial service.</p><a href="#privacy-note" className="text-link text-link-arrow">Read our privacy boundaries <ArrowRight size={16} /></a></div><div className="privacy-aside"><b>IN-APP ONLY</b><span>Nothing connects<br />to real banking.</span></div></section>
      <section className="closing-cta"><span className="eyebrow">YOUR FIRST STEP IS A SAFE ONE</span><h2>Ready to give it a try?</h2><p>Set up your account. We’ll put ₦500,000,000 in your virtual wallet.</p><Link href="/sign-up" className="button button-primary button-large">Create your demo account <ArrowRight size={17} /></Link><small>Virtual Balance / Demo Money — no real monetary value.</small></section>
    </main>
    <footer className="landing-footer"><Brand /><span>For practice, not payments.</span><div><a href="#privacy-note">Privacy</a><Link href="/sign-in">Sign in</Link></div></footer>
  </div>;
}

export function Onboarding() {
  const { user } = useUser();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const create = useCreateMyAccount();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault(); setMessage('');
    create.mutate({ data: { firstName: firstName.trim(), lastName: lastName.trim(), username: username.trim(), phone: phone.trim(), dateOfBirth, pin } }, {
      onSuccess: () => { client.invalidateQueries({ queryKey: getGetMyAccountQueryKey() }); setLocation('/dashboard'); },
      onError: (err) => setMessage(errorText(err)),
    });
  };
  return <div className="auth-frame"><div className="auth-side"><Brand inverse /><span className="eyebrow">YOUR IN-APP PROFILE</span><h1>A fresh start,<br /><em>on your terms.</em></h1><p>Your new Naira Demo account comes with ₦500,000,000 Virtual Balance / Demo Money. This is not real money.</p><div className="auth-side-note"><ShieldCheck size={18} /> All account activity stays inside the simulation.</div></div><div className="auth-form-wrap"><form className="panel onboarding-form" onSubmit={submit}><div className="eyebrow">ONE LAST STEP</div><h2>Make this account yours</h2><p>Choose the profile details you’ll use inside Naira Demo.</p>
    <Field label="First name"><input required minLength={1} maxLength={50} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" data-testid="input-first-name" /></Field>
    <Field label="Last name"><input required minLength={1} maxLength={50} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" data-testid="input-last-name" /></Field>
    <Field label="Username" hint="3–24 characters. Letters, numbers and underscores."><div className="username-input"><span>@</span><input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} placeholder="yourname" data-testid="input-username" /></div></Field>
    <Field label="Nigerian mobile number" hint="Use the international format, such as +2348012345678."><input required type="tel" inputMode="tel" pattern="\+234[789][0-9]{9}" maxLength={14} value={phone} onChange={e => setPhone(e.target.value.replace(/\s/g, ''))} placeholder="+2348012345678" data-testid="input-phone" /></Field>
    <Field label="Date of birth"><input required type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} data-testid="input-date-of-birth" /></Field>
    <Field label="Set a 4–6 digit wallet PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" data-testid="input-pin" /></Field>
    {message && <Notice tone="bad">{message}</Notice>}{create.isError && !message && <Notice tone="bad">{errorText(create.error)}</Notice>}
    <Button type="submit" disabled={create.isPending} className="button-full">{create.isPending ? 'Setting up your account…' : 'Create my demo account'} <ArrowRight size={16} /></Button>
    <small className="fineprint">This is an in-app simulation. We do not collect NIN or biometric data, and no real bank account is created.</small>
  </form></div></div>;
}

function AccountGate({ children }: { children: (profile: UserProfile) => ReactNode }) {
  const query = useGetMyAccount();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (query.isError && (query.error as { status?: number })?.status === 404) setLocation('/onboarding');
  }, [query.isError, query.error, setLocation]);
  useEffect(() => { if (query.data?.theme) document.documentElement.classList.toggle('dark', query.data.theme === 'dark'); }, [query.data?.theme]);
  if (query.isLoading) return <AppFrame><LoadingBlock /></AppFrame>;
  if (query.isError) {
    if ((query.error as { status?: number })?.status === 404) return <AppFrame><LoadingBlock label="Taking you to account setup…" /></AppFrame>;
    return <AppFrame><Failure error={query.error} retry={() => query.refetch()} /></AppFrame>;
  }
  if (!query.data) return <AppFrame><LoadingBlock /></AppFrame>;
  return <AppFrame profile={query.data}>{children(query.data)}</AppFrame>;
}

function AppFrame({ children, profile }: { children: ReactNode; profile?: UserProfile }) {
  const [path] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const { signOut } = useClerk();
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: !!profile, refetchInterval: profile ? 20_000 : false } });
  const unread = Array.isArray(notifications.data) ? notifications.data.filter(n => !n.isRead).length : 0;
  return <div className="app-frame">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Brand inverse /><button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X size={19} /></button></div>
      {profile && <div className="sidebar-user"><div className="user-initial">{(profile.originalName || 'N').slice(0, 1).toUpperCase()}</div><div className="user-meta">{profile.showUsername ? <><b data-testid="text-username">@{profile.username}</b><span>{profile.originalName}</span></> : <><b>{profile.originalName}</b><span>Private profile</span></>}</div></div>}
      <nav className="side-nav">{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-caption">{group.label}</div>{group.items.map(item => { const Icon = item.icon; const active = path === item.href || path.startsWith(`${item.href}/`); return <Link href={item.href} key={item.href} onClick={() => setMobileMenu(false)} className={`nav-link ${active ? 'nav-active' : ''}`} data-testid={`link-nav-${item.href.slice(1).replaceAll('/', '-')}`}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.href === '/notifications' && unread > 0 && <i>{unread}</i>}</Link>; })}</div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-demo-note"><span className="note-dash" />This is a simulation.<br />No real money moves.</div><button className="nav-link signout-link" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })}><LogOut size={17} /><span>Sign out</span></button></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    <main className="main-area"><header className="topbar"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={20} /></button><div className="topbar-breadcrumb">Naira Demo <ChevronRight size={14} /> <span>{path === '/' ? 'Home' : path.split('/').filter(Boolean).map(x => x.replaceAll('-', ' ')).join(' / ')}</span></div><div className="topbar-right"><DemoLabel /><Link href="/notifications" className="top-notice" aria-label="Notifications"><Bell size={18} />{unread > 0 && <i />}</Link><Link href="/profile" className="top-profile">{profile?.showUsername ? <><b>@{profile.username}</b><span>{profile.originalName}</span></> : <b>{profile?.originalName?.split(' ')[0] || 'Account'}</b>}</Link></div></header><div className="page-content enter">{children}</div><footer className="app-footer"><span>Naira Demo is a simulation. No real funds or external services.</span><Link href="/privacy">Privacy boundaries <ArrowRight size={13} /></Link></footer></main>
  </div>;
}

function BalanceCard({ profile, balance, compact = false }: { profile: UserProfile; balance: number; compact?: boolean }) {
  return <div className={`balance-card ${compact ? 'balance-card-compact' : ''}`}><div className="balance-card-head"><span>Virtual Balance / Demo Money</span><span className="balance-symbol">₦</span></div><strong data-testid="text-virtual-balance">{naira(balance)}</strong><div className="balance-card-foot"><span className="balance-identity">{profile.showUsername ? <><b>@{profile.username}</b><small>{profile.originalName}</small></> : <b>{profile.originalName}</b>}</span><span><ShieldCheck size={14} /> In-app only</span></div><div className="balance-decoration">₦</div></div>;
}
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="stat-panel"><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}
function TransactionRow({ transaction: tx }: { transaction: Transaction }) {
  const incoming = tx.direction === 'received';
  return <Link href={`/transactions/${encodeURIComponent(tx.transactionId || tx.id)}`} className="transaction-row" data-testid={`row-transaction-${tx.id}`}><div className={`transaction-mark ${incoming ? 'mark-in' : tx.direction === 'activity' ? 'mark-activity' : ''}`}>{incoming ? <ArrowDownLeft size={17} /> : tx.direction === 'activity' ? <Sparkles size={16} /> : <ArrowUpRight size={17} />}</div><div className="transaction-info"><strong>{tx.title}</strong><span>{dateText(tx.createdAt)} <i>·</i> {tx.status}</span></div><b className={`transaction-amount ${incoming ? 'amount-in' : ''}`}>{tx.amount > 0 ? `${incoming ? '+' : '−'}${naira(tx.amount)}` : '—'}</b><ChevronRight className="row-chevron" size={15} /></Link>;
}
function ActivityList({ transactions, loading, error, retry, limit }: { transactions?: Transaction[]; loading: boolean; error?: unknown; retry?: () => void; limit?: number }) {
  if (loading) return <div className="activity-loading"><div /><div /><div /></div>;
  if (error) return <Failure error={error} retry={retry} />;
  if (!transactions?.length) return <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><strong>No activity yet</strong><p>Your in-app activity will appear here when you try a flow.</p></div>;
  return <div className="transaction-list">{transactions.slice(0, limit).map(tx => <TransactionRow transaction={tx} key={tx.id} />)}</div>;
}

export function Dashboard() {
  const { data: profile } = useGetMyAccount();
  const stats = useGetWalletStats();
  const transactions = useListTransactions();
  const [, setLocation] = useLocation();
  if (!profile) return <LoadingBlock />;
  return <><PageTitle eyebrow="YOUR PRIVATE SPACE" title={`Good to see you${profile.originalName ? `, ${profile.originalName.split(' ')[0]}` : ''}.`} detail="Your Naira Demo account, at a glance." action={<Link href="/transfer" className="button button-primary"><Send size={16} /> Send demo money</Link>} />
    {stats.isLoading ? <div className="balance-skeleton" /> : stats.isError ? <Failure error={stats.error} retry={() => stats.refetch()} /> : <BalanceCard profile={profile} balance={stats.data?.virtualBalance ?? profile.virtualBalance} />}
    <div className="quick-actions"><Link href="/transfer"><span className="quick-icon"><Send size={18} /></span><b>Send</b><small>to an in-app account</small><ArrowRight size={15} /></Link><Link href="/receive"><span className="quick-icon"><ArrowDownLeft size={18} /></span><b>Receive</b><small>share your account</small><ArrowRight size={15} /></Link><Link href="/wallet"><span className="quick-icon"><Wallet size={18} /></span><b>Wallet</b><small>see your activity</small><ArrowRight size={15} /></Link></div>
    <div className="section-row"><div><div className="eyebrow">A CLEAR PICTURE</div><h2>Your wallet, this month</h2></div><Link href="/wallet" className="text-link">Full overview <ArrowRight size={15} /></Link></div>
    {stats.isLoading ? <div className="stats-grid"><div className="balance-skeleton" /><div className="balance-skeleton" /><div className="balance-skeleton" /></div> : stats.isError ? null : <StatsGrid stats={stats.data} />}
    <div className="section-row activity-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>What’s happened</h2></div><Link href="/transactions" className="text-link">All transactions <ArrowRight size={15} /></Link></div>
    <div className="panel activity-panel"><ActivityList transactions={transactions.data} loading={transactions.isLoading} error={transactions.error} retry={() => transactions.refetch()} limit={5} /></div>
    <div className="dashboard-note"><ShieldCheck size={17} /><span>Every balance shown is Virtual Balance / Demo Money. Nothing here connects to a real bank or payment service.</span><button onClick={() => setLocation('/privacy')}>How it works</button></div>
  </>;
}
function StatsGrid({ stats }: { stats?: WalletStats }) {
  if (!stats) return <Failure error="Wallet statistics are unavailable." />;
  return <div className="stats-grid"><Stat label="Sent this month" value={naira(stats.monthlySent)} sub="Virtual Balance / Demo Money" /><Stat label="Received this month" value={naira(stats.monthlyReceived)} sub="Virtual Balance / Demo Money" /><Stat label="All-time activity" value={String(stats.transactionCount)} sub="in-app transactions" /></div>;
}

export function WalletPage() {
  const { data: profile } = useGetMyAccount();
  const stats = useGetWalletStats();
  const transactions = useListTransactions();
  if (!profile) return <LoadingBlock />;
  return <><PageTitle eyebrow="YOUR VIRTUAL WALLET" title="The whole picture." detail="Every number here is demo money, held only in this in-app simulation." /><div className="wallet-layout"><div>{stats.isLoading ? <div className="balance-skeleton" /> : stats.isError ? <Failure error={stats.error} retry={() => stats.refetch()} /> : <BalanceCard profile={profile} balance={stats.data?.virtualBalance ?? profile.virtualBalance} />}</div><div className="stats-grid wallet-stats">{stats.isLoading ? <div className="balance-skeleton" /> : stats.isError ? null : <StatsGrid stats={stats.data} />}</div></div><div className="section-row activity-heading"><div><div className="eyebrow">YOUR WALLET HISTORY</div><h2>Transactions</h2></div><Link href="/transactions" className="text-link">View full history <ArrowRight size={15} /></Link></div><div className="panel activity-panel"><ActivityList transactions={transactions.data} loading={transactions.isLoading} error={transactions.error} retry={() => transactions.refetch()} /></div></>;
}

export function TransferPage() {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const profileQuery = useGetMyAccount();
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<Transaction | null>(null);
  const requestRef = useRef<{ key: string; id: string } | null>(null);
  const requestStorageKey = 'naira-demo-transfer-request';
  const recipientQuery = useSearchAccount({ query: searchTerm }, { query: { enabled: searchTerm.length >= 3, queryKey: getSearchAccountQueryKey({ query: searchTerm }), retry: false } });
  const transfer = useCreateTransfer();
  const doSearch = (e: FormEvent) => { e.preventDefault(); setRecipient(null); setMessage(''); setSearchTerm(search.trim().replace(/^@/, '')); };
  useEffect(() => { if (recipientQuery.data) setRecipient(recipientQuery.data); }, [recipientQuery.data]);
  const send = (e: FormEvent) => {
    e.preventDefault(); if (!recipient) return;
    setMessage('');
    const transferKey = `${recipient.accountNumber}:${Number(amount)}`;
    let storedRequest: { key: string; id: string } | null = null;
    try {
      const raw = sessionStorage.getItem(requestStorageKey);
      if (raw) storedRequest = JSON.parse(raw) as { key: string; id: string };
    } catch { storedRequest = null; }
    const existing = requestRef.current?.key === transferKey ? requestRef.current : storedRequest?.key === transferKey ? storedRequest : null;
    if (existing) requestRef.current = existing;
    else {
      try { sessionStorage.removeItem(requestStorageKey); } catch { /* Session storage may be unavailable. */ }
      requestRef.current = { key: transferKey, id: crypto.randomUUID() };
      try { sessionStorage.setItem(requestStorageKey, JSON.stringify(requestRef.current)); } catch { /* In-memory retry remains available. */ }
    }
    transfer.mutate({ data: { clientRequestId: requestRef.current.id, recipientAccountNumber: recipient.accountNumber, amount: Number(amount), pin } }, {
      onSuccess: tx => { requestRef.current = null; try { sessionStorage.removeItem(requestStorageKey); } catch { /* No-op when session storage is unavailable. */ } setSent(tx); setPin(''); client.invalidateQueries({ queryKey: getGetMyAccountQueryKey() }); client.invalidateQueries({ queryKey: getGetWalletStatsQueryKey() }); client.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); },
      onError: err => setMessage(errorText(err)),
    });
  };
  const profile = profileQuery.data;
  return <><PageTitle eyebrow="IN-APP TRANSFER" title="Send demo money." detail="Find a registered Naira Demo account. Transfers never leave this simulation." /><div className="transfer-layout"><div className="transfer-main panel">
    {sent ? <div className="success-state"><div className="success-seal"><Check size={27} /></div><div className="eyebrow">TRANSFER COMPLETE</div><h2>Your demo transfer is on its way.</h2><p>{naira(sent.amount)} Virtual Balance / Demo Money sent to <b>{sent.recipientName || recipient?.originalName}</b>.</p><div className="success-ref"><span>Transaction ID</span><b>{sent.transactionId}</b></div><div className="success-buttons"><Button onClick={() => { setSent(null); setRecipient(null); setSearch(''); setSearchTerm(''); setAmount(''); }}>Send another</Button><Button variant="line" onClick={() => setLocation(`/transactions/${encodeURIComponent(sent.transactionId)}`)}>View details <ArrowRight size={15} /></Button></div></div> : <>
    <div className="transfer-step"><span>01</span><div><h2>Who are you sending to?</h2><p>Search by exact username or account number.</p></div></div>
    <form className="search-recipient" onSubmit={doSearch}><div className="search-field"><span>@</span><input value={search} onChange={e => { setSearch(e.target.value); setSearchTerm(''); setRecipient(null); }} placeholder="Username or account number" minLength={3} required data-testid="input-recipient-search" /><button type="submit" aria-label="Find account"><ArrowRight size={17} /></button></div></form>
    {recipientQuery.isFetching && <div className="inline-state">Looking for that account…</div>}
    {recipientQuery.isError && searchTerm && <Notice tone="bad">No account found for “{searchTerm}”. Check the details and try again.</Notice>}
    {recipient && <div className="recipient-card"><div className="recipient-avatar">{recipient.originalName.slice(0,1).toUpperCase()}</div><div><strong>{recipient.originalName}</strong><span>{recipient.username ? `@${recipient.username}` : 'Username private'}</span><small>Account · {recipient.accountNumber}</small></div><span className="verified"><ShieldCheck size={15} /> Verified</span></div>}
    <div className="transfer-divider" />
    <form className="transfer-fields" onSubmit={send}><div className="transfer-step"><span>02</span><div><h2>How much demo money?</h2><p>Choose an amount to send in the simulation.</p></div></div>
      <Field label="Amount (₦)" hint="Virtual Balance / Demo Money"><div className="amount-input"><span>₦</span><input type="number" min="1" max="100000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" data-testid="input-transfer-amount" /></div></Field>
      <Field label="Confirm with your 4–6 digit PIN"><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={e => setPin(e.target.value)} required placeholder="••••" data-testid="input-transfer-pin" /></Field>
      {message && <Notice tone="bad">{message}</Notice>}{transfer.isError && !message && <Notice tone="bad">{errorText(transfer.error)}</Notice>}
      <div className="transfer-confirm"><span>Recipient</span><b>{recipient?.originalName || 'Select a recipient above'}</b><span>Amount</span><b>{naira(Number(amount))} <small>Virtual Balance / Demo Money</small></b></div>
      <Button type="submit" disabled={!recipient || !amount || !pin || transfer.isPending} className="button-full">{transfer.isPending ? 'Sending demo money…' : 'Confirm demo transfer'} <ArrowRight size={16} /></Button>
      <small className="fineprint"><LockKeyhole size={13} /> This transfer stays inside Naira Demo. No bank or payment network is contacted.</small>
    </form></>}
  </div><aside className="transfer-aside"><div className="aside-badge"><ShieldCheck size={18} /> SAFE TO PRACTICE</div><h3>How this works</h3><ol><li><span>1</span><div><b>Find an account</b><p>Recipients must have their own Naira Demo profile.</p></div></li><li><span>2</span><div><b>Review the details</b><p>Double-check the recipient and amount before sending.</p></div></li><li><span>3</span><div><b>Confirm with your PIN</b><p>Only a simulation balance is adjusted.</p></div></li></ol><div className="aside-note"><b>Virtual Balance / Demo Money</b><strong>{profile ? naira(profile.virtualBalance) : '—'}</strong><small>Available in your demo wallet</small></div></aside></div></>;
}

export function ReceivePage() {
  const profileQuery = useGetMyAccount();
  const profile = profileQuery.data;
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (!profile?.accountNumber) return; try { await navigator.clipboard.writeText(profile.accountNumber); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  if (profileQuery.isLoading) return <LoadingBlock />;
  if (profileQuery.isError || !profile) return <Failure error={profileQuery.error} retry={() => profileQuery.refetch()} />;
  return <><PageTitle eyebrow="RECEIVE IN THE SIMULATION" title="Your in-app details." detail="Share these only with another Naira Demo user who wants to practise sending." /><div className="receive-grid"><div className="receive-card"><div className="receive-card-top"><Brand inverse /><span>DEMO ACCOUNT</span></div><div className="receive-owner"><span>ACCOUNT HOLDER</span><strong>{profile.showUsername ? `@${profile.username}` : profile.originalName}</strong><small>{profile.showUsername ? profile.originalName : 'Username hidden from your account display'}</small></div><div className="receive-number"><span>IN-APP ACCOUNT NUMBER</span><strong>{profile.accountNumber}</strong><button onClick={copy} aria-label="Copy account number" data-testid="button-copy-account">{copied ? <><Check size={15} /> Copied</> : <><Clipboard size={15} /> Copy number</>}</button></div><div className="receive-card-foot"><ShieldCheck size={15} /> Only for Naira Demo simulations · no real deposits</div></div><div className="receive-instructions"><div className="eyebrow">HOW TO RECEIVE</div><h2>Keep it in the family.</h2><p>Someone with a Naira Demo account can send you demo money using these in-app details.</p><div className="instruction-list"><div><span>01</span><p>Share your Naira Demo account number.</p></div><div><span>02</span><p>They find and verify your in-app profile.</p></div><div><span>03</span><p>Their demo transfer appears in your activity.</p></div></div><Notice tone="info">These details cannot receive funds from a bank, card, or any external payment service.</Notice></div></div></>;
}

export function TransactionsPage() {
  const query = useListTransactions();
  const [filter, setFilter] = useState('all');
  const items = Array.isArray(query.data) ? query.data.filter(tx => filter === 'all' || tx.direction === filter) : [];
  return <><PageTitle eyebrow="YOUR PRIVATE HISTORY" title="Transactions." detail="A record of your in-app demo activity." action={<Link href="/transfer" className="button button-primary"><Send size={15} /> Send demo money</Link>} /><div className="filter-tabs" role="tablist">{[['all','All activity'],['sent','Sent'],['received','Received'],['activity','Simulations']].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'filter-active' : ''}>{label}</button>)}</div><div className="panel activity-panel"><ActivityList transactions={items} loading={query.isLoading} error={query.error} retry={() => query.refetch()} /></div></>;
}
export function TransactionDetailPage() {
  const params = useParams<{ transactionId: string }>();
  const id = decodeURIComponent(params.transactionId || '');
  const query = useGetTransaction(id, { query: { queryKey: getGetTransactionQueryKey(id), enabled: !!id } });
  const tx = query.data;
  if (query.isLoading) return <LoadingBlock label="Loading transaction details…" />;
  if (query.isError || !tx) return <><Link href="/transactions" className="back-link"><ArrowLeft size={15} /> Back to transactions</Link><Failure error={query.error} retry={() => query.refetch()} /></>;
  const incoming = tx.direction === 'received';
  return <><Link href="/transactions" className="back-link"><ArrowLeft size={15} /> Back to transactions</Link><PageTitle eyebrow="TRANSACTION DETAILS" title={tx.title} detail={dateText(tx.createdAt)} /><div className="detail-layout"><div className="panel detail-panel"><div className={`detail-icon ${incoming ? 'mark-in' : ''}`}>{incoming ? <ArrowDownLeft size={21} /> : <ArrowUpRight size={21} />}</div><span className="detail-label">AMOUNT · VIRTUAL BALANCE / DEMO MONEY</span><strong className={`detail-amount ${incoming ? 'amount-in' : ''}`}>{incoming ? '+' : '−'}{naira(tx.amount)}</strong><div className="detail-rows"><div><span>Status</span><b className="status-pill">{tx.status}</b></div><div><span>Type</span><b>{tx.transactionType}</b></div><div><span>Transaction ID</span><b>{tx.transactionId}</b></div><div><span>Date</span><b>{dateText(tx.createdAt)}</b></div>{tx.senderName && <div><span>From</span><b>{tx.senderUsername ? `@${tx.senderUsername}` : tx.senderName}<small>{tx.senderName}</small></b></div>}{tx.recipientName && <div><span>To</span><b>{tx.recipientUsername ? `@${tx.recipientUsername}` : tx.recipientName}<small>{tx.recipientName}</small></b></div>}</div></div><div className="panel detail-aside"><ShieldCheck size={22} /><h3>In-app activity</h3><p>This record belongs to your private Naira Demo history. It does not represent a real bank transaction.</p><DemoLabel /></div></div></>;
}

export function NotificationsPage() {
  const client = useQueryClient();
  const query = useListNotifications();
  const update = useUpdateNotification();
  const [error, setError] = useState('');
  const markRead = (n: Notification) => { setError(''); update.mutate({ notificationId: n.id, data: { isRead: true } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListNotificationsQueryKey() }), onError: e => setError(errorText(e)) }); };
  return <><PageTitle eyebrow="ACCOUNT UPDATES" title="Notifications." detail="Private alerts about your Naira Demo activity." /><div className="notification-toolbar"><span>{query.data?.filter(n => !n.isRead).length ?? 0} unread</span><button disabled={update.isPending || !query.data?.some(n => !n.isRead)} onClick={() => query.data?.filter(n => !n.isRead).forEach(markRead)}>Mark all as read</button></div>{error && <Notice tone="bad">{error}</Notice>}{query.isLoading ? <LoadingBlock label="Checking your notifications…" /> : query.isError ? <Failure error={query.error} retry={() => query.refetch()} /> : !query.data?.length ? <div className="panel empty-state empty-notifications"><div className="empty-icon"><Bell size={21} /></div><strong>You’re all caught up.</strong><p>There are no account notifications yet.</p></div> : <div className="notification-list">{query.data.map(n => <article className={`notification-item ${n.isRead ? 'is-read' : ''}`} key={n.id}><span className="notification-mark">{n.isRead ? <Check size={16} /> : <Bell size={16} />}</span><div className="notification-content"><div className="notification-top"><strong>{n.title}</strong><time>{dateText(n.createdAt)}</time></div><p>{n.message}</p><span className="notification-type">{n.type.replaceAll('_', ' ')}</span></div>{!n.isRead && <button className="mark-read-button" disabled={update.isPending} onClick={() => markRead(n)}>Mark read</button>}</article>)}</div>}</>;
}

export function ProfilePage() {
  const client = useQueryClient();
  const query = useGetMyAccount();
  const update = useUpdateMyAccount();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (query.data) { setName(query.data.originalName); setUsername(query.data.username); } }, [query.data]);
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <Failure error={query.error} retry={() => query.refetch()} />;
  const save = (e: FormEvent) => { e.preventDefault(); setMessage(''); update.mutate({ data: { originalName: name.trim(), username: username.trim().replace(/^@/, '') } }, { onSuccess: () => { setMessage('Your profile has been updated.'); client.invalidateQueries({ queryKey: getGetMyAccountQueryKey() }); }, onError: err => setMessage(errorText(err)) }); };
  return <><PageTitle eyebrow="YOUR ACCOUNT" title="Profile." detail="The name you registered with and your in-app username." /><div className="settings-layout"><form className="panel settings-panel" onSubmit={save}><div className="panel-heading"><div className="settings-icon"><UserRound size={19} /></div><div><h2>Profile details</h2><p>Update your details for this in-app account.</p></div></div><Field label="Original registered name"><input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} data-testid="input-profile-name" /></Field><Field label="Username" hint="Letters, numbers and underscores only. 3–24 characters."><div className="username-input"><span>@</span><input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} data-testid="input-profile-username" /></div></Field>{message && <Notice tone={message.includes('updated') ? 'good' : 'bad'}>{message}</Notice>}<Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save profile'} <ArrowRight size={15} /></Button></form><div className="panel profile-preview"><div className="eyebrow">HOW YOUR PROFILE APPEARS</div><div className="preview-person"><div className="user-initial large">{(name || 'N').slice(0,1).toUpperCase()}</div><div>{query.data.showUsername ? <><b>@{username || query.data.username}</b><span>{name || query.data.originalName}</span></> : <><b>{name || query.data.originalName}</b><span>Username hidden from display</span></>}</div></div><p>Your username visibility is controlled in <Link href="/settings">Settings</Link>. Your original name is always kept with your profile.</p><div className="profile-account-num"><span>IN-APP ACCOUNT NUMBER</span><b>{query.data.accountNumber}</b></div></div></div></>;
}

export function SettingsPage() {
  const client = useQueryClient();
  const query = useGetMyAccount();
  const update = useUpdateMyAccount();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <Failure error={query.error} retry={() => query.refetch()} />;
  const change = (field: 'showUsername' | 'notificationsEnabled' | 'theme', value: boolean | 'light' | 'dark') => {
    setNotice(''); setError('');
    update.mutate({ data: { [field]: value } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMyAccountQueryKey() }); setNotice('Your preference has been saved.'); }, onError: e => setError(errorText(e)) });
  };
  const profile = query.data;
  return <><PageTitle eyebrow="MAKE IT YOURS" title="Settings." detail="Choose how your Naira Demo account looks and what it shares." />{notice && <Notice>{notice}</Notice>}{error && <Notice tone="bad">{error}</Notice>}<div className="settings-list">
    <section className="panel preference-row"><div className="pref-icon"><Eye size={19} /></div><div className="pref-copy"><h2>Show username</h2><p>When enabled, your username appears prominently with your original registered name beneath it.</p><Link href="/privacy">Understand what is visible <ArrowRight size={13} /></Link></div><button className={`switch ${profile.showUsername ? 'switch-on' : ''}`} role="switch" aria-checked={profile.showUsername} disabled={update.isPending} onClick={() => change('showUsername', !profile.showUsername)} data-testid="toggle-show-username"><span /></button></section>
    <section className="panel preference-row"><div className="pref-icon"><Bell size={19} /></div><div className="pref-copy"><h2>Notifications</h2><p>Receive in-app notices about activity on your demo account.</p><Link href="/notifications">View notifications <ArrowRight size={13} /></Link></div><button className={`switch ${profile.notificationsEnabled ? 'switch-on' : ''}`} role="switch" aria-checked={profile.notificationsEnabled} disabled={update.isPending} onClick={() => change('notificationsEnabled', !profile.notificationsEnabled)} data-testid="toggle-notifications"><span /></button></section>
    <section className="panel preference-row"><div className="pref-icon">{profile.theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}</div><div className="pref-copy"><h2>Appearance</h2><p>Choose a light or dark look for your private dashboard.</p></div><div className="theme-toggle"><button className={profile.theme === 'light' ? 'theme-selected' : ''} disabled={update.isPending} onClick={() => change('theme', 'light')}><Sun size={14} /> Light</button><button className={profile.theme === 'dark' ? 'theme-selected' : ''} disabled={update.isPending} onClick={() => change('theme', 'dark')}><Moon size={14} /> Dark</button></div></section>
  </div></>;
}

export function PrivacyPage() {
  const query = useGetMyAccount();
  return <><PageTitle eyebrow="CLEAR BY DESIGN" title="Your privacy, plainly." detail="What Naira Demo shows, what it keeps, and what it never does." /><div className="privacy-page-grid"><div className="privacy-main"><section className="panel privacy-block"><div className="privacy-block-icon"><Eye size={19} /></div><div><h2>Your username is your choice</h2><p>{query.data?.showUsername ? <>Show Username is currently on. Your in-app account displays <b>@{query.data.username}</b> prominently, with your original registered name directly below it.</> : 'Show Username is currently off. Your username is not shown prominently in your account.'} Change this at any time in Settings.</p><Link href="/settings" className="text-link">Go to settings <ArrowRight size={14} /></Link></div></section><section className="panel privacy-block"><div className="privacy-block-icon"><Wallet size={19} /></div><div><h2>This is not a bank account</h2><p>Your Virtual Balance / Demo Money exists only inside the Naira Demo simulation. It has no real-world monetary value and cannot be withdrawn or deposited.</p></div></section><section className="panel privacy-block"><div className="privacy-block-icon"><ShieldCheck size={19} /></div><div><h2>No external payments</h2><p>Naira Demo does not connect to banks, card networks, payment providers, airtime operators or billers. Simulated services record practice activity only and do not change your wallet.</p></div></section><section className="panel privacy-block"><div className="privacy-block-icon"><UserRound size={19} /></div><div><h2>Your history is private</h2><p>Your transaction and notification history is for your authenticated in-app account. Other demo users are not given access to your private history.</p></div></section></div><aside className="privacy-aside-card"><div className="privacy-seal"><ShieldCheck size={28} /></div><span className="eyebrow">THE SHORT VERSION</span><strong>Practice safely.<br />Nothing real moves.</strong><div className="privacy-check"><Check size={15} /> In-app profiles only</div><div className="privacy-check"><Check size={15} /> Virtual Balance / Demo Money</div><div className="privacy-check"><Check size={15} /> No external service calls</div></aside></div></>;
}

export function SecurityPage() {
  const changePin = useChangePin();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const query = useGetMyAccount();
  const submit = (e: FormEvent) => {
    e.preventDefault(); setMessage('');
    if (newPin !== confirmPin) { setMessage('Your new PINs do not match.'); return; }
    changePin.mutate({ data: { currentPin, newPin } }, { onSuccess: () => { setMessage('Your in-app PIN has been changed.'); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }, onError: e => setMessage(errorText(e)) });
  };
  return <><PageTitle eyebrow="KEEP YOUR ACCOUNT YOURS" title="Security & PIN." detail="Your PIN is used to confirm transfers between in-app accounts." /><div className="settings-layout"><form className="panel settings-panel" onSubmit={submit}><div className="panel-heading"><div className="settings-icon"><LockKeyhole size={19} /></div><div><h2>Change your wallet PIN</h2><p>Use 4–6 digits. Keep it private.</p></div></div>{query.data?.pinSet && <Field label="Current PIN"><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={currentPin} onChange={e => setCurrentPin(e.target.value)} required data-testid="input-current-pin" /></Field>}<Field label="New PIN"><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value)} required data-testid="input-new-pin" /></Field><Field label="Confirm new PIN"><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value)} required data-testid="input-confirm-pin" /></Field>{message && <Notice tone={message.includes('changed') ? 'good' : 'bad'}>{message}</Notice>}<Button type="submit" disabled={changePin.isPending}>{changePin.isPending ? 'Updating PIN…' : 'Change PIN'} <ArrowRight size={15} /></Button></form><div className="panel pin-guidance"><div className="guidance-icon"><Fingerprint size={22} /></div><h3>A small security habit</h3><p>Choose a number that’s easy for you to remember, but not obvious to someone else.</p><div className="guidance-list"><span><Check size={14} /> Never share your PIN</span><span><Check size={14} /> Confirm recipient before sending</span><span><Check size={14} /> Change it if you think it’s known</span></div><DemoLabel /></div></div></>;
}

const serviceConfig = {
  airtime: { title: 'Airtime & data', eyebrow: 'SERVICE SIMULATION', description: 'Practise a familiar airtime or data purchase flow. This does not top up a phone or contact a mobile network.', options: ['Airtime top-up', 'Data bundle'], input: 'Phone number' },
  bills: { title: 'Bills', eyebrow: 'BILL PAYMENT SIMULATION', description: 'Walk through a bill payment using demo-only details. No provider is contacted and no bill is settled.', options: ['Electricity', 'TV subscription', 'Water'], input: 'Customer or meter reference' },
  betting: { title: 'Betting', eyebrow: 'BETTING SIMULATION', description: 'Explore the shape of an in-app betting wallet flow. No real betting service is connected.', options: ['Practice wallet activity'], input: 'Account reference' },
  other: { title: 'Other services', eyebrow: 'SERVICE SIMULATION', description: 'Submit a made-up service activity to see how a transaction record looks. Nothing is fulfilled.', options: ['Education', 'Transport', 'Other'], input: 'Reference (optional)' },
} as const;
type ServiceSlug = keyof typeof serviceConfig;
export function ServicePage({ kind }: { kind: ServiceSlug }) {
  const client = useQueryClient();
  const config = serviceConfig[kind];
  const simulate = useSimulateService();
  const [option, setOption] = useState<string>(config.options[0]);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [activity, setActivity] = useState<Transaction | null>(null);
  const submit = (e: FormEvent) => { e.preventDefault(); setMessage(''); const serviceType = kind === 'airtime' ? (option.toLowerCase().startsWith('data') ? 'data' : 'airtime') : kind; simulate.mutate({ data: { serviceType, title: `${option}${reference.trim() ? ` · ${reference.trim()}` : ''}`, amount: Number(amount) } }, { onSuccess: tx => { setActivity(tx); setAmount(''); client.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); client.invalidateQueries({ queryKey: getGetWalletStatsQueryKey() }); }, onError: e => setMessage(errorText(e)) }); };
  return <><div className="service-title-line"><PageTitle eyebrow={config.eyebrow} title={config.title} detail={config.description} /><DemoLabel /></div><div className="service-layout"><form className="panel service-form" onSubmit={submit}><div className="simulation-banner"><span className="simulation-stamp">SIMULATION</span><span>No real service is contacted. Your wallet balance will not change.</span></div>{activity && <Notice>Simulation recorded: {activity.title}. No wallet balance was changed.</Notice>}
    <Field label="Choose a service">{config.options.length > 1 ? <select value={option} onChange={e => setOption(e.target.value)} data-testid="select-service-option">{config.options.map(o => <option key={o}>{o}</option>)}</select> : <div className="fixed-option">{option}</div>}</Field>
    {kind !== 'other' && <Field label={config.input} hint="For simulation only — no external service is contacted."><input value={reference} onChange={e => setReference(e.target.value)} required placeholder={kind === 'airtime' ? '080…' : 'Enter a reference'} data-testid="input-service-reference" /></Field>}
    {kind === 'other' && <Field label={config.input}><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" data-testid="input-service-reference" /></Field>}
    <Field label="Amount (₦)" hint="Virtual Balance / Demo Money · this will not be deducted"><div className="amount-input"><span>₦</span><input type="number" min="1" max="100000000" step="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" data-testid="input-service-amount" /></div></Field>
    {message && <Notice tone="bad">{message}</Notice>}{simulate.isError && !message && <Notice tone="bad">{errorText(simulate.error)}</Notice>}
    <Button type="submit" className="button-full" disabled={simulate.isPending}>{simulate.isPending ? 'Recording simulation…' : 'Submit simulation'} <ArrowRight size={16} /></Button><small className="fineprint">This creates simulation-only activity. It does not deduct from your wallet.</small>
  </form><aside className="panel service-aside"><div className="service-aside-icon"><Sparkles size={20} /></div><span className="eyebrow">NOT A REAL PURCHASE</span><h3>Practise the flow.<br />Skip the payment.</h3><p>Submitting records an in-app simulation activity only. It cannot buy airtime, pay a bill or place a bet.</p><div className="service-guard"><ShieldCheck size={16} /> Your Virtual Balance / Demo Money stays unchanged.</div></aside></div></>;
}