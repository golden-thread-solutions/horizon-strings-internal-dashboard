"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { liquidSwitch } from "@/lib/theme-transition";

export function motionReduced() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "reduced"
  );
}

export function WorkspaceNavigation({ items }: { items: string[][] }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[aria-current="page"]');
      if (active)
        setPosition({
          x: active.offsetLeft,
          y: active.offsetTop,
          width: active.offsetWidth,
          height: active.offsetHeight,
        });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [path]);
  return (
    <nav ref={nav} className="workspace-navigation" aria-label="Workspace">
      {position && (
        <span
          aria-hidden="true"
          className="navigation-selection"
          style={{
            width: position.width,
            height: position.height,
            transform: `translate(${position.x}px,${position.y}px)`,
          }}
        />
      )}
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (
              href === "/"
                ? path === "/" ||
                  path.startsWith("/clients") ||
                  path.startsWith("/enquiries") ||
                  path === "/archive" ||
                  path === "/trash"
                : path.startsWith(href)
            )
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function WorkspaceMotion({ children }: { children: ReactNode }) {
  const path = usePathname();
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = main.current;
    if (!node || motionReduced()) return;
    const animations: Animation[] = [];
    const animate = (
      el: Element | null,
      delay: number,
      duration: number,
      distance: number,
    ) => {
      if (el)
        animations.push(
          el.animate(
            [
              { opacity: 0, transform: `translateY(${distance}px)` },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration,
              delay,
              easing: "cubic-bezier(.22,1,.36,1)",
              fill: "backwards",
            },
          ),
        );
    };
    // Route changes reveal primary work before its supporting controls. Saves do
    // not replay this entrance or move the owner's scroll position.
    animate(node.querySelector(".page-head"), 0, 650, 14);
    animate(
      node.querySelector(".event-board, .section, .table-wrap, .save-bar"),
      110,
      750,
      18,
    );
    animate(node.querySelector(".board-toolbar, .section-nav"), 190, 650, 8);
    animate(node.querySelector(".lost-enquiries"), 260, 650, 10);
    return () => animations.forEach((a) => a.cancel());
  }, [path]);
  return (
    <div ref={main} className="motion-page">
      {children}
    </div>
  );
}

export function BoardTitle() {
  return (
    <h1 className="word-title" aria-label="Events & enquiries">
      {["Events", "&", "enquiries"].map((word, i) => (
        <span
          key={word}
          aria-hidden="true"
          style={{ animationDelay: `${i * 85}ms` }}
        >
          {word}
          {i < 2 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    try {
      const value = localStorage.getItem("horizon-workspace-theme") === "dark";
      setDark(value);
      document.documentElement.dataset.theme = value ? "dark" : "light";
    } catch {}
  }, []);
  return (
    <button
      className="theme-toggle"
      aria-pressed={dark}
      onClick={async (e) => {
        if (running.current) return;
        running.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX || rect.left + rect.width / 2,
          y = e.clientY || rect.top + rect.height / 2;
        try {
          await liquidSwitch(x, y, () => {
            flushSync(() => setDark(!dark));
            document.documentElement.dataset.theme = dark ? "light" : "dark";
            try {
              localStorage.setItem(
                "horizon-workspace-theme",
                dark ? "light" : "dark",
              );
            } catch {}
          });
        } finally {
          running.current = false;
        }
      }}
    >
      <span aria-hidden="true">{dark ? "☀" : "◐"}</span>{" "}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
