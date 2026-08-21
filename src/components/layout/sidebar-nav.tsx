'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { can } from '@/lib/auth/roles';
import { NAV_ITEMS } from './nav-items';
import type { AppRole } from '@/types/database';

const SPRINT_COURANT = 8;

export function SidebarNav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => can(role, item.capability));

  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const actif = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const aVenir = item.sprint > SPRINT_COURANT;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={actif ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'h-touch rounded-suiton flex items-center justify-between gap-2 px-3 text-sm transition-colors',
              actif
                ? 'bg-ocean text-white'
                : 'text-mineral/80 hover:bg-abysse-80 hover:text-white',
            )}
          >
            <span className="truncate">{item.label}</span>
            {aVenir ? (
              <span className="text-mineral/60 shrink-0 rounded-full border border-white/20 px-1.5 text-[0.6875rem]">
                S{item.sprint}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
