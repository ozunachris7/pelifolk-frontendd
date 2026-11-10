import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, ClipboardList, Eye, X, Search } from 'lucide-angular';
import { Session } from '../../../core/auth/session';
import { apiError } from '../../../core/http/api-error';
import { Modal } from '../../../shared/ui/modal/modal';
import { hasPermission } from '../../users/domain/access';
import { AuditRepository } from '../infrastructure/audit-repository';
import {
  AuditAction,
  AuditActor,
  AuditDetail,
  AuditPage,
  actionLabel,
  auditModules,
  changeValue,
  entityLabel,
  fieldLabel,
  moduleLabel,
} from '../domain/audit';
@Component({
  selector: 'app-audit-list',
  imports: [DatePipe, ReactiveFormsModule, LucideAngularModule, Modal],
  templateUrl: './audit-list.html',
})
export class AuditList implements OnInit, OnDestroy {
  private readonly repo = inject(AuditRepository);
  private readonly session = inject(Session);
  private readonly fb = inject(FormBuilder);
  protected readonly canRead = computed(() => hasPermission(this.session.user(), 'audit:read'));
  protected readonly icons = { journal: ClipboardList, view: Eye, clear: X, search: Search };
  protected readonly modules = auditModules;
  protected readonly actionLabel = actionLabel;
  protected readonly moduleLabel = moduleLabel;
  protected readonly entityLabel = entityLabel;
  protected readonly fieldLabel = fieldLabel;
  protected readonly changeValue = changeValue;
  protected readonly filters = this.fb.nonNullable.group({
    q: ['', Validators.maxLength(100)],
    module: [''],
    action: ['' as AuditAction | ''],
    user_id: [''],
    date_from: [''],
    date_to: [''],
    record_id: [''],
    table: [''],
  });
  protected readonly actorSearch = this.fb.nonNullable.control('', Validators.maxLength(100));
  protected readonly actors = signal<AuditActor[]>([]);
  protected readonly actorsLoading = signal(false);
  protected readonly actorsError = signal('');
  protected readonly page = signal<AuditPage>({ items: [], total: 0, offset: 0, limit: 25 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly recordFilter = signal('');
  protected readonly open = signal(false);
  protected readonly detail = signal<AuditDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  private listRequest = 0;
  private actorRequest = 0;
  private detailRequest = 0;
  private destroyed = false;
  ngOnInit() {
    if (this.canRead()) {
      void this.load();
      void this.loadActors();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.actorRequest++;
    this.detailRequest++;
  }
  protected async load(offset = 0) {
    if (!this.canRead() || this.destroyed) return;
    const values = this.filters.getRawValue();
    this.filters.markAllAsTouched();
    if (this.filters.invalid) return;
    if (values.date_from && values.date_to && values.date_from > values.date_to) {
      this.error.set('La fecha inicial debe ser anterior o igual a la final.');
      return;
    }
    const request = ++this.listRequest;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.repo.list(values, offset);
      if (request === this.listRequest) this.page.set(page);
    } catch (e) {
      if (request === this.listRequest)
        this.error.set(apiError(e, 'No se pudo cargar la auditoría.'));
    } finally {
      if (request === this.listRequest) this.loading.set(false);
    }
  }
  protected reset() {
    this.filters.reset({
      q: '',
      module: '',
      action: '',
      user_id: '',
      date_from: '',
      date_to: '',
      record_id: '',
      table: '',
    });
    this.recordFilter.set('');
    void this.load();
  }
  protected async loadActors() {
    if (!this.canRead() || this.destroyed || this.actorSearch.invalid) return;
    const request = ++this.actorRequest;
    this.actorsLoading.set(true);
    this.actorsError.set('');
    try {
      const actors = await this.repo.users(this.actorSearch.value.trim());
      if (request === this.actorRequest) {
        const selected = this.actors().find((a) => a.id === this.filters.controls.user_id.value);
        this.actors.set(
          selected && !actors.some((a) => a.id === selected.id) ? [selected, ...actors] : actors,
        );
      }
    } catch (e) {
      if (request === this.actorRequest)
        this.actorsError.set(apiError(e, 'No se pudieron cargar los usuarios del historial.'));
    } finally {
      if (request === this.actorRequest) this.actorsLoading.set(false);
    }
  }
  protected async show(id: string) {
    if (!this.canRead() || this.destroyed) return;
    const request = ++this.detailRequest;
    this.open.set(true);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const detail = await this.repo.detail(id);
      if (request === this.detailRequest) this.detail.set(detail);
    } catch (e) {
      if (request === this.detailRequest)
        this.detailError.set(apiError(e, 'No se pudo cargar el detalle del cambio.'));
    } finally {
      if (request === this.detailRequest) this.detailLoading.set(false);
    }
  }
  protected close() {
    this.detailRequest++;
    this.open.set(false);
  }
  protected recordHistory(detail: AuditDetail) {
    this.filters.reset({
      q: '',
      module: '',
      action: '',
      user_id: '',
      date_from: '',
      date_to: '',
      record_id: detail.record_id,
      table: detail.table,
    });
    this.recordFilter.set(
      `${entityLabel(detail)} · ${detail.record_name || detail.record_id.slice(0, 8)}`,
    );
    this.close();
    void this.load();
  }
}
