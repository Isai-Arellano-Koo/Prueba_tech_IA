import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { RegisterComponent } from './components/register-component/register-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReactiveFormsModule, RegisterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('prueba_tech_angular');
}
