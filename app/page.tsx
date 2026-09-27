"use client";

import { AdviserInputs, Sources } from "./adviser/controls";
import { type Advice, type WebSource } from "./adviser/shared";
import { CoachRequestError, requestCoach } from "./adviser/request";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { ArrowRight, ArrowUpRight, Plus, BriefcaseBusiness, LogOut, LayoutDashboard, MessageSquareText, ChartNoAxesCombined, CircleCheck, Megaphone, Star, Store, MapPin, Sparkles, Wallet, ReceiptText, Coins, ShieldCheck, Activity } from "lucide-react";
import { Brand, WelcomePanel } from "./components/brand-and-insights";

import { BusinessCoach, PremiumInsights, PremiumTeaser, CaptureOptions } from "./components/business-coach";
import { PremiumReport, type PremiumAccess } from "./components/premium-report";
import { PremiumCheckout } from "./components/premium-checkout";
import { MarketingGenerator } from "./components/marketing-generator";
import { AdminDashboard } from "./components/admin-dashboard";
import { AnswerFeedback } from "./components/answer-feedback";
import { computeMetrics } from "./premium/metrics";
import { CoachConversation, CoachResponse, type ConversationTurn } from "./components/coach-conversation";
import { PrivacyAndAccess } from "./components/privacy-and-access";

const navigation = [
  { key: "Home", label: "Business overview", icon: LayoutDashboard },
  { key: "Jobs", label: "Jobs & payments", icon: BriefcaseBusiness },
  { key: "Adviser", label: "Business coach", icon: Sparkles },
  { key: "Insights", label: "Premium insights", icon: ChartNoAxesCombined },
  { key: "Actions", label: "Actions & results", icon: CircleCheck },
  { key: "Visibility", label: "Marketing", icon: Megaphone },
  { key: "Feedback", label: "Customer feedback", icon: MessageSquareText },
  { key: "Shop", label: "Business profile", icon: Store },
  { key: "Privacy", label: "Privacy & access", icon: ShieldCheck },
];
const adminNavigation = { key: "Admin", label: "Admin monitoring", icon: Activity };
const demoKey = (userId: string) => `bizwise-demo-premium:${userId}`;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const db: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

type Shop = {
  id: string;
  name: string;
  town: string;
  whatsapp_number: string | null;
  owner_user_id: string;
};
type Service = { id: string; name: string; shop_id: string };
type Job = {
  id: string;
  shop_id: string;
  service_id: string;
  customer_id: string | null;
  job_date: string;
  description: string | null;
  status: string;
  amount_charged: number | null;
  parts_cost: number;
  other_direct_cost: number;
};
type Payment = {
  id: string;
  job_id: string;
  amount: number;
  paid_at: string;
  method: string;
};
type Action = {
  id: string;
  goal: string;
  evidence_json?: { owner_question?: string; web_sources?: WebSource[]; web_searched?: boolean };
  recommendation: string;
  limitations: string;
  status: string;
  enquiries: number;
  bookings: number;
  attributed_jobs: number;
  result_notes: string | null;
  created_at: string;
};
type Asset = {
  id: string;
  action_id: string;
  body: string;
  channel: string;
  status: string;
  published_at: string | null;
};
type Feedback = {
  id: string;
  job_id: string;
  rating: number | null;
  comment: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(value || 0);

const today = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const loadVersion = useRef(0);
  const coachRequestVersion = useRef(0);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [largerText, setLargerText] = useState(false);
  const [recordsState, setRecordsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("Home");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [shop, setShop] = useState<Shop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  const [authMode, setAuthMode] = useState("sign in");
  const [showPlans, setShowPlans] = useState(false);
  const [subscription, setSubscription] = useState<{ state: "checking" } | { state: "none" } | { state: "active"; expires: string }>({ state: "checking" });
  const [demoReference, setDemoReference] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [shopName, setShopName] = useState("");
  const [town, setTown] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceName, setServiceName] = useState("");

  const [jobEdit, setJobEdit] = useState<string | null>(null);
  const [showJob, setShowJob] = useState(false);
  const [jobForm, setJobForm] = useState({
    service_id: "",
    job_date: today(),
    description: "",
    status: "completed",
    amount_charged: "",
    parts_cost: "",
    other_direct_cost: "",
  });

  const [payJob, setPayJob] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [research, setResearch] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [pendingAdvice, setPendingAdvice] = useState<Advice | null>(null);
  const [figuresConfirmed, setFiguresConfirmed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [offer, setOffer] = useState("");
  const [adService, setAdService] = useState("");
  const [adChannel, setAdChannel] = useState("whatsapp");
  const [adText, setAdText] = useState("");
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  const [fbJob, setFbJob] = useState("");
  const [fbRating, setFbRating] = useState("");
  const [fbComment, setFbComment] = useState("");
  const [period, setPeriod] = useState("all");
  const [learned, setLearned] = useState<string[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatus, setJobStatus] = useState("all");
  const visibleJobs = jobs.filter(job => {
    const service = services.find(item => item.id === job.service_id)?.name || "";
    const matchesText = `${service} ${job.description || ""} ${job.job_date}`.toLowerCase().includes(jobSearch.trim().toLowerCase());
    const paid = payments.filter(payment => payment.job_id === job.id).reduce((total, payment) => total + Number(payment.amount), 0);
    const matchesStatus = jobStatus === "all" || (jobStatus === "unpaid"
      ? job.status === "completed" && Number(job.amount_charged || 0) > paid
      : job.status === jobStatus);
    return matchesText && matchesStatus;
  });

  const premiumAccess: PremiumAccess = subscription.state === "active" ? { kind: "subscribed", expires: subscription.expires }
    : demoReference ? { kind: "demo", reference: demoReference } : subscription.state === "checking" ? { kind: "checking" } : { kind: "locked" };
  const premium = premiumAccess.kind === "subscribed" || premiumAccess.kind === "demo";
  const metrics = useMemo(() => computeMetrics({ jobs, payments, feedback, actions }), [jobs, payments, feedback, actions]);
  const tabs = isAdmin ? [...navigation, adminNavigation] : navigation;

  const clear = () => {
    setError("");
    setMessage("");
  };

  useEffect(() => {
    if (!db) {
      setReady(true);
      return;
    }

    db.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });

    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null)
    );

    return () => subscription.unsubscribe();
  }, []);

  async function load(owner: User) {
    if (!db) return;
    const version = ++loadVersion.current;
    setRecordsState('loading');

    const [sh, admin] = await Promise.all([
      db.from("shops").select("*").eq("owner_user_id", owner.id).maybeSingle(),
      db.rpc("is_platform_admin"),
    ]);

    if (version !== loadVersion.current) return;
    // Admins land on the console and can use it without a business profile.
    if (admin.data === true) { setIsAdmin(true); setTab(current => current === "Home" ? "Admin" : current); }

    if (sh.error) {
      setError('Your business records could not be loaded. Your session may have expired. Retry, or sign out and sign in again.');
      setRecordsState('error');
      return;
    }

    setShop(sh.data);
    if (!sh.data) { setRecordsState('ready'); return; }

    const id = sh.data.id;
    setShopName(sh.data.name);
    setTown(sh.data.town);
    setPhone(sh.data.whatsapp_number || "");

    const results = await Promise.all([
      db.from("services").select("*").eq("shop_id", id).order("name"),
      db.from("jobs").select("*").eq("shop_id", id)
        .order("job_date", { ascending: false }),
      db.from("payments").select("*").eq("shop_id", id),
      db.from("adviser_actions").select("*").eq("shop_id", id)
        .order("created_at", { ascending: false }),
      db.from("marketing_assets").select("*").eq("shop_id", id),
      db.from("feedback").select("*").eq("shop_id", id),
    ]);

    const resultError = results.find(result => result.error)?.error;
    if (version !== loadVersion.current) return;
    if (resultError) {
      setError('Your business records could not be loaded. Please retry before making changes.');
      setRecordsState('error');
      return;
    }

    setServices(results[0].data || []);
    setJobs(results[1].data || []);
    setPayments(results[2].data || []);
    setActions(results[3].data || []);
    setAssets(results[4].data || []);
    setFeedback(results[5].data || []);
    setRecordsState('ready');
    const [progress, entitlement] = await Promise.all([
      db.from("learning_progress").select("lesson_key").eq("owner_user_id", owner.id),
      db.from("business_entitlements").select("expires_at").eq("owner_user_id", owner.id).maybeSingle(),
    ]);
    if (version !== loadVersion.current) return;
    setLearned(progress.error ? [] : (progress.data || []).map(item => item.lesson_key));
    const expires = entitlement.data?.expires_at;
    setSubscription(expires && new Date(expires) > new Date() ? { state: "active", expires } : { state: "none" });
  }

  function activateDemo(reference: string) {
    setDemoReference(reference);
    try { if (user) localStorage.setItem(demoKey(user.id), reference); } catch { /* Demo stays active for this session only. */ }
  }

  const authorize = async () => {
    if (!db || !user) throw new CoachRequestError('Sign in first.');
    const { data: { session } } = await db.auth.getSession();
    if (!session || session.user.id !== user.id) throw new CoachRequestError('Your sign-in has expired. Sign out and sign in again, then retry.');
    return { url: URL, key: KEY, token: session.access_token, origin: window.location.origin };
  };

  async function completeLesson(topic: string) {
    if (!db || !user) return;
    try {
      const result = await db.from("learning_progress").insert({ owner_user_id: user.id, lesson_key: topic });
      if (result.error && result.error.code !== "23505") { setError("Your guide completion could not be saved. Please try again later."); return; }
      setLearned(current => [...new Set([...current, topic])]);
      setMessage("Guide completed. Put the skill into practice, then record the result.");
    } catch { setError("Could not save your progress. Check your connection."); }
  }

  useEffect(() => {
    ++loadVersion.current;
    ++coachRequestVersion.current;
    setConversation([]);
    setBusy(false);
    setShop(null); setJobs([]); setPayments([]); setServices([]);
    setActions([]); setAssets([]); setFeedback([]); setLearned([]);
    setSubscription({ state: "checking" }); setIsAdmin(false); setCheckoutOpen(false); setTab("Home");
    let storedDemo: string | null = null;
    try { storedDemo = user ? localStorage.getItem(demoKey(user.id)) : null; } catch { /* Storage unavailable. */ }
    setDemoReference(storedDemo);
    if (user) {
      void load(user);
    } else {
      setShop(null);
      setJobs([]);
      setPayments([]); setServices([]); setActions([]); setAssets([]); setFeedback([]);
      setShopName(""); setTown(""); setPhone(""); setPassword("");
      setLearned([]);
    }
    setImage(null); setAdvice(null); setPendingAdvice(null); setFiguresConfirmed(false);
    setAnswer(""); setQuestion(""); setCurrentAction(null); setAdText("");
  }, [user?.id]);

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault();
    if (!db) return;

    clear();
    setBusy(true);

    const result = authMode === "sign up"
      ? await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
      : await db.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
    } else if (authMode === "sign up" && !result.data.session) {
      setMessage("Account created. Check your email to confirm it, then sign in.");
    }
  }

  async function saveShop(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !user) return;

    clear();
    setBusy(true);

    const details = {
      name: shopName.trim(),
      town: town.trim(),
      whatsapp_number: phone.trim() || null,
    };

    const result = shop
      ? await db.from("shops").update(details).eq("id", shop.id)
      : await db.from("shops").insert({
          owner_user_id: user.id,
          ...details,
        });

    setBusy(false);

    if (result.error) setError(result.error.message);
    else {
      setMessage("Shop saved");
      await load(user);
    }
  }

  async function addService(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !shop || !user || !serviceName.trim()) return;

    clear();
    const result = await db.from("services").insert({
      shop_id: shop.id,
      name: serviceName.trim(),
    });

    if (result.error) setError(result.error.message);
    else {
      setServiceName("");
      await load(user);
    }
  }

  function openJob(job?: Job) {
    clear();
    setJobEdit(job?.id || null);

    setJobForm(job
      ? {
          service_id: job.service_id,
          job_date: job.job_date,
          description: job.description || "",
          status: job.status,
          amount_charged: String(job.amount_charged ?? ""),
          parts_cost: String(job.parts_cost),
          other_direct_cost: String(job.other_direct_cost),
        }
      : {
          service_id: services[0]?.id || "",
          job_date: today(),
          description: "",
          status: "completed",
          amount_charged: "",
          parts_cost: "",
          other_direct_cost: "",
        });

    setShowJob(true);
    setTab("Jobs");
  }

  async function saveJob(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !shop || !user) return;

    clear();
    const record = {
      shop_id: shop.id,
      service_id: jobForm.service_id,
      job_date: jobForm.job_date,
      description: jobForm.description || null,
      status: jobForm.status,
      amount_charged: jobForm.amount_charged === ""
        ? null
        : Number(jobForm.amount_charged),
      parts_cost: Number(jobForm.parts_cost || 0),
      other_direct_cost: Number(jobForm.other_direct_cost || 0),
    };

    setBusy(true);
    const result = jobEdit
      ? await db.from("jobs").update(record).eq("id", jobEdit)
      : await db.from("jobs").insert(record);
    setBusy(false);

    if (result.error) setError(result.error.message);
    else {
      setShowJob(false);
      setMessage("Job saved");
      await load(user);
    }
  }

  async function savePayment(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !shop || !user) return;

    clear();
    const job = jobs.find(item => item.id === payJob);
    const paid = payments
      .filter(item => item.job_id === payJob)
      .reduce((amount, item) => amount + Number(item.amount), 0);
    const due = Number(job?.amount_charged || 0) - paid;

    if (
      !job ||
      job.status !== "completed" ||
      Number(payAmount) <= 0 ||
      Number(payAmount) > due
    ) {
      setError("Enter a positive amount no more than the outstanding balance.");
      return;
    }

    const result = await db.from("payments").insert({
      shop_id: shop.id,
      job_id: payJob,
      amount: Number(payAmount),
      paid_at: today(),
      method: payMethod,
    });

    if (result.error) setError(result.error.message);
    else {
      setPayAmount("");
      setPayJob("");
      setMessage("Payment recorded");
      await load(user);
    }
  }

  const from = period === "month"
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().slice(0, 10)
    : "0000-01-01";

  const completed = useMemo(
    () => jobs.filter(job =>
      job.status === "completed" && job.job_date >= from
    ),
    [jobs, from]
  );

  const charge = completed.reduce(
    (amount, job) => amount + Number(job.amount_charged || 0),
    0
  );
  const costs = completed.reduce(
    (amount, job) =>
      amount + Number(job.parts_cost) + Number(job.other_direct_cost),
    0
  );
  const received = payments
    .filter(payment => period === "all" || payment.paid_at >= from)
    .reduce((amount, payment) => amount + Number(payment.amount), 0);
  const outstanding = jobs
    .filter(job => job.status === "completed")
    .reduce((amount, job) => {
      const paid = payments
        .filter(payment => payment.job_id === job.id)
        .reduce((value, payment) => value + Number(payment.amount), 0);
      return amount + Math.max(0, Number(job.amount_charged || 0) - paid);
    }, 0);

  async function callAi(which: string, followUp?: string, suppliedQuestion?: string) {
    if (!db || !shop || !user) return;
    const version = ++coachRequestVersion.current;
    const requestQuestion = suppliedQuestion || question;
    const parentAction = which === 'ask' ? currentAction : null;
    clear();
    setBusy(true);
    if (which === "ask") { setFiguresConfirmed(false); setAdText(""); }

    try {
      const { data: { session } } = await db.auth.getSession();
      if (version !== coachRequestVersion.current) return;
      if (!session || session.user.id !== user.id) throw new CoachRequestError('Your sign-in has expired. Sign out and sign in again, then retry your question.');
      const data = await requestCoach({
        url: URL, key: KEY, token: session.access_token, origin: window.location.origin,
        body: {
          goal: which,
          image: which === "ask" && !followUp ? image : undefined,
          research: which === "ask" && !followUp && research,
          question: requestQuestion,
          ...(parentAction ? { parent_action_id: parentAction } : {}),
          ...(followUp ? { follow_up: followUp } : {}),
          offer,
          service: adService,
          channel: adChannel,
        },
      });
      if (version !== coachRequestVersion.current) return;

      if (which === "advert") {
        setAdText(data.answer);
        return;
      }

      setAnswer(data.answer);
      setAdvice(data);
      setCurrentAction(null);
      setPendingAdvice(null);
      setQuestion('');
      setConversation(turns => [...turns, { question: requestQuestion, answer: data.answer }].slice(-12));
      if (data.extraction) {
        setPendingAdvice(data);
      } else {
        try { await saveAdvice(data, version); }
        catch { if (version === coachRequestVersion.current) setError('Your coach replied, but the recommendation could not be saved. Keep this response and check your connection before continuing.'); }
      }
    } catch (error) {
      if (version === coachRequestVersion.current) setError(error instanceof CoachRequestError ? error.message : 'The coaching request could not be prepared. Your question has been kept. Please try again.');
    } finally {
      if (version === coachRequestVersion.current) setBusy(false);
    }
  }

  async function saveAdvice(data: Advice, expectedVersion = coachRequestVersion.current) {
    if (!db || !shop || !user) return;
    const saved = await db.from("adviser_actions").insert({
      shop_id: shop.id, goal: data.goal, evidence_json: data.evidence,
      recommendation: data.answer, limitations: data.evidence.limitations, status: "planned",
    }).select("id").single();
    if (expectedVersion !== coachRequestVersion.current) return;
    if (saved.error) { setError(saved.error.message); return; }
    setPendingAdvice(null);
    setCurrentAction(saved.data.id);
    setMessage("Advice saved. Jobs and payments have not been changed.");
    await load(user);
  }

  async function confirmImageAdvice() {
    if (!pendingAdvice || !figuresConfirmed || busy) return;
    setBusy(true); clear();
    try { await saveAdvice({ ...pendingAdvice, evidence: { ...pendingAdvice.evidence, image_confirmed: true } }); }
    catch { setError("Could not save advice. Try again."); }
    finally { setBusy(false); }
  }

  async function saveAdvert() {
    if (!db || !shop || !user || !currentAction || !adText.trim()) return;

    clear();
    const result = await db.from("marketing_assets").insert({
      shop_id: shop.id,
      action_id: currentAction,
      channel: adChannel,
      body: adText,
      status: "draft",
    });

    if (result.error) setError(result.error.message);
    else {
      setMessage("Advert saved as a draft");
      await load(user);
    }
  }

  async function updateAction(action: Action, patch: Partial<Action>) {
    if (!db || !user) return;
    clear();

    const result = await db.from("adviser_actions")
      .update(patch)
      .eq("id", action.id);

    if (result.error) setError(result.error.message);
    else await load(user);
  }

  async function updateAsset(asset: Asset) {
    if (!db || !user) return;

    const result = await db.from("marketing_assets")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", asset.id);

    if (result.error) setError(result.error.message);
    else await load(user);
  }

  async function saveFeedback(event: React.FormEvent) {
    event.preventDefault();
    if (!db || !shop || !user) return;

    clear();
    const result = await db.from("feedback").insert({
      shop_id: shop.id,
      job_id: fbJob,
      rating: fbRating ? Number(fbRating) : null,
      comment: fbComment.trim() || null,
    });

    if (result.error) setError(result.error.message);
    else {
      setFbComment("");
      setFbRating("");
      setMessage("Feedback saved");
      await load(user);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "Date",
        "Service",
        "Status",
        "Amount charged",
        "Parts",
        "Other direct cost",
        "Left after recorded direct costs",
        "Payments",
      ],
      ...jobs.map(job => [
        job.job_date,
        services.find(service => service.id === job.service_id)?.name || "",
        job.status,
        job.amount_charged ?? "",
        job.parts_cost,
        job.other_direct_cost,
        job.status === "completed"
          ? Number(job.amount_charged || 0) -
            Number(job.parts_cost) -
            Number(job.other_direct_cost)
          : "",
        payments
          .filter(payment => payment.job_id === job.id)
          .reduce((amount, payment) => amount + Number(payment.amount), 0),
      ]),
    ];

    const csv = rows
      .map(row =>
        row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
      )
      .join("\r\n");

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(
      new Blob([csv], { type: "text/csv" })
    );
    link.download = "bizwise-jobs.csv";
    link.click();
    window.URL.revokeObjectURL(link.href);
  }

  if (!ready) {
    return <main className="shell">Loading BizWise…</main>;
  }

  if (!db) {
    return (
      <main className="shell">
        <div className="notice error">
          Supabase URL and publishable key are missing. Set NEXT_PUBLIC_SUPABASE_URL
          and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in GitHub Actions repository variables,
          then run the Deploy GitHub Pages workflow again. For local development,
          set them in .env.local and restart.
        </div>
      </main>
    );
  }

  if (!user) {
    if (showPlans) return <main className="public-plans"><header><Brand/><button className="ghost" onClick={() => setShowPlans(false)}>Back to sign in <ArrowRight size={16}/></button></header><PremiumInsights ctaLabel="Sign in to upgrade" onUpgrade={() => setShowPlans(false)}/></main>;
    return (
      <main className="auth-shell">
        <WelcomePanel/>
        <section className="auth-side">
        <div className="auth-mobile-brand"><Brand/></div>
        <div className="card auth">
          <span className="eyebrow">YOUR BUSINESS WORKSPACE</span>
          <h2>{authMode === "sign in" ? "Sign in to your workspace" : "Start with your business."}</h2>
          <p className="muted">{authMode === "sign in" ? "Sign in to pick up where you left off." : "Create an account to record your work and get practical guidance."}</p>

          <form className="form" onSubmit={handleAuth}>
            <div>
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                autoComplete="email"
                placeholder="you@yourbusiness.co.za"
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                autoComplete={authMode === "sign in" ? "current-password" : "new-password"}
                placeholder="Enter your password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </div>
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : authMode === "sign in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="actions">
            <button
              className="ghost"
              onClick={() => {
                clear();
                setAuthMode(authMode === "sign in" ? "sign up" : "sign in");
              }}
            >
              {authMode === "sign in"
                ? "Create an account"
                : "I have an account"}
            </button>
            <button
              className="ghost"
              onClick={async () => {
                if (!email) {
                  setError("Enter your email first");
                  return;
                }
                const result = await db.auth.resetPasswordForEmail(email);
                setMessage(
                  result.error
                    ? result.error.message
                    : "Password reset email sent"
                );
              }}
            >
              Reset password
            </button>
          </div>

          {message && <div className="notice">{message}</div>}
          {error && <div className="notice error" role="alert">{error}</div>}
          <div className="auth-trust"><ShieldCheck size={16}/> A dedicated space for your business.</div>
          <button className="auth-plans-link" onClick={() => setShowPlans(true)}>Free to start. Explore Premium <ArrowUpRight size={15}/></button>
        </div>
        <p className="auth-copyright">Built for South African micro and small businesses.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell${largerText ? ' larger-text' : ''}`}>
      <a className="skip-link" href="#workspace">Skip to content</a>
      <header className="app-header">
        <Brand/>
        <button className="text-size-toggle" aria-pressed={largerText} onClick={()=>setLargerText(value=>!value)}>Aa <span>{largerText ? 'Standard text' : 'Larger text'}</span></button>
        <div className="business-identity"><span className="business-avatar">{(shop?.name || "B").slice(0,1).toUpperCase()}</span><div><strong>{shop?.name || "Your business"}</strong><span><MapPin size={12}/>{shop?.town || "Let us get you set up"}</span></div></div>
        <button className="ghost signout" aria-label="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/><span>Sign out</span></button>
      </header>
      <aside className="sidebar">
        <p className="nav-caption">WORKSPACE</p>
        <nav className="nav" aria-label="Main navigation">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} disabled={!shop && key !== "Admin"} aria-current={tab === key ? "page" : undefined} className={tab === key ? "active" : ""} onClick={() => { clear(); setTab(key); }}><Icon size={19}/><span>{label}</span>{key === "Insights" && <span className="nav-ai">PRO</span>}</button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="section-kicker">BIZWISE PREMIUM</span><h3>Make more of your business data.</h3><p>Explore deeper insights and planned learning paths.</p><button disabled={!shop} onClick={() => setTab("Insights")}>Explore Premium <ArrowUpRight size={16}/></button></div>
        <div className="sidebar-footer"><span className="status-dot"/> Built around your business</div>
      </aside>
      <div className="workspace" id="workspace" tabIndex={-1}>
      <div className="workspace-heading"><div><p className="eyebrow">BUSINESS WORKSPACE</p><h1>{shop || (isAdmin && tab === "Admin") ? tabs.find(item => item.key === tab)?.label : "Set up your business"}</h1></div><span className="workspace-context"><Store size={15}/>{shop?.town || "Getting started"}</span></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice" role="status">{message}</div>}

      {isAdmin && tab === "Admin" ? <AdminDashboard db={db}/> : recordsState === 'error' ? <section className="card"><h2>Let’s reconnect your workspace</h2><p>Your records have not been replaced. Check your connection, or sign in again if your session has expired.</p><div className="actions"><button className="primary" onClick={()=>{clear(); void load(user);}}>Retry loading</button><button className="ghost" onClick={()=>db.auth.signOut()}>Sign out</button></div></section> : !shop && recordsState === 'loading' ? <section className="card" role="status"><h2>Loading your business</h2><p>Checking your account and saved records…</p></section> : !shop ? (
        <div className="card" style={{ maxWidth: 660 }}>
          <h2>Tell us about your business</h2>
          <p className="muted">
            Start with the basics. You can add services afterwards.
          </p>
          <form className="form" onSubmit={saveShop}>
            <div>
              <label htmlFor="field-1">Business name</label>
              <input id="field-1"
                required
                value={shopName}
                onChange={event => setShopName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="field-2">Town or suburb</label>
              <input id="field-2"
                required
                value={town}
                onChange={event => setTown(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="field-3">WhatsApp number (optional)</label>
              <input id="field-3"
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </div>
            <div className="full">
              <button className="primary" disabled={busy}>
                Save business <ArrowRight size={16} style={{ display: "inline" }} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {tab === "Home" && (
            <>
              <div className="overview-intro"><div><span className="section-kicker">UNDERSTAND. LEARN. ACT. IMPROVE.</span><h2>What needs your attention?</h2><p>A practical next step, grounded in what is happening in your business.</p></div><span className="workspace-plan">FREE WORKSPACE</span></div>
              <BusinessCoach outstanding={outstanding} jobCount={jobs.filter(job => job.status === "completed").length} feedbackCount={feedback.length} onNavigate={setTab} learned={learned} onLearn={completeLesson}/>
              <CaptureOptions onRecord={() => openJob()} onCoach={() => setTab("Adviser")}/>

              <div className="overview-toolbar">
                <label htmlFor="overview-period" style={{ alignSelf: "center", margin: 0 }}>Your business at a glance</label>
                <select
                  id="overview-period"
                  style={{ width: 170 }}
                  value={period}
                  onChange={event => setPeriod(event.target.value)}
                >
                  <option value="all">All records</option>
                  <option value="month">This month</option>
                </select>
              </div>

              <div className="stats">
                <div className="card stat">
                  <span className="stat-icon"><BriefcaseBusiness size={19}/></span><small>Completed jobs</small>
                  <strong>{completed.length}</strong>
                </div>
                <div className="card stat">
                  <span className="stat-icon"><ReceiptText size={19}/></span><small>Amount charged</small>
                  <strong>{money(charge)}</strong>
                </div>
                <div className="card stat">
                  <span className="stat-icon"><Wallet size={19}/></span><small>Payments received</small>
                  <strong>{money(received)}</strong>
                </div>
                <div className="card stat">
                  <span className="stat-icon"><Coins size={19}/></span><small>Recorded direct costs</small>
                  <strong>{money(costs)}</strong>
                </div>
              </div>

              <div className="grid money-grid" style={{ marginTop: 20 }}>
                <div className="card">
                  <span className="eyebrow">PAYMENTS TO COLLECT</span><h2>Money to follow up</h2>
                  <p style={{ fontSize: 30, fontWeight: 800 }}>
                    {money(outstanding)}
                  </p>
                  <p className="muted">
                    Outstanding across all completed jobs.
                  </p>
                  <button className="dark" onClick={() => setTab("Jobs")}>
                    View jobs
                  </button>
                </div>
                <div className="card">
                  <span className="eyebrow">CHARGES LESS DIRECT COSTS</span><h2>After your direct costs</h2>
                  <p style={{ fontSize: 30, fontWeight: 800 }}>
                    {money(charge - costs)}
                  </p>
                  <p className="muted">
                    For the selected period. This is not net profit: rent,
                    wages and other costs may be missing.
                  </p>
                  <button className="dark" onClick={() => setTab("Adviser")}>
                    Ask BizWise
                  </button>
                </div>
              </div>
              <PremiumTeaser onOpen={() => setTab("Insights")}/>

            </>
          )}

          {tab === "Insights" && <PremiumReport key={user.id} access={premiumAccess} shopName={shop.name} businessType={services[0]?.name || ""} metrics={metrics} onUpgrade={() => setCheckoutOpen(true)} authorize={authorize}/>}          {tab === "Privacy" && <PrivacyAndAccess/>}

          {tab === "Shop" && (
            <div className="grid">
              <div className="card">
                <h2>Business details</h2>
                <form className="form" onSubmit={saveShop}>
                  <div>
                    <label htmlFor="field-4">Business name</label>
                    <input id="field-4"
                      required
                      value={shopName}
                      onChange={event => setShopName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="field-5">Town</label>
                    <input id="field-5"
                      required
                      value={town}
                      onChange={event => setTown(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="field-6">WhatsApp number</label>
                    <input id="field-6"
                      value={phone}
                      onChange={event => setPhone(event.target.value)}
                    />
                  </div>
                  <div className="full">
                    <button className="primary">Save changes</button>
                  </div>
                </form>
              </div>

              <div className="card">
                <h2>Services</h2>
                {services.map(service => (
                  <div className="row" key={service.id}>
                    <span>
                      <BriefcaseBusiness size={16} style={{ display: "inline" }} />
                      {" "}{service.name}
                    </span>
                  </div>
                ))}
                <form onSubmit={addService} style={{ marginTop: 15 }}>
                  <label>Add a service</label>
                  <div className="actions" style={{ marginTop: 5 }}>
                    <input
                      placeholder="e.g. Hair styling, repairs or cleaning"
                      value={serviceName}
                      onChange={event => setServiceName(event.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="dark">Add</button>
                  </div>
                </form>
                <button
                  className="ghost"
                  style={{ marginTop: 20 }}
                  onClick={exportCsv}
                >
                  Export jobs to CSV
                </button>
              </div>
            </div>
          )}

          {tab === "Jobs" && (
            <>
              <div className="top">
                <div>
                  <h2>Every job. Every payment.</h2>
                  <p className="muted">
                    Record the work, then record money when it is actually paid.
                  </p>
                </div>
                <button className="primary" onClick={() => openJob()}>
                  <Plus size={16} style={{ display: "inline" }} /> Add job
                </button>
              </div>

              {services.length === 0 && (
                <div className="notice">
                  Add a service in Shop before recording a job.{" "}
                  <button className="ghost" onClick={() => setTab("Shop")}>
                    Go to Shop
                  </button>
                </div>
              )}

              {showJob && (
                <div className="card" style={{ marginBottom: 18 }}>
                  <h2>{jobEdit ? "Edit job" : "New job"}</h2>
                  <form className="form" onSubmit={saveJob}>
                    <div>
                      <label htmlFor="field-7">Service</label>
                      <select id="field-7"
                        required
                        value={jobForm.service_id}
                        onChange={event => setJobForm({
                          ...jobForm,
                          service_id: event.target.value,
                        })}
                      >
                        <option value="">Select a service</option>
                        {services.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="field-8">Job date</label>
                      <input id="field-8"
                        type="date"
                        required
                        value={jobForm.job_date}
                        onChange={event => setJobForm({
                          ...jobForm,
                          job_date: event.target.value,
                        })}
                      />
                    </div>
                    <div>
                      <label htmlFor="field-9">Job status</label>
                      <select id="field-9"
                        value={jobForm.status}
                        onChange={event => setJobForm({
                          ...jobForm,
                          status: event.target.value,
                        })}
                      >
                        <option value="completed">Completed</option>
                        <option value="draft">Draft</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="field-10">Amount charged (R)</label>
                      <input id="field-10"
                        type="number"
                        min="0"
                        step="0.01"
                        required={jobForm.status === "completed"}
                        value={jobForm.amount_charged}
                        onChange={event => setJobForm({
                          ...jobForm,
                          amount_charged: event.target.value,
                        })}
                      />
                    </div>
                    <div>
                      <label htmlFor="field-11">Materials / parts cost (R)</label>
                      <input id="field-11"
                        type="number"
                        min="0"
                        step="0.01"
                        value={jobForm.parts_cost}
                        onChange={event => setJobForm({
                          ...jobForm,
                          parts_cost: event.target.value,
                        })}
                      />
                    </div>
                    <div>
                      <label htmlFor="field-12">Other direct cost (R)</label>
                      <input id="field-12"
                        type="number"
                        min="0"
                        step="0.01"
                        value={jobForm.other_direct_cost}
                        onChange={event => setJobForm({
                          ...jobForm,
                          other_direct_cost: event.target.value,
                        })}
                      />
                    </div>
                    <div className="full">
                      <label htmlFor="field-13">Description (optional)</label>
                      <textarea id="field-13"
                        value={jobForm.description}
                        onChange={event => setJobForm({
                          ...jobForm,
                          description: event.target.value,
                        })}
                      />
                    </div>
                    <div className="full">
                      <p className="muted">
                        Left after recorded direct costs:{" "}
                        <strong>
                          {money(
                            Number(jobForm.amount_charged || 0) -
                            Number(jobForm.parts_cost || 0) -
                            Number(jobForm.other_direct_cost || 0)
                          )}
                        </strong>
                        . This is not net profit.
                      </p>
                      <div className="actions">
                        <button className="primary" disabled={busy}>
                          Save job
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setShowJob(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              <div className="card">
                <div className="jobs-toolbar">
                  <input aria-label="Search jobs" placeholder="Search services, notes or dates…" value={jobSearch} onChange={event => setJobSearch(event.target.value)}/>
                  <select aria-label="Filter jobs" value={jobStatus} onChange={event => setJobStatus(event.target.value)}><option value="all">All jobs</option><option value="unpaid">Payment due</option><option value="completed">Completed</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select>
                  <span className="results-count" role="status">{visibleJobs.length} {visibleJobs.length === 1 ? "job" : "jobs"}</span>
                </div>
                {jobs.length === 0 ? (
                  <div className="empty">
                    <BriefcaseBusiness size={32}/><strong>Your work belongs here.</strong><p>Record your first job to start building a clearer picture.</p><button className="primary" onClick={() => openJob()}>Record a job <Plus size={16}/></button>
                  </div>
                ) : visibleJobs.length === 0 ? <div className="empty"><BriefcaseBusiness size={30}/><strong>No matching jobs</strong><p>Try another search or show all jobs.</p><button className="ghost" onClick={() => {setJobSearch(""); setJobStatus("all");}}>Clear filters</button></div> : visibleJobs.map(job => {
                  const paid = payments
                    .filter(payment => payment.job_id === job.id)
                    .reduce(
                      (amount, payment) => amount + Number(payment.amount),
                      0
                    );

                  return (
                    <div className="row job-row" key={job.id}>
                      <div>
                        <span className={`pill job-status ${job.status}`}>{job.status === "completed" ? Number(job.amount_charged || 0) <= paid ? "Paid" : paid > 0 ? "Part paid" : "Payment due" : job.status}</span>
                        <strong>
                          {services.find(service =>
                            service.id === job.service_id
                          )?.name || "Service"}
                        </strong>
                        <div className="muted compact">
                          {job.job_date} · {job.status} ·{" "}
                          {job.description || "No description"}
                        </div>
                        <div className="compact">
                          Charged {money(Number(job.amount_charged || 0))} ·{" "}
                          Paid {money(paid)} · Outstanding{" "}
                          {money(Math.max(
                            0,
                            Number(job.amount_charged || 0) - paid
                          ))}
                        </div>
                        {job.status === "completed" && (
                          <div className="muted compact">
                            Left after recorded direct costs:{" "}
                            {money(
                              Number(job.amount_charged || 0) -
                              Number(job.parts_cost) -
                              Number(job.other_direct_cost)
                            )}
                          </div>
                        )}
                      </div>
                      <div className="actions">
                        <button
                          className="ghost"
                          onClick={() => openJob(job)}
                        >
                          Edit
                        </button>
                        {job.status === "completed" &&
                          Number(job.amount_charged || 0) > paid && (
                            <button
                              className="dark"
                              onClick={() => {
                                setPayJob(job.id);
                                setPayAmount("");
                              }}
                            >
                              Add payment
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {payJob && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h2>Record a payment</h2>
                  <form className="form" onSubmit={savePayment}>
                    <div>
                      <label htmlFor="field-14">Amount received (R)</label>
                      <input id="field-14"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={event => setPayAmount(event.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="field-15">Method</label>
                      <select id="field-15"
                        value={payMethod}
                        onChange={event => setPayMethod(event.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="eft">EFT</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="full actions">
                      <button className="primary">Save payment</button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPayJob("")}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {tab === "Adviser" && (
            <div className="grid">
              <div className="card">
                <span className="eyebrow"><Sparkles size={14}/> YOUR BUSINESS COACH</span><h2>What is happening in your business?</h2>
                <p className="muted">
                  Get a short guide and one practical next step for payments,
                  costs, records, feedback or marketing. Figures are calculated
                  from your saved records; AI helps select the topic.
                </p>
                <label htmlFor="bizwise-question">
                  What would you like advice on?
                </label>
                <textarea
                  id="bizwise-question"
                  value={question}
                  disabled={busy || listening}
                  maxLength={500}
                  onChange={event => setQuestion(event.target.value)}
                  placeholder="For example: Many customers still owe me money. Which payments should I follow up first?"
                />
                <AdviserInputs question={question} setQuestion={setQuestion} image={image} setImage={setImage} busy={busy} listening={listening} setListening={setListening} research={research} setResearch={setResearch}/>
                <p className="muted compact">
                  Ask about jobs, prices, payments, customers or feedback.
                </p>
                <div className="question-prompts" aria-label="Question ideas">{["Which unpaid jobs should I follow up first?", "Which services bring in the most income?", "What are competitors near my shop offering?"].map(prompt => <button key={prompt} type="button" disabled={busy || listening} onClick={() => setQuestion(prompt)}>{prompt}<ArrowUpRight size={13}/></button>)}</div>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || listening || !!pendingAdvice || question.trim().length < 8}
                    onClick={() => callAi("ask")}
                  >
                    {busy ? "Thinking…" : "Ask BizWise"}
                  </button>
                </div>
                {jobs.filter(job => job.status === "completed").length < 3 && (
                  <div className="notice">
                    You have fewer than three completed jobs recorded.
                    Advice will be limited until you add more.
                  </div>
                )}
              </div>

              <div className="card">
                <div className="section-heading"><h2>Your next move</h2><span className="mini-icon"><Sparkles size={18}/></span></div>
                {answer ? (
                  <>
                    {advice?.extraction && <div className="notice"><h3>What was read from your image</h3><p className="answer">{advice.extraction}</p><p>These figures may be wrong. Compare every amount, date and quantity against the original. If incorrect, replace or crop the image and ask again. Nothing is entered into jobs or payments automatically.</p></div>}
                    {conversation.length > 0 && <p className="conversation-question">You asked: {conversation[conversation.length - 1].question}</p>}
                    <CoachResponse answer={answer}/>
                    {advice?.evidence.coach_topic && <AnswerFeedback key={advice.evidence.generated_at} db={db} topic={advice.evidence.coach_topic}/>}
                    <CoachConversation turns={conversation} busy={busy} canContinue={!!currentAction && !pendingAdvice} onFollowUp={(kind,text)=>void callAi('ask',kind,text)} onReset={()=>{ ++coachRequestVersion.current; setConversation([]); setAnswer(''); setAdvice(null); setCurrentAction(null); setPendingAdvice(null); setImage(null); setQuestion(''); }}/>
                    {advice?.evidence.method && <details className="advice-receipt"><summary>How this response was prepared</summary><p>Method: {advice.evidence.method}. {advice.evidence.generated_at && `Prepared: ${new Date(advice.evidence.generated_at).toLocaleString('en-ZA')}.`} Figures come from your saved records. Guides are reviewed templates; AI routes typed questions to a topic. This is not an independent audit.</p></details>}
                    <Sources sources={advice?.evidence.web_sources} searched={advice?.evidence.web_searched}/>
                    {pendingAdvice && <div className="notice"><label className="research-toggle"><input type="checkbox" checked={figuresConfirmed} onChange={event => setFiguresConfirmed(event.target.checked)}/> I checked the extracted figures against the original and confirm they are correct.</label><button className="primary" disabled={busy || !figuresConfirmed} onClick={confirmImageAdvice}>Confirm and save advice</button><p className="compact">Only the advice and reviewed extraction will be saved. Use Jobs or Payments to enter business records manually.</p></div>}
                  </>
                ) : (
                  <div className="empty">
                    <Sparkles size={32}/><strong>Clarity starts with a question.</strong><p>Ask about your business to get a practical next step grounded in your records.</p>
                  </div>
                )}
              </div>

              {currentAction && <div className="card full adviser-next"><div><h3>Put your next move into words.</h3><p className="muted">Turn a confirmed offer into an editable customer advert.</p></div><button className="dark" onClick={() => setTab("Visibility")}>Create an advert <ArrowUpRight size={16}/></button></div>}
            </div>
          )}

          {tab === "Visibility" && (
            <div className="grid">
              <MarketingGenerator services={services.map(service => service.name)} premium={premium} onUpgrade={() => setCheckoutOpen(true)} authorize={authorize}/>
              <div className="card full">
                <span className="eyebrow">SHOW UP FOR YOUR NEXT CUSTOMER</span><h2>Create a customer advert</h2>
                <p className="muted">
                  Confirm the service and offer first. You can edit every word
                  before sharing.
                </p>
                <label htmlFor="advert-action">Link to a saved action</label>
                <select id="advert-action" value={currentAction || ""} onChange={event => { setCurrentAction(event.target.value || null); setAdText(""); }}><option value="">Choose an action</option>{actions.map(action => <option key={action.id} value={action.id}>{action.evidence_json?.owner_question || "BizWise advice"}</option>)}</select>
                <div className="form" style={{ marginTop: 20 }}>
                  <div>
                    <label htmlFor="field-16">Service</label>
                    <select id="field-16"
                      value={adService}
                      onChange={event => setAdService(event.target.value)}
                    >
                      <option value="">Choose a service</option>
                      {services.map(service => (
                        <option key={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="field-17">Channel</label>
                    <select id="field-17"
                      value={adChannel}
                      onChange={event => setAdChannel(event.target.value)}
                    >
                      <option value="whatsapp">WhatsApp status</option>
                      <option value="social">Social post</option>
                    </select>
                  </div>
                  <div className="full">
                    <label htmlFor="field-18">Confirmed offer or message</label>
                    <input id="field-18"
                      placeholder="e.g. Book a consultation this week. No discount."
                      value={offer}
                      onChange={event => setOffer(event.target.value)}
                    />
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="dark"
                    disabled={busy || !adService || !offer || !currentAction}
                    onClick={() => callAi("advert")}
                  >
                    Generate advert
                  </button>
                  {!currentAction && (
                    <span className="muted compact">
                      Get advice first to link this advert to an action.
                    </span>
                  )}
                </div>
                {adText && (
                  <>
                    <label style={{ marginTop: 18 }}>Edit advert</label>
                    <textarea
                      value={adText}
                      onChange={event => setAdText(event.target.value)}
                    />
                    <div className="actions">
                      <button className="primary" onClick={saveAdvert}>
                        Save draft
                      </button>
                      <button
                        className="ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(adText);
                          setMessage("Advert copied");
                        }}
                      >
                        Copy text
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "Actions" && (
            <>
              <h2>Turn advice into progress.</h2>
              <p className="muted">
                Track what you tried and the results you recorded yourself.
              </p>
              {actions.length === 0 ? (
                <div className="card empty">
                  <CircleCheck size={32}/><strong>Good advice deserves a next step.</strong><p>Ask BizWise a question to start tracking your actions.</p><button className="primary" onClick={() => setTab("Adviser")}>Ask BizWise <ArrowUpRight size={16}/></button>
                </div>
              ) : (
                <div className="stack">
                  {actions.map(action => (
                    <div className="card" key={action.id}>
                      <div className="row">
                        <strong>
                          {action.evidence_json?.owner_question ||
                            "BizWise advice"}
                        </strong>
                        <span className="pill">{action.status}</span>
                      </div>

                      <p className="answer">{action.recommendation}</p>
                      <Sources sources={action.evidence_json?.web_sources} searched={action.evidence_json?.web_searched}/>
                      <p className="muted compact">{action.limitations}</p>

                      {assets
                        .filter(asset => asset.action_id === action.id)
                        .map(asset => (
                          <div className="notice" key={asset.id}>
                            <strong>
                              {asset.channel === "whatsapp"
                                ? "WhatsApp status"
                                : "Social post"}{" "}
                              · {asset.status}
                            </strong>
                            <p className="answer" style={{ marginTop: 12 }}>
                              {asset.body}
                            </p>
                            <div className="actions">
                              <button
                                className="ghost"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(asset.body);
                                  setMessage("Advert copied");
                                }}
                              >
                                Copy
                              </button>
                              {asset.status === "draft" && (
                                <button
                                  className="ghost"
                                  onClick={() => updateAsset(asset)}
                                >
                                  Mark published
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                      <div className="form">
                        <div>
                          <label htmlFor="field-19">Enquiries</label>
                          <input id="field-19"
                            type="number"
                            min="0"
                            value={action.enquiries}
                            onChange={event =>
                              setActions(current =>
                                current.map(item =>
                                  item.id === action.id
                                    ? {
                                        ...item,
                                        enquiries: Number(event.target.value),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="field-20">Bookings</label>
                          <input id="field-20"
                            type="number"
                            min="0"
                            max={action.enquiries}
                            value={action.bookings}
                            onChange={event =>
                              setActions(current =>
                                current.map(item =>
                                  item.id === action.id
                                    ? {
                                        ...item,
                                        bookings: Number(event.target.value),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="field-21">Completed jobs from bookings</label>
                          <input id="field-21"
                            type="number"
                            min="0"
                            max={action.bookings}
                            value={action.attributed_jobs}
                            onChange={event =>
                              setActions(current =>
                                current.map(item =>
                                  item.id === action.id
                                    ? {
                                        ...item,
                                        attributed_jobs: Number(event.target.value),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="field-22">Status</label>
                          <select id="field-22"
                            value={action.status}
                            onChange={event =>
                              setActions(current =>
                                current.map(item =>
                                  item.id === action.id
                                    ? { ...item, status: event.target.value }
                                    : item
                                )
                              )
                            }
                          >
                            <option value="planned">Planned</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="dismissed">Dismissed</option>
                          </select>
                        </div>
                      </div>

                      <p className="muted compact">
                        {action.enquiries > 0
                          ? `${Math.round(
                              action.bookings / action.enquiries * 100
                            )}% of owner-reported enquiries became bookings.`
                          : "Record enquiries to see a booking rate."}{" "}
                        This does not prove the action caused additional profit.
                      </p>
                      <button
                        className="dark"
                        onClick={() => updateAction(action, {
                          enquiries: action.enquiries,
                          bookings: action.bookings,
                          attributed_jobs: action.attributed_jobs,
                          status: action.status,
                        })}
                      >
                        Save results
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "Feedback" && (
            <div className="grid">
              <div className="card">
                <h2>Listen. Learn. Build loyalty.</h2>
                <p className="muted">
                  Ask a customer, then record the answer you actually receive.
                </p>
                <label htmlFor="field-23">Completed job</label>
                <select id="field-23"
                  value={fbJob}
                  onChange={event => setFbJob(event.target.value)}
                >
                  <option value="">Select job</option>
                  {jobs
                    .filter(job => job.status === "completed")
                    .map(job => (
                      <option key={job.id} value={job.id}>
                        {job.job_date} ·{" "}
                        {services.find(service =>
                          service.id === job.service_id
                        )?.name}
                      </option>
                    ))}
                </select>

                {fbJob && (
                  <div className="notice">
                    <strong>Editable request</strong>
                    <p>
                      Thank you for choosing {shop.name}. How was your experience
                      with our service? Your feedback helps us improve.
                    </p>
                    <button
                      className="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `Thank you for choosing ${shop.name}. ` +
                          "How was your experience with our service? " +
                          "Your feedback helps us improve."
                        );
                        setMessage("Request copied");
                      }}
                    >
                      Copy request
                    </button>
                  </div>
                )}

                <form onSubmit={saveFeedback}>
                  <div className="form">
                    <div>
                      <label htmlFor="field-24">Rating (optional)</label>
                      <select id="field-24"
                        value={fbRating}
                        onChange={event => setFbRating(event.target.value)}
                      >
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map(value => (
                          <option key={value} value={value}>
                            {value} / 5
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="full">
                      <label htmlFor="field-25">Customer comment</label>
                      <textarea id="field-25"
                        value={fbComment}
                        onChange={event => setFbComment(event.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    className="primary"
                    disabled={!fbJob || (!fbRating && !fbComment.trim())}
                  >
                    Save feedback
                  </button>
                </form>
              </div>

              <div className="card">
                <h2>Responses ({feedback.length})</h2>
                {feedback.length === 0 ? (
                  <div className="empty"><Star size={32}/><strong>Every customer has a story.</strong><p>Record your first response to understand their experience.</p></div>
                ) : feedback.map(item => (
                  <div className="row" key={item.id}>
                    <div>
                      <strong>
                        {item.rating ? `${item.rating} / 5` : "No rating"}
                      </strong>
                      <p className="muted">{item.comment || "No comment"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <footer className="workspace-footer"><span>BizWise</span> Understand. Learn. Act. Improve.</footer>
      </div>
      <PremiumCheckout open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onActivated={activateDemo}/>
    </main>
  );
}
