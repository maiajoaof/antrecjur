import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function makeClient(url: string, key: string) {
  const cookieStore = cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cs: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          )
        } catch {
          // Ignorado em Server Components — apenas Route Handlers podem setar cookies
        }
      },
    },
  })
}

export function createServerSupabase() {
  return makeClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createAdminSupabase() {
  return makeClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
