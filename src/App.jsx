import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, MapPin, Star, ChevronLeft, Check, Clock,
  Home, Heart, User, Calendar, CreditCard, Sparkles,
  ChevronRight, Wallet, Smartphone, Loader2, Eye, EyeOff
} from "lucide-react";
import { supabase } from "./lib/supabase";

/* ---------------------------------------------------------
   Disponibilidade real: horário de funcionamento padrão
   (09:00–18:00, intervalos de 30 min) — configuração por
   profissional fica pra uma próxima etapa
--------------------------------------------------------- */

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 30;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getNextDays(count) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d,
      isoDate: d.toISOString().slice(0, 10),
      label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : WEEKDAY_LABELS[d.getDay()],
      sub: `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`,
    });
  }
  return days;
}

function generateTimeSlots({ isoDate, busySlots, durationMinutes }) {
  const slots = [];
  const now = new Date();
  const dayStart = new Date(`${isoDate}T00:00:00`);
  const isToday = dayStart.toDateString() === now.toDateString();

  for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL_MINUTES) {
      const slotStart = new Date(`${isoDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      if (slotEnd.getHours() > BUSINESS_END_HOUR || (slotEnd.getHours() === BUSINESS_END_HOUR && slotEnd.getMinutes() > 0)) continue;
      if (isToday && slotStart <= now) continue;

      const overlaps = busySlots.some((b) => {
        const busyStart = new Date(b.start_time);
        const busyEnd = new Date(b.end_time);
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      if (overlaps) continue;

      slots.push({
        label: slotStart.toTimeString().slice(0, 5),
        iso: slotStart.toISOString(),
      });
    }
  }
  return slots;
}

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

function AuthScreen({ userType, onAuthenticated }) {
  const [mode, setMode] = useState("login"); // login | signup | check-email
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone, birth_date: birthDate, role: userType || "client" } },
    });

    if (error) {
      let friendlyMsg = "Não foi possível cadastrar agora. Tente novamente.";
      if (error.message === "User already registered") friendlyMsg = "Esse email já está cadastrado.";
      else if (error.message?.includes("não foi liberado")) friendlyMsg = "Esse email ainda não foi liberado pra usar o TBMark. Fale com quem te convidou.";
      setErrorMsg(friendlyMsg);
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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white rounded-2xl px-4 py-3 pr-11 font-body text-[14px] text-[#2B1A1F] outline-none shadow-sm placeholder:text-[#B49A96]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B49A96]"
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

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
  salonId, professional, onBack, onConfirmed,
  selectedServices, toggleService,
  date, setDate, time, setTime,
  step, setStep,
}) {
  const [mensalista, setMensalista] = useState(false);
  const [paymentMode, setPaymentMode] = useState("sinal"); // sinal | total
  const [method, setMethod] = useState("pix");
  const [servicesForProf, setServicesForProf] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [pixData, setPixData] = useState(null); // { qr_code, qr_code_base64 }
  const [cardBrickReady, setCardBrickReady] = useState(false);
  const cardBrickRef = useRef(null);

  const [availableDays] = useState(() => getNextDays(6));
  const [selectedDay, setSelectedDay] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [scheduledAtIso, setScheduledAtIso] = useState(null);

  useEffect(() => {
    if (!selectedDay || selectedServices.length === 0) return;
    let active = true;
    async function loadSlots() {
      setLoadingSlots(true);
      const { data: busySlots } = await supabase.rpc("get_busy_slots", {
        p_professional_id: professional.id,
        p_date: selectedDay.isoDate,
      });
      if (!active) return;
      const totalDuration = selectedServices.reduce((sum, id) => {
        const service = servicesForProf.find((s) => s.id === id);
        return sum + (service?.duration_minutes || 30);
      }, 0);
      setTimeSlots(generateTimeSlots({ isoDate: selectedDay.isoDate, busySlots: busySlots || [], durationMinutes: totalDuration || 30 }));
      setLoadingSlots(false);
    }
    loadSlots();
    return () => {
      active = false;
    };
  }, [selectedDay, professional.id, selectedServices, servicesForProf]);

  const mpRef = useRef(null);

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

  const chargeAmount = mensalista ? 0 : paymentMode === "sinal" ? sinal : total;

  // Inicializa o Mercado Pago (Public Key) uma vez
  useEffect(() => {
    if (window.MercadoPago && !mpRef.current) {
      mpRef.current = new window.MercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY, { locale: "pt-BR" });
    }
  }, []);

  // Carrega o Card Payment Brick quando o método for cartão
  useEffect(() => {
    if (step !== 2 || mensalista) return;
    if (method !== "credito" && method !== "debito") return;
    if (!mpRef.current || !document.getElementById("card-brick-container")) return;

    let brickController;
    setCardBrickReady(false);

    mpRef.current
      .bricks()
      .create("cardPayment", "card-brick-container", {
        initialization: { amount: chargeAmount },
        customization: { visual: { style: { theme: "bootstrap" } } },
        callbacks: {
          onReady: () => setCardBrickReady(true),
          onSubmit: (cardFormData) => {
            return processPayment({
              method: method === "credito" ? "credit_card" : "debit_card",
              card_token: cardFormData.token,
              installments: cardFormData.installments,
              payer_email: cardFormData.payer?.email,
              payer_cpf: cardFormData.payer?.identification?.number,
            });
          },
          onError: (err) => setPaymentError(String(err?.message || err)),
        },
      })
      .then((controller) => {
        brickController = controller;
        cardBrickRef.current = controller;
      });

    return () => {
      brickController?.unmount?.();
    };
  }, [step, method, mensalista, chargeAmount]);

  async function processPayment({ method: payMethod, card_token, installments, payer_email, payer_cpf, isSubscriber }) {
    setProcessing(true);
    setPaymentError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          salon_id: salonId,
          professional_id: professional.id,
          service_ids: selectedServices,
          scheduled_at: scheduledAtIso,
          pay_full: paymentMode === "total",
          is_subscriber_booking: !!isSubscriber,
          method: isSubscriber ? undefined : payMethod,
          card_token,
          installments,
          payer_email,
          payer_cpf,
        },
      });

      if (error || data?.error) {
        setPaymentError(data?.error || error?.message || "Não foi possível processar o pagamento.");
        setProcessing(false);
        return;
      }

      if (!isSubscriber && payMethod === "pix" && data.qr_code) {
        setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, appointmentId: data.appointment_id });
        setProcessing(false);
        return;
      }

      setProcessing(false);
      onConfirmed();
    } catch (err) {
      setPaymentError(String(err));
      setProcessing(false);
    }
  }

  // Enquanto o QR code do Pix estiver na tela, verifica automaticamente
  // a cada 4 segundos se o pagamento já foi confirmado (via webhook)
  useEffect(() => {
    if (!pixData?.appointmentId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("appointment_id", pixData.appointmentId)
        .maybeSingle();
      if (data?.status === "paid") {
        clearInterval(interval);
        onConfirmed();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [pixData?.appointmentId]);

  async function handleConfirm() {
    if (mensalista) {
      // O servidor confere de verdade se a mensalidade está ativa —
      // se não estiver, ele recusa e mostra o erro na tela.
      processPayment({ isSubscriber: true });
      return;
    }
    if (method === "pix") {
      processPayment({ method: "pix" });
    }
  }

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
              {availableDays.map((d) => (
                <button
                  key={d.isoDate}
                  onClick={() => {
                    setSelectedDay(d);
                    setDate(d.label);
                    setTime(null);
                    setScheduledAtIso(null);
                  }}
                  className={`shrink-0 flex flex-col items-center rounded-2xl px-4 py-2.5 ${
                    selectedDay?.isoDate === d.isoDate ? "bg-[#6B2737] text-white" : "bg-white text-[#2B1A1F]"
                  }`}
                >
                  <span className="font-body font-bold text-[13px]">{d.label}</span>
                  <span className={`font-body text-[10.5px] ${selectedDay?.isoDate === d.isoDate ? "text-white/70" : "text-[#8A6F72]"}`}>
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

            {loadingSlots && (
              <div className="flex items-center gap-2 text-[#8A6F72] py-4">
                <Loader2 size={16} className="animate-spin" />
                <span className="font-body text-[13px]">Verificando horários...</span>
              </div>
            )}

            {!loadingSlots && timeSlots.length === 0 && (
              <p className="font-body text-[13px] text-[#8A6F72] py-2">
                Nenhum horário disponível nesse dia. Tente outra data.
              </p>
            )}

            {!loadingSlots && timeSlots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((t) => (
                  <button
                    key={t.iso}
                    onClick={() => {
                      setTime(t.label);
                      setScheduledAtIso(t.iso);
                    }}
                    className={`rounded-xl py-2.5 font-body font-semibold text-[13px] ${
                      time === t.label ? "bg-[#6B2737] text-white" : "bg-white text-[#2B1A1F]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
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
                      onClick={() => {
                        setMethod(id);
                        setPixData(null);
                        setPaymentError(null);
                      }}
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

              {(method === "credito" || method === "debito") && (
                <div className="bg-white rounded-2xl p-3 shadow-sm">
                  {!cardBrickReady && (
                    <div className="flex items-center justify-center gap-2 py-6 text-[#8A6F72]">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="font-body text-[13px]">Carregando formulário seguro...</span>
                    </div>
                  )}
                  <div id="card-brick-container" />
                </div>
              )}

              {method === "pix" && pixData && (
                <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  {pixData.qr_code_base64 && (
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="w-48 h-48 mx-auto"
                    />
                  )}
                  <p className="font-body text-[11.5px] text-[#8A6F72] mt-2">
                    Escaneie o QR Code ou copie o código abaixo no app do seu banco
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(pixData.qr_code)}
                    className="mt-2 font-body font-semibold text-[12px] text-[#6B2737] underline"
                  >
                    Copiar código Pix
                  </button>
                </div>
              )}

              {paymentError && (
                <p className="font-body text-[12px] text-[#B23A3A] bg-[#FBEAEA] rounded-xl px-3 py-2">{paymentError}</p>
              )}
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
        {step === 2 && !pixData && method !== "credito" && method !== "debito" && (
          <PrimaryButton disabled={processing} onClick={handleConfirm}>
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Processando...
              </span>
            ) : mensalista ? (
              "Confirmar agendamento"
            ) : (
              `Confirmar e pagar ${fmt(chargeAmount)}`
            )}
          </PrimaryButton>
        )}
        {step === 2 && pixData && (
          <div className="flex items-center justify-center gap-2 py-3 text-[#8A6F72]">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-body text-[13px]">Aguardando confirmação do pagamento...</span>
          </div>
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
   SCREEN: OWNER — cadastro do salão / status / painel
--------------------------------------------------------- */

function FileDropInput({ label, multiple, onFiles, files }) {
  return (
    <div>
      <label className="font-body text-[12px] font-semibold text-[#2B1A1F] block mb-1.5">{label}</label>
      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#EFE3DE] rounded-2xl py-6 cursor-pointer bg-white">
        <span className="font-body text-[12.5px] text-[#8A6F72]">
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Toque para escolher"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => onFiles(Array.from(e.target.files || []))}
        />
      </label>
    </div>
  );
}

function OwnerRegistrationForm({ userId, onSubmitted }) {
  const [name, setName] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [address, setAddress] = useState("");
  const [documentType, setDocumentType] = useState("cpf");
  const [documentNumber, setDocumentNumber] = useState("");
  const [photos, setPhotos] = useState([]);
  const [logo, setLogo] = useState([]);
  const [documentFile, setDocumentFile] = useState([]);
  const [financialPin, setFinancialPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);

    if (photos.length === 0) {
      setErrorMsg("Envie ao menos uma foto real do local.");
      return;
    }
    if (documentFile.length === 0) {
      setErrorMsg("Envie uma foto ou digitalização do documento.");
      return;
    }
    if (!/^\d{4}$/.test(financialPin)) {
      setErrorMsg("A senha financeira precisa ter exatamente 4 números.");
      return;
    }

    setLoading(true);

    // 1. Cria o salão como pendente
    const { data: salonRow, error: salonError } = await supabase
      .from("salons")
      .insert({
        owner_id: userId,
        name,
        address,
        owner_full_name: ownerFullName,
        document_type: documentType,
        document_number: documentNumber,
        verification_status: "pending",
        financial_pin: financialPin,
      })
      .select()
      .single();

    if (salonError) {
      setErrorMsg(salonError.message);
      setLoading(false);
      return;
    }

    // 2. Sobe a logo (opcional, público)
    if (logo.length > 0) {
      const logoFile = logo[0];
      const logoPath = `${salonRow.id}/logo-${Date.now()}-${logoFile.name}`;
      const { error: logoUploadError } = await supabase.storage.from("salon-photos").upload(logoPath, logoFile);
      if (!logoUploadError) {
        const { data: pub } = supabase.storage.from("salon-photos").getPublicUrl(logoPath);
        await supabase.from("salons").update({ logo_url: pub.publicUrl }).eq("id", salonRow.id);
      }
    }

    // 3. Sobe as fotos reais (público)
    for (const file of photos) {
      const path = `${salonRow.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("salon-photos").upload(path, file);
      if (!uploadError) {
        const { data: pub } = supabase.storage.from("salon-photos").getPublicUrl(path);
        await supabase.from("salon_photos").insert({ salon_id: salonRow.id, photo_url: pub.publicUrl });
      }
    }

    // 4. Sobe o documento (privado)
    const docFile = documentFile[0];
    const docPath = `${salonRow.id}/${Date.now()}-${docFile.name}`;
    const { error: docUploadError } = await supabase.storage.from("salon-documents").upload(docPath, docFile);
    if (!docUploadError) {
      await supabase.from("salon_documents").insert({ salon_id: salonRow.id, document_url: docPath });
    }

    setLoading(false);
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-3.5">
      <div>
        <h1 className="font-display font-semibold text-[22px] text-[#2B1A1F]">Cadastre seu salão</h1>
        <p className="font-body text-[13px] text-[#8A6F72] mt-1">
          Para a segurança de todo mundo, revisamos manualmente cada cadastro antes de publicar. Isso pode levar
          um tempo — enquanto isso, seu salão não aparece na busca.
        </p>
      </div>

      <input
        required
        placeholder="Nome do estúdio/salão"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] outline-none shadow-sm placeholder:text-[#B49A96]"
      />
      <input
        required
        placeholder="Seu nome completo (responsável)"
        value={ownerFullName}
        onChange={(e) => setOwnerFullName(e.target.value)}
        className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] outline-none shadow-sm placeholder:text-[#B49A96]"
      />
      <input
        required
        placeholder="Endereço completo do local"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] outline-none shadow-sm placeholder:text-[#B49A96]"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDocumentType("cpf")}
          className={`flex-1 rounded-2xl py-2.5 font-body font-semibold text-[13px] ${
            documentType === "cpf" ? "bg-[#6B2737] text-white" : "bg-white text-[#8A6F72] shadow-sm"
          }`}
        >
          Pessoa física (CPF)
        </button>
        <button
          type="button"
          onClick={() => setDocumentType("cnpj")}
          className={`flex-1 rounded-2xl py-2.5 font-body font-semibold text-[13px] ${
            documentType === "cnpj" ? "bg-[#6B2737] text-white" : "bg-white text-[#8A6F72] shadow-sm"
          }`}
        >
          Pessoa jurídica (CNPJ)
        </button>
      </div>

      <input
        required
        placeholder={documentType === "cpf" ? "Número do CPF" : "Número do CNPJ"}
        value={documentNumber}
        onChange={(e) => setDocumentNumber(e.target.value)}
        className="bg-white rounded-2xl px-4 py-3 font-body text-[14px] outline-none shadow-sm placeholder:text-[#B49A96]"
      />

      <FileDropInput
        label="Logomarca do seu negócio (opcional)"
        multiple={false}
        files={logo}
        onFiles={setLogo}
      />

      <FileDropInput
        label={`Foto ou digitalização do ${documentType === "cpf" ? "CPF" : "CNPJ"} (só o admin vê)`}
        multiple={false}
        files={documentFile}
        onFiles={setDocumentFile}
      />

      <FileDropInput
        label="Fotos reais do local (públicas, aparecem na busca)"
        multiple={true}
        files={photos}
        onFiles={setPhotos}
      />

      <div>
        <label className="font-body text-[12px] font-semibold text-[#2B1A1F] block mb-1.5">
          Crie uma senha de 4 números pra proteger os valores financeiros
        </label>
        <input
          required
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          value={financialPin}
          onChange={(e) => setFinancialPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="w-full bg-white rounded-2xl px-4 py-3 font-body text-[16px] tracking-[6px] text-center outline-none shadow-sm placeholder:text-[#B49A96]"
        />
        <p className="font-body text-[11px] text-[#8A6F72] mt-1">
          Você vai usar essa senha pra revelar valores financeiros na sua área — assim, se alguém entrar
          com seu login, não vê o dinheiro sem essa senha.
        </p>
      </div>

      {errorMsg && (
        <p className="font-body text-[12px] text-[#B23A3A] bg-[#FBEAEA] rounded-xl px-3 py-2">{errorMsg}</p>
      )}

      <div className="mt-2">
        <PrimaryButton disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Enviando...
            </span>
          ) : (
            "Enviar para análise"
          )}
        </PrimaryButton>
      </div>
    </form>
  );
}

function OwnerStatusScreen({ salon }) {
  const [financesUnlocked, setFinancesUnlocked] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(null);

  function handleUnlock(e) {
    e.preventDefault();
    if (pinInput === salon.financial_pin) {
      setFinancesUnlocked(true);
      setShowPinPrompt(false);
      setPinInput("");
      setPinError(null);
    } else {
      setPinError("Senha incorreta.");
    }
  }

  const statusInfo = {
    pending: {
      color: "#C9A227",
      bg: "#FDF6E3",
      title: "Cadastro em análise",
      text: "Estamos revisando os documentos e fotos do seu salão. Assim que aprovado, ele aparece na busca automaticamente.",
    },
    approved: {
      color: "#5C7A4C",
      bg: "#EEF3E9",
      title: "Salão aprovado!",
      text: "Seu salão já está visível na busca. A área completa de agenda, equipe e financeiro ainda está sendo construída.",
    },
    rejected: {
      color: "#B23A3A",
      bg: "#FBEAEA",
      title: "Cadastro não aprovado",
      text: salon.rejection_reason || "Não foi possível aprovar seu cadastro. Entre em contato para mais detalhes.",
    },
  };
  const info = statusInfo[salon.verification_status] || statusInfo.pending;

  return (
    <div className="max-w-xl mx-auto px-6 py-10 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: info.bg }}
      >
        <Clock size={24} color={info.color} />
      </div>
      <h1 className="font-display font-semibold text-[20px] text-[#2B1A1F]">{info.title}</h1>
      <p className="font-body text-[13.5px] text-[#8A6F72] mt-2">{info.text}</p>
      <div className="bg-white rounded-2xl p-4 mt-6 text-left shadow-sm">
        <p className="font-body font-bold text-[14px] text-[#2B1A1F]">{salon.name}</p>
        <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">{salon.address}</p>
      </div>

      <div className="mt-10 text-left">
        <div className="flex items-center justify-between mb-2">
          <p className="font-body font-semibold text-[12.5px] text-[#8A6F72]">Valores financeiros</p>
          <button
            onClick={() => (financesUnlocked ? setFinancesUnlocked(false) : setShowPinPrompt(true))}
            className="flex items-center gap-1.5 font-body font-semibold text-[12px] text-[#6B2737]"
          >
            {financesUnlocked ? <EyeOff size={15} /> : <Eye size={15} />}
            {financesUnlocked ? "Esconder valores" : "Ver valores"}
          </button>
        </div>

        {showPinPrompt && (
          <form onSubmit={handleUnlock} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-2.5 mb-4">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Senha de 4 números"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                setPinError(null);
              }}
              className="flex-1 bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[14px] tracking-[4px] text-center outline-none placeholder:text-[#B49A96] placeholder:tracking-normal"
            />
            <button className="bg-[#6B2737] text-white rounded-xl px-4 py-2.5 font-body font-semibold text-[12.5px]">
              Ver
            </button>
          </form>
        )}
        {pinError && (
          <p className="font-body text-[11.5px] text-[#B23A3A] bg-[#FBEAEA] rounded-lg px-3 py-1.5 mb-4">{pinError}</p>
        )}

        <SalonAgenda salonId={salon.id} financesUnlocked={financesUnlocked} />
        <div className="mt-10">
          <ServicesManager salonId={salon.id} />
        </div>
        <EmployeesManager salonId={salon.id} />
        <BalanceAndWithdrawal salonId={salon.id} financesUnlocked={financesUnlocked} />
      </div>
    </div>
  );
}

function ServicesManager({ salonId }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function fetchServices() {
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, active")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchServices();
  }, [salonId]);

  function resetForm() {
    setName("");
    setPrice("");
    setDuration("30");
    setEditingId(null);
    setShowForm(false);
    setErrorMsg(null);
  }

  function startEdit(s) {
    setEditingId(s.id);
    setName(s.name);
    setPrice(String(s.price));
    setDuration(String(s.duration_minutes));
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);
    const priceNum = parseFloat(price.replace(",", "."));
    const durationNum = parseInt(duration, 10);

    if (!name.trim() || isNaN(priceNum) || priceNum <= 0 || isNaN(durationNum) || durationNum <= 0) {
      setErrorMsg("Preencha nome, valor e duração corretamente.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("services")
        .update({ name: name.trim(), price: priceNum, duration_minutes: durationNum })
        .eq("id", editingId);
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase
        .from("services")
        .insert({ salon_id: salonId, name: name.trim(), price: priceNum, duration_minutes: durationNum });
      if (error) setErrorMsg(error.message);
    }

    setSaving(false);
    if (!errorMsg) {
      resetForm();
      fetchServices();
    }
  }

  async function toggleActive(s) {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    fetchServices();
  }

  async function removeService(id) {
    if (!window.confirm("Remover este serviço?")) return;
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-[17px] text-[#2B1A1F]">Serviços</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#6B2737] text-white rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px]"
          >
            + Novo serviço
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 mb-4">
          <input
            required
            placeholder="Nome do serviço (ex: Escova Modelada)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
          />
          <div className="flex gap-2.5">
            <input
              required
              placeholder="Valor (R$)"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1 bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
            />
            <input
              required
              placeholder="Duração (min)"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="flex-1 bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
            />
          </div>
          {errorMsg && (
            <p className="font-body text-[11.5px] text-[#B23A3A] bg-[#FBEAEA] rounded-lg px-3 py-1.5">{errorMsg}</p>
          )}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-[#FAF5F1] text-[#8A6F72] rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              className="flex-1 bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar"}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando...</span>
        </div>
      )}

      {!loading && services.length === 0 && !showForm && (
        <p className="font-body text-[13px] text-[#8A6F72]">Nenhum serviço cadastrado ainda.</p>
      )}

      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <div key={s.id} className={`bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 ${!s.active ? "opacity-50" : ""}`}>
            <div className="flex-1 min-w-0">
              <p className="font-body font-bold text-[13.5px] text-[#2B1A1F] truncate">{s.name}</p>
              <p className="font-body text-[12px] text-[#8A6F72]">
                {fmt(s.price)} · {s.duration_minutes} min {!s.active && "· Inativo"}
              </p>
            </div>
            <button onClick={() => startEdit(s)} className="font-body font-semibold text-[11.5px] text-[#6B2737] shrink-0">
              Editar
            </button>
            <button onClick={() => toggleActive(s)} className="font-body font-semibold text-[11.5px] text-[#8A6F72] shrink-0">
              {s.active ? "Desativar" : "Ativar"}
            </button>
            <button onClick={() => removeService(s.id)} className="font-body font-semibold text-[11.5px] text-[#B23A3A] shrink-0">
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeesManager({ salonId }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [commissionType, setCommissionType] = useState("percentage"); // percentage | fixed
  const [commissionValue, setCommissionValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function fetchEmployees() {
    setLoading(true);
    const { data } = await supabase
      .from("professionals")
      .select("id, name, email, role, commission_type, commission_value, active, user_id")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false });
    setEmployees(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEmployees();
  }, [salonId]);

  function resetForm() {
    setName("");
    setEmail("");
    setRole("");
    setCommissionType("percentage");
    setCommissionValue("");
    setEditingId(null);
    setShowForm(false);
    setErrorMsg(null);
  }

  function startEdit(e) {
    setEditingId(e.id);
    setName(e.name);
    setEmail(e.email || "");
    setRole(e.role || "");
    setCommissionType(e.commission_type);
    setCommissionValue(String(e.commission_value));
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);
    const valueNum = parseFloat(commissionValue.replace(",", "."));

    if (!name.trim() || !email.trim() || isNaN(valueNum) || valueNum <= 0) {
      setErrorMsg("Preencha nome, email e a comissão corretamente.");
      return;
    }
    if (commissionType === "percentage" && valueNum > 100) {
      setErrorMsg("A porcentagem não pode passar de 100%.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("professionals")
        .update({ name: name.trim(), email: email.trim(), role: role.trim(), commission_type: commissionType, commission_value: valueNum })
        .eq("id", editingId);
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.from("professionals").insert({
        salon_id: salonId,
        name: name.trim(),
        email: email.trim(),
        role: role.trim(),
        commission_type: commissionType,
        commission_value: valueNum,
      });
      if (error) setErrorMsg(error.message);
    }

    setSaving(false);
    if (!errorMsg) {
      resetForm();
      fetchEmployees();
    }
  }

  async function toggleActive(e) {
    await supabase.from("professionals").update({ active: !e.active }).eq("id", e.id);
    fetchEmployees();
  }

  async function removeEmployee(id) {
    if (!window.confirm("Remover esta funcionária?")) return;
    await supabase.from("professionals").delete().eq("id", id);
    fetchEmployees();
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-[17px] text-[#2B1A1F]">Funcionárias</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#6B2737] text-white rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px]"
          >
            + Nova funcionária
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 mb-4">
          <input
            required
            placeholder="Nome da funcionária"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
          />
          <input
            required
            type="email"
            placeholder="Email dela (usado pra ela entrar no site)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
          />
          <input
            placeholder="Especialidade (ex: Cabelo, Unhas)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCommissionType("percentage")}
              className={`flex-1 rounded-xl py-2.5 font-body font-semibold text-[12.5px] ${
                commissionType === "percentage" ? "bg-[#6B2737] text-white" : "bg-[#FAF5F1] text-[#8A6F72]"
              }`}
            >
              % do serviço
            </button>
            <button
              type="button"
              onClick={() => setCommissionType("fixed")}
              className={`flex-1 rounded-xl py-2.5 font-body font-semibold text-[12.5px] ${
                commissionType === "fixed" ? "bg-[#6B2737] text-white" : "bg-[#FAF5F1] text-[#8A6F72]"
              }`}
            >
              Valor fixo (R$)
            </button>
          </div>

          <input
            required
            placeholder={commissionType === "percentage" ? "Ex: 40 (para 40%)" : "Ex: 50,00 por serviço"}
            inputMode="decimal"
            value={commissionValue}
            onChange={(e) => setCommissionValue(e.target.value)}
            className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
          />

          {errorMsg && (
            <p className="font-body text-[11.5px] text-[#B23A3A] bg-[#FBEAEA] rounded-lg px-3 py-1.5">{errorMsg}</p>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-[#FAF5F1] text-[#8A6F72] rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              className="flex-1 bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar"}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando...</span>
        </div>
      )}

      {!loading && employees.length === 0 && !showForm && (
        <p className="font-body text-[13px] text-[#8A6F72]">Nenhuma funcionária cadastrada ainda.</p>
      )}

      <div className="flex flex-col gap-2">
        {employees.map((e) => (
          <div key={e.id} className={`bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 ${!e.active ? "opacity-50" : ""}`}>
            <Avatar initials={initialsOf(e.name)} color={AVATAR_COLORS[0]} size={36} />
            <div className="flex-1 min-w-0">
              <p className="font-body font-bold text-[13.5px] text-[#2B1A1F] truncate">{e.name}</p>
              <p className="font-body text-[12px] text-[#8A6F72]">
                {e.role && `${e.role} · `}
                {e.commission_type === "percentage" ? `${e.commission_value}% por serviço` : `${fmt(e.commission_value)} fixo`}
                {!e.active && " · Inativa"}
              </p>
              <p className="font-body text-[11px] mt-0.5" style={{ color: e.user_id ? "#5C7A4C" : "#C9A227" }}>
                {e.user_id ? "Já acessou o próprio login" : "Ainda não fez login"}
              </p>
            </div>
            <button onClick={() => startEdit(e)} className="font-body font-semibold text-[11.5px] text-[#6B2737] shrink-0">
              Editar
            </button>
            <button onClick={() => toggleActive(e)} className="font-body font-semibold text-[11.5px] text-[#8A6F72] shrink-0">
              {e.active ? "Desativar" : "Ativar"}
            </button>
            <button onClick={() => removeEmployee(e.id)} className="font-body font-semibold text-[11.5px] text-[#B23A3A] shrink-0">
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalonAgenda({ salonId, financesUnlocked }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming"); // upcoming | past | all

  async function fetchAppointments() {
    setLoading(true);
    let query = supabase
      .from("appointments")
      .select("id, scheduled_at, status, total_amount, deposit_paid, full_payment, is_subscriber_booking, clients(name, phone), professionals(name), services(name)")
      .eq("salon_id", salonId)
      .order("scheduled_at", { ascending: filter !== "past" });

    if (filter === "upcoming") query = query.gte("scheduled_at", new Date().toISOString());
    if (filter === "past") query = query.lt("scheduled_at", new Date().toISOString());

    const { data } = await query;
    setAppointments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAppointments();
  }, [salonId, filter]);

  const statusLabel = {
    confirmed: { text: "Confirmado", color: "#5C7A4C", bg: "#EEF3E9" },
    completed: { text: "Concluído", color: "#6B2737", bg: "#FAF5F1" },
    no_show: { text: "Faltou", color: "#B23A3A", bg: "#FBEAEA" },
    cancelled: { text: "Cancelado", color: "#8A6F72", bg: "#EFE3DE" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-[17px] text-[#2B1A1F]">Agenda</h2>
        <div className="flex items-center gap-1 bg-[#FAF5F1] p-1 rounded-full">
          {[
            { id: "upcoming", label: "Próximos" },
            { id: "past", label: "Passados" },
            { id: "all", label: "Todos" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 font-body font-semibold text-[11.5px] transition-colors ${
                filter === f.id ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-6">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando agenda...</span>
        </div>
      )}

      {!loading && appointments.length === 0 && (
        <p className="font-body text-[13px] text-[#8A6F72]">Nenhum agendamento nesse período.</p>
      )}

      <div className="flex flex-col gap-2.5">
        {appointments.map((a) => {
          const dateObj = new Date(a.scheduled_at);
          const s = statusLabel[a.status] || statusLabel.confirmed;
          return (
            <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body font-bold text-[14px] text-[#2B1A1F] truncate">{a.clients?.name}</p>
                  {a.clients?.phone && (
                    <p className="font-body text-[11.5px] text-[#8A6F72]">{a.clients.phone}</p>
                  )}
                </div>
                <span
                  className="font-body font-semibold text-[10.5px] px-2 py-1 rounded-full shrink-0"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.text}
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-[#EFE3DE] flex items-center justify-between">
                <div>
                  <p className="font-body text-[12.5px] text-[#2B1A1F] font-semibold">
                    {dateObj.toLocaleDateString("pt-BR")} às {dateObj.toTimeString().slice(0, 5)}
                  </p>
                  <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">
                    {a.services?.name} · com {a.professionals?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-body font-bold text-[13px] text-[#6B2737]">{financesUnlocked ? fmt(a.total_amount) : "R$ ••••"}</p>
                  <p className="font-body text-[10.5px] text-[#8A6F72]">
                    {a.is_subscriber_booking ? "Mensalista" : a.full_payment ? "Pago total" : a.deposit_paid ? "Sinal pago" : "Aguardando sinal"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BalanceAndWithdrawal({ salonId, financesUnlocked }) {
  const [balance, setBalance] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPixForm, setShowPixForm] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [holderName, setHolderName] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function fetchAll() {
    setLoading(true);
    const [salonRes, accountsRes, withdrawalsRes] = await Promise.all([
      supabase.from("salons").select("balance").eq("id", salonId).single(),
      supabase.from("salon_bank_accounts").select("*").eq("salon_id", salonId).order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").eq("salon_id", salonId).order("created_at", { ascending: false }),
    ]);
    setBalance(salonRes.data?.balance || 0);
    setAccounts(accountsRes.data || []);
    setWithdrawals(withdrawalsRes.data || []);
    if (accountsRes.data?.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountsRes.data[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, [salonId]);

  async function handleAddPix(e) {
    e.preventDefault();
    setErrorMsg(null);
    if (!pixKey.trim() || !holderName.trim()) {
      setErrorMsg("Preencha a chave Pix e o nome do titular.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("salon_bank_accounts").insert({
      salon_id: salonId,
      pix_key: pixKey.trim(),
      pix_key_type: pixKeyType,
      account_holder_name: holderName.trim(),
    });
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setPixKey("");
    setHolderName("");
    setShowPixForm(false);
    fetchAll();
  }

  async function handleWithdraw(e) {
    e.preventDefault();
    setErrorMsg(null);
    const amountNum = parseFloat(withdrawAmount.replace(",", "."));

    if (!selectedAccountId) {
      setErrorMsg("Cadastre uma chave Pix primeiro.");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Digite um valor válido.");
      return;
    }
    if (amountNum > balance) {
      setErrorMsg("Valor maior que o saldo disponível.");
      return;
    }

    setSaving(true);
    const platformFee = amountNum * 0.05;
    const netAmount = amountNum - platformFee;

    const { error } = await supabase.from("withdrawal_requests").insert({
      salon_id: salonId,
      bank_account_id: selectedAccountId,
      requested_amount: amountNum,
      platform_fee: platformFee,
      net_amount: netAmount,
    });

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setWithdrawAmount("");
    setShowWithdrawForm(false);
    fetchAll();
  }

  const statusLabel = {
    pending: { text: "Aguardando aprovação", color: "#C9A227" },
    approved: { text: "Aprovado — aguardando transferência", color: "#5C7A4C" },
    paid: { text: "Pago", color: "#5C7A4C" },
    rejected: { text: "Rejeitado", color: "#B23A3A" },
  };

  return (
    <div className="mt-10">
      <h2 className="font-display font-semibold text-[17px] text-[#2B1A1F] mb-3">Financeiro</h2>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <p className="font-body text-[12px] text-[#8A6F72]">Saldo disponível</p>
        <p className="font-display font-semibold text-[28px] text-[#2B1A1F] mt-0.5">{financesUnlocked ? fmt(balance) : "R$ ••••••"}</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando...</span>
        </div>
      )}

      {!loading && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="font-body font-bold text-[13px] text-[#2B1A1F]">Chaves Pix cadastradas</p>
            {!showPixForm && (
              <button
                onClick={() => setShowPixForm(true)}
                className="font-body font-semibold text-[11.5px] text-[#6B2737]"
              >
                + Cadastrar chave
              </button>
            )}
          </div>

          {showPixForm && (
            <form onSubmit={handleAddPix} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 mb-3">
              <div className="grid grid-cols-2 gap-2">
                {["cpf", "cnpj", "email", "telefone", "aleatoria"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPixKeyType(t)}
                    className={`rounded-xl py-2 font-body font-semibold text-[11.5px] capitalize ${
                      pixKeyType === t ? "bg-[#6B2737] text-white" : "bg-[#FAF5F1] text-[#8A6F72]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                required
                placeholder="Chave Pix"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
              />
              <input
                required
                placeholder="Nome completo do titular (igual ao CPF/CNPJ cadastrado)"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
              />
              {errorMsg && (
                <p className="font-body text-[11.5px] text-[#B23A3A] bg-[#FBEAEA] rounded-lg px-3 py-1.5">{errorMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPixForm(false)}
                  className="flex-1 bg-[#FAF5F1] text-[#8A6F72] rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
                >
                  Cancelar
                </button>
                <button disabled={saving} className="flex-1 bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          )}

          {accounts.length === 0 && !showPixForm && (
            <p className="font-body text-[12.5px] text-[#8A6F72] mb-4">Nenhuma chave Pix cadastrada ainda.</p>
          )}

          {accounts.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {accounts.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl p-3.5 shadow-sm">
                  <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{a.account_holder_name}</p>
                  <p className="font-body text-[12px] text-[#8A6F72]">{a.pix_key_type.toUpperCase()} · {a.pix_key}</p>
                </div>
              ))}
            </div>
          )}

          {accounts.length > 0 && !showWithdrawForm && (
            <button
              onClick={() => setShowWithdrawForm(true)}
              disabled={balance <= 0}
              className="w-full bg-[#6B2737] text-white rounded-2xl py-3 font-body font-semibold text-[13px] disabled:opacity-40 mb-5"
            >
              Solicitar saque
            </button>
          )}

          {showWithdrawForm && (
            <form onSubmit={handleWithdraw} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 mb-5">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_holder_name} — {a.pix_key}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder={`Valor a sacar (máx. ${fmt(balance)})`}
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
              />
              <p className="font-body text-[11px] text-[#8A6F72]">
                5% de taxa da plataforma é descontado no momento da aprovação do saque.
              </p>
              {errorMsg && (
                <p className="font-body text-[11.5px] text-[#B23A3A] bg-[#FBEAEA] rounded-lg px-3 py-1.5">{errorMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawForm(false)}
                  className="flex-1 bg-[#FAF5F1] text-[#8A6F72] rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
                >
                  Cancelar
                </button>
                <button disabled={saving} className="flex-1 bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]">
                  {saving ? "Enviando..." : "Confirmar solicitação"}
                </button>
              </div>
            </form>
          )}

          <p className="font-body font-bold text-[13px] text-[#2B1A1F] mb-2">Histórico de saques</p>
          {withdrawals.length === 0 && (
            <p className="font-body text-[12.5px] text-[#8A6F72]">Nenhum saque solicitado ainda.</p>
          )}
          <div className="flex flex-col gap-2">
            {withdrawals.map((w) => {
              const s = statusLabel[w.status];
              return (
                <div key={w.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{financesUnlocked ? fmt(w.requested_amount) : "R$ ••••"}</p>
                    <p className="font-body text-[11.5px]" style={{ color: s.color }}>{s.text}</p>
                  </div>
                  <p className="font-body text-[11px] text-[#8A6F72]">
                    Líquido: {financesUnlocked ? fmt(w.net_amount) : "••••"}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AdminScreen() {
  const [adminTab, setAdminTab] = useState("overview"); // overview | approvals | withdrawals
  const [pendingSalons, setPendingSalons] = useState([]);
  const [allSalons, setAllSalons] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteType, setNewInviteType] = useState("owner"); // owner | employee
  const [savingInvite, setSavingInvite] = useState(false);
  const [clients, setClients] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [paidWithdrawalsTotal, setPaidWithdrawalsTotal] = useState(0);
  const [totalTransacted, setTotalTransacted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [docUrls, setDocUrls] = useState({});

  async function fetchData() {
    setLoading(true);
    const { data: all } = await supabase
      .from("salons")
      .select("id, name, address, owner_full_name, document_type, document_number, verification_status, balance, created_at, salon_documents(document_url), salon_photos(photo_url)")
      .order("created_at", { ascending: false });

    setAllSalons(all || []);
    setPendingSalons((all || []).filter((s) => s.verification_status === "pending"));

    const { data: withdrawals } = await supabase
      .from("withdrawal_requests")
      .select("id, salon_id, requested_amount, platform_fee, net_amount, status, created_at, salons(name), salon_bank_accounts(pix_key, pix_key_type, account_holder_name)")
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: true });

    setPendingWithdrawals(withdrawals || []);

    const { data: invites } = await supabase.from("allowed_emails").select("email, role, created_at").order("created_at", { ascending: false });
    setAllowedEmails(invites || []);

    // Quem se cadastrou
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setClients(clientsData || []);

    // Quem está usando (agendamentos recentes)
    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, total_amount, created_at, clients(name), salons(name)")
      .order("created_at", { ascending: false })
      .limit(30);
    setRecentAppointments(appointmentsData || []);

    // Quanto já entrou de verdade (pagamentos confirmados)
    const { data: paidPayments } = await supabase.from("payments").select("amount").eq("status", "paid");
    setTotalTransacted((paidPayments || []).reduce((sum, p) => sum + Number(p.amount), 0));

    // Quanto a plataforma já faturou de verdade (taxas de saques já pagos)
    const { data: paidWithdrawals } = await supabase.from("withdrawal_requests").select("platform_fee").eq("status", "paid");
    setPaidWithdrawalsTotal((paidWithdrawals || []).reduce((sum, w) => sum + Number(w.platform_fee), 0));

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function getDocUrl(salon) {
    const doc = salon.salon_documents?.[0];
    if (!doc) return null;
    if (docUrls[salon.id]) return docUrls[salon.id];
    const { data } = await supabase.storage.from("salon-documents").createSignedUrl(doc.document_url, 300);
    if (data?.signedUrl) {
      setDocUrls((prev) => ({ ...prev, [salon.id]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  }

  async function approveWithdrawal(w) {
    if (!window.confirm(`Aprovar saque de ${fmt(w.requested_amount)}? Isso já debita o saldo do salão.`)) return;
    const { error } = await supabase.rpc("approve_withdrawal", { p_withdrawal_id: w.id });
    if (error) {
      alert(error.message);
      return;
    }
    fetchData();
  }

  async function rejectWithdrawal(w) {
    const reason = window.prompt("Motivo da rejeição:");
    if (reason === null) return;
    await supabase.from("withdrawal_requests").update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq("id", w.id);
    fetchData();
  }

  async function markWithdrawalPaid(w) {
    if (!window.confirm("Confirma que já transferiu esse Pix manualmente?")) return;
    await supabase.from("withdrawal_requests").update({ status: "paid" }).eq("id", w.id);
    fetchData();
  }

  async function approve(salonId) {
    await supabase.from("salons").update({ verification_status: "approved", reviewed_at: new Date().toISOString() }).eq("id", salonId);
    fetchData();
  }

  async function reject(salonId) {
    const reason = window.prompt("Motivo da rejeição (o salão vai ver esse texto):");
    if (reason === null) return;
    await supabase.from("salons").update({ verification_status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq("id", salonId);
    fetchData();
  }

  const approvedCount = allSalons.filter((s) => s.verification_status === "approved").length;
  const rejectedCount = allSalons.filter((s) => s.verification_status === "rejected").length;
  const projectedRevenue = allSalons.reduce((sum, s) => sum + (s.balance || 0), 0) * 0.05;

  async function deleteSalon(s) {
    if (!window.confirm(`Apagar o salão "${s.name}"? Isso não pode ser desfeito.`)) return;
    const { error } = await supabase.rpc("admin_delete_salon", { p_salon_id: s.id });
    if (error) {
      alert(error.message);
      return;
    }
    fetchData();
  }

  async function addInvite(e) {
    e.preventDefault();
    if (!newInviteEmail.trim()) return;
    setSavingInvite(true);
    const { error } = await supabase
      .from("allowed_emails")
      .insert({ email: newInviteEmail.trim().toLowerCase(), role: newInviteType });
    setSavingInvite(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNewInviteEmail("");
    setNewInviteNote("");
    fetchData();
  }

  async function removeInvite(email) {
    if (!window.confirm(`Remover ${email} da lista de convidados?`)) return;
    await supabase.from("allowed_emails").delete().eq("email", email);
    fetchData();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-[22px] text-[#2B1A1F]">Painel da plataforma</h1>
      <p className="font-body text-[13px] text-[#8A6F72] mt-1">Controle geral do TBMark.</p>

      <div className="flex items-center gap-1 bg-white p-1 rounded-full shadow-sm mt-5 w-fit">
        {[
          { id: "overview", label: "Visão geral" },
          { id: "approvals", label: `Aprovações${pendingSalons.length > 0 ? ` (${pendingSalons.length})` : ""}` },
          { id: "withdrawals", label: `Saques${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ""}` },
          { id: "invites", label: "Convites" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAdminTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] transition-colors ${
              adminTab === t.id ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {adminTab === "overview" && (
        <div className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="font-display font-semibold text-[20px] text-[#2B1A1F]">{clients.length}</p>
              <p className="font-body text-[11px] text-[#8A6F72]">Clientes cadastradas</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="font-display font-semibold text-[20px] text-[#5C7A4C]">{approvedCount}</p>
              <p className="font-body text-[11px] text-[#8A6F72]">Salões aprovados</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="font-display font-semibold text-[20px] text-[#2B1A1F]">{recentAppointments.length}</p>
              <p className="font-body text-[11px] text-[#8A6F72]">Agendamentos recentes</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="font-display font-semibold text-[20px] text-[#C9A227]">{pendingSalons.length}</p>
              <p className="font-body text-[11px] text-[#8A6F72]">Aguardando você</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-body text-[12px] text-[#8A6F72]">Total já transacionado na plataforma</p>
              <p className="font-display font-semibold text-[22px] text-[#2B1A1F] mt-0.5">{fmt(totalTransacted)}</p>
              <p className="font-body text-[11px] text-[#8A6F72] mt-1">Soma de todos os pagamentos confirmados</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-body text-[12px] text-[#8A6F72]">Sua receita já realizada</p>
              <p className="font-display font-semibold text-[22px] text-[#6B2737] mt-0.5">{fmt(paidWithdrawalsTotal)}</p>
              <p className="font-body text-[11px] text-[#8A6F72] mt-1">Taxa de 5% já transferida e confirmada</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-body text-[12px] text-[#8A6F72]">Sua receita a caminho</p>
              <p className="font-display font-semibold text-[22px] text-[#C9A227] mt-0.5">{fmt(projectedRevenue)}</p>
              <p className="font-body text-[11px] text-[#8A6F72] mt-1">5% do saldo que os salões ainda não sacaram</p>
            </div>
          </div>

          <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F] mt-7 mb-3">Todos os salões</h2>
          {allSalons.length === 0 && <p className="font-body text-[13px] text-[#8A6F72]">Nenhum salão cadastrado ainda.</p>}
          <div className="flex flex-col gap-2">
            {allSalons.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-body font-bold text-[13px] text-[#2B1A1F] truncate">{s.name}</p>
                  <p className="font-body text-[11.5px] text-[#8A6F72] truncate">{s.address}</p>
                  <span
                    className="inline-block mt-1 font-body font-semibold text-[10.5px] px-2 py-0.5 rounded-full"
                    style={{
                      background: s.verification_status === "approved" ? "#EEF3E9" : s.verification_status === "rejected" ? "#FBEAEA" : "#FDF6E3",
                      color: s.verification_status === "approved" ? "#5C7A4C" : s.verification_status === "rejected" ? "#B23A3A" : "#C9A227",
                    }}
                  >
                    {s.verification_status === "approved" ? "Aprovado" : s.verification_status === "rejected" ? "Rejeitado" : "Pendente"}
                  </span>
                </div>
                <button
                  onClick={() => deleteSalon(s)}
                  className="font-body font-semibold text-[11.5px] text-[#B23A3A] shrink-0"
                >
                  Apagar
                </button>
              </div>
            ))}
          </div>

          <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F] mt-7 mb-3">Clientes cadastradas</h2>
          {clients.length === 0 && <p className="font-body text-[13px] text-[#8A6F72]">Nenhuma cliente cadastrada ainda.</p>}
          <div className="flex flex-col gap-2">
            {clients.slice(0, 10).map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{c.name}</p>
                  <p className="font-body text-[11.5px] text-[#8A6F72]">{c.email} {c.phone && `· ${c.phone}`}</p>
                </div>
                <p className="font-body text-[11px] text-[#8A6F72]">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
          {clients.length > 10 && (
            <p className="font-body text-[11.5px] text-[#8A6F72] mt-2">+ {clients.length - 10} outras clientes cadastradas</p>
          )}

          <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F] mt-7 mb-3">Uso recente (quem está agendando)</h2>
          {recentAppointments.length === 0 && (
            <p className="font-body text-[13px] text-[#8A6F72]">Nenhum agendamento realizado ainda.</p>
          )}
          <div className="flex flex-col gap-2">
            {recentAppointments.slice(0, 10).map((a) => (
              <div key={a.id} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{a.clients?.name}</p>
                  <p className="font-body text-[11.5px] text-[#8A6F72]">{a.salons?.name} · {a.status}</p>
                </div>
                <p className="font-body font-bold text-[12.5px] text-[#6B2737]">{fmt(a.total_amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === "approvals" && (
        <div className="mt-6">
      <div className="bg-[#FDF6E3] rounded-2xl p-3.5 flex items-start gap-2">
        <Sparkles size={15} color="#C9A227" className="shrink-0 mt-0.5" />
        <p className="font-body text-[12px] text-[#8A6E1F]">
          Aprove ou rejeite os salões novos abaixo. Confira sempre as fotos e o documento antes de aprovar.
        </p>
      </div>
        </div>
      )}

      {adminTab === "withdrawals" && (
        <div className="mt-6 flex flex-col gap-3">
        {!loading && pendingWithdrawals.length === 0 && (
          <p className="font-body text-[13px] text-[#8A6F72]">Nenhum saque pendente no momento.</p>
        )}
        {pendingWithdrawals.map((w) => (
          <div key={w.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-body font-bold text-[14px] text-[#2B1A1F]">{w.salons?.name}</p>
                <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">
                  Solicitado: {fmt(w.requested_amount)} · Taxa (5%): {fmt(w.platform_fee)} · Líquido: {fmt(w.net_amount)}
                </p>
              </div>
              <span
                className="font-body font-semibold text-[11px] px-2 py-1 rounded-full shrink-0"
                style={{
                  background: w.status === "approved" ? "#EEF3E9" : "#FDF6E3",
                  color: w.status === "approved" ? "#5C7A4C" : "#C9A227",
                }}
              >
                {w.status === "approved" ? "Aprovado" : "Pendente"}
              </span>
            </div>

            <div className="bg-[#FAF5F1] rounded-xl p-3 mt-3">
              <p className="font-body font-semibold text-[12.5px] text-[#2B1A1F]">
                {w.salon_bank_accounts?.account_holder_name}
              </p>
              <p className="font-body text-[11.5px] text-[#8A6F72]">
                {w.salon_bank_accounts?.pix_key_type?.toUpperCase()} · {w.salon_bank_accounts?.pix_key}
              </p>
              <p className="font-body text-[10.5px] text-[#B49A96] mt-1">
                Confira se o nome bate com o documento cadastrado do salão antes de aprovar.
              </p>
            </div>

            {w.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => approveWithdrawal(w)}
                  className="flex-1 bg-[#5C7A4C] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => rejectWithdrawal(w)}
                  className="flex-1 bg-[#B23A3A] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
                >
                  Rejeitar
                </button>
              </div>
            )}

            {w.status === "approved" && (
              <button
                onClick={() => markWithdrawalPaid(w)}
                className="w-full bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px] mt-3"
              >
                Marcar como transferido (Pix já enviado)
              </button>
            )}
          </div>
        ))}
        </div>
      )}

      {adminTab === "invites" && (
        <div className="mt-6">
          <div className="bg-[#FDF6E3] rounded-2xl p-3.5 flex items-start gap-2 mb-5">
            <Sparkles size={15} color="#C9A227" className="shrink-0 mt-0.5" />
            <p className="font-body text-[12px] text-[#8A6E1F]">
              Clientes se cadastram livremente. Só donas de salão e funcionárias precisam estar nessa lista
              pra conseguir criar conta.
            </p>
          </div>

          <form onSubmit={addInvite} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 mb-5">
            <input
              required
              type="email"
              placeholder="Email a liberar"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              className="bg-[#FAF5F1] rounded-xl px-3.5 py-2.5 font-body text-[13.5px] outline-none placeholder:text-[#B49A96]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewInviteType("owner")}
                className={`flex-1 rounded-xl py-2.5 font-body font-semibold text-[12.5px] ${
                  newInviteType === "owner" ? "bg-[#6B2737] text-white" : "bg-[#FAF5F1] text-[#8A6F72]"
                }`}
              >
                Dona de salão
              </button>
              <button
                type="button"
                onClick={() => setNewInviteType("employee")}
                className={`flex-1 rounded-xl py-2.5 font-body font-semibold text-[12.5px] ${
                  newInviteType === "employee" ? "bg-[#6B2737] text-white" : "bg-[#FAF5F1] text-[#8A6F72]"
                }`}
              >
                Funcionária
              </button>
            </div>
            <button
              disabled={savingInvite}
              className="bg-[#6B2737] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
            >
              {savingInvite ? "Adicionando..." : "Liberar este email"}
            </button>
          </form>

          <p className="font-body font-bold text-[13px] text-[#2B1A1F] mb-2">
            Emails liberados ({allowedEmails.length})
          </p>
          <div className="flex flex-col gap-2">
            {allowedEmails.map((inv) => (
              <div key={inv.email} className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{inv.email}</p>
                  {inv.role && (
                    <span
                      className="inline-block mt-1 font-body font-semibold text-[10.5px] px-2 py-0.5 rounded-full"
                      style={{
                        background: inv.role === "owner" ? "#FAF5F1" : "#EEF3E9",
                        color: inv.role === "owner" ? "#6B2737" : "#5C7A4C",
                      }}
                    >
                      {inv.role === "owner" ? "Dona de salão" : "Funcionária"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeInvite(inv.email)}
                  className="font-body font-semibold text-[11.5px] text-[#B23A3A] shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === "approvals" && (
        <div className="mt-2">
      <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F] mb-3">
        Aguardando aprovação {pendingSalons.length > 0 && `(${pendingSalons.length})`}
      </h2>

      {loading && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-6">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando...</span>
        </div>
      )}

      {!loading && pendingSalons.length === 0 && (
        <p className="font-body text-[13px] text-[#8A6F72]">Nenhum cadastro pendente no momento.</p>
      )}

      <div className="flex flex-col gap-3">
        {pendingSalons.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body font-bold text-[14px] text-[#2B1A1F]">{s.name}</p>
                <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">{s.address}</p>
                <p className="font-body text-[12px] text-[#8A6F72] mt-1">
                  Responsável: {s.owner_full_name} · {s.document_type?.toUpperCase()}: {s.document_number}
                </p>
              </div>
            </div>

            {s.salon_photos?.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                {s.salon_photos.map((p, i) => (
                  <img key={i} src={p.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                ))}
              </div>
            )}

            <button
              onClick={async () => {
                const url = await getDocUrl(s);
                if (url) window.open(url, "_blank");
              }}
              className="font-body font-semibold text-[12px] text-[#6B2737] underline mt-3"
            >
              Ver documento enviado
            </button>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => approve(s.id)}
                className="flex-1 bg-[#5C7A4C] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
              >
                Aprovar
              </button>
              <button
                onClick={() => reject(s.id)}
                className="flex-1 bg-[#B23A3A] text-white rounded-xl py-2.5 font-body font-semibold text-[12.5px]"
              >
                Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
        </div>
      )}
    </div>
  );
}

function EmployeeAreaScreen({ session }) {
  const [professional, setProfessional] = useState(undefined); // undefined = carregando, null = não achou
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProfessional() {
      // Primeiro tenta achar um cadastro já vinculado a essa conta
      let { data } = await supabase
        .from("professionals")
        .select("id, name, salon_id, commission_type, commission_value")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Se não achou, tenta vincular automaticamente pelo email (primeiro login)
      if (!data && session.user.email) {
        const { data: linkedId } = await supabase.rpc("link_employee_account", { p_email: session.user.email });
        if (linkedId) {
          const { data: linked } = await supabase
            .from("professionals")
            .select("id, name, salon_id, commission_type, commission_value")
            .eq("id", linkedId)
            .maybeSingle();
          data = linked;
        }
      }

      if (!active) return;
      setProfessional(data || null);
    }
    loadProfessional();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  useEffect(() => {
    if (!professional) return;
    let active = true;
    async function loadAppointments() {
      setLoadingAppointments(true);
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, total_amount, clients(name), services(name, price)")
        .eq("professional_id", professional.id)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (!active) return;
      setAppointments(data || []);
      setLoadingAppointments(false);
    }
    loadAppointments();
    return () => {
      active = false;
    };
  }, [professional]);

  function commissionFor(totalAmount) {
    if (!professional) return 0;
    return professional.commission_type === "percentage"
      ? (totalAmount * professional.commission_value) / 100
      : professional.commission_value;
  }

  if (professional === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-[#8A6F72] py-16">
        <Loader2 size={18} className="animate-spin" />
        <span className="font-body text-[13px]">Carregando...</span>
      </div>
    );
  }

  if (professional === null) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10 text-center">
        <p className="font-display font-semibold text-[18px] text-[#2B1A1F]">Nenhum vínculo encontrado</p>
        <p className="font-body text-[13.5px] text-[#8A6F72] mt-2">
          Não encontramos um cadastro de funcionária com o email <strong>{session.user.email}</strong>. Peça pra
          dona do salão cadastrar esse mesmo email na área de funcionárias dela.
        </p>
      </div>
    );
  }

  const totalCommission = appointments.reduce((sum, a) => sum + commissionFor(a.total_amount), 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display font-semibold text-[22px] text-[#2B1A1F]">Olá, {professional.name.split(" ")[0]}</h1>
      <p className="font-body text-[13px] text-[#8A6F72] mt-1">Seus próximos agendamentos</p>

      <div className="bg-white rounded-2xl p-5 shadow-sm mt-5">
        <p className="font-body text-[12px] text-[#8A6F72]">Comissão a receber (próximos agendamentos)</p>
        <p className="font-display font-semibold text-[26px] text-[#2B1A1F] mt-0.5">{fmt(totalCommission)}</p>
      </div>

      {loadingAppointments && (
        <div className="flex items-center gap-2 text-[#8A6F72] py-6">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-body text-[13px]">Carregando agenda...</span>
        </div>
      )}

      {!loadingAppointments && appointments.length === 0 && (
        <p className="font-body text-[13px] text-[#8A6F72] mt-6">Nenhum agendamento futuro por enquanto.</p>
      )}

      <div className="flex flex-col gap-2.5 mt-5">
        {appointments.map((a) => {
          const dateObj = new Date(a.scheduled_at);
          return (
            <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-body font-bold text-[14px] text-[#2B1A1F]">{a.clients?.name}</p>
                <p className="font-body font-bold text-[13px] text-[#6B2737]">{fmt(commissionFor(a.total_amount))}</p>
              </div>
              <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">
                {a.services?.name} · {dateObj.toLocaleDateString("pt-BR")} às {dateObj.toTimeString().slice(0, 5)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OwnerAreaScreen({ session, isAdmin }) {
  const [myLoading, setMyLoading] = useState(true);
  const [mySalon, setMySalon] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      setMyLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("salons")
      .select("*")
      .eq("owner_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setMySalon(data);
        setMyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, session.user.id]);

  if (isAdmin) return <AdminScreen />;

  if (myLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-[#8A6F72] py-16">
        <Loader2 size={18} className="animate-spin" />
        <span className="font-body text-[13px]">Carregando...</span>
      </div>
    );
  }

  if (mySalon) return <OwnerStatusScreen salon={mySalon} />;

  return <OwnerRegistrationForm userId={session.user.id} onSubmitted={() => window.location.reload()} />;
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */

export default function AppBelezaPrototype() {
  const [session, setSession] = useState(undefined); // undefined = checando, null = deslogado, objeto = logado
  const [isAdmin, setIsAdmin] = useState(false);
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

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    if (!session) {
      setDisplayName(null);
      return;
    }
    if (userType === "owner") {
      supabase
        .from("salons")
        .select("name")
        .eq("owner_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setDisplayName(data?.name || null));
    } else {
      supabase
        .from("clients")
        .select("name")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setDisplayName(data?.name || null));
    }
  }, [session, userType]);

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
    <div className="w-full min-h-screen bg-[#FAF5F1] overflow-x-hidden">
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
        <div className="w-full border-b border-[#EFE3DE] bg-white/80 backdrop-blur sticky top-0 z-30 overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <span className="font-display font-semibold text-[19px] text-[#6B2737] shrink-0">TBMark</span>

              <div className="flex items-center gap-3 shrink-0 sm:hidden">
                {session && displayName && (
                  <span className="font-body font-semibold text-[12px] text-[#2B1A1F] truncate max-w-[110px]">
                    {displayName}
                  </span>
                )}
                <button
                  onClick={() => (session ? supabase.auth.signOut() : setScreen("auth"))}
                  className="flex items-center gap-1.5 font-body font-semibold text-[12.5px] text-[#6B2737] shrink-0"
                >
                  <User size={15} />
                  {session ? "Sair" : "Entrar"}
                </button>
              </div>
            </div>

            <div className="w-full sm:w-auto overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 bg-[#FAF5F1] p-1 rounded-full w-max sm:w-auto">
                <button
                  onClick={() => {
                    setUserType("client");
                    setScreen("search");
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] whitespace-nowrap transition-colors ${
                    userType === "client" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                  }`}
                >
                  Para Você
                </button>
                <button
                  onClick={() => {
                    setUserType("owner");
                    setScreen("search");
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] whitespace-nowrap transition-colors ${
                    userType === "owner" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                  }`}
                >
                  Para Negócios
                </button>
                <button
                  onClick={() => {
                    setUserType("employee");
                    setScreen("search");
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 font-body font-semibold text-[12px] whitespace-nowrap transition-colors ${
                    userType === "employee" ? "bg-[#6B2737] text-white" : "text-[#8A6F72]"
                  }`}
                >
                  Para Profissionais
                </button>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 shrink-0">
              {session && displayName && (
                <span className="font-body font-semibold text-[12.5px] text-[#2B1A1F] truncate max-w-[160px]">
                  {displayName}
                </span>
              )}
              <button
                onClick={() => (session ? supabase.auth.signOut() : setScreen("auth"))}
                className="flex items-center gap-1.5 font-body font-semibold text-[12.5px] text-[#6B2737]"
              >
                <User size={15} />
                {session ? "Sair" : "Entrar"}
              </button>
            </div>
          </div>
        </div>

        {screen === "search" && userType === "owner" && session === null && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
            <p className="font-display font-semibold text-[17px] text-[#2B1A1F]">Área da dona do salão</p>
            <p className="font-body text-[13px] text-[#8A6F72]">
              Entre ou cadastre-se para gerenciar seu salão.
            </p>
            <button
              onClick={() => setScreen("auth")}
              className="bg-[#6B2737] text-white rounded-full px-5 py-2.5 font-body font-semibold text-[13px] mt-1"
            >
              Entrar
            </button>
          </div>
        )}

        {screen === "search" && userType === "owner" && session && (
          <div className="flex-1 overflow-y-auto">
            <OwnerAreaScreen session={session} isAdmin={isAdmin} />
          </div>
        )}

        {screen === "search" && userType === "employee" && session === null && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
            <p className="font-display font-semibold text-[17px] text-[#2B1A1F]">Área da funcionária</p>
            <p className="font-body text-[13px] text-[#8A6F72]">
              Entre com o email que a dona do salão cadastrou pra você.
            </p>
            <button
              onClick={() => setScreen("auth")}
              className="bg-[#6B2737] text-white rounded-full px-5 py-2.5 font-body font-semibold text-[13px] mt-1"
            >
              Entrar
            </button>
          </div>
        )}

        {screen === "search" && userType === "employee" && session && (
          <div className="flex-1 overflow-y-auto">
            <EmployeeAreaScreen session={session} />
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
            <TopHeader title="Entre para continuar" onBack={() => setScreen(userType === "client" ? "salon" : "search")} />
            <AuthScreen userType={userType} onAuthenticated={() => setScreen(userType === "client" ? "booking" : "search")} />
          </div>
        )}

        {screen === "booking" && professional && session && (
          <div className="flex-1 flex flex-col pt-6 overflow-hidden w-full max-w-xl mx-auto sm:border-x sm:border-[#EFE3DE]">
            <BookingScreen
              salonId={salon?.id}
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
