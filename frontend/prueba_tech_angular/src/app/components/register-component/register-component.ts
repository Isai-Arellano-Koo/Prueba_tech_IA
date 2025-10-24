import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClientService } from '../../services/clientService';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-component.html',
  styleUrls: ['./register-component.css'],
})
export class RegisterComponent implements OnInit {
  form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl<string>('', { nonNullable: true }),
    token: new FormControl<string>('', { nonNullable: true, validators: Validators.required }),
  });

  loadingToken = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(private sdk: ClientService) {}

  ngOnInit(): void {
    this.loadingToken = true;
    this.sdk.getToken().subscribe({
      next: (res: any) => {
        this.form.patchValue({ token: res.token ?? '' });
        this.loadingToken = false;
      },
      error: () => {
        this.loadingToken = false;
        this.message = 'Error al obtener token';
        this.messageType = 'error';
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      // Marcar todos los campos como tocados para mostrar errores
      this.form.markAllAsTouched();
      this.message = 'Por favor, corrige los errores del formulario.';
      this.messageType = 'error';
      return;
    }

    const clientData = this.form.getRawValue();

    this.sdk.registerClient(clientData).subscribe({
      next: (r: any) => {
        const name = clientData.name;
        const email = clientData.email;
        this.message = `Cliente registrado con éxito: ${name} (${email})`;
        this.messageType = 'success';
      },
      error: (e) => {
        this.message = 'Error registro: ' + (e?.error?.error || e.message);
        this.messageType = 'error';
      },
    });
  }
}
