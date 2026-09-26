"use client";

import { AdviserInputs, Sources } from "./adviser/controls";
import { type Advice, type WebSource } from "./adviser/shared";
import { useEffect, useMemo, useState } from "react";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { ArrowRight, Plus, Wrench, LogOut } from "lucide-react";

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

    const sh = await db
      .from("shops")
      .select("*")
      .eq("owner_user_id", owner.id)
      .maybeSingle();

    if (sh.error) {
      setError(sh.error.message);
      return;
    }

    setShop(sh.data);
    if (!sh.data) return;

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
    if (resultError) {
      setError(resultError.message);
      return;
    }

    setServices(results[0].data || []);
    setJobs(results[1].data || []);
    setPayments(results[2].data || []);
    setActions(results[3].data || []);
    setAssets(results[4].data || []);
    setFeedback(results[5].data || []);
  }

  useEffect(() => {
    if (user) {
      void load(user);
    } else {
      setShop(null);
      setJobs([]);
    }
    setImage(null); setAdvice(null); setPendingAdvice(null); setFiguresConfirmed(false);
    setAnswer(""); setQuestion(""); setCurrentAction(null); setAdText("");
  }, [user]);

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

  async function callAi(which: string) {
    if (!db || !shop || !user) return;

    clear();
    setBusy(true);
    if (which === "ask") { setPendingAdvice(null); setFiguresConfirmed(false); setCurrentAction(null); setAnswer(""); setAdvice(null); setAdText(""); }

    try {
      const { data: { session } } = await db.auth.getSession();

      const response = await fetch(`${URL.replace(/\/$/, "")}/functions/v1/adviser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
          apikey: KEY,
        },
        body: JSON.stringify({
          goal: which,
          image: which === "ask" ? image : undefined,
          research: which === "ask" && research,
          question,
          offer,
          service: adService,
          channel: adChannel,
        }),
      });

      const data = await response.json().catch(() => ({ error: "Adviser function unavailable. Deploy the Supabase adviser function and check its configuration." })) as Advice & { error?: string };

      if (!response.ok) {
        setError(data.error || "AI request failed");
        return;
      }

      if (which === "advert") {
        setAdText(data.answer);
        return;
      }

      setAnswer(data.answer);
      setAdvice(data);
      if (data.extraction) {
        setPendingAdvice(data);
      } else {
        await saveAdvice(data);
      }
    } catch {
      setError("Could not contact the adviser. Check your connection and the deployed Supabase function?s ALLOWED_ORIGINS setting.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdvice(data: Advice) {
    if (!db || !shop || !user) return;
    const saved = await db.from("adviser_actions").insert({
      shop_id: shop.id, goal: data.goal, evidence_json: data.evidence,
      recommendation: data.answer, limitations: data.evidence.limitations, status: "planned",
    }).select("id").single();
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
    return (
      <main className="shell">
        <div className="card auth">
          <div className="brand">Biz<span>Wise</span> Garage</div>
          <h1>Run your shop with clearer numbers.</h1>
          <p className="muted">
            Record work, understand costs and choose your next customer action.
          </p>

          <form className="form" onSubmit={handleAuth}>
            <div>
              <label>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label>Password</label>
              <input
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
          {error && <div className="notice error">{error}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <div>
          <div className="brand">Biz<span>Wise</span> Garage</div>
          <div className="muted compact">
            {shop ? `${shop.name} · ${shop.town}` : "Set up your shop"}
          </div>
        </div>
        <button className="ghost" onClick={() => db.auth.signOut()}>
          <LogOut size={16} style={{ display: "inline", verticalAlign: "middle" }} />
          {" "}Sign out
        </button>
      </header>

      {shop && (
        <nav className="nav" aria-label="Main navigation">
          {["Home", "Jobs", "Adviser", "Actions", "Feedback", "Shop"].map(item => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => {
                clear();
                setTab(item);
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      )}

      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice" role="status">{message}</div>}

      {!shop ? (
        <div className="card" style={{ maxWidth: 660 }}>
          <h1>Tell us about your shop</h1>
          <p className="muted">
            Start with the basics. You can add services afterwards.
          </p>
          <form className="form" onSubmit={saveShop}>
            <div>
              <label>Shop name</label>
              <input
                required
                value={shopName}
                onChange={event => setShopName(event.target.value)}
              />
            </div>
            <div>
              <label>Town or suburb</label>
              <input
                required
                value={town}
                onChange={event => setTown(event.target.value)}
              />
            </div>
            <div>
              <label>WhatsApp number (optional)</label>
              <input
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </div>
            <div className="full">
              <button className="primary" disabled={busy}>
                Save shop <ArrowRight size={16} style={{ display: "inline" }} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {tab === "Home" && (
            <>
              <section className="hero">
                <h1>Good day. What needs attention?</h1>
                <p>
                  Keep a record of each job, then use those figures to make a
                  practical next move.
                </p>
                <button className="primary" onClick={() => openJob()}>
                  <Plus size={16} style={{ display: "inline" }} /> Add a job
                </button>
              </section>

              <div className="actions" style={{ marginBottom: 16 }}>
                <label style={{ alignSelf: "center", margin: 0 }}>Period</label>
                <select
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
                  <small>Completed jobs</small>
                  <strong>{completed.length}</strong>
                </div>
                <div className="card stat">
                  <small>Amount charged</small>
                  <strong>{money(charge)}</strong>
                </div>
                <div className="card stat">
                  <small>Payments received</small>
                  <strong>{money(received)}</strong>
                </div>
                <div className="card stat">
                  <small>Recorded direct costs</small>
                  <strong>{money(costs)}</strong>
                </div>
              </div>

              <div className="grid" style={{ marginTop: 16 }}>
                <div className="card">
                  <h2>Money to follow up</h2>
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
                  <h2>Left after recorded direct costs</h2>
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
            </>
          )}

          {tab === "Shop" && (
            <div className="grid">
              <div className="card">
                <h2>Shop details</h2>
                <form className="form" onSubmit={saveShop}>
                  <div>
                    <label>Shop name</label>
                    <input
                      required
                      value={shopName}
                      onChange={event => setShopName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label>Town</label>
                    <input
                      required
                      value={town}
                      onChange={event => setTown(event.target.value)}
                    />
                  </div>
                  <div>
                    <label>WhatsApp number</label>
                    <input
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
                      <Wrench size={16} style={{ display: "inline" }} />
                      {" "}{service.name}
                    </span>
                  </div>
                ))}
                <form onSubmit={addService} style={{ marginTop: 15 }}>
                  <label>Add a service</label>
                  <div className="actions" style={{ marginTop: 5 }}>
                    <input
                      placeholder="e.g. Brake repairs"
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
                  <h1>Jobs and payments</h1>
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
                      <label>Service</label>
                      <select
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
                      <label>Job date</label>
                      <input
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
                      <label>Job status</label>
                      <select
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
                      <label>Amount charged (R)</label>
                      <input
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
                      <label>Parts cost (R)</label>
                      <input
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
                      <label>Other direct cost (R)</label>
                      <input
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
                      <label>Description (optional)</label>
                      <textarea
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
                {jobs.length === 0 ? (
                  <div className="empty">
                    No jobs yet. Add a completed job to see useful figures.
                  </div>
                ) : jobs.map(job => {
                  const paid = payments
                    .filter(payment => payment.job_id === job.id)
                    .reduce(
                      (amount, payment) => amount + Number(payment.amount),
                      0
                    );

                  return (
                    <div className="row" key={job.id}>
                      <div>
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
                      <label>Amount received (R)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={event => setPayAmount(event.target.value)}
                      />
                    </div>
                    <div>
                      <label>Method</label>
                      <select
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
                <h1>Ask BizWise</h1>
                <p className="muted">
                  Describe your situation in your own words. BizWise uses the
                  records you have saved.
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
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || listening || question.trim().length < 8}
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
                <h2>Your recommendation</h2>
                {answer ? (
                  <>
                    {advice?.extraction && <div className="notice"><h3>What was read from your image</h3><p className="answer">{advice.extraction}</p><p>These figures may be wrong. Compare every amount, date and quantity against the original. If incorrect, replace or crop the image and ask again. Nothing is entered into jobs or payments automatically.</p></div>}
                    <div className="answer">{answer}</div>
                    <Sources sources={advice?.evidence.web_sources} searched={advice?.evidence.web_searched}/>
                    {pendingAdvice && <div className="notice"><label className="research-toggle"><input type="checkbox" checked={figuresConfirmed} onChange={event => setFiguresConfirmed(event.target.checked)}/> I checked the extracted figures against the original and confirm they are correct.</label><button className="primary" disabled={busy || !figuresConfirmed} onClick={confirmImageAdvice}>Confirm and save advice</button><p className="compact">Only the advice and reviewed extraction will be saved. Use Jobs or Payments to enter business records manually.</p></div>}
                  </>
                ) : (
                  <div className="empty">
                    Describe your situation to get advice based on your shop
                    records.
                  </div>
                )}
              </div>

              <div className="card full">
                <h2>Create a customer advert</h2>
                <p className="muted">
                  Confirm the service and offer first. You can edit every word
                  before sharing.
                </p>
                <div className="form">
                  <div>
                    <label>Service</label>
                    <select
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
                    <label>Channel</label>
                    <select
                      value={adChannel}
                      onChange={event => setAdChannel(event.target.value)}
                    >
                      <option value="whatsapp">WhatsApp status</option>
                      <option value="social">Social post</option>
                    </select>
                  </div>
                  <div className="full">
                    <label>Confirmed offer or message</label>
                    <input
                      placeholder="e.g. Book a brake inspection. No discount."
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
              <h1>Actions and results</h1>
              <p className="muted">
                Track what you tried and the results you recorded yourself.
              </p>
              {actions.length === 0 ? (
                <div className="card empty">
                  Ask BizWise for advice to create your first action.
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
                          <label>Enquiries</label>
                          <input
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
                          <label>Bookings</label>
                          <input
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
                          <label>Completed jobs from bookings</label>
                          <input
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
                          <label>Status</label>
                          <select
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
                <h1>Customer feedback</h1>
                <p className="muted">
                  Ask a customer, then record the answer you actually receive.
                </p>
                <label>Completed job</label>
                <select
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
                      with the repair? Your feedback helps us improve.
                    </p>
                    <button
                      className="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `Thank you for choosing ${shop.name}. ` +
                          "How was your experience with the repair? " +
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
                      <label>Rating (optional)</label>
                      <select
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
                      <label>Customer comment</label>
                      <textarea
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
                  <div className="empty">No feedback recorded yet.</div>
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
    </main>
  );
}