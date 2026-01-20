"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/ui/logo";
import { useI18n } from "@/hooks/useI18n";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const { t, locale, setLocale } = useI18n();
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", {
          credentials: "include",
        });
        const data = await response.json();
        setIsAuthenticated(response.ok && data.success);
      } catch {
        setIsAuthenticated(false);
      }
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    checkAuth();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // No longer blocking with a full-screen loading indicator

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${isScrolled
        ? "top-6 w-[95%] max-w-7xl px-0 border border-white-100 rounded-xl"
        : "top-0 w-full px-0"
        }`}>
        <div className={`transition-all duration-500 ${isScrolled
          ? "bg-gray-950/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.3)] px-6 py-4"
          : "bg-gray-900 border-b border-white/5 px-8 py-5"
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              <Logo size="md" theme="dark" />

              {/* Desktop Menu - Centered */}
              <div className="hidden md:flex items-center justify-center flex-1 gap-12">
                <a href="#api" className="text-sm font-semibold text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95">{t("API")}</a>
                <a href="#mcp" className="text-sm font-semibold text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95">{t("MCP")}</a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Language Switcher */}
              <button
                onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-white/5"
              >
                <span className="text-xs font-bold text-gray-400 uppercase">{locale}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.188 16.225 5 19.168" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              </button>

              <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>

              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="px-6 py-2.5 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-all font-bold text-sm shadow-lg hover:scale-105 active:scale-95"
                >
                  {t("Dashboard")}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-2.5 text-gray-300 hover:text-white transition-colors font-semibold text-sm"
                  >
                    {t("Sign In")}
                  </Link>
                  <Link
                    href="/register"
                    className="px-6 py-2.5 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-all font-bold text-sm shadow-lg hover:scale-105 active:scale-95"
                  >
                    {t("Get Started")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-40 pb-20 md:pt-48 md:pb-32">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 mb-8 leading-tight tracking-tight">
            {t("PDF Infrastructure")}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              {t("for Modern Apps")}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
            {t("The most powerful engine to design, manage, and generate pixel-perfect PDFs via API and native MCP integration.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="px-10 py-5 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition-all hover:scale-105 font-bold text-lg shadow-2xl flex items-center justify-center gap-2"
            >
              {isAuthenticated ? t("Go to Dashboard") : t("Start Free Trial")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </Link>
            <Link
              href="#mcp"
              className="px-10 py-5 bg-white text-gray-900 rounded-2xl hover:bg-gray-50 transition-all border-2 border-gray-100 font-bold text-lg shadow-sm flex items-center justify-center gap-2"
            >
              {t("Explore MCP")}
              <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full uppercase">{t("New")}</span>
            </Link>
          </div>
        </div>

        {/* Hero Visual - Premium Browser Framework */}
        <div className="relative group max-w-6xl mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[2.5rem] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative bg-gray-900 rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden">
            {/* Browser Header */}
            <div className="bg-gray-800/50 px-6 py-4 border-b border-white/5 flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40"></div>
              </div>
              <div className="flex-1 max-w-sm h-7 bg-gray-900/50 rounded-lg border border-white/5 flex items-center px-3 gap-2">
                <div className="w-3 h-3 text-gray-500">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="text-[10px] text-gray-500 font-mono">pdfgenai.com/editor/w2-template</div>
              </div>
            </div>
            {/* Image Content */}
            <div className="aspect-video relative overflow-hidden">
              <Image
                src="/editor.png"
                alt="Template Editor"
                fill
                className="object-cover object-top"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent"></div>
            </div>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section id="api" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                {t("Developer Friendly")}
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
                {t("API-First")} <br />
                <span className="text-blue-600">{t("Infrastructure.")}</span>
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {t("Seamlessly integrate PDF generation into your existing workflow. Our REST API allows you to trigger generations with dynamic data in milliseconds.")}
              </p>
              <ul className="space-y-4">
                {[
                  "Dynamic Data Injection",
                  "Secure API Key Auth",
                  "High Availability Infrastructure",
                  "Webhooks and Callbacks"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-700 font-medium">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="relative group h-[450px] select-none"
              onMouseMove={(e) => {
                if (!isDragging) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const margin = 25;
                const x = Math.max(margin, Math.min(e.clientX - rect.left, rect.width - margin));
                setSliderPosition((x / rect.width) * 100);
              }}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {/* Background Layer (Response) */}
              <div className="absolute inset-0 bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 p-8 font-mono text-sm overflow-hidden bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.1),_transparent)]">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-1.5 opacity-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/30"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/30"></div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-500/50 uppercase tracking-widest">{t("Response")}</span>
                </div>
                <pre className="text-emerald-400">
                  <code>{`{
  "success": true,
  "document": {
    "id": "doc_99a8b2",
    "name": "invoice-2026",
    "template_id": "inv-4452",
    "size": 104523,
    "status": "completed",
    "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
  },
  "pdfUrl": "https://api.pdfgenai.com/api/v1/documents/doc_99a8b2/download?signature=..."
}`}</code>
                </pre>
              </div>

              {/* Top Layer (Request) */}
              <div
                className="absolute inset-0 bg-gray-950 rounded-3xl border border-white/5 p-8 font-mono text-sm overflow-hidden z-10"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/30"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/30"></div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{t("Request")}</span>
                </div>
                <pre className="text-blue-400">
                  <code>{`// Generate PDF via API
fetch('${process.env.NEXT_PUBLIC_DOMAIN || 'https://api.pdfgenai.com'}/api/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template_id: 'inv-4452',
    name: 'invoice-2026',
    data: {
      customer: 'John Doe',
      amount: 1450.00,
      currency: 'USD'
    }
  })
})`}</code>
                </pre>
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-blue-500 z-20 cursor-ew-resize group/handle"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDragging(true);
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] group-hover/handle:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l-4 4 4 4m8-8l4 4-4 4" />
                  </svg>
                </div>
                {/* Glow Effect */}
                <div className="absolute inset-0 w-[2px] bg-blue-400 blur-sm -left-px"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MCP Section - The Big Innovation */}
      <section id="mcp" className="py-24 bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">
              {t("The MCP Revolution.")}
            </h2>
            <p className="text-xl text-gray-400 leading-relaxed mb-10">
              {t("We are the first PDF platform with native Model Context Protocol support. Let your AI agents design, edit, and generate PDFs directly.")}
            </p>

            {/* Compatibility Row */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest w-full mb-2">{t("Compatible With")}</span>
              {[
                { name: "ChatGPT", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/10" },
                { name: "Claude Desktop", color: "bg-orange-500/10 text-orange-400 border-orange-500/10" },
                { name: "VSCode", color: "bg-blue-500/10 text-blue-400 border-blue-500/10" },
                { name: t("Custom AI Apps"), color: "bg-purple-500/10 text-purple-400 border-purple-500/10" }
              ].map((item) => (
                <div key={item.name} className={`px-4 py-2 rounded-full border ${item.color} text-xs font-black hover:scale-105 transition-transform cursor-default uppercase tracking-tight`}>
                  {item.name}
                </div>
              ))}
            </div>
          </div>

          {/* AI Simulator */}
          <div className="max-w-4xl mx-auto bg-gray-900/50 rounded-3xl border border-white/5 p-4 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group mb-20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>

            <div className="space-y-8 mb-10">
              {/* User Message */}
              <div className="flex justify-end pr-4">
                <div className="bg-blue-600 text-white px-6 py-4 rounded-3xl rounded-tr-none max-w-[85%] font-medium shadow-xl">
                  {t("AI Prompt Example")}
                </div>
              </div>

              {/* AI Message with Tool Indicator */}
              <div className="flex justify-start pl-4">
                <div className="space-y-4 max-w-[85%]">
                  <div className="bg-gray-800/80 text-gray-100 px-7 py-5 rounded-3xl rounded-tl-none font-medium shadow-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-4 py-1.5 pr-4 pl-1.5 bg-gray-950/80 rounded-xl border border-white/10 w-fit">
                      <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                        <Logo size="sm" theme="dark" showText={false} />
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-0.5">
                          {t("Connected Tool")}
                        </div>
                        <div className="text-[09px] font-bold text-gray tracking-tight">PDFGenAI: generate_pdf</div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    </div>
                    <p className="leading-relaxed">{t("AI Response Example")}</p>
                    <div className="mt-4 p-3 bg-gray-900/50 rounded-xl border border-white/5 flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white tracking-tight">invoice_acme_corp.pdf</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">145 KB • PDF DOCUMENT</div>
                      </div>
                      <div className="text-blue-500 hover:text-blue-400 cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Input Area */}
            <div className="relative pt-6 border-t border-white/5">
              <div className="bg-gray-950/80 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl">
                <div className="text-gray-500 text-sm font-medium">{t("Ask AI...")}</div>
                <div className="flex gap-2">
                  <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center text-gray-500 border border-white/5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="MD12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">{t("AI Context")}</h3>
              <p className="text-gray-400 italic mb-4">&quot;Hey, create an invoice template for a tech company using my corporate colors.&quot;</p>
              <p className="text-sm text-gray-500">{t("The AI understands your request and uses our tools to build exactly what you need.")}</p>
            </div>
            <div className="p-8 rounded-3xl bg-blue-600 border border-blue-400 shadow-[0_0_40px_rgba(37,99,235,0.4)] relative">
              <div className="absolute -top-3 right-8 bg-white text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">{t("Main Feature")}</div>
              <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2h4a2 2 0 012 2v1a2 2 0 002 2h4a2 2 0 002-2V5a2 2 0 012-2h4a2 2 0 012 2v11a2 2 0 01-2 2H3a2 2 0 01-2-2V5" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{t("Full Integration")}</h3>
              <p className="text-blue-100 mb-8 italic">{t("Universal connection between LLMs and our PDF generation engine.")}</p>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-blue-600 bg-blue-400"></div>)}
              </div>
            </div>
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">{t("Live Execution")}</h3>
              <p className="text-gray-400 italic mb-4">&quot;Regenerate all pending reports for this month.&quot;</p>
              <p className="text-sm text-gray-500">{t("Automate complex tasks through natural language with direct server execution.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t("How It Works")}</h2>
            <p className="text-xl text-gray-600">{t("Get started in three simple steps")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t("Create Template")}</h3>
              <p className="text-gray-600">
                {t("Design your PDF template using HTML and CSS. Use our visual editor or start from scratch.")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t("Add Dynamic Data")}</h3>
              <p className="text-gray-600">
                {t("Define variables and test data. Preview your template with real-time data injection.")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t("Generate PDFs")}</h3>
              <p className="text-gray-600">
                {t("Use our API to generate PDFs on-demand. Integrate with your apps in minutes.")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{t("Ready to Get Started?")}</h2>
          <p className="text-xl text-gray-300 mb-10">
            {t("Join thousands of developers using PDFGenAI to generate beautiful PDFs")}
          </p>
          <Link
            href={isAuthenticated ? "/dashboard" : "/register"}
            className="inline-block px-10 py-4 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-all hover:scale-105 font-bold text-lg shadow-xl"
          >
            {isAuthenticated ? t("Go to Dashboard") : t("Start Free Trial")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Logo theme="dark" size="sm" />
            <div className="text-sm">
              © {new Date().getFullYear()} PDFGenAI powered by ChambaPRO SAPI de CV. {t("All rights reserved.")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
