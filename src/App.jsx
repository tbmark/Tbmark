import React, { useState, useMemo, useEffect } from "react";
import {
  Search, MapPin, Star, ChevronLeft, Check, Clock,
  Home, Heart, User, Calendar, CreditCard, Sparkles,
  ChevronRight, Wallet, Smartphone, Loader2
} from "lucide-react";
import { supabase } from "./lib/supabase";

/* ---------------------------------------------------------
   MOCK DATA — datas e horários ainda são fixos até a lógica
   de disponibilidade real ser construída (próxima etapa)
--------------------------------------------------------- */

const DATES = [
  { label: "Hoje", sub: "13 Ago" },
  { label: "Amanhã", sub: "14 Ago" },
  { label: "Sex", sub: "15 Ago" },
  { label: "Sáb", sub: "16 Ago" },
  { label: "Dom", sub: "17 Ago" },
];

const TIMES = ["09:00", "10:30", "11:15", "13:00", "14:30", "16:00", "17:30"];

const fmt = (n) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const initialsOf = (name) => name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const AVATAR_COLORS = ["#6B2737", "#8B3A4E", "#A2555E", "#B4696F"];


/* ---------------------------------------------------------
   SHARED UI BITS
--------------------------------------------------------- */

function Avatar({ initials, color, size = 48 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-body font-bold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function TopHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-3 pb-4 bg-[#FAF5F1]">
      <button
        onClick={onBack}
        className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0"
      >
        <ChevronLeft size={18} color="#6B2737" />
      </button>
      <h1 className="font-display font-semibold text-[17px] text-[#2B1A1F] truncate">{title}</h1>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl py-3.5 font-body font-bold text-[15px] transition-all ${
        disabled
          ? "bg-[#EFE3DE] text-[#B49A96] cursor-not-allowed"
          : "bg-[#6B2737] text-white active:scale-[0.98] shadow-[0_6px_16px_-4px_rgba(107,39,55,0.45)]"
      }`}
    >
      {children}
    </button>
  );
}

function StepDots({ step }) {
  const labels = ["Profissional", "Serviços", "Horário", "Pagamento"];
  return (
    <div className="flex items-center gap-1.5 px-5 pb-3">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-1.5 flex-1">
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-[#6B2737]" : "bg-[#EFE3DE]"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: AUTH (login / cadastro do cliente)
--------------------------------------------------------- */

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // login | signup | check-email
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone, birth_date: birthDate } },
    });

    if (error) {
      setErrorMsg(error.message === "User already registered" ? "Esse email já está cadastrado." : "Não foi possível cadastrar agora. Tente novamente.");
      setLoading(false);
      return;
    }

    // Cria o registro correspondente na tabela clients
    if (data.user) {
      await supabase.from("clients").insert({
        user_id: data.user.id,
        name,
        phone,
        email,
        birth_date: birthDate || null,
      });
    }

    setLoading(false);
    setMode("check-email");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg("Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onAuthenticated();
  }

  if (mode === "check-email") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#FAF5F1] px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#EEF3E9] flex items-center justify-center mb-5">
          <Check size={28} color="#5C7A4C" strokeWidth={3} />
        </div>
        <h1 className="font-display font-semibold text-[20px] text-[#2B1A1F]">Confirme seu email</h1>
        <p className="font-body text-[13px] text-[#8A6F72] mt-2">
          Enviamos um link de confirmação para <span className="font-semibold text-[#2B1A1F]">{email}</span>.
          Depois de confirmar, você já pode entrar normalmente.
        </p>
        <div className="w-full mt-6">
          <PrimaryButton onClick={() => setMode("login")}>Ir para o login</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF5F1] pb-8">
      <div className="px-6 pt-10 pb-6 text-center">
        <h1 className="font-display font-semibold text-[26px] text-[#2B1A1F]">TBMark</h1>
        <p className="font-body text-[13px] text-[#8A6F72] mt-1">
          {mode === "login" ? "Entre para agendar seu próximo horário" : "Crie sua conta para começar a agendar"}
        </p>
      </div>

      <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="px-6 flex flex-col gap-3">
        {mode === "signup" && (
          <>
            <input
              type="text"
              required
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm placeholder:text-[#B49A96]"
            />
            <input
              type="tel"
              required
              placeholder="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm placeholder:text-[#B49A96]"
            />
            <div>
              <label className="font-body text-[11.5px] text-[#8A6F72] ml-1">Data de nascimento</label>
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-white rounded-2xl px-4 py-3 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm mt-1"
              />
            </div>
          </>
        )}

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm placeholder:text-[#B49A96]"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm placeholder:text-[#B49A96]"
        />

        {errorMsg && (
          <p className="font-body text-[12px] text-[#B23A3A] bg-[#FBEAEA] rounded-xl px-3 py-2">{errorMsg}</p>
        )}

        <div className="mt-2">
          <PrimaryButton disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Aguarde...
              </span>
            ) : mode === "login" ? (
              "Entrar"
            ) : (
              "Criar conta"
            )}
          </PrimaryButton>
        </div>
      </form>

      <p className="text-center font-body text-[12.5px] text-[#8A6F72] mt-5">
        {mode === "login" ? (
          <>
            Ainda não tem conta?{" "}
            <button onClick={() => setMode("signup")} className="text-[#6B2737] font-semibold">
              Cadastre-se
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button onClick={() => setMode("login")} className="text-[#6B2737] font-semibold">
              Entrar
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: SEARCH / HOME
--------------------------------------------------------- */

function SearchScreen({ onOpenSalon }) {
  const chips = ["Todos", "Escova", "Unhas", "Sobrancelha", "Cílios", "Massagem"];
  const [activeChip, setActiveChip] = useState("Todos");
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [location, setLocation] = useState(null); // { city, neighborhood } | null
  const [editingLocation, setEditingLocation] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [neighborhoodInput, setNeighborhoodInput] = useState("");

  useEffect(() => {
    let active = true;
    async function fetchSalons() {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase
        .from("salons")
        .select("id, name, address, photo_url, is_featured, services(name)")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Erro ao buscar salões:", error);
        setErrorMsg(error.message || "Não foi possível carregar os salões agora.");
        setSalons([]);
      } else {
        setSalons(data || []);
      }
      setLoading(false);
    }
    fetchSalons();
    return () => {
      active = false;
    };
  }, []);

  function saveLocation(e) {
    e.preventDefault();
    if (cityInput.trim()) {
      setLocation({ city: cityInput.trim(), neighborhood: neighborhoodInput.trim() });
    }
    setEditingLocation(false);
  }

  const locationLabel = location
    ? [location.neighborhood, location.city].filter(Boolean).join(", ")
    : "Escolher localização";

  return (
    <div className="flex-1 overflow-y-auto pb-10">
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-2 text-center">
        <div className="relative inline-block mb-2">
          <button
            onClick={() => {
              setCityInput(location?.city || "");
              setNeighborhoodInput(location?.neighborhood || "");
              setEditingLocation((v) => !v);
            }}
            className="flex items-center gap-1.5 text-[#6B2737] font-body font-semibold text-[12.5px]"
          >
            <MapPin size={13} />
            <span>{locationLabel}</span>
          </button>

          {editingLocation && (
            <form
              onSubmit={saveLocation}
              className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg p-3 w-64 flex flex-col gap-2"
            >
              <input
                autoFocus
                type="text"
                placeholder="Cidade"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3 py-2 font-body text-[13px] text-[#2B1A1F] outline-none placeholder:text-[#B49A96]"
              />
              <input
                type="text"
                placeholder="Bairro (opcional)"
                value={neighborhoodInput}
                onChange={(e) => setNeighborhoodInput(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3 py-2 font-body text-[13px] text-[#2B1A1F] outline-none placeholder:text-[#B49A96]"
              />
              <button
                type="submit"
                className="bg-[#6B2737] text-white rounded-xl py-2 font-body font-semibold text-[12.5px] mt-1"
              >
                Salvar
              </button>
            </form>
          )}
        </div>
        <h1 className="font-display font-semibold text-[30px] sm:text-[38px] text-[#2B1A1F] leading-tight">
          Encontre seu próximo salão ✨
        </h1>
        <p className="font-body text-[14px] text-[#8A6F72] mt-1.5">
          Encontre e agende no seu próximo salão de beleza
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-5">
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3.5 shadow-sm">
          <Search size={18} color="#B49A96" />
          <input
            type="text"
            placeholder="Buscar salão ou procedimento"
            className="flex-1 bg-transparent outline-none font-body text-[14.5px] text-[#2B1A1F] placeholder:text-[#B49A96]"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex gap-2 px-6 mt-4 overflow-x-auto no-scrollbar justify-center flex-wrap">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setActiveChip(c)}
            className={`shrink-0 font-body font-semibold text-[12.5px] px-3.5 py-2 rounded-full transition-colors ${
              activeChip === c ? "bg-[#6B2737] text-white" : "bg-white text-[#6B2737] border border-[#EFE3DE]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {activeChip !== "Todos" && (
        <p className="text-center font-body text-[11.5px] text-[#8A6F72] mt-2">
          Filtrando por: <span className="font-semibold text-[#6B2737]">{activeChip}</span>
        </p>
      )}

      <div className="max-w-5xl mx-auto px-6 mt-8 flex items-center justify-between">
        <h2 className="font-display font-semibold text-[18px] text-[#2B1A1F]">Perto de você</h2>
        <span className="font-body text-[12px] text-[#8A6F72]">Ver tudo</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-[#8A6F72]">
            <Loader2 size={18} className="animate-spin" />
            <span className="font-body text-[13px]">Carregando salões...</span>
          </div>
        )}

        {!loading && errorMsg && (
          <p className="text-center font-body text-[13px] text-[#8A6F72] py-8">{errorMsg}</p>
        )}

        {!loading && !errorMsg && salons.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-auto">
            <p className="font-body font-semibold text-[13.5px] text-[#2B1A1F]">
              Nenhum salão cadastrado ainda
            </p>
            <p className="font-body text-[12px] text-[#8A6F72] mt-1">
              Assim que uma dona de salão cadastrar o negócio dela, ele aparece aqui.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading &&
            salons.map((salon) => {
              const tags = [...new Set((salon.services || []).map((s) => s.name))].slice(0, 3);
              return (
                <button key={salon.id} onClick={() => onOpenSalon(salon)} className="text-left">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.99] transition-all h-full flex flex-col">
                    <div
                      className="h-32 relative bg-gradient-to-br from-[#6B2737] to-[#A2555E]"
                      style={
                        salon.photo_url
                          ? { backgroundImage: `url(${salon.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                          : undefined
                      }
                    >
                      {salon.is_featured && (
                        <span className="absolute top-2.5 left-2.5 bg-[#C9A227] text-white text-[10px] font-body font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Sparkles size={10} /> Destaque
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-display font-semibold text-[16px] text-[#2B1A1F]">{salon.name}</h3>
                      {salon.address && (
                        <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">{salon.address}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                          {tags.map((t) => (
                            <span key={t} className="text-[10.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-[#FAF5F1] text-[#6B2737]">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: SALON PROFILE (choose professional)
--------------------------------------------------------- */

function SalonScreen({ salon, onBack, onSelectProfessional }) {
  const [professionals, setProfessionals] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avg: null, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      setLoading(true);
      const [profRes, reviewRes] = await Promise.all([
        supabase.from("professionals").select("id, name, role").eq("salon_id", salon.id).eq("active", true),
        supabase.from("reviews").select("rating").eq("salon_id", salon.id),
      ]);
      if (!active) return;

      setProfessionals(profRes.data || []);

      const ratings = reviewRes.data || [];
      if (ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        setReviewStats({ avg: avg.toFixed(1), count: ratings.length });
      } else {
        setReviewStats({ avg: null, count: 0 });
      }
      setLoading(false);
    }
    fetchData();
    return () => {
      active = false;
    };
  }, [salon.id]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF5F1] pb-4">
      <div
        className="h-40 relative bg-gradient-to-br from-[#6B2737] to-[#A2555E]"
        style={
          salon.photo_url
            ? { backgroundImage: `url(${salon.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center"
        >
          <ChevronLeft size={18} color="#6B2737" />
        </button>
      </div>

      <div className="px-5 -mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <h1 className="font-display font-semibold text-[19px] text-[#2B1A1F]">{salon.name}</h1>
          <div className="flex items-center gap-1 mt-1">
            {reviewStats.avg ? (
              <>
                <Star size={13} fill="#C9A227" color="#C9A227" />
                <span className="font-body font-bold text-[12.5px] text-[#2B1A1F]">{reviewStats.avg}</span>
                <span className="font-body text-[12px] text-[#8A6F72]">({reviewStats.count} avaliações)</span>
              </>
            ) : (
              <span className="font-body text-[12px] text-[#8A6F72]">Ainda sem avaliações</span>
            )}
          </div>
          {salon.address && (
            <div className="flex items-center gap-1 mt-1.5 text-[#8A6F72]">
              <MapPin size={12} />
              <span className="font-body text-[12px]">{salon.address}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 mt-6">
        <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F]">Escolha quem vai te atender</h2>
        <p className="font-body text-[12.5px] text-[#8A6F72] mt-0.5">
          Profissionais desse salão
        </p>
      </div>

      <div className="px-5 mt-3 flex flex-col gap-2.5">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-[#8A6F72]">
            <Loader2 size={18} className="animate-spin" />
            <span className="font-body text-[13px]">Carregando profissionais...</span>
          </div>
        )}

        {!loading && professionals.length === 0 && (
          <div className="bg-white rounded-2xl p-5 text-center">
            <p className="font-body text-[13px] text-[#8A6F72]">
              Esse salão ainda não cadastrou profissionais.
            </p>
          </div>
        )}

        {!loading &&
          professionals.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onSelectProfessional(p)}
              className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <Avatar initials={initialsOf(p.name)} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
              <div className="flex-1 min-w-0">
                <h3 className="font-body font-bold text-[14px] text-[#2B1A1F] truncate">{p.name}</h3>
                {p.role && <p className="font-body text-[12px] text-[#8A6F72]">{p.role}</p>}
              </div>
              <ChevronRight size={16} color="#B49A96" className="shrink-0" />
            </button>
          ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: BOOKING FLOW (services -> date/time -> payment)
--------------------------------------------------------- */

function BookingScreen({
  professional, onBack, onConfirmed,
  selectedServices, toggleService,
  date, setDate, time, setTime,
  step, setStep,
}) {
  const [mensalista, setMensalista] = useState(false);
  const [paymentMode, setPaymentMode] = useState("sinal"); // sinal | total
  const [method, setMethod] = useState("pix");
  const [servicesForProf, setServicesForProf] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchServices() {
      setLoadingServices(true);
      const { data } = await supabase
        .from("professional_services")
        .select("services(id, name, price, duration_minutes)")
        .eq("professional_id", professional.id);
      if (!active) return;
      setServicesForProf((data || []).map((row) => row.services).filter(Boolean));
      setLoadingServices(false);
    }
    fetchServices();
    return () => {
      active = false;
    };
  }, [professional.id]);

  const total = useMemo(
    () => selectedServices.reduce((sum, id) => sum + (servicesForProf.find((s) => s.id === id)?.price || 0), 0),
    [selectedServices, servicesForProf]
  );
  const sinal = total * 0.1;

  const canContinueStep0 = selectedServices.length > 0;
  const canContinueStep1 = !!date && !!time;

  const titles = ["Serviços", "Data e horário", "Pagamento"];

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF5F1] pb-4 flex flex-col">
      <TopHeader title={titles[step]} onBack={step === 0 ? onBack : () => setStep(step - 1)} />
      <StepDots step={step + 1} />

      <div className="flex items-center gap-2.5 px-5 pb-4">
        <Avatar initials={initialsOf(professional.name)} color={AVATAR_COLORS[0]} size={36} />
        <div>
          <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{professional.name}</p>
          <p className="font-body text-[11px] text-[#8A6F72]">{professional.role}</p>
        </div>
      </div>

      {/* STEP 0: SERVICES */}
      {step === 0 && (
        <div className="px-5 flex flex-col gap-2.5">
          {loadingServices && (
            <div className="flex items-center justify-center gap-2 py-10 text-[#8A6F72]">
              <Loader2 size={18} className="animate-spin" />
              <span className="font-body text-[13px]">Carregando serviços...</span>
            </div>
          )}
          {!loadingServices && servicesForProf.length === 0 && (
            <div className="bg-white rounded-2xl p-5 text-center">
              <p className="font-body text-[13px] text-[#8A6F72]">
                Essa profissional ainda não tem serviços cadastrados.
              </p>
            </div>
          )}
          {!loadingServices && servicesForProf.map((s) => {
            const active = selectedServices.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                className={`rounded-2xl p-3.5 flex items-center gap-3 text-left border-2 transition-colors ${
                  active ? "border-[#6B2737] bg-white" : "border-transparent bg-white"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    active ? "bg-[#6B2737]" : "bg-[#EFE3DE]"
                  }`}
                >
                  {active && <Check size={13} color="white" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <p className="font-body font-bold text-[14px] text-[#2B1A1F]">{s.name}</p>
                  <p className="font-body text-[11.5px] text-[#8A6F72]">{s.duration_minutes} min</p>
                </div>
                <p className="font-body font-bold text-[14px] text-[#6B2737]">{fmt(s.price)}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* STEP 1: DATE / TIME */}
      {step === 1 && (
        <div className="px-5 flex flex-col gap-5">
          <div>
            <p className="font-body font-bold text-[12.5px] text-[#2B1A1F] mb-2">Escolha o dia</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {DATES.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDate(d.label)}
                  className={`shrink-0 flex flex-col items-center rounded-2xl px-4 py-2.5 ${
                    date === d.label ? "bg-[#6B2737] text-white" : "bg-white text-[#2B1A1F]"
                  }`}
                >
                  <span className="font-body font-bold text-[13px]">{d.label}</span>
                  <span className={`font-body text-[10.5px] ${date === d.label ? "text-white/70" : "text-[#8A6F72]"}`}>
                    {d.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-body font-bold text-[12.5px] text-[#2B1A1F] mb-2 flex items-center gap-1.5">
              <Clock size={13} /> Horários disponíveis
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={`rounded-xl py-2.5 font-body font-semibold text-[13px] ${
                    time === t ? "bg-[#6B2737] text-white" : "bg-white text-[#2B1A1F]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PAYMENT / SUMMARY */}
      {step === 2 && (
        <div className="px-5 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-body font-bold text-[12.5px] text-[#2B1A1F] mb-2.5">Resumo</p>
            {selectedServices.map((id) => {
              const s = servicesForProf.find((x) => x.id === id);
              return (
                <div key={id} className="flex justify-between font-body text-[13px] text-[#4A3538] py-1">
                  <span>{s.name}</span>
                  <span className="font-semibold">{fmt(s.price)}</span>
                </div>
              );
            })}
            <div className="flex justify-between font-body text-[12px] text-[#8A6F72] mt-1.5 pt-1.5 border-t border-[#EFE3DE]">
              <span>{date}, {time}</span>
            </div>
            <div className="flex justify-between font-body font-bold text-[15px] text-[#2B1A1F] mt-2 pt-2 border-t border-[#EFE3DE]">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setMensalista((m) => !m)}
            className="flex items-center justify-between bg-white rounded-2xl p-3.5 shadow-sm"
          >
            <span className="font-body font-semibold text-[13px] text-[#2B1A1F]">Sou cliente mensalista</span>
            <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${mensalista ? "bg-[#6B2737]" : "bg-[#EFE3DE]"}`} style={{ height: 22, width: 40 }}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${mensalista ? "translate-x-4.5" : ""}`} style={{ transform: mensalista ? "translateX(18px)" : "translateX(0)" }} />
            </div>
          </button>

          {mensalista ? (
            <div className="bg-[#EEF3E9] rounded-2xl p-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#5C7A4C] flex items-center justify-center shrink-0">
                <Check size={16} color="white" strokeWidth={3} />
              </div>
              <div>
                <p className="font-body font-bold text-[13px] text-[#3F5233]">Recorrência em dia</p>
                <p className="font-body text-[11.5px] text-[#5C7A4C]">Nenhum sinal necessário para agendar</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-1 flex shadow-sm">
                <button
                  onClick={() => setPaymentMode("sinal")}
                  className={`flex-1 rounded-xl py-2.5 font-body font-bold text-[12.5px] ${
                    paymentMode === "sinal" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                  }`}
                >
                  Pagar sinal (10%)
                </button>
                <button
                  onClick={() => setPaymentMode("total")}
                  className={`flex-1 rounded-xl py-2.5 font-body font-bold text-[12.5px] ${
                    paymentMode === "total" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                  }`}
                >
                  Pagar valor total
                </button>
              </div>

              {paymentMode === "total" && (
                <div className="flex items-center gap-2 bg-[#FDF6E3] rounded-xl px-3 py-2">
                  <Sparkles size={13} color="#C9A227" />
                  <p className="font-body text-[11.5px] text-[#8A6E1F]">Ganhe cashback em dobro pagando tudo pelo app</p>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between font-body text-[13px] text-[#4A3538] mb-2">
                  <span>Valor a pagar agora</span>
                  <span className="font-bold text-[#6B2737]">{fmt(paymentMode === "sinal" ? sinal : total)}</span>
                </div>
                {paymentMode === "sinal" && (
                  <p className="font-body text-[11px] text-[#8A6F72] mb-3">
                    Restante ({fmt(total - sinal)}) pago no dia do atendimento. Falta sem aviso: sinal não é reembolsado.
                  </p>
                )}
                <div className="flex gap-2">
                  {[
                    { id: "pix", label: "Pix", icon: Smartphone },
                    { id: "credito", label: "Crédito", icon: CreditCard },
                    { id: "debito", label: "Débito", icon: Wallet },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setMethod(id)}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 border-2 ${
                        method === id ? "border-[#6B2737] bg-[#FAF5F1]" : "border-[#EFE3DE]"
                      }`}
                    >
                      <Icon size={16} color={method === id ? "#6B2737" : "#8A6F72"} />
                      <span className={`font-body text-[10.5px] font-semibold ${method === id ? "text-[#6B2737]" : "text-[#8A6F72]"}`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* FOOTER CTA */}
      <div className="mt-auto px-5 pt-5">
        {step === 0 && (
          <PrimaryButton disabled={!canContinueStep0} onClick={() => setStep(1)}>
            Continuar · {fmt(total)}
          </PrimaryButton>
        )}
        {step === 1 && (
          <PrimaryButton disabled={!canContinueStep1} onClick={() => setStep(2)}>
            Continuar
          </PrimaryButton>
        )}
        {step === 2 && (
          <PrimaryButton onClick={onConfirmed}>
            {mensalista ? "Confirmar agendamento" : `Confirmar e pagar ${fmt(paymentMode === "sinal" ? sinal : total)}`}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: CONFIRMATION
--------------------------------------------------------- */

function ConfirmedScreen({ salon, professional, date, time, onDone }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#FAF5F1] px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-[#5C7A4C] flex items-center justify-center mb-5 animate-[pop_0.4s_ease]">
        <Check size={30} color="white" strokeWidth={3} />
      </div>
      <h1 className="font-display font-semibold text-[21px] text-[#2B1A1F]">Agendamento confirmado!</h1>
      <p className="font-body text-[13px] text-[#8A6F72] mt-1.5">
        Você vai receber um lembrete antes do horário
      </p>

      <div className="bg-white rounded-2xl p-4 mt-6 w-full shadow-sm text-left">
        <div className="flex items-center gap-2.5">
          <Avatar initials={initialsOf(professional.name)} color={AVATAR_COLORS[0]} size={38} />
          <div>
            <p className="font-body font-bold text-[13.5px] text-[#2B1A1F]">{professional.name}</p>
            <p className="font-body text-[11.5px] text-[#8A6F72]">{salon?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#EFE3DE] text-[#4A3538]">
          <Calendar size={13} />
          <span className="font-body text-[12.5px] font-semibold">{date}, {time}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[#C9A227]">
          <Clock size={13} />
          <span className="font-body text-[11.5px] font-semibold">Chegue 10 minutos antes do horário</span>
        </div>
      </div>

      <div className="w-full mt-6">
        <PrimaryButton onClick={onDone}>Voltar ao início</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */

export default function AppBelezaPrototype() {
  const [session, setSession] = useState(undefined); // undefined = checando, null = deslogado, objeto = logado
  const [userType, setUserType] = useState("client"); // client | owner
  const [screen, setScreen] = useState("search");
  const [salon, setSalon] = useState(null);
  const [professional, setProfessional] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const reset = () => {
    setScreen("search");
    setSalon(null);
    setProfessional(null);
    setSelectedServices([]);
    setDate(null);
    setTime(null);
    setStep(0);
  };

  const toggleService = (id) =>
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Só pede login na hora de escolher a profissional (início do agendamento de verdade)
  const handleSelectProfessional = (p) => {
    setProfessional(p);
    setScreen(session ? "booking" : "auth");
  };

  return (
    <div className="w-full min-h-screen bg-[#FAF5F1]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');
        .font-display{font-family:'Fraunces',serif;}
        .font-body{font-family:'Manrope',sans-serif;}
        .no-scrollbar::-webkit-scrollbar{display:none;}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}
        @keyframes pop{0%{transform:scale(0.6);opacity:0;}100%{transform:scale(1);opacity:1;}}
      `}</style>

      <div className="w-full min-h-screen flex flex-col relative">

        {/* NAVBAR — presente em todas as telas */}
        <div className="w-full border-b border-[#EFE3DE] bg-white/80 backdrop-blur sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
            <span className="font-display font-semibold text-[19px] text-[#6B2737] shrink-0">TBMark</span>

            <div className="flex items-center gap-1 bg-[#FAF5F1] p-1 rounded-full shrink-0">
              <button
                onClick={() => {
                  setUserType("client");
                  setScreen("search");
                }}
                className={`rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] transition-colors ${
                  userType === "client" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                }`}
              >
                Sou cliente
              </button>
              <button
                onClick={() => {
                  setUserType("owner");
                  setScreen("search");
                }}
                className={`rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] transition-colors ${
                  userType === "owner" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                }`}
              >
                Dona do comércio
              </button>
            </div>

            <button
              onClick={() => (session ? supabase.auth.signOut() : setScreen("auth"))}
              className="flex items-center gap-1.5 font-body font-semibold text-[12.5px] text-[#6B2737] shrink-0"
            >
              <User size={15} />
              {session ? "Sair" : "Entrar"}
            </button>
          </div>
        </div>

        {screen === "search" && userType === "owner" && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-2">
            <p className="font-display font-semibold text-[17px] text-[#2B1A1F]">Portal da dona do salão</p>
            <p className="font-body text-[13px] text-[#8A6F72]">
              Essa área (cadastro do salão, agenda, financeiro) ainda está sendo construída. Em breve por aqui!
            </p>
          </div>
        )}

        {screen === "search" && userType === "client" && (
          <div className="flex-1 flex flex-col pt-2 overflow-hidden">
            <SearchScreen
              onOpenSalon={(s) => {
                setSalon(s);
                setScreen("salon");
              }}
            />
          </div>
        )}

        {screen === "salon" && salon && (
          <div className="flex-1 flex flex-col pt-6 overflow-hidden w-full max-w-xl mx-auto sm:border-x sm:border-[#EFE3DE]">
            <SalonScreen
              salon={salon}
              onBack={() => setScreen("search")}
              onSelectProfessional={handleSelectProfessional}
            />
          </div>
        )}

        {screen === "auth" && (
          <div className="flex-1 flex flex-col overflow-hidden w-full max-w-xl mx-auto sm:border-x sm:border-[#EFE3DE]">
            <TopHeader title="Entre para continuar" onBack={() => setScreen("salon")} />
            <AuthScreen onAuthenticated={() => setScreen("booking")} />
          </div>
        )}

        {screen === "booking" && professional && session && (
          <div className="flex-1 flex flex-col pt-6 overflow-hidden w-full max-w-xl mx-auto sm:border-x sm:border-[#EFE3DE]">
            <BookingScreen
              professional={professional}
              onBack={() => setScreen("salon")}
              onConfirmed={() => setScreen("confirmed")}
              selectedServices={selectedServices}
              toggleService={toggleService}
              date={date}
              setDate={setDate}
              time={time}
              setTime={setTime}
              step={step}
              setStep={setStep}
            />
          </div>
        )}

        {screen === "confirmed" && professional && (
          <div className="flex-1 flex flex-col overflow-hidden w-full max-w-xl mx-auto sm:border-x sm:border-[#EFE3DE]">
            <ConfirmedScreen salon={salon} professional={professional} date={date} time={time} onDone={reset} />
          </div>
        )}

      </div>
    </div>
  );
}
