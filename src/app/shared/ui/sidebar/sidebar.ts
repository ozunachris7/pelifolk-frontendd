import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import {
  ChevronDown,
  Layers,
  ListChecks,
  ShieldCheck,
  Wallet,
  LucideAngularModule,
} from 'lucide-angular';
import { navigationFor } from './navigation';
import { Session } from '../../../core/auth/session';

const GROUPS = [
  {
    id: 'herd',
    label: 'Hato',
    icon: Layers,
    paths: ['animals', 'genealogy', 'breeds', 'groups', 'locations'],
  },
  {
    id: 'operations',
    label: 'Operación',
    icon: ListChecks,
    paths: ['management', 'health', 'breeding', 'feeding'],
  },
  { id: 'economy', label: 'Economía', icon: Wallet, paths: ['finance', 'exits'] },
  {
    id: 'administration',
    label: 'Administración',
    icon: ShieldCheck,
    paths: ['users', 'roles', 'audit'],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  readonly navigate = output<void>();
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly chevron = ChevronDown;
  protected readonly openGroup = signal<string | null>(null);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );
  private readonly items = computed(() => navigationFor(this.session.user()?.permissions ?? []));
  protected readonly overview = computed(() =>
    this.items().find((item) => item.path === 'overview'),
  );
  protected readonly reports = computed(() => this.items().find((item) => item.path === 'reports'));
  protected readonly groups = computed(() =>
    GROUPS.map((group) => ({
      ...group,
      items: group.paths.flatMap((path) => {
        const item = this.items().find((item) => item.path === path);
        return item
          ? [
              {
                ...item,
                label:
                  path === 'management'
                    ? 'Pesajes'
                    : path === 'finance'
                      ? 'Movimientos'
                      : item.label,
              },
            ]
          : [];
      }),
    })).filter((group) => group.items.length > 0),
  );

  constructor() {
    // Route or permission changes select the appropriate section, without fighting manual collapse.
    effect(() => {
      const current = this.path();
      const group = this.groups().find((group) =>
        group.items.some(
          (item) =>
            current === '/dashboard/' + item.path ||
            current.startsWith('/dashboard/' + item.path + '/'),
        ),
      );
      this.openGroup.set(group?.id ?? null);
    });
  }

  protected active(path: string): boolean {
    return (
      this.path() === '/dashboard/' + path || this.path().startsWith('/dashboard/' + path + '/')
    );
  }

  protected toggle(group: string): void {
    this.openGroup.update((current) => (current === group ? null : group));
  }
}
