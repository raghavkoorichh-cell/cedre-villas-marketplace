import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════
// CEDRE VILLAS MARKETPLACE
// Replace these 3 values with your real ones (Step 3)
// ══════════════════════════════════════════════════════════════
const SHEETS_CONFIG = {
  SHEET_ID:   "YOUR_GOOGLE_SHEET_ID",        // from Sheet URL
  API_KEY:    "YOUR_GOOGLE_SHEETS_API_KEY",  // from Google Cloud
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
  { key:"paid_in_escrow", label:"Escrow",  icon:"🔒" },
  { key:"item_handed",    label:"Handover",icon:"🤝" },
  { key:"released",       label:"Complete",icon:"✅" },
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

// ── GOOGLE SHEETS FETCH ──
async function fetchListings() {
  if (SHEETS_CONFIG.SHEET_ID === "YOUR_GOOGLE_SHEET_ID") return SAMPLE;
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
    setEscrow("paid_in_escrow"); setModal("escrow");
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

  const connected = SHEETS_CONFIG.SHEET_ID !== "YOUR_GOOGLE_SHEET_ID";

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
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Secure checkout</p>
                  <p className="text-lg font-bold text-gray-900">{activeItem.title}</p>
                  <div className="rounded-2xl p-4 mt-3 mb-4" style={{ background:"#eef2ff",border:`1px solid ${ES}` }}>
                    <p className="text-xs font-bold mb-1" style={{ color:ES }}>🔒 Escrow protected</p>
                    <p className="text-xs text-indigo-700">Your money is held safely. Released to seller <strong>only after you confirm receipt.</strong></p>
                    <EscrowBar step="payment_pending" />
                  </div>
                  <div className="rounded-2xl p-4" style={{ background:"#f9fafb" }}>
                    <div className="flex justify-between text-sm text-gray-600"><span>Item price</span><span>AED {activeItem.price}</span></div>
                    <div className="flex justify-between text-sm text-gray-400 mt-1"><span>Platform fee (2%)</span><span>AED {Math.round(activeItem.price*0.02)}</span></div>
                    <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between font-bold text-gray-900"><span>Total to escrow</span><span>AED {activeItem.price+Math.round(activeItem.price*0.02)}</span></div>
                  </div>
                  <button onClick={confirmPay} className="w-full mt-4 py-4 rounded-2xl text-white font-bold shadow" style={{ background:ES }}>🔒 Pay into escrow</button>
                  <button onClick={confirmPay} className="w-full mt-2 py-3 rounded-2xl text-white font-semibold text-sm" style={{ background:G }}>🍎 Apple Pay</button>
                  <button onClick={()=>setModal(null)} className="w-full mt-2 py-3 rounded-2xl text-gray-500 font-semibold text-sm">Cancel</button>
                </div>
              )}

              {modal==="escrow" && activeItem && (
                <div className="p-6">
                  <div className="text-center mb-2">
                    <span className="text-5xl">🔒</span>
                    <p className="text-lg font-bold text-gray-900 mt-2">AED {activeItem.price} in escrow</p>
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
                    </div>
                  </div>
                  <button onClick={confirmHandover} className="w-full mt-5 py-4 rounded-2xl text-white font-bold shadow" style={{ background:G }}>✅ I received the item — release payment</button>
                  <button onClick={()=>setModal("dispute")} className="w-full mt-2 py-3 rounded-2xl font-semibold text-sm" style={{ color:"#EF4444" }}>⚠️ Raise a dispute</button>
                </div>
              )}

              {modal==="dispute" && (
                <div className="p-6 text-center">
                  <span className="text-5xl">⚠️</span>
                  <p className="text-lg font-bold text-gray-900 mt-3">Raise a dispute</p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">Your money stays in escrow until resolved.</p>
                  <div className="space-y-2 text-left">
                    {["Item not as described","Item not received","Item damaged","Seller not responding"].map(r=>(
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
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-400">{item.cat}</p>
                        <p className="font-semibold text-gray-900 text-sm leading-tight mt-0.5">{item.title}</p>
                        <p className="font-bold mt-1" style={{ color:GD }}>AED {item.price}</p>
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
                  <p className="text-xs" style={{ color:ES }}><strong>Escrow protected</strong> — money released only after you confirm receipt</p>
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
                  <div className="mt-5 flex gap-3">
                    <button onClick={()=>handleBuy(item)} className="flex-1 py-4 rounded-2xl text-white font-bold text-base shadow" style={{ background:G }}>🔒 Buy (escrow)</button>
                    <a href={`https://wa.me/${item.phone?.replace(/\D/g,"")}`} className="py-4 px-5 rounded-2xl font-bold text-base border-2 flex items-center justify-center" style={{ borderColor:G,color:GD }}>💬</a>
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
