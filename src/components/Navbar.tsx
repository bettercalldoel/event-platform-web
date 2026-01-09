"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

function navClass(active: boolean) {
  return [
    "px-3 py-2 rounded-lg text-sm border font-medium transition",
    active
      ? "bg-(--primary)/25 border-(--primary)/40 text-white"
      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1220]/70 backdrop-blur shadow-[0_16px_36px_-28px_rgba(2,6,23,0.95)]">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="text-lg font-semibold tracking-wide select-none">
          <span className="text-(--primary)">Aqua</span>
          <span className="text-white">Event</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Organizer */}
          {user?.role === "ORGANIZER" && (
            <>
              <Link className={navClass(isActive("/organizer"))} href="/organizer">
                Organizer
              </Link>

              <Link
                className={[
                  "px-3 py-2 rounded-lg text-sm border transition",
                  isActive("/organizer/events/new")
                    ? "bg-(--accent)/25 border-(--accent)/40"
                    : "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40",
                ].join(" ")}
                href="/organizer/events/new"
              >
                Create Event
              </Link>
            </>
          )}

          {/* Customer */}
          {user?.role === "CUSTOMER" && (
            <Link
              className={navClass(isActive("/customer") || pathname === "/transactions")}
              href="/customer"
            >
              Dashboard
            </Link>
          )}

          {/* Auth area */}
          {user ? (
            <>
              <div className="hidden sm:block text-sm text-(--subtext)">
                Hi, <span className="text-white">{user.name}</span>
              </div>

              <button
                onClick={logout}
                className="px-3 py-2 rounded-lg text-sm border bg-(--accent)/20 hover:bg-(--accent)/30 border-(--accent)/40 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className={navClass(isActive("/login"))} href="/login">
                Login
              </Link>

              <Link
                className={[
                  "px-3 py-2 rounded-lg text-sm border transition",
                  isActive("/register")
                    ? "bg-(--primary)/25 border-(--primary)/40"
                    : "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40",
                ].join(" ")}
                href="/register"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
