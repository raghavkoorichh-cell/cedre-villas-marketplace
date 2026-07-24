import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════
// CEDRE VILLAS MARKETPLACE
// Credentials come from Vercel Environment Variables.
// Set VITE_SHEET_ID and VITE_API_KEY in:
//   Vercel → project → Settings → Environment Variables
// Never hardcode the API key here — this file is public on GitHub.
// ══════════════════════════════════════════════════════════════
const SHEETS_CONFIG = {
  SHEET_ID:   import.meta.env.VITE_SHEET_ID,
  API_KEY:    import.meta.env.VITE_API_KEY,
  SHEET_NAME: "📋 Listings",
};

// ── CONSTANTS ──
const G  = "#25D366", GD = "#128C7E", AM = "#F59E0B";
const ES = "#6366F1", BG = "#ECE5DD";
const EM = { Electronics:"📱",Kids:"🧸",Home:"🏠",Furniture:"🪑",Fashion:"👗",Other:"📦" };
const GR = { Electronics:"from-slate-100 to-slate-200",Kids:"from-pink-100 to-rose-200",Home:"from-purple-100 to-purple-200",Furniture:"from-amber-50 to-amber-100",Fashion:"from-fuchsia-100 to-pink-200",Other:"from-teal-100 to-cyan-200" };
const CATS = ["All","Electronics","Kids","Home","Furniture","Fashion","Other"];
const ESCROW_STEPS = [
  { key:"payment_pending",label:"Payment",icon:"💳" },
  { key:"safe_pay_holding", label:"Held Safely", icon:"🛡️" },
  { key:"item_handed",    label:"Handover",icon:"🤝" },
  { key:"released",       label:"Done",icon:"✅" },
];
const BOT = [
  { from:"bot",text:"👋 Hi! Welcome to *Cedre Villas Marketplace*.\n\nWhat would you like to do?",type:"options",opts:["🛍️ Sell something","🔍 Browse listings","❓ Help"] },
  { from:"bot",text:"Let's get your item listed 📸\n\nFirst, *send me a photo* of what you're selling.",type:"photo" },
  { from:"bot",text:"Nice photo! 👌\n\nWhat's the *price* in AED?",type:"text",ph:"e.g. 350" },
  { from:"bot",text:"Got it.\n\nGive your item a *title*.",type:"text",ph:"e.g. Dyson V11 Vacuum" },
  { from:"bot",text:"Add a *brief description* — condition, age, extras?",type:"text",ph:"e.g. 2 years old, excellent condition" },
  { from:"bot",text:"Which *category* fits best?",type:"options",opts:["📱 Electronics","🧸 Kids","🏠 Home","🪑 Furniture","👗 Fashion","📦 Other"] },
  { from:"bot",text:null,type:"preview" },
  { from:"bot",text:"🎉 *Your listing is live right now!*\n\nShare it to the Cedre Villas group so residents can see it 👇",type:"share" },
];

// ── SAMPLE DATA (used while Sheet not connected) ──
const SAMPLE = [
  { id:"CVL-0001",title:"Dyson V11 Vacuum",price:850,desc:"2 years old, excellent condition. All attachments included.",cat:"Home",status:"available",seller:"Sara M.",phone:"+971501234567",time:"2 min ago",emoji:"🧹",grad:"from-purple-100 to-purple-200" },
  { id:"CVL-0002",title:"Kids Bike (5–8 yrs)",price:180,desc:"Pink, barely used. Helmet included.",cat:"Kids",status:"available",seller:"Ahmed K.",phone:"+971509876543",time:"14 min ago",emoji:"🚲",grad:"from-pink-100 to-rose-200" },
  { id:"CVL-0003",title:"iPhone 14 Pro 256GB",price:2800,desc:"Space Black, Apple Care until Nov 2025.",cat:"Electronics",status:"sold",seller:"Priya R.",phone:"+971507654321",time:"1 hr ago",emoji:"📱",grad:"from-slate-100 to-slate-200" },
  { id:"CVL-0004",title:"IKEA Kallax Shelf",price:220,desc:"White, 4x4. Self-collection only.",cat:"Furniture",status:"reserved",seller:"Omar F.",phone:"+971502345678",time:"3 hr ago",emoji:"🪑",grad:"from-amber-50 to-amber-100" },
  { id:"CVL-0005",title:"Montessori Activity Set",price:95,desc:"Ages 2–4. Complete wooden set from Germany.",cat:"Kids",status:"available",seller:"Nadia T.",phone:"+971508765432",time:"5 hr ago",emoji:"🧩",grad:"from-green-100 to-emerald-200" },
];

// ── FEE CALCULATION ──
function calculateFee(price) {
  if (price < 50) {
    return { buyerFee:3, sellerFee:3, totalEarned:6, tier:"Under AED 50" };
  } else if (price <= 100) {
    return { buyerFee:5, sellerFee:5, totalEarned:10, tier:"AED 50–100" };
  } else if (price <= 200) {
    return { buyerFee:7, sellerFee:7, totalEarned:14, tier:"AED 100–200" };
  } else {
    const fee = Math.max(7, parseFloat((price * 0.025).toFixed(2)));
    return { buyerFee:fee, sellerFee:fee, totalEarned:fee*2, tier:"Above AED 200" };
  }
}

// ── DELIVERY FEE CALCULATION ──
function calculateDeliveryFee(porterBase) {
  // 20% markup on Porter's price
  return Math.ceil(porterBase * 1.2);
}

// Porter booking page — Option A handoff until API access is granted
const PORTER_BOOKING_URL = "https://porter.ae/";

// Porter estimated base prices within DSO (3-5km range)
const PORTER_ESTIMATES = {
  car:   25,  // Porter car ~AED 18 base, ~AED 25 within DSO
  truck: 65,  // Porter pickup truck ~AED 34 base, ~AED 65 within DSO
};

const DELIVERY_SLOTS = [
  { id:"today_morning",   label:"Today",     time:"9am – 12pm",  icon:"🌅" },
  { id:"today_afternoon", label:"Today",     time:"2pm – 5pm",   icon:"☀️" },
  { id:"today_evening",   label:"Today",     time:"6pm – 8pm",   icon:"🌆" },
  { id:"tomorrow_morning",label:"Tomorrow",  time:"9am – 12pm",  icon:"🌅" },
  { id:"tomorrow_afternoon",label:"Tomorrow",time:"2pm – 5pm",   icon:"☀️" },
];

// ── PROHIBITED ITEMS ──
const PROHIBITED = [
  "alcohol","beer","wine","spirits","liquor","vape","cigarette",
  "weapon","knife","gun","pistol","rifle","ammo","ammunition",
  "counterfeit","fake","replica","clone",
  "medication","medicine","pills","prescription","drugs",
  "adult","explicit","xxx",
];
function checkProhibited(title, desc) {
  const text = (title + " " + desc).toLowerCase();
  return PROHIBITED.find(w => text.includes(w)) || null;
}

// ── PORTER COVERAGE ──
const PORTER_EMIRATES = ["dubai","sharjah","دبي","الشارقة"];
function porterCoversEmirate(address) {
  if (!address) return true; // default allow, check at booking
  return PORTER_EMIRATES.some(e => address.toLowerCase().includes(e));
}

// ── LISTING EXPIRY ──
function daysUntilExpiry(timestamp) {
  if (!timestamp) return 30;
  const listed = new Date(timestamp);
  const now = new Date();
  const days = Math.floor((now - listed) / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - days);
}

// ── SELLER TRUST BADGE ──
function sellerBadge(salesCount) {
  if (!salesCount || salesCount < 1) return { label:"🆕 New", color:"#9CA3AF" };
  if (salesCount < 5)  return { label:"✓ Verified", color:"#6366F1" };
  if (salesCount < 20) return { label:"⭐ Trusted", color:"#F59E0B" };
  return { label:"🏆 Top seller", color:"#25D366" };
}

// ── DEVICE WALLET DETECTION ──
// Apple Pay only works in Safari/iOS; Google Pay on Android/Chrome.
// Showing both to everyone means one is always a dead button.
function detectWallet() {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (isIOS || isSafari) return { id:"apple", label:"Apple Pay", icon:"" };
  if (/Android/i.test(ua)) return { id:"google", label:"Google Pay", icon:"G" };
  return null; // desktop/other — card only
}

// ── GOOGLE SHEETS FETCH ──
async function fetchListings() {
  if (!SHEETS_CONFIG.SHEET_ID || !SHEETS_CONFIG.API_KEY) return SAMPLE;
  try {
    const range  = encodeURIComponent(`${SHEETS_CONFIG.SHEET_NAME}!A3:N1000`);
    const url    = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.SHEET_ID}/values/${range}?key=${SHEETS_CONFIG.API_KEY}`;
    const res    = await fetch(url);
    const data   = await res.json();
    if (!data.values) return SAMPLE;
    return data.values
      .filter(r => r[0] && r[4])
      .map(r => ({
        id:     r[0]  || "",
        time:   r[1]  || "",
        seller: r[2]  || "",
        phone:  r[3]  || "",
        title:  r[4]  || "",
        cat:    r[5]  || "Other",
        price:  parseFloat(r[6]) || 0,
        desc:   r[7]  || "",
        photo:  r[8]  || "",
        status: (r[9] || "available").toLowerCase(),
        emoji:  EM[r[5]] || "📦",
        grad:   GR[r[5]]  || "from-teal-100 to-cyan-200",
      }));
  } catch (e) {
    console.error("Sheet fetch error:", e);
    return SAMPLE;
  }
}

// ── ESCROW BAR ──
function EscrowBar({ step }) {
  const idx = ESCROW_STEPS.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-1 mt-3">
      {ESCROW_STEPS.map((s,i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
              style={{ background:i<=idx?ES:"#e5e7eb", color:i<=idx?"#fff":"#9ca3af" }}>
              {i<idx?"✓":s.icon}
            </div>
            <p className="mt-0.5 text-center" style={{ fontSize:9, color:i<=idx?ES:"#9ca3af" }}>{s.label}</p>
          </div>
          {i<ESCROW_STEPS.length-1 && <div className="w-5 h-0.5 mb-3" style={{ background:i<idx?ES:"#e5e7eb" }} />}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [screen,   setScreen]   = useState("home");
  const [listings, setListings] = useState(SAMPLE);
  const [loading,  setLoading]  = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [cat,      setCat]      = useState("All");
  const [selItem,  setSelItem]  = useState(null);
  const [modal,    setModal]    = useState(null);
  const [activeItem,setActiveItem]=useState(null);
  const [escrow,   setEscrow]   = useState("payment_pending");
  const [waitlist, setWaitlist] = useState(false);
  const [timer,    setTimer]    = useState(487);
  const [toast,    setToast]    = useState(null);
  const [shareToast,setShareToast]=useState(false);
  const [deliveryType,setDeliveryType]=useState(null);
  const [buyerEmirate,setBuyerEmirate]=useState(null);
  const [showOffer,setShowOffer]=useState(false);
  const [offerSent,setOfferSent]=useState(false);
  const [wallet,setWallet]=useState(null);
  const [dropAddress,setDropAddress]=useState("");
  const [trackingLink,setTrackingLink]=useState("");
  const [offerAmount,setOfferAmount]=useState("");
  const [savedItems,setSavedItems]=useState([]);
  const [activeTab,setActiveTab]=useState("catalogue"); // catalogue | saved
  const [prohibitedWord,setProhibitedWord]=useState(null);
  const [sellerRating,setSellerRating]=useState(0);
  const [showRating,setShowRating]=useState(false); // "car" | "truck" | "collect"
  const [deliverySlot,setDeliverySlot]=useState(null);
  const [deliveryQuote,setDeliveryQuote]=useState(null);
  const [deliveryStep,setDeliveryStep]=useState(null); // "type" | "size" | "slot" | "confirm" | "tracking"
  // bot
  const [msgs,  setMsgs]  = useState([]);
  const [bStep, setBStep] = useState(0);
  const [bInput,setBInput]= useState("");
  const [bData, setBData] = useState({ price:"",title:"",desc:"",cat:"",photo:false });
  const [typing,setTyping]= useState(false);
  const [botDone,setBotDone]=useState(false);
  const chatEnd = useRef(null);

  // ── LOAD FROM SHEETS ──
  useEffect(() => {
    loadListings();
    setWallet(detectWallet());
    const interval = setInterval(loadListings, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadListings() {
    const data = await fetchListings();
    setListings(data);
    setLoading(false);
    setLastSync(new Date());
  }

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs,typing]);
  useEffect(() => {
    if (modal==="reserved" && timer>0) {
      const t = setTimeout(()=>setTimer(v=>v-1),1000);
      return ()=>clearTimeout(t);
    }
  },[modal,timer]);

  const fmtT = s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const filtered = listings.filter(l=>l.status!=="removed"&&(cat==="All"||l.cat===cat));
  const avail  = listings.filter(l=>l.status==="available").length;
  const res    = listings.filter(l=>l.status==="reserved").length;
  const sold   = listings.filter(l=>l.status==="sold").length;

  // ── BOT LOGIC ──
  function startBot() {
    setMsgs([]); setBStep(0);
    setBData({ price:"",title:"",desc:"",cat:"",photo:false });
    setBotDone(false); setTyping(true); setScreen("bot");
    setTimeout(()=>{ setTyping(false); setMsgs([{...BOT[0]}]); },800);
  }

  function botNext(userText,nextStep,d) {
    setMsgs(prev=>[...prev,{ from:"user",text:userText }]);
    setTyping(true);
    setTimeout(()=>{
      setTyping(false);
      const s = BOT[nextStep];
      if (!s) return;
      if (s.type==="preview") {
        const dat = d||bData;
        setMsgs(prev=>[...prev,{ from:"bot",text:`Here's your listing preview:\n\n*${dat.title}*\n💰 AED ${dat.price}\n📦 ${dat.cat}\n📝 ${dat.desc}\n\nLooks good?`,type:"preview_confirm",dat }]);
      } else {
        setMsgs(prev=>[...prev,{...s}]);
      }
      setBStep(nextStep);
    },900);
  }

  function handleOpt(opt) {
    if (bStep===0) {
      if (opt.includes("Sell")) botNext(opt,1,bData);
      else if (opt.includes("Browse")) setScreen("catalogue");
      else botNext(opt,0,bData);
    } else if (bStep===5) {
      const c = opt.replace(/^.+? /,"");
      const d = {...bData,cat:c};
      setBData(d); botNext(opt,6,d);
    }
  }

  function handlePhoto() { const d={...bData,photo:true}; setBData(d); botNext("📷 [Photo sent]",2,d); }

  function handleSend() {
    if (!bInput.trim()) return;
    const v=bInput.trim(); setBInput("");
    let d={...bData};
    if (bStep===2) d.price=v;
    if (bStep===3) d.title=v;
    if (bStep===4) d.desc=v;
    setBData(d); botNext(v,bStep+1,d);
  }

  function confirmListing() {
    const item={
      id:"CVL-"+String(listings.length+1).padStart(4,"0"),
      title:bData.title, price:parseInt(bData.price), desc:bData.desc,
      cat:bData.cat, status:"available", seller:"You", phone:"+971500000000",
      time:"Just now", emoji:EM[bData.cat]||"📦", grad:GR[bData.cat]||"from-teal-100 to-cyan-200",
    };
    setListings(prev=>[item,...prev]);
    setToast(item);
    setTimeout(()=>setToast(null),5000);
    setMsgs(prev=>[...prev,{ from:"user",text:"✅ Yes, post it!" }]);
    setTyping(true);
    setTimeout(()=>{ setTyping(false); setMsgs(prev=>[...prev,{...BOT[7]}]); setBStep(7); setBotDone(true); },900);
  }

  function handleBuy(item) {
    setActiveItem(item);
    if (item.status==="reserved") { setWaitlist(false); setTimer(487); setModal("reserved"); }
    else { setEscrow("payment_pending"); setModal("payment"); }
  }

  function confirmPay() {
    setListings(prev=>prev.map(l=>l.id===activeItem.id?{...l,status:"reserved"}:l));
    setEscrow("safe_pay_holding"); setModal("escrow");
  }

  function confirmHandover() {
    setEscrow("item_handed");
    setTimeout(()=>{
      setEscrow("released");
      setListings(prev=>prev.map(l=>l.id===activeItem.id?{...l,status:"sold"}:l));
      setModal("complete");
    },1200);
  }

  const badge = item => {
    if (item.status==="sold")     return { label:"SOLD",     bg:"#EF4444" };
    if (item.status==="reserved") return { label:"RESERVED", bg:AM };
    return null;
  };

  const connected = Boolean(SHEETS_CONFIG.SHEET_ID && SHEETS_CONFIG.API_KEY);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ background:BG,fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div className="relative w-full max-w-sm mx-auto" style={{ minHeight:"100vh" }}>

        {/* CONNECTION STATUS BANNER */}
        {!connected && (
          <div className="fixed top-0 left-1/2 w-full max-w-sm z-50 px-4 py-2 text-center text-xs font-semibold text-white" style={{ transform:"translateX(-50%)",background:AM }}>
            ⚠️ Demo mode — connect Google Sheet to go live
          </div>
        )}
        {connected && lastSync && (
          <div className="fixed top-0 left-1/2 w-full max-w-sm z-50 px-4 py-1.5 text-center text-xs text-white" style={{ transform:"translateX(-50%)",background:G }}>
            🟢 Live · synced {lastSync.toLocaleTimeString()}
          </div>
        )}

        {/* NEW LISTING TOAST */}
        {toast && (
          <div className="fixed top-8 left-1/2 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden" style={{ transform:"translateX(-50%)",background:"#fff" }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background:G }}>
              <span className="text-white text-xs font-semibold">📲 Cedre Villas Community</span>
              <span className="ml-auto text-white text-xs opacity-80">now</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">🆕 New listing posted!</p>
              <p className="text-sm text-gray-600 mt-0.5"><span className="font-medium">{toast.title}</span> — AED {toast.price}</p>
              <button onClick={()=>{ setScreen("catalogue"); setToast(null); }} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background:G,color:"#fff" }}>View catalogue →</button>
            </div>
          </div>
        )}

        {offerSent && (
          <div className="fixed top-1/2 left-1/2 z-50 px-5 py-4 rounded-2xl shadow-xl text-center" style={{ transform:"translate(-50%,-50%)", background:"#fff", maxWidth:280 }}>
            <p className="text-3xl mb-1">📨</p>
            <p className="font-bold text-gray-900 text-sm">Offer sent!</p>
            <p className="text-xs text-gray-500 mt-1">The seller has been notified. You'll get a WhatsApp alert if they accept.</p>
          </div>
        )}

        {shareToast && (
          <div className="fixed top-1/2 left-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold" style={{ transform:"translate(-50%,-50%)",background:GD }}>
            ✅ Message copied — paste into group!
          </div>
        )}

        {/* ── MODALS ── */}
        {modal && (
          <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background:"rgba(0,0,0,0.55)" }}>
            <div className="w-full max-w-sm bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight:"90vh",overflowY:"auto" }}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4" />

              {modal==="reserved" && (
                <div className="p-6">
                  <div className="text-center mb-4">
                    <span className="text-5xl">⏳</span>
                    <p className="text-lg font-bold text-gray-900 mt-2">Someone is buying this</p>
                    <p className="text-3xl font-bold mt-2" style={{ color:AM }}>{fmtT(timer)}</p>
                    <p className="text-xs text-gray-400 mt-1">remaining in their payment window</p>
                  </div>
                  <div className="rounded-2xl p-4 mb-4" style={{ background:"#fffbeb",border:`1px solid ${AM}` }}>
                    <p className="text-xs font-bold text-amber-800">🟡 Item is Reserved</p>
                    <p className="text-xs text-amber-700 mt-1">You'll be notified on WhatsApp if it becomes available.</p>
                  </div>
                  {!waitlist
                    ? <><button onClick={()=>setWaitlist(true)} className="w-full py-4 rounded-2xl text-white font-bold" style={{ background:G }}>🔔 Notify me if available</button>
                      <button onClick={()=>setModal(null)} className="w-full mt-2 py-3 rounded-2xl text-gray-500 font-semibold text-sm">Not interested</button></>
                    : <div className="text-center py-3">
                      <p className="text-2xl mb-1">✅</p>
                      <p className="font-bold text-gray-800">You're on the waitlist!</p>
                      <p className="text-sm text-gray-500 mt-1">We'll ping you on WhatsApp if it becomes available.</p>
                      <button onClick={()=>setModal(null)} className="w-full mt-4 py-3 rounded-2xl text-gray-500 font-semibold text-sm">Close</button>
                    </div>}
                </div>
              )}

              {modal==="payment" && activeItem && (
                <div className="p-6">
                  {/* STEP 1 — delivery or collect */}
                  {deliveryStep === null && (
                    <>
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">How do you want to receive it?</p>
                      <p className="text-lg font-bold text-gray-900 mb-4">{activeItem.title}</p>
                      <button onClick={()=>setDeliveryStep(activeItem.cat==="Furniture" ? "address" : "size")}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left mb-3" style={{ background:"#f0fdf4",border:`1.5px solid ${G}` }}>
                        <span className="text-3xl">🚗</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">Get it delivered</p>
                          <p className="text-xs text-gray-500 mt-0.5">Booked via Porter · Dubai & Sharjah</p>
                        </div>
                        <span className="text-gray-400">→</span>
                      </button>
                      <button onClick={()=>{ setDeliveryType("collect"); setDeliveryStep("checkout"); }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left" style={{ background:"#f8fafc",border:"1.5px solid #e5e7eb" }}>
                        <span className="text-3xl">🏠</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">Self collect</p>
                          <p className="text-xs text-gray-500 mt-0.5">Arrange with seller after payment — free</p>
                        </div>
                        <span className="text-gray-400">→</span>
                      </button>
                    </>
                  )}

                  {/* STEP 2 — vehicle size */}
                  {deliveryStep === "size" && (
                    <>
                      <button onClick={()=>setDeliveryStep(null)} className="text-gray-400 text-sm mb-3">← Back</button>
                      <p className="text-sm font-bold text-gray-900 mb-3">What size is the item?</p>
                      <button onClick={()=>{ setDeliveryType("car"); setDeliveryQuote(calculateDeliveryFee(PORTER_ESTIMATES.car)); setDeliveryStep("address"); }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left mb-3" style={{ background:"#f0fdf4",border:`1.5px solid ${G}` }}>
                        <span className="text-3xl">📦</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">Small — fits in a car</p>
                          <p className="text-xs text-gray-500 mt-0.5">Electronics, kids items, fashion</p>
                        </div>
                        <p className="text-sm font-bold" style={{ color:GD }}>~AED {calculateDeliveryFee(PORTER_ESTIMATES.car)}</p>
                      </button>
                      <button onClick={()=>{ setDeliveryType("truck"); setDeliveryQuote(calculateDeliveryFee(PORTER_ESTIMATES.truck)); setDeliveryStep("address"); }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left" style={{ background:"#fefce8",border:`1.5px solid ${AM}` }}>
                        <span className="text-3xl">🛋️</span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">Large — needs a truck</p>
                          <p className="text-xs text-gray-500 mt-0.5">Furniture, appliances, heavy items</p>
                        </div>
                        <p className="text-sm font-bold" style={{ color:AM }}>~AED {calculateDeliveryFee(PORTER_ESTIMATES.truck)}</p>
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-3">Final price confirmed by Porter at booking</p>
                    </>
                  )}

                  {/* STEP 3 — delivery address */}
                  {deliveryStep === "address" && (
                    <>
                      <button onClick={()=>setDeliveryStep(activeItem.cat==="Furniture" ? null : "size")} className="text-gray-400 text-sm mb-3">← Back</button>
                      <p className="text-sm font-bold text-gray-900 mb-1">Where should we deliver?</p>
                      <p className="text-xs text-gray-400 mb-3">Porter covers Dubai and Sharjah only</p>
                      {activeItem.cat==="Furniture" && (
                        <div className="rounded-xl p-3 mb-3" style={{ background:"#fffbeb",border:`1px solid ${AM}` }}>
                          <p className="text-xs text-amber-800"><strong>🛋️ Furniture</strong> — a pickup truck will be booked automatically.</p>
                        </div>
                      )}
                      <select value={buyerEmirate||""} onChange={e=>setBuyerEmirate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-2" style={{ border:"1px solid #e5e7eb",background:"#fff" }}>
                        <option value="">Select emirate…</option>
                        <option value="dubai">Dubai</option>
                        <option value="sharjah">Sharjah</option>
                        <option value="other">Other emirate</option>
                      </select>
                      {buyerEmirate==="other" ? (
                        <div className="rounded-xl p-3 mb-3" style={{ background:"#fef2f2",border:"1px solid #EF4444" }}>
                          <p className="text-xs text-red-700"><strong>Not covered.</strong> Porter delivers to Dubai and Sharjah only.</p>
                          <button onClick={()=>{ setDeliveryType("collect"); setBuyerEmirate(null); setDeliveryStep("checkout"); }}
                            className="w-full mt-2 py-2 rounded-xl text-white text-xs font-bold" style={{ background:GD }}>Switch to self collect</button>
                        </div>
                      ) : buyerEmirate ? (
                        <>
                          <textarea value={dropAddress} onChange={e=>setDropAddress(e.target.value)} rows={3}
                            placeholder="Building / villa number, street, area&#10;e.g. Villa 42, Cedre Villas, DSO"
                            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-3"
                            style={{ border:`1px solid ${dropAddress.length>9?G:"#e5e7eb"}`,background:"#fff" }} />
                          <button onClick={()=>setDeliveryStep("slot")} disabled={dropAddress.trim().length<10}
                            className="w-full py-3 rounded-2xl font-bold text-white text-sm"
                            style={{ background: dropAddress.trim().length>=10 ? G : "#d1d5db" }}>
                            Continue →
                          </button>
                          {dropAddress.trim().length<10 && <p className="text-xs text-gray-400 text-center mt-2">Enter a full address so the driver can find you</p>}
                        </>
                      ) : null}
                    </>
                  )}

                  {/* STEP 4 — pickup slot */}
                  {deliveryStep === "slot" && (
                    <>
                      <button onClick={()=>setDeliveryStep("address")} className="text-gray-400 text-sm mb-3">← Back</button>
                      <p className="text-sm font-bold text-gray-900 mb-1">Preferred pickup slot</p>
                      <p className="text-xs text-gray-400 mb-3">The seller confirms before Porter is booked</p>
                      {DELIVERY_SLOTS.map(slot=>(
                        <button key={slot.id} onClick={()=>{ setDeliverySlot(slot); setDeliveryStep("checkout"); }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl text-left mb-2"
                          style={{ background:"#f9fafb",border:"1px solid #e5e7eb" }}>
                          <span>{slot.icon}</span>
                          <p className="text-sm font-semibold text-gray-900">{slot.label} · {slot.time}</p>
                        </button>
                      ))}
                    </>
                  )}

                  {/* STEP 5 — checkout */}
                  {deliveryStep === "checkout" && (
                    <>
                      <button onClick={()=>setDeliveryStep(deliveryType==="collect"?null:"slot")} className="text-gray-400 text-sm mb-3">← Back</button>
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Order summary</p>
                      <p className="text-lg font-bold text-gray-900 mb-3">{activeItem.title}</p>
                      <div className="rounded-2xl p-4 mb-3" style={{ background:"#eef2ff",border:`1px solid ${ES}` }}>
                        <p className="text-xs font-bold mb-1" style={{ color:ES }}>🔒 Safe Pay protected</p>
                        <p className="text-xs text-indigo-700">Powered by <strong>PayTabs</strong>. Money released to the seller only after you confirm receipt.</p>
                        <EscrowBar step="payment_pending" />
                      </div>
                      {(() => {
                        const f = calculateFee(activeItem.price);
                        const del = deliveryType!=="collect" ? (deliveryQuote||0) : 0;
                        const total = activeItem.price + f.buyerFee + del;
                        return (
                          <div className="rounded-2xl p-4 mb-3" style={{ background:"#f9fafb" }}>
                            <div className="flex justify-between text-sm text-gray-600"><span>Item price</span><span>AED {activeItem.price}</span></div>
                            <div className="flex justify-between text-sm text-gray-400 mt-1"><span>Platform fee</span><span>AED {f.buyerFee}</span></div>
                            {deliveryType!=="collect" ? (
                              <>
                                <div className="flex justify-between text-sm text-gray-400 mt-1"><span>Delivery ({deliveryType==="car"?"🚗 Car":"🛻 Truck"})</span><span>~AED {del}</span></div>
                                {deliverySlot && <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Slot</span><span>{deliverySlot.label} · {deliverySlot.time}</span></div>}
                              </>
                            ) : (
                              <div className="flex justify-between text-sm text-gray-400 mt-1"><span>Delivery</span><span>Self collect — free</span></div>
                            )}
                            <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between font-bold text-gray-900"><span>Total</span><span>AED {total}</span></div>
                          </div>
                        );
                      })()}
                      {deliveryType!=="collect" && (
                        <div className="rounded-xl p-3 mb-3" style={{ background:"#fffbeb",border:`1px solid ${AM}` }}>
                          <p className="text-xs font-bold text-amber-800">📋 What happens next</p>
                          <p className="text-xs text-amber-700 mt-1">1. You pay into Safe Pay<br/>2. Seller confirms the slot<br/>3. Porter is booked — you get a tracking link<br/>4. Confirm receipt → seller paid</p>
                          <p className="text-xs text-amber-600 mt-2">Delivery price is an estimate. Porter confirms the exact fare at booking.</p>
                        </div>
                      )}
                      <button onClick={confirmPay} className="w-full py-4 rounded-2xl text-white font-bold shadow" style={{ background:ES }}>💳 Pay by card</button>
                      {wallet && (
                        <button onClick={confirmPay} className="w-full mt-2 py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2" style={{ background:"#000" }}>
                          <span style={{ fontWeight:700 }}>{wallet.icon}</span> {wallet.label}
                        </button>
                      )}
                      <p className="text-xs text-gray-400 text-center mt-2">Secured by PayTabs · Visa, Mastercard{wallet ? `, ${wallet.label}` : ""}</p>
                      <button onClick={()=>{ setModal(null); setDeliveryStep(null); setDeliveryType(null); setDeliverySlot(null); setDropAddress(""); setBuyerEmirate(null); }}
                        className="w-full mt-2 py-3 rounded-2xl text-gray-500 font-semibold text-sm">Cancel</button>
                    </>
                  )}
                </div>
              )}

              {modal==="escrow" && activeItem && (
                <div className="p-6">
                  <div className="text-center mb-2">
                    <span className="text-5xl">🔒</span>
                    <p className="text-lg font-bold text-gray-900 mt-2">AED {activeItem.price} held safely</p>
                  </div>
                  <EscrowBar step={escrow} />
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl p-3" style={{ background:"#eef2ff" }}>
                      <p className="text-xs font-bold" style={{ color:ES }}>What happens next</p>
                      <p className="text-xs text-indigo-700 mt-1">1. Arrange collection with seller via WhatsApp<br/>2. Pick up the item<br/>3. Confirm receipt below → seller gets paid</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background:"#f0fdf4",border:`1px solid ${G}` }}>
                      <p className="text-xs font-bold" style={{ color:GD }}>Seller: {activeItem.seller}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{activeItem.phone} — notified via WhatsApp</p>
                      <a href={`https://wa.me/${(activeItem.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color:G }}>💬 Chat with seller →</a>
                    </div>

                    {deliveryType && deliveryType!=="collect" && (
                      <div className="rounded-xl p-3 mt-3" style={{ background:"#fffbeb",border:`1px solid ${AM}` }}>
                        <p className="text-xs font-bold text-amber-800">🚚 Book the Porter driver</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Pickup: <strong>{activeItem.seller}</strong>, Cedre Villas DSO<br/>
                          Drop: <strong>{dropAddress || "your address"}</strong><br/>
                          Vehicle: <strong>{deliveryType==="car" ? "Car" : "Pickup truck"}</strong>
                          {deliverySlot && <><br/>Slot: <strong>{deliverySlot.label} · {deliverySlot.time}</strong></>}
                        </p>
                        <a href={PORTER_BOOKING_URL} target="_blank" rel="noopener noreferrer"
                          className="block w-full mt-2 py-2.5 rounded-xl text-center text-white text-xs font-bold" style={{ background:AM }}>
                          Open Porter to book →
                        </a>
                        <p className="text-xs text-amber-600 mt-2">Paste the tracking link below once booked, so the seller can follow it too.</p>
                        <input value={trackingLink} onChange={e=>setTrackingLink(e.target.value)}
                          placeholder="Paste Porter tracking link"
                          className="w-full mt-2 px-3 py-2 rounded-xl text-xs outline-none" style={{ border:"1px solid #e5e7eb" }} />
                        {trackingLink && <p className="text-xs mt-1" style={{ color:G }}>✅ Saved — shared with the seller</p>}
                      </div>
                    )}
                  </div>
                  <button onClick={confirmHandover} className="w-full mt-5 py-4 rounded-2xl text-white font-bold shadow" style={{ background:G }}>✅ I received the item — release payment to seller</button>
                  <button onClick={()=>setModal("dispute")} className="w-full mt-2 py-3 rounded-2xl font-semibold text-sm" style={{ color:"#EF4444" }}>⚠️ Raise a dispute</button>
                </div>
              )}

              {modal==="dispute" && (
                <div className="p-6 text-center">
                  <span className="text-5xl">⚠️</span>
                  <p className="text-lg font-bold text-gray-900 mt-3">Raise a dispute</p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">Your money stays held safely until resolved.</p>
                  <div className="space-y-2 text-left">
                    {["Item not as described","Item not received","Item damaged","Seller not responding","Item sold elsewhere by seller","Wrong item delivered"].map(r=>(
                      <button key={r} onClick={()=>setModal(null)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700" style={{ background:"#f9fafb",border:"1px solid #e5e7eb" }}>{r}</button>
                    ))}
                  </div>
                  <button onClick={()=>setModal("escrow")} className="w-full mt-4 py-3 rounded-2xl text-gray-500 font-semibold text-sm">Go back</button>
                </div>
              )}

              {modal==="complete" && activeItem && (
                <div className="p-6 text-center">
                  <span className="text-6xl">🎉</span>
                  <p className="text-xl font-bold text-gray-900 mt-3">Transaction complete!</p>
                  <p className="text-sm text-gray-500 mt-1">AED {activeItem.price} released to {activeItem.seller}</p>
                  <EscrowBar step="released" />
                  <div className="mt-4 rounded-2xl p-4" style={{ background:"#f0fdf4",border:`1px solid ${G}` }}>
                    <p className="text-sm text-gray-700 mb-2">Rate {activeItem.seller}</p>
                    <div className="flex justify-center gap-2 text-2xl">{["⭐","⭐","⭐","⭐","⭐"].map((s,i)=><span key={i} className="cursor-pointer">{s}</span>)}</div>
                  </div>
                  <button onClick={()=>{ setModal(null); setActiveItem(null); }} className="w-full mt-4 py-4 rounded-2xl text-white font-bold" style={{ background:G }}>Done</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ HOME ══ */}
        {screen==="home" && (
          <div style={{ background:GD,minHeight:"100vh",paddingTop:connected?8:32 }}>
            <div className="px-5 pt-10 pb-6">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#9FE1CB" }}>Community Marketplace</p>
              <p className="text-white text-2xl font-bold mt-1">Cedre Villas</p>
              <p className="text-sm mt-0.5" style={{ color:"#9FE1CB" }}>Dubai Silicon Oasis</p>
              {loading && <p className="text-xs mt-1" style={{ color:"#9FE1CB" }}>Loading listings...</p>}
            </div>
            <div className="mx-3 rounded-3xl overflow-hidden bg-white">
              <div className="flex border-b border-gray-100">
                {[{ label:"Available",val:avail,c:G },{ label:"Reserved",val:res,c:AM },{ label:"Sold",val:sold,c:"#EF4444" }].map(s=>(
                  <div key={s.label} className="flex-1 py-4 text-center border-r border-gray-100 last:border-r-0">
                    <p className="text-xl font-bold" style={{ color:s.c }}>{s.val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <button onClick={startBot} className="w-full flex items-center gap-4 p-4 rounded-2xl text-left" style={{ background:"#f0fdf4",border:`1.5px solid ${G}` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background:G }}>💬</div>
                  <div>
                    <p className="font-bold text-gray-900">Sell something</p>
                    <p className="text-xs text-gray-500 mt-0.5">Chat with our WhatsApp bot — 60 seconds</p>
                  </div>
                  <span className="ml-auto text-gray-400">→</span>
                </button>
                <button onClick={()=>setScreen("catalogue")} className="w-full flex items-center gap-4 p-4 rounded-2xl text-left" style={{ background:"#f8fafc",border:"1.5px solid #e5e7eb" }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-gray-100">🛍️</div>
                  <div>
                    <p className="font-bold text-gray-900">Browse catalogue</p>
                    <p className="text-xs text-gray-500 mt-0.5">{avail} items available now</p>
                  </div>
                  <span className="ml-auto text-gray-400">→</span>
                </button>
                <button onClick={()=>setScreen("admin")} className="w-full flex items-center gap-4 p-4 rounded-2xl text-left" style={{ background:"#fefce8",border:`1.5px solid ${AM}` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background:AM }}>⚙️</div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Admin panel</p>
                    <p className="text-xs text-gray-500 mt-0.5">Monitor listings · {sold} sold</p>
                  </div>
                </button>
              </div>
              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recent listings</p>
                {listings.slice(0,3).map(item=>(
                  <button key={item.id} onClick={()=>{ setSelItem(item); setScreen("detail"); }} className="w-full flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.grad} flex items-center justify-center text-lg flex-shrink-0`}>{item.emoji}</div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.seller} · {item.time}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color:GD }}>AED {item.price}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background:item.status==="available"?G:item.status==="reserved"?AM:"#EF4444" }} />
                        <p className="text-xs capitalize" style={{ color:item.status==="available"?G:item.status==="reserved"?AM:"#EF4444" }}>{item.status}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <button onClick={()=>setScreen("catalogue")} className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-center" style={{ color:GD,background:"#f0fdf4" }}>View all listings →</button>
              </div>
            </div>
            <p className="text-center text-xs mt-4 pb-6 opacity-50" style={{ color:"#9FE1CB" }}>Cedre Villas · Dubai Silicon Oasis · {connected?"🟢 Live":"🟡 Demo"}</p>
          </div>
        )}

        {/* ══ BOT ══ */}
        {screen==="bot" && (
          <div className="flex flex-col" style={{ minHeight:"100vh",background:BG }}>
            <div className="sticky top-0 z-10" style={{ background:GD }}>
              <div className="flex items-center gap-3 px-4 pt-10 pb-3">
                <button onClick={()=>setScreen("home")} className="text-white text-lg mr-1">←</button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background:G }}>🤖</div>
                <div>
                  <p className="text-white font-semibold text-sm">Cedre Villas Bot</p>
                  <p className="text-xs" style={{ color:"#9FE1CB" }}>Your listing assistant</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 pb-32">
              {msgs.map((msg,i)=>(
                <div key={i} className={`flex ${msg.from==="user"?"justify-end":"justify-start"}`}>
                  {msg.from==="bot" && <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1" style={{ background:G }}>🤖</div>}
                  <div style={{ maxWidth:"78%" }}>
                    <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm"
                      style={{ background:msg.from==="user"?G:"#fff",color:msg.from==="user"?"#fff":"#111",borderBottomRightRadius:msg.from==="user"?4:16,borderBottomLeftRadius:msg.from==="bot"?4:16 }}>
                      {msg.text&&msg.text.split("\n").map((line,j)=>(
                        <p key={j} className={j>0?"mt-1":""} dangerouslySetInnerHTML={{ __html:line.replace(/\*(.*?)\*/g,"<strong>$1</strong>") }} />
                      ))}
                      {msg.type==="options"&&i===msgs.length-1&&(
                        <div className="mt-3 space-y-2">
                          {msg.opts.map(opt=>(
                            <button key={opt} onClick={()=>handleOpt(opt)} className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold text-left" style={{ background:"#f0fdf4",color:GD,border:`1px solid ${G}` }}>{opt}</button>
                          ))}
                        </div>
                      )}
                      {msg.type==="photo"&&i===msgs.length-1&&(
                        <button onClick={handlePhoto} className="mt-3 w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" style={{ background:"#f0fdf4",color:GD,border:`1px solid ${G}` }}>📷 Send photo</button>
                      )}
                      {msg.type==="preview_confirm"&&i===msgs.length-1&&(
                        <div className="mt-3 space-y-2">
                          <button onClick={confirmListing} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:G }}>✅ Yes, post it!</button>
                          <button onClick={startBot} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb" }}>✏️ Edit listing</button>
                        </div>
                      )}
                      {msg.type==="share"&&(
                        <div className="mt-3 space-y-2">
                          <button onClick={()=>{ setShareToast(true); setTimeout(()=>setShareToast(false),2500); }} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:G }}>📤 Share to Cedre Villas group</button>
                          <button onClick={()=>setScreen("catalogue")} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background:"#f0fdf4",color:GD }}>🛍️ Browse catalogue</button>
                          <div className="mt-2 p-3 rounded-xl" style={{ background:"#fffbeb",border:`1px solid #F59E0B` }}>
                            <p className="text-xs font-bold text-amber-800">💰 Set up your payment</p>
                            <p className="text-xs text-amber-700 mt-0.5">Set up how you receive money when your item sells — takes 1 minute.</p>
                            <button onClick={()=>{
                              setMsgs(prev=>[...prev,
                                { from:"bot", text:"✅ Item listed!\n\nNow let's set up your payment — *one-time setup* so you get paid instantly when your item sells.\n\nHow would you like to receive payment?", type:"options", opts:["💚 AANI (Instant)","🏦 Bank Transfer (IBAN)"] }
                              ]);
                              setBStep(8);
                            }} className="w-full mt-2 py-2 rounded-xl text-xs font-bold text-white" style={{ background:AM }}>💰 Set up payment now</button>
                          </div>
                        </div>
                      )}
                      {msg.type==="options" && i===msgs.length-1 && msg.opts && msg.opts.includes("💚 AANI (Instant)") && bStep===8 &&(
                        <div className="mt-3 space-y-2">
                          {msg.opts.map(opt=>(
                            <button key={opt} onClick={()=>{
                              if(opt.includes("AANI")) {
                                setMsgs(prev=>[...prev,
                                  { from:"user", text:opt },
                                  { from:"bot", text:"💚 *AANI — great choice!*\n\nDo you already have AANI set up on your UAE banking app?", type:"aani_check" }
                                ]);
                              } else {
                                setMsgs(prev=>[...prev,
                                  { from:"user", text:opt },
                                  { from:"bot", text:"🏦 *Bank Transfer selected*\n\nPlease share your IBAN number.\n\n📋 Format: AE + 21 digits\nExample: AE070331234567890123456\n\n💡 Find it in your banking app → Account Details → IBAN", type:"iban_flow" }
                                ]);
                              }
                            }} className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold text-left" style={{ background:"#f0fdf4",color:GD,border:`1px solid ${G}` }}>{opt}</button>
                          ))}
                        </div>
                      )}
                      {msg.type==="aani_check"&&i===msgs.length-1&&(
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-bold mb-2" style={{ color:G }}>Do you have AANI set up?</p>
                          <button onClick={()=>botNext("✅ Yes, I have AANI", bStep+1, bData)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-left px-3" style={{ background:"#f0fdf4",color:GD,border:`1px solid ${G}` }}>✅ Yes — enter my AANI number</button>
                          <button onClick={()=>{ setMsgs(prev=>[...prev,{ from:"bot",text:"📱 *Setting up AANI takes 2 minutes:*\n\n1️⃣ Open your UAE banking app\n2️⃣ Look for 'AANI' or 'Instant Payment'\n3️⃣ Register your mobile number\n4️⃣ Done — receive money instantly\n\n🏦 *Supported banks:*\nEmirates NBD, ADCB, FAB, Mashreq, DIB, RAK Bank and all major UAE banks\n\nOnce registered, reply with your mobile number to save it.",type:"aani_register" }]); }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-left px-3" style={{ background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb" }}>❓ No — help me set it up</button>
                        </div>
                      )}
                      {msg.type==="aani_register"&&i===msgs.length-1&&(
                        <div className="mt-3 p-3 rounded-xl" style={{ background:"#f0fdf4",border:`1px solid ${G}` }}>
                          <p className="text-xs font-bold mb-1" style={{ color:GD }}>Once registered:</p>
                          <p className="text-xs text-gray-600">Type your UAE mobile number (e.g. 0501234567) and we'll save it for instant payouts.</p>
                        </div>
                      )}
                      {msg.type==="iban_flow"&&i===msgs.length-1&&(
                        <div className="mt-3 space-y-2">
                          <div className="p-3 rounded-xl" style={{ background:"#f9fafb",border:"1px solid #e5e7eb" }}>
                            <p className="text-xs text-gray-600">Format: <strong>AE + 21 digits</strong></p>
                            <p className="text-xs text-gray-400 mt-0.5">Find it: Banking app → Account Details → IBAN</p>
                          </div>
                          <p className="text-xs text-gray-400 text-center">Type your AANI number above</p>
                          <button onClick={()=>setMsgs(prev=>[...prev,
                            { from:"user", text:"🏦 IBAN noted" },
                            { from:"bot", text:"✅ *All set!*\n\nBuyer pays → we hold it safely → you hand over → buyer confirms → you get paid. 🏦\n\nWe'll notify you on WhatsApp at every step.", type:"payment_saved" }
                          ])} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background:GD }}>✓ IBAN entered in chat above</button>
                        </div>
                      )}
                      {msg.type==="payment_saved"&&(
                        <div className="mt-3 space-y-2">
                          <div className="p-3 rounded-xl" style={{ background:"#f0fdf4",border:`1px solid ${G}` }}>
                            <p className="text-xs font-bold" style={{ color:GD }}>🛡️ Powered by PayTabs</p>
                            <p className="text-xs text-gray-600 mt-1">UAE's trusted payment processor. Your money is protected at every step.</p>
                          </div>
                          <button onClick={startBot} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background:G }}>📤 List another item</button>
                          <button onClick={()=>setScreen("catalogue")} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background:"#f0fdf4",color:GD }}>🛍️ Browse catalogue</button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 px-1">{msg.from==="user"?"You":"Bot"} · now</p>
                  </div>
                </div>
              ))}
              {typing&&(
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background:G }}>🤖</div>
                  <div className="px-4 py-3 rounded-2xl bg-white shadow-sm" style={{ borderBottomLeftRadius:4 }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full" style={{ background:"#9ca3af",animation:`bounce 1s ease-in-out ${i*0.15}s infinite` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            {!botDone&&msgs.length>0&&BOT[bStep]?.type==="text"&&(
              <div className="fixed bottom-0 left-1/2 w-full max-w-sm px-3 py-3" style={{ transform:"translateX(-50%)",background:BG }}>
                <div className="flex gap-2">
                  <input value={bInput} onChange={e=>setBInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder={BOT[bStep]?.ph||"Type a message..."} className="flex-1 px-4 py-3 rounded-full text-sm outline-none" style={{ background:"#fff" }} />
                  <button onClick={handleSend} className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background:bInput.trim()?G:"#9ca3af" }}>➤</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CATALOGUE ══ */}
        {screen==="catalogue" && (
          <div style={{ minHeight:"100vh",background:BG }}>
            <div className="sticky top-0 z-10" style={{ background:GD }}>
              <div className="flex items-center gap-3 px-4 pt-10 pb-3">
                <button onClick={()=>setScreen("home")} className="text-white text-lg mr-1">←</button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:G }}>🏘️</div>
                <div>
                  <p className="text-white font-semibold text-sm">Cedre Villas</p>
                  <p className="text-xs" style={{ color:"#9FE1CB" }}>{avail} available · <span style={{ color:"#FCD34D" }}>{res} reserved</span></p>
                </div>
                <button onClick={()=>{ loadListings(); }} className="ml-auto text-white text-xs px-2 py-1 rounded-full opacity-60" style={{ background:"rgba(255,255,255,0.2)" }}>↻</button>
                <button onClick={startBot} className="text-white text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background:G }}>+ Sell</button>
              </div>
              <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
                {CATS.map(c=>(
                  <button key={c} onClick={()=>setCat(c)} className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background:cat===c?G:"rgba(255,255,255,0.15)",color:"#fff" }}>{c}</button>
                ))}
              </div>
            </div>
            <div className="px-3 py-3 pb-6">
              {loading && <p className="text-center text-sm text-gray-400 py-8">Loading listings from Google Sheet...</p>}
              <div className="flex gap-3 mb-3 px-1">
                {[["available",G,"Available"],["reserved",AM,"Reserved"],["sold","#EF4444","Sold"]].map(([s,c,l])=>(
                  <div key={s} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background:c }} /><span className="text-xs text-gray-500">{l}</span></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(item=>{
                  const b=badge(item);
                  return (
                    <button key={item.id} onClick={()=>{ setSelItem(item); setScreen("detail"); }} className="text-left rounded-2xl overflow-hidden bg-white shadow-sm" style={{ border:`1px solid ${item.status==="reserved"?AM:"rgba(0,0,0,0.06)"}` }}>
                      <div className={`bg-gradient-to-br ${item.grad} h-28 flex items-center justify-center relative`}>
                        {item.photo ? <img src={item.photo} alt={item.title} className="w-full h-full object-cover" onError={e=>{ e.target.style.display="none"; }} /> : <span className="text-5xl">{item.emoji}</span>}
                        {b&&<div className="absolute inset-0 flex items-center justify-center" style={{ background:"rgba(0,0,0,0.4)" }}><span className="font-bold text-xs tracking-widest px-3 py-1 rounded-full text-white" style={{ background:b.bg }}>{b.label}</span></div>}
                        {!b&&<div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background:G }} />}
                        {/* Wishlist heart */}
                        <button onClick={e=>{ e.stopPropagation(); setSavedItems(prev=>prev.find(s=>s.id===item.id)?prev.filter(s=>s.id!==item.id):[...prev,item]); }}
                          className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                          style={{ background:"rgba(255,255,255,0.9)" }}>
                          {savedItems.find(s=>s.id===item.id) ? "❤️" : "🤍"}
                        </button>
                        {/* Expiry warning */}
                        {daysUntilExpiry(item.time) <= 5 && item.status==="available" && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-white" style={{ background:"#EF4444",fontSize:9,fontWeight:700 }}>
                            Expires in {daysUntilExpiry(item.time)}d
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-400">{item.cat}</p>
                        <p className="font-semibold text-gray-900 text-sm leading-tight mt-0.5">{item.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-bold" style={{ color:GD }}>AED {item.price}</p>
                          {item.salesCount && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background:sellerBadge(item.salesCount).color,fontSize:9 }}>{sellerBadge(item.salesCount).label}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{item.seller} · {item.time}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ DETAIL ══ */}
        {screen==="detail"&&selItem&&(()=>{
          const item=listings.find(l=>l.id===selItem.id)||selItem;
          const b=badge(item);
          return (
            <div style={{ minHeight:"100vh",background:"#fff" }}>
              <div className="sticky top-0 z-10" style={{ background:GD }}>
                <div className="flex items-center gap-3 px-4 pt-10 pb-3">
                  <button onClick={()=>setScreen("catalogue")} className="text-white text-lg mr-1">←</button>
                  <p className="text-white font-semibold text-sm">Listing detail</p>
                </div>
              </div>
              <div className={`bg-gradient-to-br ${item.grad} h-56 flex items-center justify-center relative`}>
                {item.photo ? <img src={item.photo} alt={item.title} className="w-full h-full object-cover" /> : <span className="text-8xl">{item.emoji}</span>}
                {b&&<div className="absolute inset-0 flex items-center justify-center" style={{ background:"rgba(0,0,0,0.45)" }}><span className="font-bold text-xl tracking-widest px-5 py-2 rounded-full text-white" style={{ background:b.bg }}>{b.label}</span></div>}
              </div>
              <div className="px-5 pt-5 pb-32">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background:G }}>{item.cat}</span>
                    <h2 className="text-xl font-bold text-gray-900 mt-2">{item.title}</h2>
                  </div>
                  <p className="text-2xl font-bold mt-1 flex-shrink-0" style={{ color:GD }}>AED {item.price}</p>
                </div>
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl" style={{ background:"#eef2ff" }}>
                  <span style={{ color:ES }}>🔒</span>
                  <p className="text-xs" style={{ color:ES }}><strong>Safe Pay protected</strong> — money released only after you confirm receipt</p>
                </div>
                <div className="flex items-center gap-3 mt-4 p-3 rounded-2xl" style={{ background:"#f0fdf4" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background:G }}>👤</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.seller}</p>
                    <p className="text-xs text-gray-500">DSO resident · {item.time}</p>
                  </div>
                  <div className="ml-auto text-xs font-semibold" style={{ color:AM }}>⭐ 4.9</div>
                </div>
                {item.status==="available"&&(
                  <div className="mt-5 space-y-2">
                    <button onClick={()=>handleBuy(item)} className="w-full py-4 rounded-2xl text-white font-bold text-base shadow" style={{ background:G }}>🔒 Buy</button>
                    {!showOffer ? (
                      <button onClick={()=>setShowOffer(true)} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb" }}>
                        💬 Make an offer
                      </button>
                    ) : (
                      <div className="rounded-2xl p-4" style={{ background:"#f9fafb",border:"1px solid #e5e7eb" }}>
                        <p className="text-xs font-bold text-gray-700 mb-2">Your offer (AED)</p>
                        <div className="flex gap-2">
                          <input value={offerAmount} onChange={e=>setOfferAmount(e.target.value)} type="number"
                            placeholder={`Max AED ${item.price}`}
                            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border:"1px solid #e5e7eb" }} />
                          <button onClick={()=>{
                            const amt = parseInt(offerAmount);
                            if(amt && amt > 0 && amt < item.price) {
                              setOfferSent(true);
                              setShowOffer(false);
                              setOfferAmount("");
                              setTimeout(()=>setOfferSent(false), 4000);
                            }
                          }} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background:G }}>Send</button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">We'll notify the seller. If they accept, you'll get a WhatsApp alert to complete the purchase.</p>
                      </div>
                    )}
                    <button onClick={()=>setSavedItems(prev=>prev.find(s=>s.id===item.id)?prev.filter(s=>s.id!==item.id):[...prev,item])}
                      className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb" }}>
                      {savedItems.find(s=>s.id===item.id) ? "❤️ Saved" : "🤍 Save for later"}
                    </button>
                  </div>
                )}
                {item.status==="reserved"&&(
                  <div className="mt-5 space-y-2">
                    <div className="py-3 px-4 rounded-2xl text-center font-bold" style={{ background:"#fffbeb",color:AM,border:`1px solid ${AM}` }}>⏳ Reserved — someone is paying now</div>
                    <button onClick={()=>handleBuy(item)} className="w-full py-3 rounded-2xl font-semibold text-sm" style={{ background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb" }}>🔔 Join waitlist</button>
                  </div>
                )}
                {item.status==="sold"&&<div className="mt-5 py-4 rounded-2xl text-center font-bold text-gray-400 bg-gray-100">This item has been sold</div>}
              </div>
            </div>
          );
        })()}

        {/* ══ ADMIN ══ */}
        {screen==="admin"&&(
          <div style={{ minHeight:"100vh",background:"#f9fafb" }}>
            <div className="sticky top-0 z-10" style={{ background:GD }}>
              <div className="flex items-center gap-3 px-4 pt-10 pb-4">
                <button onClick={()=>setScreen("home")} className="text-white text-lg mr-1">←</button>
                <p className="text-white font-semibold text-sm">Admin Panel</p>
                <button onClick={loadListings} className="ml-auto text-white text-xs px-3 py-1.5 rounded-full" style={{ background:"rgba(255,255,255,0.2)" }}>↻ Refresh</button>
              </div>
            </div>
            <div className="px-4 py-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ label:"Live",val:avail+res,c:G },{ label:"Sold",val:sold,c:ES },{ label:"Total",val:listings.length,c:GD }].map(s=>(
                  <div key={s.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                    <p className="text-2xl font-bold" style={{ color:s.c }}>{s.val}</p>
                    <p style={{ fontSize:10,color:"#9ca3af",marginTop:2 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {connected && (
                <div className="rounded-2xl p-3 mb-4 flex items-center gap-2" style={{ background:"#f0fdf4",border:`1px solid ${G}` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background:G }} />
                  <p className="text-xs" style={{ color:GD }}>Live — reading from Google Sheet · refreshes every 30s</p>
                </div>
              )}
              {!connected && (
                <div className="rounded-2xl p-3 mb-4" style={{ background:"#fffbeb",border:`1px solid ${AM}` }}>
                  <p className="text-xs font-bold text-amber-800">🟡 Demo mode</p>
                  <p className="text-xs text-amber-700 mt-0.5">Add your Sheet ID and API key to go live</p>
                </div>
              )}
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">All listings</p>
              <div className="space-y-2">
                {listings.map(item=>(
                  <div key={item.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.grad} flex items-center justify-center text-lg flex-shrink-0`}>{item.emoji}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.seller} · AED {item.price}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background:item.status==="available"?G:item.status==="reserved"?AM:"#EF4444" }} />
                        <p className="text-xs capitalize font-medium" style={{ color:item.status==="available"?G:item.status==="reserved"?AM:"#EF4444" }}>{item.status}</p>
                      </div>
                      <p className="text-xs text-gray-300">{item.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}
