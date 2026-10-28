'use client';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f8f5] text-emerald-950">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800" />
      <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-lime-300/10 blur-3xl" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-white">
        <a className="text-lg font-semibold tracking-tight" href="#home">Karma Ayurveda</a>
        <span className="hidden rounded-full border border-white/20 px-4 py-2 text-xs text-emerald-50 sm:block">A healthier conversation starts here</span>
      </nav>
      <section id="home" className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-28 pt-14 text-white md:grid-cols-[1.15fr_.85fr] md:pb-36 md:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-100"><span className="h-2 w-2 rounded-full bg-lime-300"/>Personal guidance, one conversation at a time</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl">Tell us how you’re feeling.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/80 sm:text-lg">Our health assistant can listen to your concerns, share general information, and help connect you with the Karma Ayurveda team.</p>
          <button onClick={() => window.dispatchEvent(new Event('open-health-chat'))} className="mt-8 rounded-full bg-lime-300 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-lime-200">Start a conversation</button>
        </div>
        <div className="hidden justify-center md:flex">
          <div className="flex h-64 w-64 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[0_0_100px_-24px_rgba(190,242,100,.3)]">
            <div className="flex h-44 w-44 items-center justify-center rounded-full border border-lime-200/30 bg-gradient-to-br from-emerald-700 to-emerald-950 text-center shadow-inner"><div><span className="text-5xl">✳</span><p className="mt-2 text-xs font-medium tracking-wide text-emerald-100">CARE THAT LISTENS</p></div></div>
          </div>
        </div>
      </section>
      <section className="relative mx-auto grid max-w-6xl gap-5 px-6 pb-24 sm:grid-cols-3">
        {[
          ['Start with your concern', 'Describe what you’ve been experiencing in your own words.'],
          ['Get a helpful next step', 'The assistant can offer general information and guide the conversation.'],
          ['Connect with our team', 'If you choose, share your contact details so our team can follow up.'],
        ].map(([title, copy], index) => <article key={title} className="rounded-2xl border border-emerald-950/5 bg-white p-6 shadow-[0_12px_36px_-24px_rgba(15,72,54,.35)]"><span className="text-xs font-semibold text-emerald-700">0{index + 1}</span><h2 className="mt-3 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></article>)}
      </section>
      <footer className="border-t border-emerald-950/5 px-6 py-6 text-center text-xs text-slate-500">This assistant provides general information and does not replace a qualified healthcare professional or emergency care.</footer>
    </main>
  );
}
