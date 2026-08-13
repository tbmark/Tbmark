import React, { useState, useMemo } from "react";
import {
  Search, MapPin, Star, ChevronLeft, Check, Clock,
  Home, Heart, User, Calendar, CreditCard, Sparkles,
  ChevronRight, Wallet, Smartphone
} from "lucide-react";

/* ---------------------------------------------------------
   MOCK DATA
--------------------------------------------------------- */

const SALON = {
  name: "Espaço Aurora",
  rating: 4.9,
  reviews: 238,
  address: "Rua das Flores, 210 — Batel, Curitiba",
  distance: "0,8 km",
};

const PROFESSIONALS = [
  { id: 1, name: "Marina Duarte", role: "Cabelo", initials: "MD", color: "#6B2737", slotsToday: 3 },
  { id: 2, name: "Camila Ferreira", role: "Unhas", initials: "CF", color: "#8B3A4E", slotsToday: 0 },
  { id: 3, name: "Juliana Prado", role: "Sobrancelha & Cílios", initials: "JP", color: "#A2555E", slotsToday: 5 },
];

const SERVICES = [
  { id: 1, profId: 1, name: "Escova Modelada", price: 150, duration: 60 },
  { id: 2, profId: 1, name: "Corte Feminino", price: 120, duration: 45 },
  { id: 3, profId: 1, name: "Hidratação Profunda", price: 90, duration: 40 },
  { id: 4, profId: 3, name: "Design de Sobrancelha", price: 60, duration: 30 },
  { id: 5, profId: 3, name: "Extensão de Cílios", price: 180, duration: 90 },
];

const DATES = [
  { label: "Hoje", sub: "13 Ago" },
  { label: "Amanhã", sub: "14 Ago" },
  { label: "Sex", sub: "15 Ago" },
  { label: "Sáb", sub: "16 Ago" },
  { label: "Dom", sub: "17 Ago" },
];

const TIMES = ["09:00", "10:30", "11:15", "13:00", "14:30", "16:00", "17:30"];

const fmt = (n) => `R$ ${n.toFixed(2).replace(".", ",")}`;

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
   SCREEN: SEARCH / HOME
--------------------------------------------------------- */

function SearchScreen({ onOpenSalon }) {
  const chips = ["Escova", "Unhas", "Sobrancelha", "Cílios", "Massagem"];
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF5F1] pb-4">
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-1.5 text-[#8A6F72] font-body text-[12.5px] mb-1">
          <MapPin size={13} />
          <span>Batel, Curitiba — usando sua localização</span>
        </div>
        <h1 className="font-display font-semibold text-[24px] text-[#2B1A1F] leading-tight">
          Boa tarde, Bianca ✨
        </h1>
        <p className="font-body text-[13.5px] text-[#8A6F72] mt-0.5">O que você quer fazer hoje?</p>
      </div>

      <div className="px-5 mt-4">
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-sm">
          <Search size={17} color="#B49A96" />
          <span className="font-body text-[14px] text-[#B49A96]">Buscar salão ou procedimento</span>
        </div>
      </div>

      <div className="flex gap-2 px-5 mt-4 overflow-x-auto no-scrollbar">
        {chips.map((c, i) => (
          <span
            key={c}
            className={`shrink-0 font-body font-semibold text-[12.5px] px-3.5 py-2 rounded-full ${
              i === 0 ? "bg-[#6B2737] text-white" : "bg-white text-[#6B2737] border border-[#EFE3DE]"
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      <div className="px-5 mt-6 flex items-center justify-between">
        <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F]">Perto de você</h2>
        <span className="font-body text-[12px] text-[#8A6F72]">Ver tudo</span>
      </div>

      <div className="px-5 mt-3 flex flex-col gap-3">
        <button onClick={onOpenSalon} className="text-left">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform">
            <div className="h-28 relative bg-gradient-to-br from-[#6B2737] to-[#A2555E]">
              <span className="absolute top-2.5 left-2.5 bg-[#C9A227] text-white text-[10px] font-body font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Sparkles size={10} /> Destaque
              </span>
            </div>
            <div className="p-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-[15px] text-[#2B1A1F]">{SALON.name}</h3>
                <div className="flex items-center gap-1">
                  <Star size={13} fill="#C9A227" color="#C9A227" />
                  <span className="font-body font-bold text-[12.5px] text-[#2B1A1F]">{SALON.rating}</span>
                </div>
              </div>
              <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">
                {SALON.address} · {SALON.distance}
              </p>
              <div className="flex gap-1.5 mt-2">
                {["Cabelo", "Sobrancelha", "Cílios"].map((t) => (
                  <span key={t} className="text-[10.5px] font-body font-semibold px-2 py-0.5 rounded-full bg-[#FAF5F1] text-[#6B2737]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-2xl overflow-hidden shadow-sm opacity-60">
          <div className="h-28 bg-gradient-to-br from-[#8A6F72] to-[#B49A96]" />
          <div className="p-3.5">
            <h3 className="font-display font-semibold text-[15px] text-[#2B1A1F]">Studio Vitrine</h3>
            <p className="font-body text-[12px] text-[#8A6F72] mt-0.5">Centro, Curitiba · 2,4 km</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SCREEN: SALON PROFILE (choose professional)
--------------------------------------------------------- */

function SalonScreen({ onBack, onSelectProfessional }) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF5F1] pb-4">
      <div className="h-40 relative bg-gradient-to-br from-[#6B2737] to-[#A2555E]">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center"
        >
          <ChevronLeft size={18} color="#6B2737" />
        </button>
      </div>

      <div className="px-5 -mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <h1 className="font-display font-semibold text-[19px] text-[#2B1A1F]">{SALON.name}</h1>
          <div className="flex items-center gap-1 mt-1">
            <Star size={13} fill="#C9A227" color="#C9A227" />
            <span className="font-body font-bold text-[12.5px] text-[#2B1A1F]">{SALON.rating}</span>
            <span className="font-body text-[12px] text-[#8A6F72]">({SALON.reviews} avaliações)</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[#8A6F72]">
            <MapPin size={12} />
            <span className="font-body text-[12px]">{SALON.address}</span>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <h2 className="font-display font-semibold text-[16px] text-[#2B1A1F]">Escolha quem vai te atender</h2>
        <p className="font-body text-[12.5px] text-[#8A6F72] mt-0.5">
          Veja quem está disponível hoje ou escolha por especialidade
        </p>
      </div>

      <div className="px-5 mt-3 flex flex-col gap-2.5">
        {PROFESSIONALS.map((p) => (
          <button
            key={p.id}
            onClick={() => p.slotsToday > 0 && onSelectProfessional(p)}
            disabled={p.slotsToday === 0}
            className={`bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 text-left ${
              p.slotsToday === 0 ? "opacity-50" : "active:scale-[0.98] transition-transform"
            }`}
          >
            <Avatar initials={p.initials} color={p.color} />
            <div className="flex-1 min-w-0">
              <h3 className="font-body font-bold text-[14px] text-[#2B1A1F] truncate">{p.name}</h3>
              <p className="font-body text-[12px] text-[#8A6F72]">{p.role}</p>
            </div>
            {p.slotsToday > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-body font-semibold text-[#5C7A4C] bg-[#EEF3E9] px-2.5 py-1 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5C7A4C]" />
                {p.slotsToday} hoje
              </span>
            ) : (
              <span className="text-[11px] font-body font-semibold text-[#B49A96] shrink-0">Sem horário</span>
            )}
            {p.slotsToday > 0 && <ChevronRight size={16} color="#B49A96" className="shrink-0" />}
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

  const servicesForProf = SERVICES.filter((s) => s.profId === professional.id);
  const total = useMemo(
    () => selectedServices.reduce((sum, id) => sum + servicesForProf.find((s) => s.id === id).price, 0),
    [selectedServices]
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
        <Avatar initials={professional.initials} color={professional.color} size={36} />
        <div>
          <p className="font-body font-bold text-[13px] text-[#2B1A1F]">{professional.name}</p>
          <p className="font-body text-[11px] text-[#8A6F72]">{professional.role}</p>
        </div>
      </div>

      {/* STEP 0: SERVICES */}
      {step === 0 && (
        <div className="px-5 flex flex-col gap-2.5">
          {servicesForProf.map((s) => {
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
                  <p className="font-body text-[11.5px] text-[#8A6F72]">{s.duration} min</p>
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

function ConfirmedScreen({ professional, date, time, onDone }) {
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
          <Avatar initials={professional.initials} color={professional.color} size={38} />
          <div>
            <p className="font-body font-bold text-[13.5px] text-[#2B1A1F]">{professional.name}</p>
            <p className="font-body text-[11.5px] text-[#8A6F72]">{SALON.name}</p>
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
  const [screen, setScreen] = useState("search");
  const [professional, setProfessional] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [step, setStep] = useState(0);

  const reset = () => {
    setScreen("search");
    setProfessional(null);
    setSelectedServices([]);
    setDate(null);
    setTime(null);
    setStep(0);
  };

  const toggleService = (id) =>
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="w-full min-h-[820px] flex items-center justify-center bg-[#E9DFDA] p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');
        .font-display{font-family:'Fraunces',serif;}
        .font-body{font-family:'Manrope',sans-serif;}
        .no-scrollbar::-webkit-scrollbar{display:none;}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}
        @keyframes pop{0%{transform:scale(0.6);opacity:0;}100%{transform:scale(1);opacity:1;}}
      `}</style>

      {/* PHONE FRAME */}
      <div className="w-[380px] h-[790px] bg-[#C9B8AA] rounded-[46px] p-[10px] shadow-2xl">
        <div className="w-full h-full bg-[#FAF5F1] rounded-[36px] overflow-hidden flex flex-col relative">
          {/* notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#C9B8AA] rounded-b-2xl z-20" />

          <div className="flex-1 flex flex-col pt-6 overflow-hidden">
            {screen === "search" && <SearchScreen onOpenSalon={() => setScreen("salon")} />}

            {screen === "salon" && (
              <SalonScreen
                onBack={() => setScreen("search")}
                onSelectProfessional={(p) => {
                  setProfessional(p);
                  setScreen("booking");
                }}
              />
            )}

            {screen === "booking" && professional && (
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
            )}

            {screen === "confirmed" && professional && (
              <ConfirmedScreen professional={professional} date={date} time={time} onDone={reset} />
            )}
          </div>

          {/* BOTTOM NAV — only on search/home */}
          {screen === "search" && (
            <div className="flex items-center justify-around border-t border-[#EFE3DE] bg-white py-2.5 px-2">
              {[
                { icon: Home, label: "Início", active: true },
                { icon: Search, label: "Buscar" },
                { icon: Heart, label: "Favoritos" },
                { icon: User, label: "Perfil" },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
                  <Icon size={19} color={active ? "#6B2737" : "#B49A96"} />
                  <span className={`font-body text-[10px] font-semibold ${active ? "text-[#6B2737]" : "text-[#B49A96]"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
