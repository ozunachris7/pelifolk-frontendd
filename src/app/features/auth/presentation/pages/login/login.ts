import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArrowRight, Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
import { Session } from '../../../../../core/auth/session';
import { TimeoutError } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly notice =
    this.route.snapshot.queryParamMap.get('reason') === 'password_changed'
      ? 'Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.'
      : this.route.snapshot.queryParamMap.get('reason') === 'expired'
        ? 'Tu sesión terminó. Inicia sesión nuevamente.'
        : '';
  protected readonly showPassword = signal(false);
  protected readonly error = signal('');
  protected readonly submitting = signal(false);
  protected readonly eyeIcon = Eye;
  protected readonly eyeOffIcon = EyeOff;
  protected readonly arrowIcon = ArrowRight;
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination =
      requested && (requested === '/dashboard' || requested.startsWith('/dashboard/'))
        ? requested
        : '/dashboard/overview';
    try {
      await this.session.login(email, password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.error.set('El correo o la contraseña son incorrectos.');
      } else if (
        error instanceof TimeoutError ||
        (error instanceof HttpErrorResponse && error.status === 0)
      ) {
        this.error.set('No se pudo conectar con el servidor. Intenta nuevamente.');
      } else if (error instanceof HttpErrorResponse && error.status === 422) {
        this.error.set('Revisa el correo y la contraseña.');
      } else if (error instanceof HttpErrorResponse && error.status === 429) {
        this.error.set('Demasiados intentos. Espera unos segundos y vuelve a intentarlo.');
      } else {
        this.error.set('No se pudo iniciar sesión. Intenta nuevamente.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
