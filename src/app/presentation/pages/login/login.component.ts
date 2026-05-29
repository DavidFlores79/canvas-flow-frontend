import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../application/stores/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  protected showPassword = false;

  constructor() {
    this.authStore.error.set(null);
  }

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    await this.authStore.signIn({ email: email!, password: password! });
  }
}
