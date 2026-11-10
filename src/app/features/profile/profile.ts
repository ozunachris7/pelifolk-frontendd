import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { LucideAngularModule, Camera, Upload, UserRound, PencilLine } from 'lucide-angular';
import { API_URL } from '../../core/http/api-url';
import { Session, SessionUser } from '../../core/auth/session';
import { apiError } from '../../core/http/api-error';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-profile',
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './profile.html',
})
export class Profile implements OnDestroy {
  protected readonly session = inject(Session);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  protected readonly camera = Camera;
  protected readonly upload = Upload;
  protected readonly userIcon = UserRound;
  protected readonly selected = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly failedPhoto = signal<string | null>(null);
  protected readonly editIcon = PencilLine;
  protected readonly editing = signal(false);
  protected readonly savingInfo = signal(false);
  protected readonly locked = computed(() => this.busy() || this.savingInfo());
  protected readonly infoError = signal('');
  protected readonly infoSuccess = signal('');
  private readonly fb = inject(FormBuilder);
  protected readonly infoForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    middle_name: ['', Validators.maxLength(120)],
    paternal_lastname: [
      '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    ],
    maternal_lastname: [
      '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    phone: ['', Validators.maxLength(30)],
  });
  protected readonly fields = [
    {
      key: 'name',
      label: 'Nombre',
      required: true,
      type: 'text',
      max: 120,
      autocomplete: 'given-name',
    },
    {
      key: 'middle_name',
      label: 'Segundo nombre',
      required: false,
      type: 'text',
      max: 120,
      autocomplete: 'additional-name',
    },
    {
      key: 'paternal_lastname',
      label: 'Apellido paterno',
      required: true,
      type: 'text',
      max: 120,
      autocomplete: 'family-name',
    },
    {
      key: 'maternal_lastname',
      label: 'Apellido materno',
      required: true,
      type: 'text',
      max: 120,
      autocomplete: 'off',
    },
    {
      key: 'email',
      label: 'Correo',
      required: true,
      type: 'email',
      max: 190,
      autocomplete: 'email',
    },
    { key: 'phone', label: 'Teléfono', required: false, type: 'tel', max: 30, autocomplete: 'tel' },
  ] as const;

  protected editDetails(): void {
    const user = this.session.user();
    if (!user || this.locked()) return;
    this.infoForm.reset({
      name: user.name,
      middle_name: user.middle_name ?? '',
      paternal_lastname: user.paternal_lastname,
      maternal_lastname: user.maternal_lastname,
      email: user.email,
      phone: user.phone ?? '',
    });
    this.infoError.set('');
    this.infoSuccess.set('');
    this.editing.set(true);
  }

  protected cancelDetails(): void {
    if (this.locked()) return;
    this.editing.set(false);
    this.infoError.set('');
  }

  protected async saveDetails(): Promise<void> {
    if (this.locked()) return;
    this.infoForm.markAllAsTouched();
    if (this.infoForm.invalid) return;
    const user = this.session.user();
    if (!user) return;
    const raw = this.infoForm.getRawValue();
    const values = {
      name: raw.name.trim(),
      middle_name: raw.middle_name.trim() || null,
      paternal_lastname: raw.paternal_lastname.trim(),
      maternal_lastname: raw.maternal_lastname.trim(),
      email: raw.email.trim().toLowerCase(),
      phone: raw.phone.trim() || null,
    };
    const changes = Object.fromEntries(
      this.fields
        .filter(({ key }) => values[key] !== user[key])
        .map(({ key }) => [key, values[key]]),
    );
    if (!Object.keys(changes).length) {
      this.editing.set(false);
      return;
    }
    this.savingInfo.set(true);
    this.infoError.set('');
    try {
      const saved = await firstValueFrom(
        this.http.patch<SessionUser>(`${this.api}/profile`, changes).pipe(timeout(15_000)),
      );
      this.session.updateIdentity(saved);
      this.editing.set(false);
      this.infoSuccess.set('Información actualizada.');
    } catch (error) {
      this.infoError.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Ese correo ya está registrado. Utiliza otro correo.'
          : apiError(error, 'No se pudo guardar tu información. Intenta nuevamente.'),
      );
    } finally {
      this.savingInfo.set(false);
    }
  }

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.locked()) return;
    this.reset();
    this.success.set('');
    this.error.set('');
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('La foto no debe superar 5 MB.');
      return;
    }
    if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error.set('Selecciona una imagen JPEG, PNG o WebP.');
      return;
    }
    this.selected.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  protected reset(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.selected.set(null);
    this.preview.set(null);
  }

  protected async save(): Promise<void> {
    const file = this.selected();
    if (!file || this.locked()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    const data = new FormData();
    data.append('file', file);
    try {
      const user = await firstValueFrom(
        this.http.post<SessionUser>(`${this.api}/profile/photo`, data).pipe(timeout(60_000)),
      );
      this.session.updateIdentity(user);
      this.reset();
      this.success.set('Foto de perfil actualizada.');
    } catch (error) {
      const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 413
          ? 'La foto no debe superar 5 MB.'
          : error instanceof HttpErrorResponse && error.status === 422 && typeof detail === 'string'
            ? detail
            : apiError(
                error,
                'No se pudo actualizar la foto. Revisa tu conexión y vuelve a intentarlo.',
              ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    this.reset();
  }
}
