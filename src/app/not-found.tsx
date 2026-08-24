import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-zinc-900">404</h1>
        <p className="mt-2 text-lg text-zinc-600">Page not found</p>
        <Link href="/board" className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700">
          Go to pipeline
        </Link>
      </div>
    </div>
  );
}