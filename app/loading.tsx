import Image from "next/image";

export default function Loading() {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 h-14 w-14 overflow-hidden rounded-2xl sm:h-16 sm:w-16">
          <Image
            src="/logo.png"
            alt="Internships logo"
            width={64}
            height={64}
            className="h-full w-full object-cover"
            priority
          />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Internships
        </h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">Loading your workspace...</p>

        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-700 [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-700 [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-700" />
        </div>
      </div>
    </section>
  );
}
