import Image from "next/image";

export default function Loading() {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-5 h-16 w-16 overflow-hidden rounded-2xl border border-slate-200">
          <Image
            src="/logo.png"
            alt="Internships logo"
            width={64}
            height={64}
            className="h-full w-full object-cover"
            priority
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">
          Internships
        </h1>
        <p className="mt-2 text-sm text-slate-600">Loading your workspace...</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-900 [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-900 [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-900" />
        </div>
      </div>
    </section>
  );
}